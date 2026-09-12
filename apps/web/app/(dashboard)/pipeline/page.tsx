import { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@whatsapp-crm/db";
import { KanbanBoard } from "@/components/pipeline/kanban-board";
import { PIPELINE_STAGES } from "@whatsapp-crm/shared";

export const metadata: Metadata = { title: "Pipeline" };

export default async function PipelinePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const contacts = await prisma.contact.findMany({
    where: { userId: user.id, archivedAt: null },
    orderBy: { updatedAt: "desc" },
    include: {
      contactTags: { include: { tag: true } },
      campaignContacts: {
        take: 1,
        orderBy: { sentAt: "desc" },
        include: { campaign: { select: { name: true } } },
      },
      messages: {
        take: 1,
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      },
    },
  });

  // Group by pipeline stage
  const grouped = Object.fromEntries(
    PIPELINE_STAGES.map((stage) => [
      stage,
      contacts.filter((c) => c.pipelineStage === stage),
    ])
  );

  return <KanbanBoard initialGrouped={grouped} />;
}
