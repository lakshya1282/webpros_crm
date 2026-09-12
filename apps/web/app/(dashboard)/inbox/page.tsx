import { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@whatsapp-crm/db";
import { InboxClient } from "@/components/inbox/inbox-client";

export const metadata: Metadata = { title: "Inbox" };

export default async function InboxPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Get all contacts that have at least one message, ordered by last message
  const conversations = await prisma.contact.findMany({
    where: {
      userId: user.id,
      messages: { some: {} },
    },
    orderBy: {
      messages: { _count: "desc" },
    },
    include: {
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  // Sort by last message timestamp
  conversations.sort((a, b) => {
    const aTime = a.messages[0]?.createdAt?.getTime() || 0;
    const bTime = b.messages[0]?.createdAt?.getTime() || 0;
    return bTime - aTime;
  });

  return <InboxClient conversations={conversations} />;
}
