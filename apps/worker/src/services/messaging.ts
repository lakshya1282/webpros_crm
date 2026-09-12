import type { WhatsAppProvider } from "@whatsapp-crm/whatsapp";
import { logger } from "../lib/logger.js";

const log = logger.child({ module: "messaging-service" });

/**
 * MessagingService — the only layer that touches the WhatsApp provider.
 * CRM code (workers, processors) must call this service, never the provider directly.
 */
export class MessagingService {
  constructor(private readonly provider: WhatsAppProvider) {}

  async connect(): Promise<void> {
    log.info("Connecting WhatsApp provider...");
    await this.provider.connect();
  }

  async disconnect(): Promise<void> {
    log.info("Disconnecting WhatsApp provider...");
    await this.provider.disconnect();
  }

  isConnected(): boolean {
    return this.provider.isConnected();
  }

  getConnectionState() {
    return this.provider.getConnectionState();
  }

  async sendMessage(
    phone: string,
    body: string
  ): Promise<{ success: boolean; providerMessageId?: string; error?: string }> {
    log.info({ phone }, "Sending message");
    const result = await this.provider.sendMessage(phone, body);
    if (!result.success) {
      log.error({ phone, error: result.error }, "Send failed");
    }
    return result;
  }

  onInboundMessage(
    handler: (msg: {
      fromPhone: string;
      body: string;
      timestamp: Date;
      providerMessageId: string;
    }) => Promise<void>
  ): void {
    this.provider.onInboundMessage(handler);
  }

  onMessageStatusUpdate(
    handler: (update: {
      providerMessageId: string;
      toPhone: string;
      status: "SENT" | "DELIVERED" | "READ" | "FAILED";
      timestamp: Date;
    }) => Promise<void>
  ): void {
    this.provider.onMessageStatusUpdate(handler);
  }

  onConnectionStateChange(
    handler: (
      state: string,
      qrCode?: string
    ) => void
  ): void {
    this.provider.onConnectionStateChange(handler);
  }
}
