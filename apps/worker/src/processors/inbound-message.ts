import { Worker, type Job } from "bullmq";
import type IORedis from "ioredis";
import { prisma } from "@whatsapp-crm/db";
import { detectOptOut, normalizePhone } from "@whatsapp-crm/shared";
import { QUEUE_NAMES } from "@whatsapp-crm/shared";
import type { MessagingService } from "../services/messaging.js";
import { logger } from "../lib/logger.js";

const log = logger.child({ module: "inbound-message-processor" });

export interface InboundMessageJobData {
  fromPhone: string;
  body: string;
  timestamp: string; // ISO string
  providerMessageId: string;
}

export function startInboundMessageWorker(
  redis: IORedis,
  messagingService: MessagingService
) {
  // Register the inbound handler on the messaging service
  messagingService.onInboundMessage(async (inboundMsg) => {
    // Enqueue job so it can be processed reliably with BullMQ guarantees
    const { Queue } = await import("bullmq");
    const queue = new Queue<InboundMessageJobData>(QUEUE_NAMES.INBOUND_MESSAGE, {
      connection: redis,
    });

    await queue.add("process-inbound", {
      fromPhone: inboundMsg.fromPhone,
      body: inboundMsg.body,
      timestamp: inboundMsg.timestamp.toISOString(),
      providerMessageId: inboundMsg.providerMessageId,
    });
  });

  const worker = new Worker<InboundMessageJobData>(
    QUEUE_NAMES.INBOUND_MESSAGE,
    async (job: Job<InboundMessageJobData>) => {
      const { fromPhone, body, timestamp, providerMessageId } = job.data;
      log.info({ fromPhone, providerMessageId }, "Processing inbound message");

      // Normalize phone
      const normalized = normalizePhone(fromPhone);
      const phone = normalized.success ? normalized.e164! : fromPhone;

      // Find contact by phone
      const contact = await prisma.contact.findUnique({
        where: { phone },
      });

      if (!contact) {
        log.warn({ phone }, "Inbound message from unknown contact — ignoring");
        return;
      }

      // Idempotency: check if message already stored
      const existing = await prisma.message.findFirst({
        where: { providerMessageId },
      });
      if (existing) {
        log.info({ providerMessageId }, "Message already stored — skipping");
        return;
      }

      // Store message
      const message = await prisma.message.create({
        data: {
          contactId: contact.id,
          direction: "INBOUND",
          body,
          providerMessageId,
          createdAt: new Date(timestamp),
        },
      });

      // Create MessageEvent
      await prisma.messageEvent.create({
        data: {
          messageId: message.id,
          eventType: "DELIVERED",
        },
      });

      // Update contact auto messaging status = REPLIED
      await prisma.contact.update({
        where: { id: contact.id },
        data: { messagingStatus: "REPLIED" },
      });
      // NOTE: pipeline_stage is NOT changed automatically — human decides

      // Detect opt-out keywords
      if (detectOptOut(body)) {
        log.info({ phone }, "Opt-out detected — setting do_not_contact = true");
        await prisma.contact.update({
          where: { id: contact.id },
          data: { doNotContact: true },
        });
      }

      log.info(
        { contactId: contact.id, messageId: message.id },
        "Inbound message processed"
      );
    },
    {
      connection: redis,
      concurrency: 5,
    }
  );

  worker.on("failed", (job, err) => {
    log.error({ jobId: job?.id, err }, "Inbound message job failed");
  });

  log.info("Inbound message worker started");
  return worker;
}
