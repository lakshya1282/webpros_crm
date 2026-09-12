/**
 * WhatsApp Provider Interface
 *
 * The CRM core must NEVER depend on Baileys-specific types.
 * All WhatsApp operations go through this interface.
 * Providers: BaileysProvider, MockProvider, CloudApiProvider
 */

export type WhatsAppConnectionState =
  | "DISCONNECTED"
  | "CONNECTING"
  | "CONNECTED"
  | "AUTH_REQUIRED"
  | "ERROR";

export interface SendMessageResult {
  success: boolean;
  providerMessageId?: string;
  error?: string;
}

export interface InboundMessage {
  fromPhone: string; // E.164
  body: string;
  timestamp: Date;
  providerMessageId: string;
}

export interface MessageStatusUpdate {
  providerMessageId: string;
  toPhone: string;
  status: "SENT" | "DELIVERED" | "READ" | "FAILED";
  timestamp: Date;
}

export interface WhatsAppProvider {
  /**
   * Establish the WhatsApp connection.
   * For Baileys: initiates Web session (QR or cached auth).
   * For Cloud API: validates credentials.
   */
  connect(): Promise<void>;

  /**
   * Gracefully disconnect.
   */
  disconnect(): Promise<void>;

  /**
   * Returns current connection state.
   */
  getConnectionState(): WhatsAppConnectionState;

  /**
   * Returns true if the provider is ready to send messages.
   */
  isConnected(): boolean;

  /**
   * Basic health check — returns true if provider is operational.
   */
  healthCheck(): Promise<boolean>;

  /**
   * Send a message to a phone number in E.164 format.
   */
  sendMessage(phone: string, body: string): Promise<SendMessageResult>;

  /**
   * Register a listener for inbound messages.
   */
  onInboundMessage(handler: (message: InboundMessage) => Promise<void>): void;

  /**
   * Register a listener for message status updates (delivered, read, etc.)
   */
  onMessageStatusUpdate(
    handler: (update: MessageStatusUpdate) => Promise<void>
  ): void;

  /**
   * Register a listener for connection state changes.
   */
  onConnectionStateChange(
    handler: (state: WhatsAppConnectionState, qrCode?: string) => void
  ): void;
}
