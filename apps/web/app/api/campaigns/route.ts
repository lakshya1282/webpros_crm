import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@whatsapp-crm/db";
import { createCampaignSchema } from "@whatsapp-crm/shared";

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const campaigns = await prisma.campaign.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: {
          campaignContacts: true,
        },
      },
      campaignContacts: {
        select: { sendStatus: true },
      },
    },
  });

  // Compute stats per campaign
  const campaignsWithStats = campaigns.map((c) => {
    const stats = {
      total: c.campaignContacts.length,
      queued: c.campaignContacts.filter((cc) => cc.sendStatus === "QUEUED").length,
      sent: c.campaignContacts.filter((cc) => cc.sendStatus === "SENT").length,
      delivered: c.campaignContacts.filter((cc) => cc.sendStatus === "DELIVERED").length,
      failed: c.campaignContacts.filter((cc) => cc.sendStatus === "FAILED").length,
      skipped: c.campaignContacts.filter((cc) => cc.sendStatus === "SKIPPED").length,
    };
    const { campaignContacts: _, ...campaign } = c;
    return { ...campaign, stats };
  });

  return NextResponse.json({ campaigns: campaignsWithStats });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = createCampaignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { name, messageTemplate, contactIds } = parsed.data;

  // Validate that none of the selected contacts are do_not_contact or archived
  const validContacts = await prisma.contact.findMany({
    where: {
      id: { in: contactIds },
      userId: user.id,
      doNotContact: false,
      archivedAt: null,
    },
    select: { id: true },
  });

  const validContactIds = validContacts.map((c) => c.id);
  const skippedCount = contactIds.length - validContactIds.length;

  if (validContactIds.length === 0) {
    return NextResponse.json(
      { error: "All selected contacts are opted out or archived" },
      { status: 400 }
    );
  }

  const campaign = await prisma.campaign.create({
    data: {
      userId: user.id,
      name,
      messageTemplate,
      status: "DRAFT",
      campaignContacts: {
        create: validContactIds.map((contactId) => ({
          contactId,
          sendStatus: "QUEUED",
          queuedAt: new Date(),
        })),
      },
    },
    include: {
      _count: { select: { campaignContacts: true } },
    },
  });

  return NextResponse.json(
    { campaign, validCount: validContactIds.length, skippedCount },
    { status: 201 }
  );
}
