import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@whatsapp-crm/db";
import { columnMappingSchema } from "@whatsapp-crm/shared";
import { Queue } from "bullmq";
import IORedis from "ioredis";
import { QUEUE_NAMES } from "@whatsapp-crm/shared";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: batchId } = await params;

  const body = await req.json();
  const parsed = columnMappingSchema.safeParse({ batchId, ...body });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const batch = await prisma.importBatch.findFirst({
    where: { id: batchId, userId: user.id },
  });
  if (!batch) return NextResponse.json({ error: "Batch not found" }, { status: 404 });
  if (batch.status === "COMMITTED") {
    return NextResponse.json({ error: "Batch already committed" }, { status: 400 });
  }

  if (!batch.storageKey) {
    return NextResponse.json({ error: "No file uploaded for this batch" }, { status: 400 });
  }

  // Save column mapping
  await prisma.importBatch.update({
    where: { id: batchId },
    data: {
      columnMapping: parsed.data.mapping as object,
      tagName: parsed.data.tagName || batch.tagName,
      status: "READY",
    },
  });

  // Enqueue the import job
  const redis = new IORedis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });
  const queue = new Queue(QUEUE_NAMES.IMPORTS, { connection: redis });
  await queue.add("process-import", {
    batchId,
    storageKey: batch.storageKey,
    columnMapping: parsed.data.mapping,
    tagName: parsed.data.tagName || batch.tagName,
    defaultCountryCode: parsed.data.defaultCountryCode,
  });
  redis.disconnect();

  return NextResponse.json({ success: true, batchId });
}
