/**
 * CloudApiProvider — Meta's Official WhatsApp Business Cloud API
 *
 * This is a stub for future production migration.
 * Activated when WHATSAPP_PROVIDER=cloud-api
 */

import type {
  WhatsAppProvider,
  WhatsAppConnectionState,
  SendMessageResult,
  InboundMessage,
  MessageStatusUpdate,
} from "./provider.js";

export class CloudApiProvider implements WhatsAppProvider {
  private connected = false;
  private inboundHandlers: Array<(msg: InboundMessage) => Promise<void>> = [];
  private statusHandlers: Array<(update: MessageStatusUpdate) => Promise<void>> = [];
  private stateHandlers: Array<(state: WhatsAppConnectionState, qrCode?: string) => void> = [];

  constructor(
    private readonly accessToken: string,
    private readonly phoneNumberId: string,
    private readonly verifyToken: string
  ) {}

  async connect(): Promise<void> {
    // Cloud API is stateless — just validate credentials
    if (!this.accessToken || !this.phoneNumberId) {
      throw new Error("CloudApiProvider requires META_ACCESS_TOKEN and META_PHONE_NUMBER_ID");
    }
    this.connected = true;
    this.stateHandlers.forEach((h) => h("CONNECTED"));
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.stateHandlers.forEach((h) => h("DISCONNECTED"));
  }

  getConnectionState(): WhatsAppConnectionState {
    return this.connected ? "CONNECTED" : "DISCONNECTED";
  }

  isConnected(): boolean {
    return this.connected;
  }

  async healthCheck(): Promise<boolean> {
    return this.connected;
  }

  async sendMessage(phone: string, body: string): Promise<SendMessageResult> {
    if (!this.isConnected()) {
      return { success: false, error: "Cloud API provider not connected" };
    }

    try {
      const url = `https://graph.facebook.com/v18.0/${this.phoneNumberId}/messages`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: phone.replace("+", ""),
          type: "text",
          text: { body },
        }),
      });

      const data = await response.json() as { messages?: Array<{ id: string }>; error?: { message: string } };

      if (!response.ok) {
        return {
          success: false,
          error: data.error?.message || `HTTP ${response.status}`,
        };
      }

      return {
        success: true,
        providerMessageId: data.messages?.[0]?.id,
      };
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : String(err);
      return { success: false, error };
    }
  }

  onInboundMessage(handler: (message: InboundMessage) => Promise<void>): void {
    this.inboundHandlers.push(handler);
  }

  onMessageStatusUpdate(
    handler: (update: MessageStatusUpdate) => Promise<void>
  ): void {
    this.statusHandlers.push(handler);
  }

  onConnectionStateChange(
    handler: (state: WhatsAppConnectionState, qrCode?: string) => void
  ): void {
    this.stateHandlers.push(handler);
  }

  /**
   * Handle incoming webhook payload from Meta.
   * Call this from the webhook endpoint in Next.js.
   */
  async handleWebhook(payload: unknown): Promise<void> {
    const data = payload as {
      entry?: Array<{
        changes?: Array<{
          value?: {
            messages?: Array<{
              from: string;
              id: string;
              timestamp: string;
              type: string;
              text?: { body: string };
            }>;
            statuses?: Array<{
              id: string;
              recipient_id: string;
              status: string;
              timestamp: string;
            }>;
          };
        }>;
      }>;
    };

    for (const entry of data.entry || []) {
      for (const change of entry.changes || []) {
        const value = change.value;
        if (!value) continue;

        // Inbound messages
        for (const msg of value.messages || []) {
          if (msg.type === "text" && msg.text?.body) {
            const inbound: InboundMessage = {
              fromPhone: `+${msg.from}`,
              body: msg.text.body,
              timestamp: new Date(parseInt(msg.timestamp) * 1000),
              providerMessageId: msg.id,
            };
            for (const handler of this.inboundHandlers) {
              await handler(inbound);
            }
          }
        }

        // Status updates
        for (const status of value.statuses || []) {
          const statusMap: Record<string, "SENT" | "DELIVERED" | "READ" | "FAILED"> = {
            sent: "SENT",
            delivered: "DELIVERED",
            read: "READ",
            failed: "FAILED",
          };
          const mappedStatus = statusMap[status.status];
          if (mappedStatus) {
            const update: MessageStatusUpdate = {
              providerMessageId: status.id,
              toPhone: `+${status.recipient_id}`,
              status: mappedStatus,
              timestamp: new Date(parseInt(status.timestamp) * 1000),
            };
            for (const handler of this.statusHandlers) {
              await handler(update);
            }
          }
        }
      }
    }
  }
}
