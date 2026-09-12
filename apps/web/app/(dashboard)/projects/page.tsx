import { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@whatsapp-crm/db";
import Link from "next/link";
import { formatCurrency, formatRelativeTime, cn } from "@/lib/utils";
import { AlertCircle, FolderKanban } from "lucide-react";

export const metadata: Metadata = { title: "Projects" };

const STATUS_STYLES: Record<string, string> = {
  IN_PROGRESS: "bg-blue-500/15 text-blue-400",
  DELIVERED: "bg-green-500/15 text-green-400",
  PAID: "bg-emerald-500/15 text-emerald-400",
};

export default async function ProjectsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const projects = await prisma.project.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      contact: { select: { id: true, name: true, company: true } },
      tasks: {
        where: { isDone: false },
        orderBy: { dueDate: "asc" },
      },
    },
  });

  const now = new Date();
  const totalDealValue = projects
    .filter((p) => p.status !== "PAID")
    .reduce((sum, p) => sum + (p.dealValue ? Number(p.dealValue) : 0), 0);
  const overdueTasks = projects.flatMap((p) =>
    p.tasks.filter((t) => t.dueDate && new Date(t.dueDate) < now)
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Projects</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {projects.length} projects · {formatCurrency(totalDealValue)} pipeline value
          </p>
        </div>
      </div>

      {/* Summary cards */}
      {overdueTasks.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-400">
              {overdueTasks.length} overdue task{overdueTasks.length > 1 ? "s" : ""}
            </p>
            <p className="text-xs text-red-400/70 mt-0.5">
              Some project tasks are past their due date
            </p>
          </div>
        </div>
      )}

      {projects.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <FolderKanban className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">
            No projects yet. Move a contact to <strong>Won</strong> in the Pipeline to auto-create a project.
          </p>
          <Link
            href="/pipeline"
            className="mt-4 inline-flex items-center text-sm text-primary hover:text-primary/80"
          >
            Go to Pipeline →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => {
            const overdueInProject = project.tasks.filter(
              (t) => t.dueDate && new Date(t.dueDate) < now
            );
            const nextTask = project.tasks[0];

            return (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="bg-card border border-border rounded-xl p-5 hover:border-border/70 hover:bg-card/80 transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground truncate">{project.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {project.contact.name}
                      {project.contact.company && ` · ${project.contact.company}`}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "text-xs font-medium px-2 py-0.5 rounded-md ml-2 shrink-0",
                      STATUS_STYLES[project.status]
                    )}
                  >
                    {project.status.replace("_", " ")}
                  </span>
                </div>

                {project.dealValue && (
                  <p className="text-lg font-bold text-foreground tabular-nums mb-3">
                    {formatCurrency(Number(project.dealValue))}
                  </p>
                )}

                {overdueInProject.length > 0 && (
                  <div className="flex items-center gap-1.5 text-xs text-red-400 mb-2">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {overdueInProject.length} overdue task{overdueInProject.length > 1 ? "s" : ""}
                  </div>
                )}

                {nextTask && (
                  <div className="text-xs text-muted-foreground bg-secondary/50 rounded-lg p-2 truncate">
                    📋 {nextTask.title}
                    {nextTask.dueDate && (
                      <span className={cn(
                        "ml-2",
                        new Date(nextTask.dueDate) < now ? "text-red-400" : "text-muted-foreground"
                      )}>
                        · Due {formatRelativeTime(nextTask.dueDate)}
                      </span>
                    )}
                  </div>
                )}

                <p className="text-xs text-muted-foreground mt-3">
                  {project.tasks.length} task{project.tasks.length !== 1 ? "s" : ""} remaining
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
