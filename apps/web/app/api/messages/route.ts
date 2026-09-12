import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@whatsapp-crm/db";
import { sendMessageSchema } from "@whatsapp-crm/shared";
import { Queue } from "bullmq";
import IORedis from "ioredis";
import { QUEUE_NAMES } from "@whatsapp-crm/shared";

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const contactId = searchParams.get("contactId");
  if (!contactId) {
    return NextResponse.json({ error: "contactId required" }, { status: 400 });
  }

  const cursor = searchParams.get("cursor");
  const limit = 50;

  const messages = await prisma.message.findMany({
    where: {
      contactId,
      contact: { userId: user.id },
    },
    take: limit + 1,
    cursor: cursor ? { id: cursor } : undefined,
    skip: cursor ? 1 : undefined,
    orderBy: { createdAt: "desc" },
    include: { events: true },
  });

  const hasMore = messages.length > limit;
  const data = hasMore ? messages.slice(0, limit) : messages;
  const nextCursor = hasMore ? data[data.length - 1].id : null;

  return NextResponse.json({ messages: data.reverse(), nextCursor, hasMore });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = sendMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { contactId, body: messageBody, campaignId } = parsed.data;

  // Verify contact belongs to user and check do_not_contact
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, userId: user.id },
  });

  if (!contact) return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  if (contact.doNotContact) {
    return NextResponse.json({ error: "Contact has opted out" }, { status: 400 });
  }
  if (contact.archivedAt) {
    return NextResponse.json({ error: "Contact is archived" }, { status: 400 });
  }

  // Create message record
  const message = await prisma.message.create({
    data: {
      contactId,
      campaignId: campaignId || null,
      direction: "OUTBOUND",
      body: messageBody,
    },
  });

  // Create MessageEvent
  await prisma.messageEvent.create({
    data: { messageId: message.id, eventType: "QUEUED" },
  });

  // Enqueue send job (reuse campaign-send processor with no campaign)
  // For manual sends, we create a temporary CampaignContact-less job
  // The worker handles direct sends via MessagingService
  const redis = new IORedis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });
  const queue = new Queue("direct-send", { connection: redis });
  await queue.add("send", {
    contactId,
    messageId: message.id,
    body: messageBody,
    phone: contact.phone,
  });
  redis.disconnect();

  return NextResponse.json({ message }, { status: 201 });
}
