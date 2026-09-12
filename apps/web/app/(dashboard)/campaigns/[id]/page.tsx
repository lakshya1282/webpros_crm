import { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@whatsapp-crm/db";
import { CampaignDetailClient } from "@/components/campaigns/campaign-detail-client";

export const metadata: Metadata = { title: "Campaign Detail" };

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { id } = await params;

  const campaign = await prisma.campaign.findFirst({
    where: { id, userId: user.id },
    include: {
      campaignContacts: {
        include: {
          contact: { select: { id: true, name: true, company: true, phone: true } },
        },
        orderBy: { queuedAt: "desc" },
        take: 100,
      },
    },
  });

  if (!campaign) notFound();

  const stats = {
    total: campaign.campaignContacts.length,
    queued: campaign.campaignContacts.filter((cc) => cc.sendStatus === "QUEUED").length,
    sent: campaign.campaignContacts.filter((cc) => cc.sendStatus === "SENT").length,
    delivered: campaign.campaignContacts.filter((cc) => cc.sendStatus === "DELIVERED").length,
    failed: campaign.campaignContacts.filter((cc) => cc.sendStatus === "FAILED").length,
    skipped: campaign.campaignContacts.filter((cc) => cc.sendStatus === "SKIPPED").length,
  };

  return <CampaignDetailClient campaign={campaign} stats={stats} />;
}
