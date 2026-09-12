// Shared type definitions for worker job data
// These are imported by both the web and worker to keep job payloads in sync

export interface CampaignSendJobData {
  campaignId: string;
  contactId: string;
  campaignContactId: string;
}

export interface ImportJobData {
  batchId: string;
  storageKey: string;
  columnMapping: Record<string, string>;
  tagName?: string;
  defaultCountryCode: string;
}

export interface InboundMessageJobData {
  fromPhone: string;
  body: string;
  timestamp: string;
  providerMessageId: string;
}

export interface MessageStatusJobData {
  providerMessageId: string;
  toPhone: string;
  status: "SENT" | "DELIVERED" | "READ" | "FAILED";
  timestamp: string;
}
