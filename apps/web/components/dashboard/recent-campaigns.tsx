import Link from "next/link";
import { formatRelativeTime } from "@/lib/utils";
import { ChevronRight, Dot } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "text-muted-foreground bg-muted",
  QUEUED: "text-amber-400 bg-amber-500/10",
  RUNNING: "text-blue-400 bg-blue-500/10",
  PAUSED: "text-orange-400 bg-orange-500/10",
  COMPLETED: "text-green-400 bg-green-500/10",
  FAILED: "text-red-400 bg-red-500/10",
};

interface Campaign {
  id: string;
  name: string;
  status: string;
  createdAt: Date;
  _count: { campaignContacts: number };
}

export function RecentCampaigns({ campaigns }: { campaigns: Campaign[] }) {
  return (
    <div className="bg-card border border-border rounded-xl">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">
          Recent Campaigns
        </h2>
        <Link
          href="/campaigns"
          className="text-xs text-primary hover:text-primary/80 flex items-center gap-0.5"
        >
          View all <ChevronRight className="w-3 h-3" />
        </Link>
      </div>
      <div className="divide-y divide-border">
        {campaigns.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-8">
            No campaigns yet
          </p>
        ) : (
          campaigns.map((c) => (
            <Link
              key={c.id}
              href={`/campaigns/${c.id}`}
              className="flex items-center justify-between px-5 py-3.5 hover:bg-secondary/30 transition-colors"
            >
              <div>
                <p className="text-sm font-medium text-foreground">{c.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {c._count.campaignContacts.toLocaleString()} contacts ·{" "}
                  {formatRelativeTime(c.createdAt)}
                </p>
              </div>
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-md ${STATUS_COLORS[c.status] || STATUS_COLORS.DRAFT}`}
              >
                {c.status}
              </span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
