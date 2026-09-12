import { Worker, type Job } from "bullmq";
import type IORedis from "ioredis";
import { prisma } from "@whatsapp-crm/db";
import { renderTemplate, detectOptOut } from "@whatsapp-crm/shared";
import { QUEUE_NAMES } from "@whatsapp-crm/shared";
import type { MessagingService } from "../services/messaging.js";
import { logger } from "../lib/logger.js";

const log = logger.child({ module: "campaign-send-processor" });

export interface CampaignSendJobData {
  campaignId: string;
  contactId: string;
  campaignContactId: string;
}

/**
 * Campaign Send Processor
 *
 * Critical requirements:
 * 1. IDEMPOTENT — check send_status before sending, terminate if already SENT
 * 2. ELIGIBILITY — check do_not_contact, archived, campaign status before sending
 * 3. RATE LIMITED — delay is applied by BullMQ job options (set at enqueue time)
 */
export function startCampaignSendWorker(
  redis: IORedis,
  messagingService: MessagingService
) {
  const worker = new Worker<CampaignSendJobData>(
    QUEUE_NAMES.CAMPAIGN_SEND,
    async (job: Job<CampaignSendJobData>) => {
      const { campaignId, contactId, campaignContactId } = job.data;

      const ctx = { campaignId, contactId, campaignContactId, jobId: job.id };
      log.info(ctx, "Processing campaign send job");

      // ── Step 1: Idempotency check ─────────────────────────
      const campaignContact = await prisma.campaignContact.findUnique({
        where: { id: campaignContactId },
        include: {
          contact: true,
          campaign: true,
        },
      });

      if (!campaignContact) {
        log.warn(ctx, "CampaignContact not found — skipping");
        return;
      }

      // Already sent — do not resend
      if (
        campaignContact.sendStatus === "SENT" ||
        campaignContact.sendStatus === "DELIVERED"
      ) {
        log.info(ctx, "Already sent — idempotency check passed, terminating");
        return;
      }

      // Already permanently failed or skipped
      if (
        campaignContact.sendStatus === "FAILED" ||
        campaignContact.sendStatus === "SKIPPED"
      ) {
        log.info(ctx, "Already in terminal state — skipping");
        return;
      }

      const { contact, campaign } = campaignContact;

      // ── Step 2: Eligibility checks ────────────────────────

      // Check if contact is archived
      if (contact.archivedAt) {
        log.warn(ctx, "Contact is archived — skipping");
        await markSkipped(campaignContactId, "Contact archived");
        return;
      }

      // Check do_not_contact — ALWAYS wins
      if (contact.doNotContact) {
        log.warn(ctx, "Contact has do_not_contact = true — skipping");
        await markSkipped(campaignContactId, "Do not contact");
        return;
      }

      // Check campaign status
      if (campaign.status === "PAUSED" || campaign.status === "FAILED") {
        log.warn({ ...ctx, campaignStatus: campaign.status }, "Campaign is paused/failed — terminating job");
        return; // Don't mark skipped — can resume
      }

      if (campaign.status === "COMPLETED") {
        log.warn(ctx, "Campaign already completed — skipping");
        return;
      }

      // Check provider connection
      if (!messagingService.isConnected()) {
        log.error(ctx, "WhatsApp provider not connected — pausing campaign");
        await pauseCampaign(campaignId);
        throw new Error("Provider disconnected — job will be retried");
      }

      // ── Step 3: Render message ────────────────────────────
      const body = renderTemplate(campaign.messageTemplate, {
        name: contact.name,
        company: contact.company,
      });

      // ── Step 4: Send ──────────────────────────────────────
      const result = await messagingService.sendMessage(contact.phone, body);

      if (result.success && result.providerMessageId) {
        // Update CampaignContact to SENT
        await prisma.campaignContact.update({
          where: { id: campaignContactId },
          data: {
            sendStatus: "SENT",
            sentAt: new Date(),
            providerMessageId: result.providerMessageId,
          },
        });

        // Create Message log
        const message = await prisma.message.create({
          data: {
            contactId,
            campaignId,
            direction: "OUTBOUND",
            body,
            providerMessageId: result.providerMessageId,
          },
        });

        // Create MessageEvent audit trail
        await prisma.messageEvent.create({
          data: {
            messageId: message.id,
            eventType: "SENT",
          },
        });

        // Update contact messaging status
        await prisma.contact.update({
          where: { id: contactId },
          data: { messagingStatus: "SENT" },
        });

        log.info(
          { ...ctx, providerMessageId: result.providerMessageId },
          "Message sent successfully"
        );
      } else {
        // Permanent failure — mark failed
        await prisma.campaignContact.update({
          where: { id: campaignContactId },
          data: {
            sendStatus: "FAILED",
            failedAt: new Date(),
            errorReason: result.error || "Unknown error",
          },
        });

        // Update contact messaging status
        await prisma.contact.update({
          where: { id: contactId },
          data: { messagingStatus: "FAILED" },
        });

        log.error({ ...ctx, error: result.error }, "Message send failed");
      }
    },
    {
      connection: redis,
      concurrency: 1, // Process one at a time to respect rate limits
    }
  );

  worker.on("failed", (job, err) => {
    log.error({ jobId: job?.id, err }, "Campaign send job failed");
  });

  log.info("Campaign send worker started");
  return worker;
}

async function markSkipped(campaignContactId: string, reason: string) {
  await prisma.campaignContact.update({
    where: { id: campaignContactId },
    data: {
      sendStatus: "SKIPPED",
      errorReason: reason,
    },
  });
}

async function pauseCampaign(campaignId: string) {
  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: "PAUSED" },
  });
}
