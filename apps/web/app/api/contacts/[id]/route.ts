import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@whatsapp-crm/db";
import { updateContactSchema } from "@whatsapp-crm/shared";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const contact = await prisma.contact.findFirst({
    where: { id, userId: user.id },
    include: {
      contactTags: { include: { tag: true } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { events: true },
      },
      projects: {
        where: { status: { not: "PAID" } },
        include: { tasks: { orderBy: { dueDate: "asc" } } },
      },
      campaignContacts: {
        include: { campaign: { select: { id: true, name: true } } },
        orderBy: { queuedAt: "desc" },
        take: 5,
      },
    },
  });

  if (!contact) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ contact });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const body = await req.json();
  const parsed = updateContactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Check if archiving a contact with active projects
  if (parsed.data.archivedAt !== undefined && parsed.data.archivedAt !== null) {
    const activeProject = await prisma.project.findFirst({
      where: { contactId: id, status: "IN_PROGRESS" },
    });
    if (activeProject) {
      return NextResponse.json(
        { error: "Cannot archive a contact with an active project. Complete or close the project first." },
        { status: 409 }
      );
    }
  }

  const contact = await prisma.contact.update({
    where: { id, userId: user.id },
    data: parsed.data,
    include: {
      contactTags: { include: { tag: true } },
    },
  });

  return NextResponse.json({ contact });
}
