import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@whatsapp-crm/db";
import { Queue } from "bullmq";
import IORedis from "ioredis";
import { QUEUE_NAMES } from "@whatsapp-crm/shared";
import type { CampaignSendJobData } from "@/types/worker";

function getRedis() {
  return new IORedis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const campaign = await prisma.campaign.findFirst({
    where: { id, userId: user.id },
    include: {
      campaignContacts: {
        include: {
          contact: { select: { id: true, name: true, phone: true, company: true } },
        },
        orderBy: { queuedAt: "desc" },
      },
    },
  });

  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const stats = {
    total: campaign.campaignContacts.length,
    queued: campaign.campaignContacts.filter((cc) => cc.sendStatus === "QUEUED").length,
    sent: campaign.campaignContacts.filter((cc) => cc.sendStatus === "SENT").length,
    delivered: campaign.campaignContacts.filter((cc) => cc.sendStatus === "DELIVERED").length,
    failed: campaign.campaignContacts.filter((cc) => cc.sendStatus === "FAILED").length,
    skipped: campaign.campaignContacts.filter((cc) => cc.sendStatus === "SKIPPED").length,
  };

  return NextResponse.json({ campaign: { ...campaign, stats } });
}
