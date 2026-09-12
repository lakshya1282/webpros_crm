/**
 * BaileysProvider — WhatsApp Web session via Baileys library.
 *
 * This provider connects to WhatsApp using the unofficial Web multi-device protocol.
 * Used for MVP development. MUST be replaced with CloudApiProvider for production volume.
 *
 * Risk acknowledgement (per PRD §8):
 * - WhatsApp's Business Policy prohibits unsolicited bulk messaging
 * - This runs on reverse-engineered protocol access
 * - Number can be flagged/rate-limited/banned for policy violations
 * - Mitigations: daily caps, randomized delays, business hours only
 *
 * The CRM MUST use MessagingService and never import Baileys directly in CRM code.
 */

import type {
  WhatsAppProvider,
  WhatsAppConnectionState,
  SendMessageResult,
  InboundMessage,
  MessageStatusUpdate,
} from "./provider.js";

export class BaileysProvider implements WhatsAppProvider {
  private state: WhatsAppConnectionState = "DISCONNECTED";
  private sock: unknown = null; // Baileys socket — typed as unknown to avoid Baileys type leak
  private inboundHandlers: Array<(msg: InboundMessage) => Promise<void>> = [];
  private statusHandlers: Array<(update: MessageStatusUpdate) => Promise<void>> = [];
  private stateHandlers: Array<(state: WhatsAppConnectionState, qrCode?: string) => void> = [];
  private sessionPath: string;

  constructor(sessionPath: string = "./whatsapp-session") {
    this.sessionPath = sessionPath;
  }

  async connect(): Promise<void> {
    // Dynamic import to avoid requiring Baileys unless this provider is actually used
    const baileysModule: any = await import("@whiskeysockets/baileys").catch(() => {
      throw new Error(
        "Baileys is not installed. Run: pnpm add @whiskeysockets/baileys --filter @whatsapp-crm/worker"
      );
    });
    const makeWASocket = baileysModule.default?.default || baileysModule.default || baileysModule;
    const { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = baileysModule;

    this.setState("CONNECTING");

    const { state: authState, saveCreds } = await useMultiFileAuthState(
      this.sessionPath
    );

    let version = [2, 3000, 1043857760];
    try {
      if (typeof fetchLatestBaileysVersion === "function") {
        const latest = await fetchLatestBaileysVersion();
        if (latest?.version) version = latest.version;
      }
    } catch {
      // Fallback
    }

    let logger: any = undefined;
    try {
      const pino = (await import("pino")).default;
      logger = pino({ level: "silent" });
    } catch {}

    const sock = makeWASocket({
      version,
      auth: authState,
      printQRInTerminal: false,
      logger,
      browser: ["Ubuntu", "Chrome", "20.0.04"],
      syncFullHistory: false,
    }) as any;

    this.sock = sock;

    sock.ev.on("connection.update", async (update: any) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        this.setState("AUTH_REQUIRED", qr);
        console.log("\n========================================================");
        console.log("   SCAN THIS QR CODE IN WHATSAPP TO CONNECT");
        console.log("========================================================\n");
        try {
          // @ts-ignore
          const qrcodeModule: any = await import("qrcode-terminal");
          const q = qrcodeModule?.default || qrcodeModule;
          if (typeof q?.setErrorLevel === "function") {
            q.setErrorLevel("L");
          }
          if (typeof q?.generate === "function") {
            q.generate(qr, { small: true });
          } else if (typeof q === "function") {
            q(qr, { small: true });
          } else {
            console.log("QR String:", qr);
          }
        } catch (err) {
          console.error("QR render error:", err);
          console.log("QR String:", qr);
        }
        console.log("\nWaiting for scan on phone...\n");
      }

      if (connection === "open") {
        console.log("\n✅ WhatsApp connected successfully via Baileys!\n");
        this.setState("CONNECTED");
      }

      if (connection === "close") {
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        const isReplaced = statusCode === DisconnectReason.connectionReplaced;
        const isLoggedOut = statusCode === DisconnectReason.loggedOut;

        if (isReplaced) {
          console.log("⚠️ WhatsApp connection was replaced by another process or device (440). Auto-reconnect stopped to prevent conflict.");
          this.setState("DISCONNECTED");
        } else if (!isLoggedOut) {
          console.log(`WhatsApp disconnected (${statusCode || "reconnecting"}), reconnecting in 3s...`);
          setTimeout(() => this.connect(), 3000);
        } else {
          console.log("WhatsApp logged out. Please restart to re-pair.");
          this.setState("DISCONNECTED");
        }
      }
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("messages.upsert", async (m: any) => {
      const messages = m.messages || [];
      for (const msg of messages) {
        if (!msg.key.fromMe && msg.message) {
          const fromPhone = msg.key.remoteJid?.replace("@s.whatsapp.net", "");
          if (!fromPhone) continue;

          const body =
            msg.message?.conversation ||
            msg.message?.extendedTextMessage?.text ||
            "";

          if (!body) continue;

          const inbound: InboundMessage = {
            fromPhone: fromPhone.startsWith("+") ? fromPhone : `+${fromPhone}`,
            body,
            timestamp: new Date((msg.messageTimestamp as number) * 1000),
            providerMessageId: msg.key.id || `baileys-${Date.now()}`,
          };

          for (const handler of this.inboundHandlers) {
            await handler(inbound);
          }
        }
      }
    });

    sock.ev.on("message-receipt.update", async (updates: any[]) => {
      for (const update of updates) {
        const receipt = update.receipt;
        if (!receipt) continue;

        let status: "DELIVERED" | "READ" | "FAILED" | "SENT" = "SENT";
        if (receipt.readTimestamp) status = "READ";
        else if (receipt.receiptTimestamp) status = "DELIVERED";

        const statusUpdate: MessageStatusUpdate = {
          providerMessageId: update.key?.id || "",
          toPhone: update.key?.remoteJid?.replace("@s.whatsapp.net", "") || "",
          status,
          timestamp: new Date(),
        };

        for (const handler of this.statusHandlers) {
          await handler(statusUpdate);
        }
      }
    });
  }

  async disconnect(): Promise<void> {
    if (this.sock) {
      (this.sock as any).end();
      this.sock = null;
    }
    this.setState("DISCONNECTED");
  }

  getConnectionState(): WhatsAppConnectionState {
    return this.state;
  }

  isConnected(): boolean {
    return this.state === "CONNECTED";
  }

  async healthCheck(): Promise<boolean> {
    return this.isConnected();
  }

  async sendMessage(phone: string, body: string): Promise<SendMessageResult> {
    if (!this.isConnected() || !this.sock) {
      return { success: false, error: "Baileys provider not connected" };
    }

    try {
      // Baileys JID format: phone without + suffix @s.whatsapp.net
      const jid = phone.replace("+", "") + "@s.whatsapp.net";
      const result = await (this.sock as any).sendMessage(jid, { text: body });
      return {
        success: true,
        providerMessageId: result?.key?.id || `baileys-${Date.now()}`,
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

  private setState(state: WhatsAppConnectionState, qrCode?: string): void {
    this.state = state;
    this.stateHandlers.forEach((h) => h(state, qrCode));
  }
}
