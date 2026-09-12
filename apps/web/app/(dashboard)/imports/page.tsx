import { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@whatsapp-crm/db";
import { ImportsClient } from "@/components/imports/imports-client";

export const metadata: Metadata = { title: "Imports" };

export default async function ImportsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const batches = await prisma.importBatch.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return <ImportsClient batches={batches} />;
}
