export { PrismaClient, Prisma } from "@prisma/client";
export type {
  User,
  Contact,
  Tag,
  ContactTag,
  ImportBatch,
  Campaign,
  CampaignContact,
  Message,
  MessageEvent,
  Project,
  Task,
  PipelineStage,
  MessagingStatus,
  CampaignStatus,
  CampaignContactStatus,
  MessageDirection,
  MessageEventType,
  ProjectStatus,
  ImportBatchStatus,
} from "@prisma/client";
import { PrismaClient } from "@prisma/client";

// Singleton Prisma client for server-side use
const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
