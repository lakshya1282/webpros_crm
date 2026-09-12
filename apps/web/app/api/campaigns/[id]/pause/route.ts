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

  await prisma.campaign.update({
    where: { id: campaignId, userId: user.id },
    data: { status: "PAUSED" },
  });

  return NextResponse.json({ success: true });
}
