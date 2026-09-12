// ============================================================
// Pipeline Stage constants and labels
// ============================================================

export const PIPELINE_STAGES = [
  "NEW_LEAD",
  "CONTACTED",
  "REPLIED",
  "NEGOTIATING",
  "WON",
  "LOST",
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const PIPELINE_STAGE_LABELS: Record<PipelineStage, string> = {
  NEW_LEAD: "New Lead",
  CONTACTED: "Contacted",
  REPLIED: "Replied",
  NEGOTIATING: "Negotiating",
  WON: "Won",
  LOST: "Lost",
};

export const PIPELINE_STAGE_COLORS: Record<PipelineStage, string> = {
  NEW_LEAD: "slate",
  CONTACTED: "blue",
  REPLIED: "violet",
  NEGOTIATING: "amber",
  WON: "green",
  LOST: "red",
};

// ============================================================
// Messaging Status constants
// ============================================================

export const MESSAGING_STATUSES = [
  "NOT_CONTACTED",
  "QUEUED",
  "SENT",
  "DELIVERED",
  "REPLIED",
  "FAILED",
] as const;

export type MessagingStatus = (typeof MESSAGING_STATUSES)[number];

export const MESSAGING_STATUS_LABELS: Record<MessagingStatus, string> = {
  NOT_CONTACTED: "Not Contacted",
  QUEUED: "Queued",
  SENT: "Sent",
  DELIVERED: "Delivered",
  REPLIED: "Replied",
  FAILED: "Failed",
};

// ============================================================
// Campaign Status constants
// ============================================================

export const CAMPAIGN_STATUSES = [
  "DRAFT",
  "QUEUED",
  "RUNNING",
  "PAUSED",
  "COMPLETED",
  "FAILED",
] as const;

export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  DRAFT: "Draft",
  QUEUED: "Queued",
  RUNNING: "Running",
  PAUSED: "Paused",
  COMPLETED: "Completed",
  FAILED: "Failed",
};

// ============================================================
// Campaign Contact (send) Status
// ============================================================

export const CAMPAIGN_CONTACT_STATUSES = [
  "QUEUED",
  "SENT",
  "DELIVERED",
  "FAILED",
  "SKIPPED",
] as const;

export type CampaignContactStatus =
  (typeof CAMPAIGN_CONTACT_STATUSES)[number];

// ============================================================
// Project Status
// ============================================================

export const PROJECT_STATUSES = ["IN_PROGRESS", "DELIVERED", "PAID"] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  IN_PROGRESS: "In Progress",
  DELIVERED: "Delivered",
  PAID: "Paid",
};

// ============================================================
// Import Batch Status
// ============================================================

export const IMPORT_BATCH_STATUSES = [
  "UPLOADED",
  "PARSING",
  "VALIDATING",
  "READY",
  "COMMITTED",
  "FAILED",
] as const;

export type ImportBatchStatus = (typeof IMPORT_BATCH_STATUSES)[number];

// ============================================================
// WhatsApp connection states
// ============================================================

export const WHATSAPP_CONNECTION_STATES = [
  "DISCONNECTED",
  "CONNECTING",
  "CONNECTED",
  "AUTH_REQUIRED",
  "ERROR",
] as const;

export type WhatsAppConnectionState =
  (typeof WHATSAPP_CONNECTION_STATES)[number];

// ============================================================
// BullMQ Queue Names
// ============================================================

export const QUEUE_NAMES = {
  CAMPAIGN_SEND: "campaign-send",
  INBOUND_MESSAGE: "inbound-message",
  MESSAGE_STATUS: "message-status",
  IMPORTS: "imports",
  NOTIFICATIONS: "notifications",
} as const;

// ============================================================
// Opt-out keywords (case-insensitive)
// ============================================================

export const OPT_OUT_KEYWORDS = [
  "stop",
  "unsubscribe",
  "don't contact me",
  "dont contact me",
  "remove me",
  "opt out",
  "optout",
  "do not contact",
];

// ============================================================
// Schema fields for contact import
// ============================================================

export const CONTACT_SCHEMA_FIELDS = [
  "name",
  "phone",
  "company",
  "email",
  "source",
  "notes",
] as const;

export type ContactSchemaField = (typeof CONTACT_SCHEMA_FIELDS)[number];

export const CONTACT_FIELD_LABELS: Record<ContactSchemaField, string> = {
  name: "Name",
  phone: "Phone",
  company: "Company",
  email: "Email",
  source: "Source",
  notes: "Notes",
};

// ============================================================
// Supported import file types
// ============================================================

export const SUPPORTED_IMPORT_MIME_TYPES = [
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

export const SUPPORTED_IMPORT_EXTENSIONS = [".csv", ".xlsx", ".xls"];

// ============================================================
// Max file size for imports (50MB)
// ============================================================

export const MAX_IMPORT_FILE_SIZE_BYTES = 50 * 1024 * 1024;

// ============================================================
// Pagination defaults
// ============================================================

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 200;
