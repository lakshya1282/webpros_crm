"use client";

import { useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import { formatRelativeTime, cn } from "@/lib/utils";
import { Upload, FileText, CheckCircle, XCircle, Clock, ChevronRight, Trash2 } from "lucide-react";
import { CONTACT_FIELD_LABELS, CONTACT_SCHEMA_FIELDS } from "@whatsapp-crm/shared";

type BatchStatus = "UPLOADED" | "PARSING" | "VALIDATING" | "READY" | "COMMITTED" | "FAILED";

interface Batch {
  id: string;
  filename: string;
  status: BatchStatus;
  tagName: string | null;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  createdAt: Date;
  completedAt: Date | null;
}

interface UploadStep {
  step: "upload" | "mapping" | "processing" | "done";
  batchId?: string;
  headers?: string[];
  mapping?: Record<string, string>;
}

const STATUS_ICONS: Record<BatchStatus, typeof CheckCircle> = {
  UPLOADED: Clock,
  PARSING: Clock,
  VALIDATING: Clock,
  READY: Clock,
  COMMITTED: CheckCircle,
  FAILED: XCircle,
};

const STATUS_STYLES: Record<BatchStatus, string> = {
  UPLOADED: "text-muted-foreground",
  PARSING: "text-amber-400",
  VALIDATING: "text-amber-400",
  READY: "text-blue-400",
  COMMITTED: "text-green-400",
  FAILED: "text-red-400",
};

export function ImportsClient({ batches: initialBatches }: { batches: Batch[] }) {
  const [batches, setBatches] = useState<Batch[]>(initialBatches);
  const [flow, setFlow] = useState<UploadStep>({ step: "upload" });
  const [uploading, setUploading] = useState(false);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [tagName, setTagName] = useState("");
  const [committing, setCommitting] = useState(false);
  const [deletingBatch, setDeletingBatch] = useState<Batch | null>(null);
  const [deleteContactsOption, setDeleteContactsOption] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDeleteBatch = async () => {
    if (!deletingBatch) return;
    setIsDeleting(true);
    try {
      const res = await fetch(
        `/api/imports/${deletingBatch.id}?deleteContacts=${deleteContactsOption}`,
        { method: "DELETE" }
      );
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error || "Failed to delete imported file");

      setBatches((prev) => prev.filter((b) => b.id !== deletingBatch.id));
      toast.success("Imported file deleted successfully");
      setDeletingBatch(null);
      setDeleteContactsOption(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete import file");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleFileSelect = useCallback(async (file: File) => {
    if (!file) return;
    setUploading(true);

    const formData = new FormData();
    formData.append("file", file);
    if (tagName) formData.append("tagName", tagName);

    try {
      const res = await fetch("/api/imports", { method: "POST", body: formData });
      let data: {
        batch?: { id: string; filename: string };
        detectedHeaders?: string[];
        error?: string;
      } = {};
      try {
        data = await res.json();
      } catch {
        throw new Error(`Server error (${res.status} ${res.statusText})`);
      }
      if (!res.ok) throw new Error(data.error || "Upload failed");

      // Auto-suggest mappings intelligently
      const headers = data.detectedHeaders || [];
      const autoMapping: Record<string, string> = {};

      const isNonPhone = (h: string) => {
        const lower = h.toLowerCase();
        return (
          lower.includes("serial") ||
          lower.includes("sr") ||
          lower.includes("order") ||
          lower.includes("invoice") ||
          lower.includes("ticket") ||
          lower.includes("id") ||
          lower.includes("code") ||
          lower.includes("pin") ||
          lower.includes("zip") ||
          lower.includes("account")
        );
      };

      // 1. Phone matching (highest priority, strict)
      for (const h of headers) {
        const lower = h.toLowerCase();
        if (isNonPhone(lower)) continue;
        if (
          lower.includes("whatsapp") ||
          lower.includes("mobile") ||
          lower.includes("phone") ||
          lower.includes("cell") ||
          lower.includes("tel") ||
          lower.includes("contact no")
        ) {
          autoMapping.phone = h;
          break;
        }
      }

      // 2. Name matching
      for (const h of headers) {
        const lower = h.toLowerCase();
        if (autoMapping.phone === h) continue;
        if (
          lower.includes("name") ||
          lower.includes("person") ||
          lower.includes("customer") ||
          lower.includes("client")
        ) {
          autoMapping.name = h;
          break;
        }
      }

      // 3. Company
      for (const h of headers) {
        const lower = h.toLowerCase();
        if (autoMapping.phone === h) continue;
        if (
          lower.includes("company") ||
          lower.includes("business") ||
          lower.includes("agency") ||
          lower.includes("firm") ||
          lower.includes("organization")
        ) {
          autoMapping.company = h;
          break;
        }
      }

      // 4. Email
      for (const h of headers) {
        const lower = h.toLowerCase();
        if (lower.includes("email") || lower.includes("mail")) {
          autoMapping.email = h;
          break;
        }
      }

      // 5. Source
      for (const h of headers) {
        const lower = h.toLowerCase();
        if (autoMapping.phone === h || autoMapping.name === h || autoMapping.company === h) continue;
        if (
          lower.includes("source") ||
          lower.includes("city") ||
          lower.includes("location") ||
          lower.includes("platform") ||
          lower.includes("channel")
        ) {
          autoMapping.source = h;
          break;
        }
      }

      setMapping(autoMapping);
      setFlow({
        step: "mapping",
        batchId: data.batch!.id,
        headers,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }, [tagName]);

  const handleCommit = async () => {
    if (!flow.batchId) return;
    if (!mapping.name || !mapping.phone) {
      toast.error("You must map at least the Name and Phone columns");
      return;
    }

    setCommitting(true);
    try {
      const res = await fetch(`/api/imports/${flow.batchId}/commit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mapping,
          tagName: tagName || undefined,
          defaultCountryCode: "IN",
        }),
      });
      const data = await res.json() as { success?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error || "Commit failed");

      setFlow({ step: "processing", batchId: flow.batchId });
      toast.success("Import started — processing contacts in the background");

      // Poll for completion
      const pollInterval = setInterval(async () => {
        const statusRes = await fetch(`/api/imports/${flow.batchId}`);
        const statusData = await statusRes.json() as { batch: Batch };
        if (statusData.batch.status === "COMMITTED" || statusData.batch.status === "FAILED") {
          clearInterval(pollInterval);
          setBatches((prev) => [statusData.batch, ...prev.filter((b) => b.id !== flow.batchId)]);
          setFlow({ step: "done", batchId: flow.batchId });
          if (statusData.batch.status === "COMMITTED") {
            toast.success(
              `Import complete: ${statusData.batch.validRows} new contacts, ${statusData.batch.duplicateRows} duplicates skipped, ${statusData.batch.invalidRows} invalid`
            );
          } else {
            toast.error("Import failed — check the batch details");
          }
        }
      }, 3000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Commit failed");
    } finally {
      setCommitting(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Imports</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Upload CSV or Excel files to import contacts
        </p>
      </div>

      {/* Upload wizard */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {flow.step === "upload" && (
          <div className="p-8 text-center">
            <div
              className="border-2 border-dashed border-border rounded-xl p-10 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file) handleFileSelect(file);
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground mb-1">
                {uploading ? "Uploading..." : "Drop your file here or click to browse"}
              </p>
              <p className="text-xs text-muted-foreground">
                Supports CSV and Excel (.xlsx) files up to 50MB
              </p>
            </div>

            <div className="mt-4">
              <input
                type="text"
                value={tagName}
                onChange={(e) => setTagName(e.target.value)}
                placeholder="Batch tag (optional) — e.g. Instagram agencies – Sept"
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-foreground text-sm placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileSelect(file);
              }}
            />
          </div>
        )}

        {flow.step === "mapping" && flow.headers && (
          <div className="p-6">
            <h3 className="text-sm font-semibold text-foreground mb-1">Map Columns</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Match the columns in your file to the CRM fields. <strong className="text-foreground">Name</strong> and <strong className="text-foreground">Phone</strong> are required.
            </p>
            <div className="space-y-3">
              {CONTACT_SCHEMA_FIELDS.map((field) => (
                <div key={field} className="flex items-center gap-3">
                  <label className="w-24 text-sm font-medium text-foreground shrink-0">
                    {CONTACT_FIELD_LABELS[field]}
                    {(field === "name" || field === "phone") && (
                      <span className="text-red-400 ml-0.5">*</span>
                    )}
                  </label>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  <select
                    value={mapping[field] || ""}
                    onChange={(e) =>
                      setMapping((prev) => ({ ...prev, [field]: e.target.value }))
                    }
                    className="flex-1 bg-secondary border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    <option value="">— Skip this field —</option>
                    {flow.headers!.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setFlow({ step: "upload" })}
                className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleCommit}
                disabled={committing}
                className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {committing ? "Starting import..." : "Import Contacts"}
              </button>
            </div>
          </div>
        )}

        {flow.step === "processing" && (
          <div className="p-10 text-center">
            <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm font-medium text-foreground">Processing import...</p>
            <p className="text-xs text-muted-foreground mt-1">
              Large files may take a minute. You&apos;ll be notified when it completes.
            </p>
          </div>
        )}

        {flow.step === "done" && (
          <div className="p-10 text-center">
            <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-4" />
            <p className="text-sm font-medium text-foreground">Import complete!</p>
            <button
              onClick={() => { setFlow({ step: "upload" }); setTagName(""); setMapping({}); }}
              className="mt-4 text-sm text-primary hover:text-primary/80"
            >
              Import another file
            </button>
          </div>
        )}
      </div>

      {/* Import history */}
      {batches.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">Import History</h3>
          </div>
          <div className="divide-y divide-border">
            {batches.map((batch) => {
              const Icon = STATUS_ICONS[batch.status];
              return (
                <div key={batch.id} className="px-4 py-3 flex items-center gap-3">
                  <Icon className={cn("w-4 h-4 shrink-0", STATUS_STYLES[batch.status])} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground truncate">{batch.filename}</p>
                      {batch.tagName && (
                        <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                          {batch.tagName}
                        </span>
                      )}
                    </div>
                    {batch.status === "COMMITTED" && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {batch.validRows.toLocaleString()} new ·{" "}
                        {batch.duplicateRows.toLocaleString()} dupes ·{" "}
                        {batch.invalidRows.toLocaleString()} invalid
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <span className={cn("text-xs font-medium", STATUS_STYLES[batch.status])}>
                      {batch.status}
                    </span>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatRelativeTime(batch.createdAt)}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setDeletingBatch(batch);
                      setDeleteContactsOption(false);
                    }}
                    title="Delete imported file"
                    className="p-2 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deletingBatch && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-red-400">
              <div className="p-2 bg-red-500/10 rounded-lg">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-base">Delete Imported File</h3>
                <p className="text-xs text-muted-foreground mt-0.5">This removes the file and import history.</p>
              </div>
            </div>

            <div className="bg-secondary/50 border border-border rounded-lg p-3 text-sm space-y-1">
              <p className="font-medium text-foreground truncate">{deletingBatch.filename}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Uploaded {formatRelativeTime(deletingBatch.createdAt)}</span>
                <span>•</span>
                <span className={cn("font-medium", STATUS_STYLES[deletingBatch.status])}>
                  {deletingBatch.status}
                </span>
                {deletingBatch.tagName && (
                  <>
                    <span>•</span>
                    <span className="text-primary">{deletingBatch.tagName}</span>
                  </>
                )}
              </div>
            </div>

            {deletingBatch.validRows > 0 && (
              <label className="flex items-start gap-3 p-3 rounded-lg border border-border bg-secondary/20 cursor-pointer hover:bg-secondary/40 transition-colors">
                <input
                  type="checkbox"
                  checked={deleteContactsOption}
                  onChange={(e) => setDeleteContactsOption(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-border text-red-500 focus:ring-red-500/50"
                />
                <div className="text-xs">
                  <span className="font-medium text-foreground block">
                    Also delete the {deletingBatch.validRows.toLocaleString()} contacts imported from this file
                  </span>
                  <span className="text-muted-foreground mt-0.5 block">
                    If unchecked, contacts will remain in your CRM but become unlinked from this file. Contacts with sent outreach messages are always preserved.
                  </span>
                </div>
              </label>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingBatch(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground border border-border rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteBatch}
                disabled={isDeleting}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {isDeleting ? "Deleting..." : "Delete File"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
