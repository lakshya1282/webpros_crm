/**
 * Factory — creates the correct WhatsApp provider based on WHATSAPP_PROVIDER env var.
 */

import type { WhatsAppProvider } from "./provider";
import { MockProvider } from "./mock";
import { BaileysProvider } from "./baileys";
import { CloudApiProvider } from "./cloud-api";

export function createWhatsAppProvider(): WhatsAppProvider {
  const providerType = process.env.WHATSAPP_PROVIDER || "mock";

  switch (providerType) {
    case "mock":
      return new MockProvider();
    case "baileys": {
      const sessionPath = process.env.WHATSAPP_SESSION_PATH || "./whatsapp-session";
      return new BaileysProvider(sessionPath);
    }
    case "cloud-api": {
      const accessToken = process.env.META_ACCESS_TOKEN;
      const phoneNumberId = process.env.META_PHONE_NUMBER_ID;
      const verifyToken = process.env.META_VERIFY_TOKEN;
      if (!accessToken || !phoneNumberId || !verifyToken) {
        throw new Error(
          "cloud-api provider requires META_ACCESS_TOKEN, META_PHONE_NUMBER_ID, META_VERIFY_TOKEN"
        );
      }
      return new CloudApiProvider(accessToken, phoneNumberId, verifyToken);
    }
    default:
      throw new Error(`Unknown WHATSAPP_PROVIDER: ${providerType}`);
  }
}

export type { WhatsAppProvider } from "./provider";
export type {
  WhatsAppConnectionState,
  SendMessageResult,
  InboundMessage,
  MessageStatusUpdate,
} from "./provider.js";
export { MockProvider } from "./mock.js";
export { BaileysProvider } from "./baileys.js";
export { CloudApiProvider } from "./cloud-api.js";
