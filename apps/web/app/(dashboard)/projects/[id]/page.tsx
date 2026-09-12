import { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@whatsapp-crm/db";
import { ProjectDetailClient } from "@/components/projects/project-detail-client";

export const metadata: Metadata = { title: "Project" };

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { id } = await params;

  const project = await prisma.project.findFirst({
    where: { id, userId: user.id },
    include: {
      contact: { select: { id: true, name: true, company: true, phone: true } },
      campaign: { select: { id: true, name: true } },
      tasks: { orderBy: [{ isDone: "asc" }, { dueDate: "asc" }] },
    },
  });

  if (!project) notFound();

  return (
    <ProjectDetailClient
      project={{
        ...project,
        dealValue: project.dealValue ? project.dealValue.toNumber() : null,
      }}
    />
  );
}
