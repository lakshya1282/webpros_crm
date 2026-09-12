import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@whatsapp-crm/db";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: campaignId } = await params;

  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, userId: user.id },
  });
  if (!campaign || campaign.status !== "PAUSED") {
    return NextResponse.json({ error: "Campaign must be PAUSED to resume" }, { status: 400 });
  }

  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: "RUNNING" },
  });

  // Re-enqueue remaining QUEUED contacts
  const { Queue } = await import("bullmq");
  const IORedis = (await import("ioredis")).default;
  const { QUEUE_NAMES } = await import("@whatsapp-crm/shared");

  const redis = new IORedis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });
  const queue = new Queue(QUEUE_NAMES.CAMPAIGN_SEND, { connection: redis });

  const pendingContacts = await prisma.campaignContact.findMany({
    where: { campaignId, sendStatus: "QUEUED" },
    select: { id: true, contactId: true },
  });

  const sendDelayMin = parseInt(process.env.SEND_DELAY_MIN_SEC || "30") * 1000;
  const sendDelayMax = parseInt(process.env.SEND_DELAY_MAX_SEC || "120") * 1000;

  for (let i = 0; i < pendingContacts.length; i++) {
    const cc = pendingContacts[i];
    const delay = i === 0 ? 0 : Math.floor(
      sendDelayMin + Math.random() * (sendDelayMax - sendDelayMin)
    ) * i;

    await queue.add("send", {
      campaignId,
      contactId: cc.contactId,
      campaignContactId: cc.id,
    }, {
      delay,
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
    });
  }

  redis.disconnect();

  return NextResponse.json({ success: true, enqueuedCount: pendingContacts.length });
}
