import { Metadata } from "next";
import { prisma } from "@whatsapp-crm/db";
import { createClient } from "@/lib/supabase/server";
import { DashboardStats } from "@/components/dashboard/dashboard-stats";
import { RecentCampaigns } from "@/components/dashboard/recent-campaigns";
import { RecentActivity } from "@/components/dashboard/recent-activity";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Fetch all stats in parallel
  const [
    totalContacts,
    activeCampaigns,
    messagesSent,
    replies,
    negotiating,
    wonDeals,
    activeProjects,
    overdueTasks,
    recentCampaigns,
    recentMessages,
  ] = await Promise.all([
    prisma.contact.count({ where: { userId: user.id, archivedAt: null } }),
    prisma.campaign.count({
      where: { userId: user.id, status: { in: ["RUNNING", "QUEUED"] } },
    }),
    prisma.campaignContact.count({ where: { sendStatus: "SENT" } }),
    prisma.contact.count({
      where: { userId: user.id, messagingStatus: "REPLIED" },
    }),
    prisma.contact.count({
      where: { userId: user.id, pipelineStage: "NEGOTIATING", archivedAt: null },
    }),
    prisma.contact.count({
      where: { userId: user.id, pipelineStage: "WON", archivedAt: null },
    }),
    prisma.project.count({
      where: { userId: user.id, status: { in: ["IN_PROGRESS"] } },
    }),
    prisma.task.count({
      where: {
        project: { userId: user.id },
        isDone: false,
        dueDate: { lt: new Date() },
      },
    }),
    prisma.campaign.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        _count: { select: { campaignContacts: true } },
      },
    }),
    prisma.message.findMany({
      where: {
        contact: { userId: user.id },
        direction: "INBOUND",
      },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { contact: { select: { name: true, company: true, id: true } } },
    }),
  ]);

  const stats = {
    totalContacts,
    activeCampaigns,
    messagesSent,
    replies,
    negotiating,
    wonDeals,
    activeProjects,
    overdueTasks,
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Your outreach pipeline at a glance
        </p>
      </div>

      {/* KPI Stats Grid */}
      <DashboardStats stats={stats} />

      {/* Recent data */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentCampaigns campaigns={recentCampaigns} />
        <RecentActivity messages={recentMessages} />
      </div>
    </div>
  );
}
