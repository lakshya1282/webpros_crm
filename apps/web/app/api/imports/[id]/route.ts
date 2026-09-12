import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@whatsapp-crm/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const batch = await prisma.importBatch.findFirst({
    where: { id, userId: user.id },
  });

  if (!batch) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ batch });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const batch = await prisma.importBatch.findFirst({
    where: { id, userId: user.id },
  });

  if (!batch) return NextResponse.json({ error: "Batch not found" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const deleteContacts = searchParams.get("deleteContacts") === "true";

  // 1. Remove file from Supabase Storage if present
  if (batch.storageKey) {
    try {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const adminClient = createAdminClient();
      await adminClient.storage.from("imports").remove([batch.storageKey]);
    } catch (storageErr) {
      console.warn("Storage file removal warning:", storageErr);
    }
  }

  // 2. Handle contacts associated with this batch
  if (deleteContacts) {
    // Find contacts belonging to this batch
    const contacts = await prisma.contact.findMany({
      where: { importBatchId: id, userId: user.id },
      include: {
        _count: {
          select: { messages: true, campaignContacts: true },
        },
      },
    });

    // Only delete contacts that have NO outreach activity (no messages, no campaigns)
    const safeToDelete = contacts.filter(
      (c) => c._count.messages === 0 && c._count.campaignContacts === 0
    );
    const hasActivity = contacts.filter(
      (c) => c._count.messages > 0 || c._count.campaignContacts > 0
    );

    if (safeToDelete.length > 0) {
      await prisma.contact.deleteMany({
        where: { id: { in: safeToDelete.map((c) => c.id) } },
      });
    }

    // Unlink contacts that have activity so we don't break message history
    if (hasActivity.length > 0) {
      await prisma.contact.updateMany({
        where: { id: { in: hasActivity.map((c) => c.id) } },
        data: { importBatchId: null },
      });
    }
  } else {
    // Keep contacts in CRM, simply unlink from this import batch
    await prisma.contact.updateMany({
      where: { importBatchId: id },
      data: { importBatchId: null },
    });
  }

  // 3. Delete the import batch
  await prisma.importBatch.delete({
    where: { id },
  });

  return NextResponse.json({ success: true, id, deleteContacts });
}
