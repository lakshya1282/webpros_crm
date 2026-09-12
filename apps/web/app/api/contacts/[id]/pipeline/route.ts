import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@whatsapp-crm/db";
import { updatePipelineStageSchema } from "@whatsapp-crm/shared";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const body = await req.json();
  const parsed = updatePipelineStageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { pipelineStage } = parsed.data;

  const contact = await prisma.contact.update({
    where: { id, userId: user.id },
    data: { pipelineStage },
  });

  // Auto-create project when stage = WON
  if (pipelineStage === "WON") {
    const existingProject = await prisma.project.findFirst({
      where: { contactId: id },
    });

    if (!existingProject) {
      // Find most recent campaign for this contact
      const lastCampaignContact = await prisma.campaignContact.findFirst({
        where: { contactId: id },
        orderBy: { sentAt: "desc" },
      });

      await prisma.project.create({
        data: {
          userId: user.id,
          contactId: id,
          campaignId: lastCampaignContact?.campaignId || null,
          name: `Project — ${contact.name}`,
          status: "IN_PROGRESS",
        },
      });
    }
  }

  return NextResponse.json({ contact, projectCreated: pipelineStage === "WON" });
}
