"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { formatRelativeTime, truncate, cn } from "@/lib/utils";
import { Send, ArrowLeft, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { PIPELINE_STAGE_LABELS } from "@whatsapp-crm/shared";

interface Message {
  id: string;
  direction: "INBOUND" | "OUTBOUND";
  body: string;
  createdAt: Date;
}

interface Contact {
  id: string;
  name: string;
  company: string | null;
  phone: string;
  pipelineStage: string;
  messages: Array<{ body: string; createdAt: Date; direction?: string }>;
}

const STAGE_STYLES: Record<string, string> = {
  NEW_LEAD: "bg-slate-500/15 text-slate-400",
  CONTACTED: "bg-blue-500/15 text-blue-400",
  REPLIED: "bg-violet-500/15 text-violet-400",
  NEGOTIATING: "bg-amber-500/15 text-amber-400",
  WON: "bg-green-500/15 text-green-400",
  LOST: "bg-red-500/15 text-red-400",
};

export function InboxClient({ conversations }: { conversations: Contact[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(
    conversations[0]?.id || null
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const selectedContact = conversations.find((c) => c.id === selectedId);

  useEffect(() => {
    if (!selectedId) return;
    setLoadingMessages(true);
    fetch(`/api/messages?contactId=${selectedId}`)
      .then((r) => r.json())
      .then((data: { messages: Message[] }) => {
        setMessages(data.messages || []);
        setLoadingMessages(false);
      })
      .catch(() => setLoadingMessages(false));
  }, [selectedId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendReply = async () => {
    if (!replyText.trim() || !selectedId || sending) return;
    setSending(true);

    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId: selectedId, body: replyText }),
      });
      const data = await res.json() as { message?: Message; error?: string };
      if (!res.ok) throw new Error(data.error || "Failed to send");

      setMessages((prev) => [...prev, { ...(data.message as Message), direction: "OUTBOUND" }]);
      setReplyText("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-screen">
      {/* Left: Conversation list */}
      <div className="w-72 shrink-0 border-r border-border flex flex-col">
        <div className="px-4 py-4 border-b border-border">
          <h1 className="text-lg font-bold text-foreground">Inbox</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {conversations.length} conversations
          </p>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-border">
          {conversations.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8 px-4">
              No conversations yet. Start a campaign to begin outreach.
            </p>
          ) : (
            conversations.map((c) => {
              const lastMsg = c.messages[0];
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={cn(
                    "w-full text-left px-4 py-3 hover:bg-secondary/30 transition-colors",
                    selectedId === c.id && "bg-secondary/50"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground truncate">
                      {c.name}
                    </p>
                    {lastMsg && (
                      <span className="text-xs text-muted-foreground shrink-0 ml-2">
                        {formatRelativeTime(lastMsg.createdAt)}
                      </span>
                    )}
                  </div>
                  {c.company && (
                    <p className="text-xs text-muted-foreground truncate">{c.company}</p>
                  )}
                  {lastMsg && (
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      {truncate(lastMsg.body, 45)}
                    </p>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Right: Conversation thread */}
      {selectedContact ? (
        <div className="flex-1 flex flex-col min-w-0">
          {/* Thread header */}
          <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <p className="font-semibold text-foreground">{selectedContact.name}</p>
                <span
                  className={cn(
                    "text-xs font-medium px-2 py-0.5 rounded-md",
                    STAGE_STYLES[selectedContact.pipelineStage]
                  )}
                >
                  {PIPELINE_STAGE_LABELS[selectedContact.pipelineStage as keyof typeof PIPELINE_STAGE_LABELS]}
                </span>
              </div>
              {selectedContact.company && (
                <p className="text-xs text-muted-foreground">{selectedContact.company}</p>
              )}
            </div>
            <Link
              href={`/contacts/${selectedContact.id}`}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              View Contact
            </Link>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {loadingMessages ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground text-sm">Loading...</p>
              </div>
            ) : messages.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">
                No messages yet
              </p>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex",
                    msg.direction === "OUTBOUND" ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[70%] rounded-2xl px-4 py-2.5 text-sm",
                      msg.direction === "OUTBOUND"
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-secondary text-foreground rounded-bl-sm"
                    )}
                  >
                    <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                    <p
                      className={cn(
                        "text-xs mt-1",
                        msg.direction === "OUTBOUND"
                          ? "text-primary-foreground/60"
                          : "text-muted-foreground"
                      )}
                    >
                      {formatRelativeTime(msg.createdAt)}
                    </p>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Reply input */}
          <div className="px-4 py-3 border-t border-border">
            <div className="flex items-end gap-2">
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendReply();
                  }
                }}
                placeholder="Type a reply... (Enter to send, Shift+Enter for newline)"
                rows={2}
                className="flex-1 resize-none rounded-xl bg-secondary border border-border text-foreground text-sm px-3.5 py-2.5 placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
              />
              <button
                onClick={sendReply}
                disabled={!replyText.trim() || sending}
                className="p-2.5 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 disabled:opacity-50 transition-colors shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground text-sm">Select a conversation</p>
        </div>
      )}
    </div>
  );
}
