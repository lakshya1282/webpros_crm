"use client";

import { useState } from "react";
import { toast } from "sonner";
import { formatRelativeTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Play, Pause, RotateCcw, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface Stats {
  total: number;
  queued: number;
  sent: number;
  delivered: number;
  failed: number;
  skipped: number;
}

interface CampaignContact {
  id: string;
  sendStatus: string;
  sentAt: Date | null;
  deliveredAt: Date | null;
  failedAt: Date | null;
  errorReason: string | null;
  contact: { id: string; name: string; company: string | null; phone: string };
}

interface Campaign {
  id: string;
  name: string;
  status: string;
  messageTemplate: string;
  createdAt: Date;
  startedAt: Date | null;
  campaignContacts: CampaignContact[];
}

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-secondary text-muted-foreground",
  QUEUED: "bg-amber-500/15 text-amber-400",
  RUNNING: "bg-blue-500/15 text-blue-400",
  PAUSED: "bg-orange-500/15 text-orange-400",
  COMPLETED: "bg-green-500/15 text-green-400",
  FAILED: "bg-red-500/15 text-red-400",
};

const CC_STYLES: Record<string, string> = {
  QUEUED: "text-amber-400",
  SENT: "text-blue-400",
  DELIVERED: "text-green-400",
  FAILED: "text-red-400",
  SKIPPED: "text-muted-foreground",
};

export function CampaignDetailClient({
  campaign: initialCampaign,
  stats: initialStats,
}: {
  campaign: Campaign;
  stats: Stats;
}) {
  const [campaign, setCampaign] = useState(initialCampaign);
  const [stats, setStats] = useState(initialStats);
  const [loading, setLoading] = useState<string | null>(null);

  const handleAction = async (action: "start" | "pause" | "resume") => {
    setLoading(action);
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/${action}`, {
        method: "POST",
      });
      const data = await res.json() as { success?: boolean; error?: string; enqueuedCount?: number };
      if (!res.ok) throw new Error(data.error || "Failed");

      const statusMap = { start: "RUNNING", pause: "PAUSED", resume: "RUNNING" };
      setCampaign((prev) => ({ ...prev, status: statusMap[action] }));

      if (action === "start" || action === "resume") {
        toast.success(`Campaign ${action === "start" ? "started" : "resumed"} — ${data.enqueuedCount} messages queued`);
      } else {
        toast.success("Campaign paused");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setLoading(null);
    }
  };

  const progressPct = stats.total > 0
    ? Math.round(((stats.sent + stats.delivered + stats.failed + stats.skipped) / stats.total) * 100)
    : 0;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link
          href="/campaigns"
          className="mt-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-foreground">{campaign.name}</h1>
            <span className={cn("text-xs font-medium px-2.5 py-1 rounded-lg", STATUS_STYLES[campaign.status])}>
              {campaign.status}
            </span>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            Created {formatRelativeTime(campaign.createdAt)}
            {campaign.startedAt && ` · Started ${formatRelativeTime(campaign.startedAt)}`}
          </p>
        </div>
        {/* Controls */}
        <div className="flex items-center gap-2">
          {(campaign.status === "DRAFT" || campaign.status === "QUEUED") && (
            <button
              onClick={() => handleAction("start")}
              disabled={loading !== null}
              className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              <Play className="w-4 h-4" />
              {loading === "start" ? "Starting..." : "Start Campaign"}
            </button>
          )}
          {campaign.status === "RUNNING" && (
            <button
              onClick={() => handleAction("pause")}
              disabled={loading !== null}
              className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              <Pause className="w-4 h-4" />
              {loading === "pause" ? "Pausing..." : "Pause"}
            </button>
          )}
          {campaign.status === "PAUSED" && (
            <button
              onClick={() => handleAction("resume")}
              disabled={loading !== null}
              className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              <RotateCcw className="w-4 h-4" />
              {loading === "resume" ? "Resuming..." : "Resume"}
            </button>
          )}
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
        {[
          { label: "Total", value: stats.total, color: "text-foreground" },
          { label: "Queued", value: stats.queued, color: "text-amber-400" },
          { label: "Sent", value: stats.sent, color: "text-blue-400" },
          { label: "Delivered", value: stats.delivered, color: "text-green-400" },
          { label: "Failed", value: stats.failed, color: "text-red-400" },
          { label: "Skipped", value: stats.skipped, color: "text-muted-foreground" },
        ].map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4 text-center">
            <p className={cn("text-2xl font-bold tabular-nums", s.color)}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      {stats.total > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-foreground font-medium">Progress</span>
            <span className="text-sm text-muted-foreground tabular-nums">{progressPct}%</span>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Message template */}
      <div className="bg-card border border-border rounded-xl p-4">
        <h3 className="text-sm font-medium text-foreground mb-2">Message Template</h3>
        <p className="text-sm text-muted-foreground whitespace-pre-wrap bg-secondary/50 rounded-lg p-3">
          {campaign.messageTemplate}
        </p>
      </div>

      {/* Contact list */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-medium text-foreground">
            Contacts ({campaign.campaignContacts.length})
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="text-left py-2.5 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Contact</th>
                <th className="text-left py-2.5 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Status</th>
                <th className="text-left py-2.5 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Sent At</th>
                <th className="text-left py-2.5 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Error</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {campaign.campaignContacts.map((cc) => (
                <tr key={cc.id} className="hover:bg-secondary/20">
                  <td className="py-2.5 px-4">
                    <Link href={`/contacts/${cc.contact.id}`} className="font-medium text-foreground hover:text-primary">
                      {cc.contact.name}
                    </Link>
                    {cc.contact.company && (
                      <span className="text-xs text-muted-foreground ml-2">{cc.contact.company}</span>
                    )}
                  </td>
                  <td className="py-2.5 px-4">
                    <span className={cn("text-xs font-medium", CC_STYLES[cc.sendStatus])}>{cc.sendStatus}</span>
                  </td>
                  <td className="py-2.5 px-4 text-muted-foreground text-xs">
                    {cc.sentAt ? formatRelativeTime(cc.sentAt) : "—"}
                  </td>
                  <td className="py-2.5 px-4 text-red-400 text-xs">{cc.errorReason || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
