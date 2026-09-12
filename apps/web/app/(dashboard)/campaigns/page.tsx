import { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@whatsapp-crm/db";
import Link from "next/link";
import { Plus } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Campaigns" };

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-secondary text-muted-foreground",
  QUEUED: "bg-amber-500/15 text-amber-400",
  RUNNING: "bg-blue-500/15 text-blue-400",
  PAUSED: "bg-orange-500/15 text-orange-400",
  COMPLETED: "bg-green-500/15 text-green-400",
  FAILED: "bg-red-500/15 text-red-400",
};

export default async function CampaignsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const campaigns = await prisma.campaign.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      campaignContacts: { select: { sendStatus: true } },
    },
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Campaigns</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {campaigns.length} total campaigns
          </p>
        </div>
        <Link
          href="/campaigns/new"
          className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Campaign
        </Link>
      </div>

      {campaigns.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <p className="text-muted-foreground text-sm">No campaigns yet.</p>
          <Link
            href="/campaigns/new"
            className="mt-4 inline-flex items-center text-sm text-primary hover:text-primary/80"
          >
            Create your first campaign →
          </Link>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Campaign</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Status</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Total</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Sent</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Delivered</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Failed</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {campaigns.map((c) => {
                const sent = c.campaignContacts.filter((cc) => cc.sendStatus === "SENT" || cc.sendStatus === "DELIVERED").length;
                const delivered = c.campaignContacts.filter((cc) => cc.sendStatus === "DELIVERED").length;
                const failed = c.campaignContacts.filter((cc) => cc.sendStatus === "FAILED").length;
                return (
                  <tr key={c.id} className="hover:bg-secondary/20 transition-colors">
                    <td className="py-3 px-4">
                      <Link href={`/campaigns/${c.id}`} className="font-medium text-foreground hover:text-primary">
                        {c.name}
                      </Link>
                    </td>
                    <td className="py-3 px-4">
                      <span className={cn("text-xs font-medium px-2 py-0.5 rounded-md", STATUS_STYLES[c.status])}>
                        {c.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground tabular-nums">{c.campaignContacts.length}</td>
                    <td className="py-3 px-4 text-blue-400 tabular-nums">{sent}</td>
                    <td className="py-3 px-4 text-green-400 tabular-nums">{delivered}</td>
                    <td className="py-3 px-4 text-red-400 tabular-nums">{failed}</td>
                    <td className="py-3 px-4 text-muted-foreground text-xs">{formatRelativeTime(c.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
