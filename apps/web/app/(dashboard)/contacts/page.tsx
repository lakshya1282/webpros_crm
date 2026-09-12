import { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { prisma, PipelineStage } from "@whatsapp-crm/db";
import { ContactsTable } from "@/components/contacts/contacts-table";
import Link from "next/link";
import { Upload, UserPlus } from "lucide-react";

export const metadata: Metadata = { title: "Contacts" };

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const sp = await searchParams;
  const search = sp.search || "";
  const pipelineStage = sp.pipelineStage as PipelineStage | undefined;

  const contacts = await prisma.contact.findMany({
    where: {
      userId: user.id,
      archivedAt: null,
      ...(search ? {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { phone: { contains: search } },
          { company: { contains: search, mode: "insensitive" } },
        ]
      } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { contactTags: { include: { tag: true } } },
  });

  const totalCount = await prisma.contact.count({
    where: { userId: user.id, archivedAt: null },
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Contacts</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {totalCount.toLocaleString()} total contacts
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/imports"
            className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-muted-foreground border border-border rounded-lg hover:bg-secondary/60 hover:text-foreground transition-colors"
          >
            <Upload className="w-4 h-4" />
            Import
          </Link>
          <Link
            href="/contacts/new"
            className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Add Contact
          </Link>
        </div>
      </div>

      {/* Contacts table */}
      <ContactsTable contacts={contacts} />
    </div>
  );
}
