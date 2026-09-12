import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@whatsapp-crm/db";
import { createProjectSchema, updateProjectSchema } from "@whatsapp-crm/shared";

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projects = await prisma.project.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      contact: { select: { id: true, name: true, company: true, phone: true } },
      tasks: {
        where: { isDone: false },
        orderBy: { dueDate: "asc" },
      },
    },
  });

  return NextResponse.json({ projects });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = createProjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const project = await prisma.project.create({
    data: {
      userId: user.id,
      ...parsed.data,
      dealValue: parsed.data.dealValue ? parsed.data.dealValue.toString() : undefined,
    },
    include: {
      contact: { select: { id: true, name: true, company: true } },
    },
  });

  return NextResponse.json({ project }, { status: 201 });
}
