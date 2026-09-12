import { Worker, type Job } from "bullmq";
import type IORedis from "ioredis";
import { prisma } from "@whatsapp-crm/db";
import { QUEUE_NAMES } from "@whatsapp-crm/shared";
import type { MessagingService } from "../services/messaging.js";
import { logger } from "../lib/logger.js";

const log = logger.child({ module: "message-status-processor" });

export interface MessageStatusJobData {
  providerMessageId: string;
  toPhone: string;
  status: "SENT" | "DELIVERED" | "READ" | "FAILED";
  timestamp: string;
}

export function startMessageStatusWorker(
  redis: IORedis,
  messagingService: MessagingService
) {
  // Register status update handler
  messagingService.onMessageStatusUpdate(async (update) => {
    const { Queue } = await import("bullmq");
    const queue = new Queue<MessageStatusJobData>(QUEUE_NAMES.MESSAGE_STATUS, {
      connection: redis,
    });

    await queue.add("process-status", {
      providerMessageId: update.providerMessageId,
      toPhone: update.toPhone,
      status: update.status,
      timestamp: update.timestamp.toISOString(),
    });
  });

  const worker = new Worker<MessageStatusJobData>(
    QUEUE_NAMES.MESSAGE_STATUS,
    async (job: Job<MessageStatusJobData>) => {
      const { providerMessageId, status, timestamp } = job.data;

      log.info({ providerMessageId, status }, "Processing message status update");

      // Find the message by provider ID
      const message = await prisma.message.findFirst({
        where: { providerMessageId },
      });

      if (!message) {
        log.warn({ providerMessageId }, "Message not found for status update");
        return;
      }

      // Create MessageEvent audit trail entry
      await prisma.messageEvent.create({
        data: {
          messageId: message.id,
          eventType: status === "READ" ? "READ" : status === "DELIVERED" ? "DELIVERED" : status === "FAILED" ? "FAILED" : "SENT",
          metadata: { timestamp },
        },
      });

      // Update CampaignContact if this was a campaign message
      if (status === "DELIVERED") {
        await prisma.campaignContact.updateMany({
          where: { providerMessageId },
          data: {
            sendStatus: "DELIVERED",
            deliveredAt: new Date(timestamp),
          },
        });

        // Update contact messaging status
        await prisma.contact.update({
          where: { id: message.contactId },
          data: { messagingStatus: "DELIVERED" },
        });
      }

      if (status === "FAILED") {
        await prisma.campaignContact.updateMany({
          where: { providerMessageId },
          data: {
            sendStatus: "FAILED",
            failedAt: new Date(timestamp),
          },
        });

        await prisma.contact.update({
          where: { id: message.contactId },
          data: { messagingStatus: "FAILED" },
        });
      }

      log.info({ providerMessageId, status }, "Status update processed");
    },
    {
      connection: redis,
      concurrency: 10,
    }
  );

  worker.on("failed", (job, err) => {
    log.error({ jobId: job?.id, err }, "Message status job failed");
  });

  log.info("Message status worker started");
  return worker;
}
