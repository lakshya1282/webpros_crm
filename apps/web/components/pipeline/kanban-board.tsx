"use client";

import { useState, useCallback } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import Link from "next/link";
import { formatRelativeTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { PIPELINE_STAGES, PIPELINE_STAGE_LABELS } from "@whatsapp-crm/shared";

type Stage =
  | "NEW_LEAD"
  | "CONTACTED"
  | "REPLIED"
  | "NEGOTIATING"
  | "WON"
  | "LOST";

interface ContactCard {
  id: string;
  name: string;
  company: string | null;
  phone: string;
  pipelineStage: Stage;
  contactTags: Array<{ tag: { name: string } }>;
  campaignContacts: Array<{ campaign: { name: string } | null }>;
  messages: Array<{ createdAt: Date }>;
}

const COLUMN_STYLES: Record<Stage, string> = {
  NEW_LEAD: "border-slate-500/30",
  CONTACTED: "border-blue-500/30",
  REPLIED: "border-violet-500/30",
  NEGOTIATING: "border-amber-500/30",
  WON: "border-green-500/30",
  LOST: "border-red-500/30",
};

const COLUMN_HEADER_STYLES: Record<Stage, string> = {
  NEW_LEAD: "text-slate-400",
  CONTACTED: "text-blue-400",
  REPLIED: "text-violet-400",
  NEGOTIATING: "text-amber-400",
  WON: "text-green-400",
  LOST: "text-red-400",
};

function ContactCardItem({ contact }: { contact: ContactCard }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: contact.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const lastActivity =
    contact.messages[0]?.createdAt;
  const campaignName =
    contact.campaignContacts[0]?.campaign?.name;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-card border border-border rounded-lg p-3 cursor-grab active:cursor-grabbing hover:border-border/80 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/contacts/${contact.id}`}
          className="font-medium text-sm text-foreground hover:text-primary transition-colors line-clamp-1"
          onClick={(e) => e.stopPropagation()}
        >
          {contact.name}
        </Link>
      </div>
      {contact.company && (
        <p className="text-xs text-muted-foreground mt-0.5 truncate">
          {contact.company}
        </p>
      )}
      {campaignName && (
        <p className="text-xs text-primary/70 mt-1 truncate">
          📣 {campaignName}
        </p>
      )}
      <div className="flex items-center justify-between mt-2">
        <div className="flex flex-wrap gap-1">
          {contact.contactTags.slice(0, 2).map((ct, i) => (
            <span
              key={i}
              className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded"
            >
              {ct.tag.name}
            </span>
          ))}
        </div>
        {lastActivity && (
          <span className="text-xs text-muted-foreground">
            {formatRelativeTime(lastActivity)}
          </span>
        )}
      </div>
    </div>
  );
}

export function KanbanBoard({
  initialGrouped,
}: {
  initialGrouped: Record<string, ContactCard[]>;
}) {
  const [grouped, setGrouped] = useState<Record<string, ContactCard[]>>(
    initialGrouped as Record<string, ContactCard[]>
  );
  const [activeContact, setActiveContact] = useState<ContactCard | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const id = String(event.active.id);
    for (const stage of PIPELINE_STAGES) {
      const contact = grouped[stage]?.find((c) => c.id === id);
      if (contact) {
        setActiveContact(contact);
        break;
      }
    }
  }, [grouped]);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveContact(null);
      const { active, over } = event;
      if (!over) return;

      const contactId = String(active.id);
      const targetStage = String(over.id) as Stage;

      // Find current stage
      let currentStage: Stage | null = null;
      for (const stage of PIPELINE_STAGES) {
        if (grouped[stage]?.find((c) => c.id === contactId)) {
          currentStage = stage as Stage;
          break;
        }
      }

      if (!currentStage || currentStage === targetStage) return;

      // Optimistic update
      const contact = grouped[currentStage].find((c) => c.id === contactId)!;
      setGrouped((prev) => ({
        ...prev,
        [currentStage!]: prev[currentStage!].filter((c) => c.id !== contactId),
        [targetStage]: [{ ...contact, pipelineStage: targetStage }, ...prev[targetStage]],
      }));

      // API call
      try {
        const res = await fetch(`/api/contacts/${contactId}/pipeline`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pipelineStage: targetStage }),
        });
        const data = await res.json() as { projectCreated?: boolean; error?: string };

        if (!res.ok) throw new Error(data.error || "Failed to update");

        if (data.projectCreated) {
          toast.success(`🎉 ${contact.name} won! Project created automatically.`, {
            action: {
              label: "View Projects",
              onClick: () => window.location.href = "/projects",
            },
          });
        } else {
          toast.success(`Moved ${contact.name} to ${PIPELINE_STAGE_LABELS[targetStage]}`);
        }
      } catch (err) {
        // Revert
        setGrouped((prev) => ({
          ...prev,
          [currentStage!]: [...prev[currentStage!], contact],
          [targetStage]: prev[targetStage].filter((c) => c.id !== contactId),
        }));
        toast.error(err instanceof Error ? err.message : "Failed to update pipeline stage");
      }
    },
    [grouped]
  );

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-foreground">Pipeline</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Drag and drop to move contacts through your sales pipeline
        </p>
      </div>

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4 flex-1">
          {PIPELINE_STAGES.map((stage) => {
            const contacts = grouped[stage] || [];
            return (
              <div
                key={stage}
                id={stage}
                className={cn(
                  "flex flex-col w-64 shrink-0 rounded-xl border bg-card/50",
                  COLUMN_STYLES[stage as Stage]
                )}
              >
                {/* Column header */}
                <div className="px-3 py-2.5 border-b border-border/50 flex items-center justify-between">
                  <h3
                    className={cn(
                      "text-xs font-semibold uppercase tracking-wider",
                      COLUMN_HEADER_STYLES[stage as Stage]
                    )}
                  >
                    {PIPELINE_STAGE_LABELS[stage as keyof typeof PIPELINE_STAGE_LABELS]}
                  </h3>
                  <span className="text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded-md">
                    {contacts.length}
                  </span>
                </div>

                {/* Cards */}
                <div className="flex-1 p-2 space-y-2 overflow-y-auto min-h-24">
                  <SortableContext
                    id={stage}
                    items={contacts.map((c) => c.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {contacts.map((contact) => (
                      <ContactCardItem key={contact.id} contact={contact} />
                    ))}
                  </SortableContext>
                </div>
              </div>
            );
          })}
        </div>

        <DragOverlay>
          {activeContact && (
            <div className="bg-card border border-primary/50 rounded-lg p-3 shadow-xl rotate-2 opacity-90 w-64">
              <p className="font-medium text-sm text-foreground">{activeContact.name}</p>
              {activeContact.company && (
                <p className="text-xs text-muted-foreground">{activeContact.company}</p>
              )}
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
