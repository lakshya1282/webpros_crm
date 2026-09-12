"use client";

import Link from "next/link";
import { formatRelativeTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { PIPELINE_STAGE_LABELS } from "@whatsapp-crm/shared";
import type { Contact, Tag, ContactTag } from "@whatsapp-crm/db";

type ContactWithTags = Contact & {
  contactTags: (ContactTag & { tag: Tag })[];
};

const STAGE_STYLES: Record<string, string> = {
  NEW_LEAD: "bg-slate-500/15 text-slate-400",
  CONTACTED: "bg-blue-500/15 text-blue-400",
  REPLIED: "bg-violet-500/15 text-violet-400",
  NEGOTIATING: "bg-amber-500/15 text-amber-400",
  WON: "bg-green-500/15 text-green-400",
  LOST: "bg-red-500/15 text-red-400",
};

const MSG_STYLES: Record<string, string> = {
  NOT_CONTACTED: "bg-secondary text-muted-foreground",
  QUEUED: "bg-amber-500/15 text-amber-400",
  SENT: "bg-blue-500/15 text-blue-400",
  DELIVERED: "bg-cyan-500/15 text-cyan-400",
  REPLIED: "bg-violet-500/15 text-violet-400",
  FAILED: "bg-red-500/15 text-red-400",
};

export function ContactsTable({ contacts }: { contacts: ContactWithTags[] }) {
  if (contacts.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-12 text-center">
        <p className="text-muted-foreground text-sm">
          No contacts yet. Import a CSV/Excel file to get started.
        </p>
        <Link
          href="/imports"
          className="mt-4 inline-flex items-center text-sm text-primary hover:text-primary/80"
        >
          Import contacts →
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/30">
              <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                Name
              </th>
              <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                Company
              </th>
              <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                Phone
              </th>
              <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                Pipeline
              </th>
              <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                Status
              </th>
              <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                Tags
              </th>
              <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                Added
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {contacts.map((contact) => (
              <tr
                key={contact.id}
                className="hover:bg-secondary/20 transition-colors"
              >
                <td className="py-3 px-4">
                  <Link
                    href={`/contacts/${contact.id}`}
                    className="font-medium text-foreground hover:text-primary transition-colors"
                  >
                    {contact.name}
                  </Link>
                  {contact.doNotContact && (
                    <span className="ml-2 text-xs text-red-400">⛔ DNC</span>
                  )}
                </td>
                <td className="py-3 px-4 text-muted-foreground">
                  {contact.company || "—"}
                </td>
                <td className="py-3 px-4 text-muted-foreground font-mono text-xs">
                  {contact.phone}
                </td>
                <td className="py-3 px-4">
                  <span
                    className={cn(
                      "text-xs font-medium px-2 py-0.5 rounded-md",
                      STAGE_STYLES[contact.pipelineStage]
                    )}
                  >
                    {PIPELINE_STAGE_LABELS[contact.pipelineStage as keyof typeof PIPELINE_STAGE_LABELS]}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <span
                    className={cn(
                      "text-xs font-medium px-2 py-0.5 rounded-md",
                      MSG_STYLES[contact.messagingStatus]
                    )}
                  >
                    {contact.messagingStatus.replace("_", " ")}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <div className="flex flex-wrap gap-1">
                    {contact.contactTags.slice(0, 2).map((ct) => (
                      <span
                        key={ct.tagId}
                        className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded"
                      >
                        {ct.tag.name}
                      </span>
                    ))}
                    {contact.contactTags.length > 2 && (
                      <span className="text-xs text-muted-foreground">
                        +{contact.contactTags.length - 2}
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-3 px-4 text-muted-foreground text-xs">
                  {formatRelativeTime(contact.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
