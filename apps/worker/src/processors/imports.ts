import { Worker, type Job } from "bullmq";
import type IORedis from "ioredis";
import { prisma } from "@whatsapp-crm/db";
import { normalizePhone } from "@whatsapp-crm/shared";
import { QUEUE_NAMES } from "@whatsapp-crm/shared";
import { logger } from "../lib/logger.js";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import { createClient } from "@supabase/supabase-js";

const log = logger.child({ module: "imports-processor" });

export interface ImportJobData {
  batchId: string;
  storageKey: string;
  columnMapping: Record<string, string>;
  tagName?: string;
  defaultCountryCode: string;
}

export function startImportWorker(redis: IORedis) {
  const worker = new Worker<ImportJobData>(
    QUEUE_NAMES.IMPORTS,
    async (job: Job<ImportJobData>) => {
      const { batchId, storageKey, columnMapping, tagName, defaultCountryCode } =
        job.data;
      const ctx = { batchId };
      log.info(ctx, "Starting import job");

      // Update batch status to PARSING
      await prisma.importBatch.update({
        where: { id: batchId },
        data: { status: "PARSING" },
      });

      try {
        // Download file from Supabase Storage
        const supabase = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const { data: fileData, error: downloadError } = await supabase.storage
          .from("imports")
          .download(storageKey);

        if (downloadError || !fileData) {
          throw new Error(`Failed to download import file: ${downloadError?.message}`);
        }

        const buffer = Buffer.from(await fileData.arrayBuffer());

        // Parse the file
        let rows: Record<string, unknown>[] = [];

        if (storageKey.endsWith(".csv")) {
          const csvText = buffer.toString("utf-8");
          const result = Papa.parse<Record<string, unknown>>(csvText, {
            header: true,
            skipEmptyLines: true,
          });
          rows = result.data;
        } else {
          // Excel parsing via SheetJS
          const workbook = XLSX.read(buffer, { type: "buffer", codepage: 65001 });
          const firstSheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[firstSheetName];
          rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
            defval: "",
            raw: false,
          });
        }

        // Update batch to VALIDATING
        await prisma.importBatch.update({
          where: { id: batchId },
          data: { status: "VALIDATING", totalRows: rows.length },
        });

        log.info({ ...ctx, totalRows: rows.length }, "File parsed, starting validation");

        // Get batch info for userId
        const batch = await prisma.importBatch.findUnique({
          where: { id: batchId },
        });
        if (!batch) throw new Error("Batch not found");

        const existingContacts = await prisma.contact.findMany({
          select: { id: true, phone: true },
        });
        const phoneToContactId = new Map(existingContacts.map((c: { id: string; phone: string }) => [c.phone, c.id]));
        const existingPhones = new Set(existingContacts.map((c: { phone: string }) => c.phone));
        const existingContactIdsToTag: string[] = [];

        // Ensure tag exists if tagName provided
        let tagId: string | undefined;
        if (tagName) {
          const tag = await prisma.tag.upsert({
            where: { name: tagName },
            update: {},
            create: { name: tagName },
          });
          tagId = tag.id;
        }

        let validCount = 0;
        let invalidCount = 0;
        let duplicateCount = 0;
        const contactsToInsert: Array<{
          userId: string;
          name: string;
          phone: string;
          company?: string;
          email?: string;
          source?: string;
          notes?: string;
          importBatchId: string;
        }> = [];

        for (const row of rows) {
          // Map columns using the provided mapping
          const rawPhone = String(row[columnMapping["phone"] || "phone"] || "");
          const rawName = String(row[columnMapping["name"] || "name"] || "").trim();
          const rawCompany = String(row[columnMapping["company"] || ""] || "").trim();
          const rawEmail = String(row[columnMapping["email"] || ""] || "").trim();
          const rawSource = String(row[columnMapping["source"] || ""] || "").trim();
          const rawNotes = String(row[columnMapping["notes"] || ""] || "").trim();

          // Validate name
          if (!rawName) {
            invalidCount++;
            continue;
          }

          // Normalize phone
          const phoneResult = normalizePhone(
            rawPhone,
            defaultCountryCode as Parameters<typeof normalizePhone>[1]
          );

          if (!phoneResult.success || !phoneResult.e164) {
            invalidCount++;
            log.debug({ rawPhone, error: phoneResult.error }, "Invalid phone number");
            continue;
          }

          const e164Phone = phoneResult.e164;

          // Deduplication
          if (existingPhones.has(e164Phone)) {
            duplicateCount++;
            const existingId = phoneToContactId.get(e164Phone);
            if (tagId && existingId) {
              existingContactIdsToTag.push(String(existingId));
            }
            continue;
          }

          // Add to local set to catch duplicates within this batch
          existingPhones.add(e164Phone);

          contactsToInsert.push({
            userId: batch.userId,
            name: rawName,
            phone: e164Phone,
            company: rawCompany || undefined,
            email: rawEmail || undefined,
            source: rawSource || undefined,
            notes: rawNotes || undefined,
            importBatchId: batchId,
          });

          validCount++;
        }

        // Tag existing duplicate contacts if tag was provided
        if (tagId && existingContactIdsToTag.length > 0) {
          const uniqueIds = Array.from(new Set(existingContactIdsToTag));
          for (const contactId of uniqueIds) {
            await prisma.contactTag.upsert({
              where: { contactId_tagId: { contactId, tagId } },
              update: {},
              create: { contactId, tagId },
            });
          }
          log.info({ ...ctx, taggedExisting: uniqueIds.length }, "Tagged existing duplicate contacts with batch tag");
        }

        // Bulk insert contacts
        if (contactsToInsert.length > 0) {
          const created = await prisma.$transaction(
            contactsToInsert.map((contact) =>
              prisma.contact.create({
                data: {
                  ...contact,
                  contactTags: tagId
                    ? { create: { tagId } }
                    : undefined,
                },
              })
            )
          );
          log.info({ ...ctx, inserted: created.length }, "Contacts inserted");
        }

        // Update batch to COMMITTED
        await prisma.importBatch.update({
          where: { id: batchId },
          data: {
            status: "COMMITTED",
            validRows: validCount,
            invalidRows: invalidCount,
            duplicateRows: duplicateCount,
            completedAt: new Date(),
          },
        });

        log.info(
          { ...ctx, validCount, invalidCount, duplicateCount },
          "Import completed successfully"
        );
      } catch (err) {
        log.error({ ...ctx, err }, "Import failed");
        await prisma.importBatch.update({
          where: { id: batchId },
          data: {
            status: "FAILED",
            errorMessage: err instanceof Error ? err.message : String(err),
            completedAt: new Date(),
          },
        });
        throw err; // Re-throw for BullMQ retry
      }
    },
    {
      connection: redis,
      concurrency: 2,
    }
  );

  worker.on("failed", (job, err) => {
    log.error({ jobId: job?.id, err }, "Import job failed");
  });

  log.info("Import worker started");
  return worker;
}
