import Link from "next/link";
import { formatRelativeTime, truncate } from "@/lib/utils";
import { ChevronRight, MessageCircle } from "lucide-react";

interface Message {
  id: string;
  body: string;
  createdAt: Date;
  contact: { id: string; name: string; company: string | null };
}

export function RecentActivity({ messages }: { messages: Message[] }) {
  return (
    <div className="bg-card border border-border rounded-xl">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">
          Recent Replies
        </h2>
        <Link
          href="/inbox"
          className="text-xs text-primary hover:text-primary/80 flex items-center gap-0.5"
        >
          Open inbox <ChevronRight className="w-3 h-3" />
        </Link>
      </div>
      <div className="divide-y divide-border">
        {messages.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-8">
            No replies yet
          </p>
        ) : (
          messages.map((msg) => (
            <Link
              key={msg.id}
              href={`/inbox/${msg.contact.id}`}
              className="flex items-start gap-3 px-5 py-3.5 hover:bg-secondary/30 transition-colors"
            >
              <div className="shrink-0 mt-0.5 w-7 h-7 rounded-full bg-violet-500/15 flex items-center justify-center">
                <MessageCircle className="w-3.5 h-3.5 text-violet-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground truncate">
                    {msg.contact.name}
                  </p>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatRelativeTime(msg.createdAt)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {msg.contact.company && (
                    <span className="text-muted-foreground/70">{msg.contact.company} · </span>
                  )}
                  {truncate(msg.body, 60)}
                </p>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
