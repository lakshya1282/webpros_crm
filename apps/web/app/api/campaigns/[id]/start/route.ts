import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@whatsapp-crm/db";
import { Queue } from "bullmq";
import IORedis from "ioredis";
import { QUEUE_NAMES } from "@whatsapp-crm/shared";

function getRedis() {
  return new IORedis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });
}

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
    include: {
      campaignContacts: {
        where: { sendStatus: "QUEUED" },
        select: { id: true, contactId: true },
      },
    },
  });

  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!["DRAFT", "PAUSED"].includes(campaign.status)) {
    return NextResponse.json(
      { error: `Campaign cannot be started in status: ${campaign.status}` },
      { status: 400 }
    );
  }

  // Update campaign status
  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: "RUNNING", startedAt: new Date() },
  });

  // Enqueue BullMQ jobs for each queued contact
  const redis = getRedis();
  const queue = new Queue(QUEUE_NAMES.CAMPAIGN_SEND, { connection: redis });

  const sendDailyCapStr = process.env.SEND_DAILY_CAP || "30";
  const sendDelayMin = parseInt(process.env.SEND_DELAY_MIN_SEC || "30") * 1000;
  const sendDelayMax = parseInt(process.env.SEND_DELAY_MAX_SEC || "120") * 1000;

  const dailyCap = parseInt(sendDailyCapStr);
  const contactsToProcess = campaign.campaignContacts.slice(0, dailyCap);

  for (let i = 0; i < contactsToProcess.length; i++) {
    const cc = contactsToProcess[i];
    // Randomized delay between sends
    const delay = i === 0 ? 0 : Math.floor(
      sendDelayMin + Math.random() * (sendDelayMax - sendDelayMin)
    ) * i;

    await queue.add(
      "send",
      {
        campaignId,
        contactId: cc.contactId,
        campaignContactId: cc.id,
      },
      {
        delay,
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 500 },
      }
    );
  }

  redis.disconnect();

  return NextResponse.json({
    success: true,
    enqueuedCount: contactsToProcess.length,
  });
}
