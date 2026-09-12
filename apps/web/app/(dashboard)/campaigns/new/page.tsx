import { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@whatsapp-crm/db";
import { NewCampaignClient } from "@/components/campaigns/new-campaign-client";

export const metadata: Metadata = { title: "New Campaign" };

export default async function NewCampaignPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Fetch tags for audience selection
  const tags = await prisma.tag.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { contactTags: true } } },
  });

  return <NewCampaignClient tags={tags} />;
}
