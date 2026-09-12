import { z } from "zod";

// ============================================================
// Contact schemas
// ============================================================

export const createContactSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  phone: z.string().min(1, "Phone is required"),
  company: z.string().max(255).optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  source: z.string().max(255).optional(),
  notes: z.string().optional(),
});

export const updateContactSchema = createContactSchema.partial().extend({
  pipelineStage: z
    .enum([
      "NEW_LEAD",
      "CONTACTED",
      "REPLIED",
      "NEGOTIATING",
      "WON",
      "LOST",
    ])
    .optional(),
  doNotContact: z.boolean().optional(),
  archivedAt: z.string().datetime().nullable().optional(),
});

export const contactFilterSchema = z.object({
  search: z.string().optional(),
  pipelineStage: z
    .enum(["NEW_LEAD", "CONTACTED", "REPLIED", "NEGOTIATING", "WON", "LOST"])
    .optional(),
  messagingStatus: z
    .enum([
      "NOT_CONTACTED",
      "QUEUED",
      "SENT",
      "DELIVERED",
      "REPLIED",
      "FAILED",
    ])
    .optional(),
  tagId: z.string().optional(),
  doNotContact: z.boolean().optional(),
  archived: z.boolean().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(200).default(50),
});

export const updatePipelineStageSchema = z.object({
  pipelineStage: z.enum([
    "NEW_LEAD",
    "CONTACTED",
    "REPLIED",
    "NEGOTIATING",
    "WON",
    "LOST",
  ]),
});

// ============================================================
// Import schemas
// ============================================================

export const columnMappingSchema = z.object({
  batchId: z.string().cuid(),
  tagName: z.string().optional(),
  mapping: z.record(
    z.enum(["name", "phone", "company", "email", "source", "notes"]),
    z.string() // maps schema field → column header in the file
  ),
  defaultCountryCode: z.string().default("IN"),
});

// ============================================================
// Campaign schemas
// ============================================================

export const createCampaignSchema = z.object({
  name: z.string().min(1, "Campaign name is required").max(255),
  messageTemplate: z
    .string()
    .min(1, "Message template is required")
    .max(4096),
  contactIds: z
    .array(z.string())
    .min(1, "Select at least one contact"),
  tagIds: z.array(z.string()).optional(),
});

export const campaignFilterSchema = z.object({
  status: z
    .enum(["DRAFT", "QUEUED", "RUNNING", "PAUSED", "COMPLETED", "FAILED"])
    .optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(200).default(50),
});

// ============================================================
// Message schemas
// ============================================================

export const sendMessageSchema = z.object({
  contactId: z.string().cuid(),
  body: z.string().min(1, "Message body is required").max(4096),
  campaignId: z.string().cuid().optional(),
});

// ============================================================
// Project schemas
// ============================================================

export const createProjectSchema = z.object({
  contactId: z.string().cuid(),
  campaignId: z.string().cuid().optional(),
  name: z.string().min(1, "Project name is required").max(255),
  dealValue: z.coerce.number().positive().optional(),
  notes: z.string().optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  dealValue: z.coerce.number().positive().nullable().optional(),
  status: z.enum(["IN_PROGRESS", "DELIVERED", "PAID"]).optional(),
  notes: z.string().optional(),
});

// ============================================================
// Task schemas
// ============================================================

export const createTaskSchema = z.object({
  projectId: z.string().cuid(),
  title: z.string().min(1, "Task title is required").max(512),
  dueDate: z.string().datetime().optional().nullable(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(512).optional(),
  dueDate: z.string().datetime().nullable().optional(),
  isDone: z.boolean().optional(),
});

// ============================================================
// Settings schemas
// ============================================================

export const sendRateLimitsSchema = z.object({
  dailyCap: z.number().int().min(1).max(500).default(30),
  delayMinSec: z.number().int().min(5).max(300).default(30),
  delayMaxSec: z.number().int().min(5).max(600).default(120),
  defaultCountryCode: z.string().min(2).max(2).default("IN"),
});

// ============================================================
// Inferred types
// ============================================================

export type CreateContactInput = z.infer<typeof createContactSchema>;
export type UpdateContactInput = z.infer<typeof updateContactSchema>;
export type ContactFilterInput = z.infer<typeof contactFilterSchema>;
export type ColumnMappingInput = z.infer<typeof columnMappingSchema>;
export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type SendRateLimitsInput = z.infer<typeof sendRateLimitsSchema>;
