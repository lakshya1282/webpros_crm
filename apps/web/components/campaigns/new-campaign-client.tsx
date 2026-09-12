"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Eye } from "lucide-react";
import Link from "next/link";
import { renderTemplate } from "@whatsapp-crm/shared";

interface Tag {
  id: string;
  name: string;
  _count: { contactTags: number };
}

type Step = "audience" | "template" | "preview" | "confirm";

export function NewCampaignClient({ tags }: { tags: Tag[] }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("audience");
  const [name, setName] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [template, setTemplate] = useState("");
  const [previewContacts, setPreviewContacts] = useState<
    Array<{ id: string; name: string; company: string | null }>
  >([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [creating, setCreating] = useState(false);

  const selectedCount = selectedTagIds.reduce((sum, tagId) => {
    const tag = tags.find((t) => t.id === tagId);
    return sum + (tag?._count.contactTags || 0);
  }, 0);

  const loadPreview = async () => {
    if (!selectedTagIds.length) return;
    setLoadingPreview(true);
    try {
      const params = selectedTagIds.map((id) => `tagId=${id}`).join("&");
      const res = await fetch(`/api/contacts?${params}&limit=3`);
      const data = await res.json() as { contacts: Array<{ id: string; name: string; company: string | null }> };
      setPreviewContacts(data.contacts || []);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleSubmit = async () => {
    if (!name.trim() || !template.trim() || selectedTagIds.length === 0) return;
    setCreating(true);

    try {
      // Fetch all contact IDs for selected tags
      const params = selectedTagIds.map((id) => `tagId=${id}`).join("&");
      const contactsRes = await fetch(`/api/contacts?${params}&limit=200`);
      const contactsData = await contactsRes.json() as { contacts: Array<{ id: string }> };
      const contactIds = contactsData.contacts.map((c) => c.id);

      if (contactIds.length === 0) {
        toast.error("No eligible contacts found for selected tags");
        return;
      }

      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, messageTemplate: template, contactIds }),
      });
      const data = await res.json() as { campaign?: { id: string }; error?: string };
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Failed to create campaign");

      toast.success("Campaign created! Start it from the campaign page.");
      router.push(`/campaigns/${data.campaign!.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create campaign");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/campaigns" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">New Campaign</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Step {["audience", "template", "preview", "confirm"].indexOf(step) + 1} of 4</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-secondary rounded-full">
        <div
          className="h-full bg-primary rounded-full transition-all duration-300"
          style={{ width: `${(["audience", "template", "preview", "confirm"].indexOf(step) + 1) * 25}%` }}
        />
      </div>

      {/* Step 1: Audience */}
      {step === "audience" && (
        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground mb-3">Campaign Name & Audience</h2>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Campaign name (e.g. September Agency Outreach)"
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 mb-4"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground block mb-2">Select audience by tag</label>
            {tags.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No tags available. Import contacts with a batch tag first.
              </p>
            ) : (
              <div className="space-y-2">
                {tags.map((tag) => (
                  <label key={tag.id} className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-secondary/50">
                    <input
                      type="checkbox"
                      checked={selectedTagIds.includes(tag.id)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedTagIds((prev) => [...prev, tag.id]);
                        else setSelectedTagIds((prev) => prev.filter((id) => id !== tag.id));
                      }}
                      className="w-4 h-4 rounded border-border text-primary focus:ring-primary/50"
                    />
                    <span className="text-sm text-foreground">{tag.name}</span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {tag._count.contactTags.toLocaleString()} contacts
                    </span>
                  </label>
                ))}
              </div>
            )}
            {selectedTagIds.length > 0 && (
              <p className="text-xs text-primary mt-2">
                ~{selectedCount.toLocaleString()} contacts selected (excludes opted-out and archived)
              </p>
            )}
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => setStep("template")}
              disabled={!name.trim() || selectedTagIds.length === 0}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
            >
              Next: Write Message <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Template */}
      {step === "template" && (
        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Write Your Message</h2>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <label className="text-sm font-medium text-foreground">Message Template</label>
              <div className="flex gap-1.5">
                {["{{name}}", "{{company}}"].map((field) => (
                  <button
                    key={field}
                    onClick={() => setTemplate((prev) => prev + field)}
                    className="text-xs bg-primary/15 text-primary px-2 py-0.5 rounded hover:bg-primary/25 transition-colors"
                  >
                    {field}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              rows={6}
              placeholder="Hi {{name}}, I noticed {{company}} and wanted to reach out about..."
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {template.length} characters · Use {"{{name}}"} and {"{{company}}"} for personalization
            </p>
          </div>
          <div className="flex justify-between">
            <button onClick={() => setStep("audience")} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg">
              Back
            </button>
            <button
              onClick={async () => { await loadPreview(); setStep("preview"); }}
              disabled={!template.trim()}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
            >
              <Eye className="w-4 h-4" /> Preview
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Preview */}
      {step === "preview" && (
        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Message Previews</h2>
          <p className="text-xs text-muted-foreground">
            Here&apos;s how your message will look for a few sample contacts:
          </p>
          {loadingPreview ? (
            <p className="text-muted-foreground text-sm">Loading previews...</p>
          ) : previewContacts.length === 0 ? (
            <p className="text-muted-foreground text-sm">No contacts available for preview</p>
          ) : (
            previewContacts.map((contact) => (
              <div key={contact.id} className="bg-secondary/50 rounded-xl p-4">
                <p className="text-xs text-muted-foreground mb-2 font-medium">
                  → {contact.name}{contact.company ? ` (${contact.company})` : ""}
                </p>
                <p className="text-sm text-foreground whitespace-pre-wrap">
                  {renderTemplate(template, { name: contact.name, company: contact.company })}
                </p>
              </div>
            ))
          )}
          <div className="flex justify-between">
            <button onClick={() => setStep("template")} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg">
              Edit Message
            </button>
            <button
              onClick={() => setStep("confirm")}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
            >
              Looks Good <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Confirm */}
      {step === "confirm" && (
        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Review & Create</h2>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between py-2 border-b border-border">
              <span className="text-muted-foreground">Campaign name</span>
              <span className="text-foreground font-medium">{name}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border">
              <span className="text-muted-foreground">Audience</span>
              <span className="text-foreground font-medium">~{selectedCount.toLocaleString()} contacts</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border">
              <span className="text-muted-foreground">Tags</span>
              <div className="flex gap-1 flex-wrap justify-end">
                {selectedTagIds.map((id) => {
                  const tag = tags.find((t) => t.id === id);
                  return tag ? (
                    <span key={id} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                      {tag.name}
                    </span>
                  ) : null;
                })}
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
            ⚠️ The campaign will be created in <strong>DRAFT</strong> status. You&apos;ll need to click <strong>Start Campaign</strong> on the campaign page to begin sending.
          </p>
          <div className="flex justify-between">
            <button onClick={() => setStep("preview")} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg">
              Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={creating}
              className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create Campaign"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
