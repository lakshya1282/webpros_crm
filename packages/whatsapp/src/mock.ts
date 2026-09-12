/**
 * MockProvider — for development and testing.
 *
 * Simulates WhatsApp sends and inbound messages without connecting to a real account.
 * Activated when WHATSAPP_PROVIDER=mock
 */

import type {
  WhatsAppProvider,
  WhatsAppConnectionState,
  SendMessageResult,
  InboundMessage,
  MessageStatusUpdate,
} from "./provider.js";

export class MockProvider implements WhatsAppProvider {
  private state: WhatsAppConnectionState = "DISCONNECTED";
  private inboundHandlers: Array<(msg: InboundMessage) => Promise<void>> = [];
  private statusHandlers: Array<(update: MessageStatusUpdate) => Promise<void>> = [];
  private stateHandlers: Array<(state: WhatsAppConnectionState, qrCode?: string) => void> = [];
  private messageCounter = 0;

  async connect(): Promise<void> {
    this.state = "CONNECTING";
    this.emitStateChange("CONNECTING");

    // Simulate connection delay
    await new Promise((r) => setTimeout(r, 500));

    this.state = "CONNECTED";
    this.emitStateChange("CONNECTED");
    console.log("[MockProvider] Connected (mock mode)");
  }

  async disconnect(): Promise<void> {
    this.state = "DISCONNECTED";
    this.emitStateChange("DISCONNECTED");
    console.log("[MockProvider] Disconnected (mock mode)");
  }

  getConnectionState(): WhatsAppConnectionState {
    return this.state;
  }

  isConnected(): boolean {
    return this.state === "CONNECTED";
  }

  async healthCheck(): Promise<boolean> {
    return this.state === "CONNECTED";
  }

  async sendMessage(phone: string, body: string): Promise<SendMessageResult> {
    if (!this.isConnected()) {
      return { success: false, error: "Provider not connected" };
    }

    this.messageCounter++;
    const providerMessageId = `mock-msg-${Date.now()}-${this.messageCounter}`;

    console.log(`[MockProvider] SEND → ${phone}: "${body.slice(0, 50)}..."`);

    // Simulate async delivery status update after 2s
    setTimeout(() => {
      this.statusHandlers.forEach((h) =>
        h({
          providerMessageId,
          toPhone: phone,
          status: "DELIVERED",
          timestamp: new Date(),
        })
      );
    }, 2000);

    return { success: true, providerMessageId };
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
   * Test helper — simulate an inbound message from a phone number.
   */
  simulateInboundMessage(fromPhone: string, body: string): void {
    const msg: InboundMessage = {
      fromPhone,
      body,
      timestamp: new Date(),
      providerMessageId: `mock-in-${Date.now()}`,
    };
    this.inboundHandlers.forEach((h) => h(msg));
  }

  private emitStateChange(
    state: WhatsAppConnectionState,
    qrCode?: string
  ): void {
    this.stateHandlers.forEach((h) => h(state, qrCode));
  }
}
