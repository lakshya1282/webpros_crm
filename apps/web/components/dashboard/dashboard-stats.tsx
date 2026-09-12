import {
  Users,
  Megaphone,
  MessageSquare,
  MessageCircle,
  Handshake,
  Trophy,
  FolderKanban,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Stats {
  totalContacts: number;
  activeCampaigns: number;
  messagesSent: number;
  replies: number;
  negotiating: number;
  wonDeals: number;
  activeProjects: number;
  overdueTasks: number;
}

const STAT_CARDS = (stats: Stats) => [
  {
    label: "Total Contacts",
    value: stats.totalContacts.toLocaleString(),
    icon: Users,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
  },
  {
    label: "Active Campaigns",
    value: stats.activeCampaigns.toLocaleString(),
    icon: Megaphone,
    color: "text-violet-400",
    bg: "bg-violet-500/10",
  },
  {
    label: "Messages Sent",
    value: stats.messagesSent.toLocaleString(),
    icon: MessageSquare,
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
  },
  {
    label: "Replies Received",
    value: stats.replies.toLocaleString(),
    icon: MessageCircle,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  {
    label: "Negotiating",
    value: stats.negotiating.toLocaleString(),
    icon: Handshake,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
  },
  {
    label: "Won Deals",
    value: stats.wonDeals.toLocaleString(),
    icon: Trophy,
    color: "text-green-400",
    bg: "bg-green-500/10",
  },
  {
    label: "Active Projects",
    value: stats.activeProjects.toLocaleString(),
    icon: FolderKanban,
    color: "text-purple-400",
    bg: "bg-purple-500/10",
  },
  {
    label: "Overdue Tasks",
    value: stats.overdueTasks.toLocaleString(),
    icon: AlertCircle,
    color: stats.overdueTasks > 0 ? "text-red-400" : "text-muted-foreground",
    bg: stats.overdueTasks > 0 ? "bg-red-500/10" : "bg-secondary",
  },
];

export function DashboardStats({ stats }: { stats: Stats }) {
  const cards = STAT_CARDS(stats);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className="bg-card border border-border rounded-xl p-4 hover:border-border/80 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium mb-1">
                  {card.label}
                </p>
                <p className="text-2xl font-bold text-foreground tabular-nums">
                  {card.value}
                </p>
              </div>
              <div className={cn("p-2 rounded-lg", card.bg)}>
                <Icon className={cn("w-4 h-4", card.color)} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
