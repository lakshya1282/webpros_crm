import "dotenv/config";
import { logger } from "./lib/logger.js";
import { createRedisConnection } from "./lib/redis.js";
import { createWhatsAppProvider } from "@whatsapp-crm/whatsapp";
import { startCampaignSendWorker } from "./processors/campaign-send.js";
import { startImportWorker } from "./processors/imports.js";
import { startInboundMessageWorker } from "./processors/inbound-message.js";
import { startMessageStatusWorker } from "./processors/message-status.js";
import { MessagingService } from "./services/messaging.js";

const log = logger.child({ module: "worker-main" });

async function main() {
  log.info("Starting WhatsApp CRM Worker...");

  // ── Redis connection ──────────────────────────────────────
  const redis = createRedisConnection();

  // ── WhatsApp provider ─────────────────────────────────────
  const provider = createWhatsAppProvider();
  const messagingService = new MessagingService(provider);

  // Connect the WhatsApp provider
  await messagingService.connect();

  // ── BullMQ workers ────────────────────────────────────────
  startCampaignSendWorker(redis, messagingService);
  startImportWorker(redis);
  startInboundMessageWorker(redis, messagingService);
  startMessageStatusWorker(redis, messagingService);

  log.info("All workers started. Waiting for jobs...");

  // ── Graceful shutdown ─────────────────────────────────────
  const shutdown = async (signal: string) => {
    log.info({ signal }, "Shutdown signal received");
    await messagingService.disconnect();
    redis.disconnect();
    log.info("Worker shut down gracefully.");
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  log.error({ err }, "Fatal worker error");
  process.exit(1);
});
