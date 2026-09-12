"use client";

import { useState } from "react";
import Link from "next/link";
import { formatRelativeTime, formatCurrency, cn } from "@/lib/utils";
import { toast } from "sonner";
import { ArrowLeft, Plus, Check, Trash2, ExternalLink } from "lucide-react";

interface Task {
  id: string;
  title: string;
  dueDate: Date | null;
  isDone: boolean;
  createdAt: Date;
}

interface Project {
  id: string;
  name: string;
  dealValue: string | number | null;
  status: string;
  notes: string | null;
  createdAt: Date;
  contact: { id: string; name: string; company: string | null; phone: string };
  campaign: { id: string; name: string } | null;
  tasks: Task[];
}

const STATUS_OPTIONS = ["IN_PROGRESS", "DELIVERED", "PAID"] as const;
const STATUS_LABELS: Record<string, string> = {
  IN_PROGRESS: "In Progress",
  DELIVERED: "Delivered",
  PAID: "Paid",
};

export function ProjectDetailClient({ project: initialProject }: { project: Project }) {
  const [project, setProject] = useState(initialProject);
  const [tasks, setTasks] = useState<Task[]>(initialProject.tasks);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  const [addingTask, setAddingTask] = useState(false);
  const [notes, setNotes] = useState(project.notes || "");
  const [notesSaving, setNotesSaving] = useState(false);

  const now = new Date();

  const updateProject = async (updates: Partial<Pick<Project, "status" | "dealValue" | "notes">>) => {
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const data = await res.json() as { project?: Project; error?: string };
      if (!res.ok) throw new Error(data.error);
      setProject((prev) => ({ ...prev, ...updates }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    }
  };

  const addTask = async () => {
    if (!newTaskTitle.trim()) return;
    setAddingTask(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          title: newTaskTitle.trim(),
          dueDate: newTaskDueDate ? new Date(newTaskDueDate).toISOString() : undefined,
        }),
      });
      const data = await res.json() as { task?: Task; error?: string };
      if (!res.ok) throw new Error(data.error);
      setTasks((prev) => [...prev, data.task!]);
      setNewTaskTitle("");
      setNewTaskDueDate("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add task");
    } finally {
      setAddingTask(false);
    }
  };

  const toggleTask = async (taskId: string, isDone: boolean) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, isDone } : t))
    );
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDone }),
      });
    } catch {
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, isDone: !isDone } : t))
      );
    }
  };

  const deleteTask = async (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    try {
      const res = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
    } catch {
      if (task) setTasks((prev) => [...prev, task]);
      toast.error("Failed to delete task");
    }
  };

  const saveNotes = async () => {
    setNotesSaving(true);
    await updateProject({ notes });
    setNotesSaving(false);
    toast.success("Notes saved");
  };

  const pendingTasks = tasks.filter((t) => !t.isDone);
  const doneTasks = tasks.filter((t) => t.isDone);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link href="/projects" className="mt-1 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">{project.name}</h1>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <Link
              href={`/contacts/${project.contact.id}`}
              className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1"
            >
              {project.contact.name}
              {project.contact.company && ` · ${project.contact.company}`}
              <ExternalLink className="w-3 h-3" />
            </Link>
            {project.campaign && (
              <Link
                href={`/campaigns/${project.campaign.id}`}
                className="text-xs text-primary/70 hover:text-primary"
              >
                📣 {project.campaign.name}
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Project meta */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Status */}
        <div className="bg-card border border-border rounded-xl p-4">
          <label className="text-xs text-muted-foreground font-medium block mb-2">Status</label>
          <div className="flex gap-2 flex-wrap">
            {STATUS_OPTIONS.map((s) => (
              <button
                key={s}
                onClick={() => updateProject({ status: s })}
                className={cn(
                  "text-xs font-medium px-3 py-1.5 rounded-lg transition-colors",
                  project.status === s
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                )}
              >
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        {/* Deal value */}
        <div className="bg-card border border-border rounded-xl p-4">
          <label className="text-xs text-muted-foreground font-medium block mb-2">Deal Value (₹)</label>
          <input
            type="number"
            defaultValue={project.dealValue ? Number(project.dealValue) : ""}
            onBlur={(e) => {
              const val = parseFloat(e.target.value);
              if (!isNaN(val)) updateProject({ dealValue: val });
            }}
            placeholder="Enter deal value"
            className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          {project.dealValue && (
            <p className="text-xs text-muted-foreground mt-1">
              {formatCurrency(Number(project.dealValue))}
            </p>
          )}
        </div>
      </div>

      {/* Tasks */}
      <div className="bg-card border border-border rounded-xl">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">
            Tasks ({pendingTasks.length} remaining)
          </h3>
        </div>

        {/* Add task */}
        <div className="p-4 border-b border-border">
          <div className="flex gap-2">
            <input
              type="text"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addTask(); }}
              placeholder="Add a task..."
              className="flex-1 bg-secondary border border-border rounded-lg px-3 py-2 text-foreground text-sm placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <input
              type="date"
              value={newTaskDueDate}
              onChange={(e) => setNewTaskDueDate(e.target.value)}
              className="bg-secondary border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 w-36"
            />
            <button
              onClick={addTask}
              disabled={addingTask || !newTaskTitle.trim()}
              className="p-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Task list */}
        <div className="divide-y divide-border">
          {tasks.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-6">No tasks yet</p>
          ) : (
            [...pendingTasks, ...doneTasks].map((task) => {
              const isOverdue = !task.isDone && task.dueDate && new Date(task.dueDate) < now;
              return (
                <div
                  key={task.id}
                  className={cn(
                    "flex items-start gap-3 px-4 py-3 group",
                    task.isDone && "opacity-50"
                  )}
                >
                  <button
                    onClick={() => toggleTask(task.id, !task.isDone)}
                    className={cn(
                      "mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                      task.isDone
                        ? "bg-green-600 border-green-600"
                        : "border-border hover:border-primary"
                    )}
                  >
                    {task.isDone && <Check className="w-2.5 h-2.5 text-white" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm text-foreground", task.isDone && "line-through")}>
                      {task.title}
                    </p>
                    {task.dueDate && (
                      <p className={cn("text-xs mt-0.5", isOverdue ? "text-red-400" : "text-muted-foreground")}>
                        {isOverdue ? "⚠️ Overdue · " : ""}Due {formatRelativeTime(task.dueDate)}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => deleteTask(task.id)}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Notes */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-foreground">Notes</h3>
          <button
            onClick={saveNotes}
            disabled={notesSaving}
            className="text-xs text-primary hover:text-primary/80 disabled:opacity-50"
          >
            {notesSaving ? "Saving..." : "Save"}
          </button>
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={5}
          placeholder="Add notes about this project..."
          className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-foreground text-sm placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
        />
      </div>
    </div>
  );
}
