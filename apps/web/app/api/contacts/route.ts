import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma, Prisma } from "@whatsapp-crm/db";
import { contactFilterSchema } from "@whatsapp-crm/shared";
import { DEFAULT_PAGE_SIZE } from "@whatsapp-crm/shared";

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const parsed = contactFilterSchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { search, pipelineStage, messagingStatus, tagId, doNotContact, archived, cursor, limit } = parsed.data;

  const where: Prisma.ContactWhereInput = {
    userId: user.id,
    archivedAt: archived ? { not: null } : null,
  };

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { phone: { contains: search } },
      { company: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }

  if (pipelineStage) where.pipelineStage = pipelineStage;
  if (messagingStatus) where.messagingStatus = messagingStatus;
  if (doNotContact !== undefined) where.doNotContact = doNotContact;
  const rawTagIds = searchParams.getAll("tagId").flatMap((t) => t.split(",")).filter(Boolean);
  if (rawTagIds.length > 0) {
    where.contactTags = { some: { tagId: { in: rawTagIds } } };
  } else if (tagId) {
    where.contactTags = { some: { tagId } };
  }

  const contacts = await prisma.contact.findMany({
    where,
    take: limit + 1,
    cursor: cursor ? { id: cursor } : undefined,
    skip: cursor ? 1 : undefined,
    orderBy: { createdAt: "desc" },
    include: {
      contactTags: { include: { tag: true } },
    },
  });

  const hasMore = contacts.length > limit;
  const data = hasMore ? contacts.slice(0, limit) : contacts;
  const nextCursor = hasMore ? data[data.length - 1].id : null;

  return NextResponse.json({ contacts: data, nextCursor, hasMore });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { createContactSchema } = await import("@whatsapp-crm/shared");
  const { normalizePhone } = await import("@whatsapp-crm/shared");

  const parsed = createContactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { name, phone, company, email, source, notes } = parsed.data;

  const normalized = normalizePhone(phone);
  if (!normalized.success) {
    return NextResponse.json(
      { error: { phone: normalized.error } },
      { status: 400 }
    );
  }

  // Check for duplicate
  const existing = await prisma.contact.findUnique({
    where: { phone: normalized.e164! },
  });
  if (existing) {
    return NextResponse.json(
      { error: "A contact with this phone number already exists" },
      { status: 409 }
    );
  }

  const contact = await prisma.contact.create({
    data: {
      userId: user.id,
      name,
      phone: normalized.e164!,
      company: company || undefined,
      email: email || undefined,
      source: source || undefined,
      notes: notes || undefined,
    },
  });

  return NextResponse.json({ contact }, { status: 201 });
}
