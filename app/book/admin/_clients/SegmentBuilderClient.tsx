"use client";

import { useEffect, useState } from "react";
import { Filter, Plus, Save, Send, Trash2, Users, Download, X } from "lucide-react";
import { adminGet, adminPost } from "@/app/book/admin/_components/admin-api";
import { fetchBookJson } from "@/app/book/_lib/book-api";
import { AdminCard, PageHeader } from "@/app/book/admin/_components/AdminCard";
import { ErrorAlert } from "@/app/book/admin/_components/ErrorAlert";
import { EmptyState } from "@/components/ui/EmptyState";
import { downloadCSV } from "@/app/book/admin/_components/csv";
import { MAX_SYNC_RECIPIENTS } from "@/app/app/api/book/admin/segments/notify-limits-core";

type FilterField =
  | "plan"
  | "proSource"
  | "country"
  | "lastActiveWithinDays"
  | "booksCompleted"
  | "flowPoints"
  | "signupWithinDays"
  | "hasBadge"
  | "hasCompletedOnboarding";

type Operator =
  | "is" | "isNot" | "gt" | "lt" | "gte" | "lte" | "between"
  | "contains" | "isEmpty" | "isNotEmpty";

type SegmentFilter = {
  field: FilterField;
  operator: Operator;
  value?: string | number;
  valueMax?: number;
};

type Segment = {
  segmentId: string;
  name: string;
  description?: string;
  filters: SegmentFilter[];
  createdAt: string;
  updatedAt: string;
  lastRunCount?: number;
  lastRunAt?: string;
};

type PreviewUser = {
  userId: string;
  email: string | null;
  plan: string;
  proSource: string | null;
  countryCode: string | null;
  lastActiveAt: string | null;
  booksCompleted: number;
  flowPoints: number;
};

type PreviewResp = {
  totalScanned: number;
  matchCount: number;
  preview: PreviewUser[];
};

const FIELD_LABELS: Record<FilterField, string> = {
  plan: "Plan",
  proSource: "PRO source",
  country: "Country",
  lastActiveWithinDays: "Last active within (days)",
  booksCompleted: "Books completed",
  flowPoints: "Insight Points",
  signupWithinDays: "Signup within (days)",
  hasBadge: "Has earned badge",
  hasCompletedOnboarding: "Completed onboarding",
};

const OPERATORS_BY_FIELD: Record<FilterField, Operator[]> = {
  plan: ["is", "isNot"],
  proSource: ["is", "isNot", "isEmpty", "isNotEmpty"],
  country: ["is", "isNot", "contains", "isEmpty"],
  lastActiveWithinDays: ["gt", "lt"],
  signupWithinDays: ["gt", "lt"],
  booksCompleted: ["is", "gt", "lt", "gte", "lte", "between"],
  flowPoints: ["is", "gt", "lt", "gte", "lte", "between"],
  hasBadge: ["is", "isNot"],
  hasCompletedOnboarding: ["is", "isNot"],
};

const OPERATOR_LABELS: Record<Operator, string> = {
  is: "is",
  isNot: "is not",
  gt: ">",
  lt: "<",
  gte: "≥",
  lte: "≤",
  between: "between",
  contains: "contains",
  isEmpty: "is empty",
  isNotEmpty: "is not empty",
};

export function SegmentBuilderClient() {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [filters, setFilters] = useState<SegmentFilter[]>([
    { field: "plan", operator: "is", value: "PRO" },
  ]);
  const [preview, setPreview] = useState<PreviewResp | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Notify modal state
  const [notifyOpen, setNotifyOpen] = useState<Segment | null>(null);
  // Inline delete-confirm state (avoids native confirm())
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const loadSegments = () => {
    setLoading(true);
    adminGet<{ segments: Segment[] }>("/segments")
      .then((d) => setSegments(d.segments))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadSegments();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(t);
  }, [toast]);

  // Debounced preview — refetch when filters change
  useEffect(() => {
    if (filters.length === 0) {
      setPreview(null);
      return;
    }
    const t = window.setTimeout(async () => {
      setPreviewing(true);
      try {
        const res = await adminPost<PreviewResp>("/segments/preview", { filters });
        setPreview(res);
      } catch (err) {
        console.warn("preview failed", err);
      } finally {
        setPreviewing(false);
      }
    }, 500);
    return () => window.clearTimeout(t);
  }, [filters]);

  const addFilter = () => {
    setFilters((f) => [
      ...f,
      { field: "country", operator: "is", value: "" },
    ]);
  };

  const updateFilter = (idx: number, patch: Partial<SegmentFilter>) => {
    setFilters((fs) =>
      fs.map((f, i) => (i === idx ? ({ ...f, ...patch } as SegmentFilter) : f)),
    );
  };

  const removeFilter = (idx: number) => {
    setFilters((fs) => fs.filter((_, i) => i !== idx));
  };

  const saveSegment = async () => {
    if (!name.trim() || filters.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      await adminPost("/segments", {
        name: name.trim(),
        description: description.trim() || undefined,
        filters,
      });
      setName("");
      setDescription("");
      loadSegments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const deleteSegment = async (segmentId: string) => {
    setConfirmDeleteId(null);
    try {
      await fetchBookJson(`/app/api/book/admin/segments/${segmentId}`, { method: "DELETE" });
      setToast("Segment deleted.");
      loadSegments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  const matchCount = preview?.matchCount ?? 0;

  return (
    <div>
      <PageHeader
        title="Segments"
        description="Filter users by any combination of attributes. Save and run bulk actions."
      />

      {error && <ErrorAlert error={error} onRetry={() => setError(null)} />}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <AdminCard
          title="Build segment"
          description="Filters are joined with AND"
          className="lg:col-span-2"
        >
          <div className="space-y-3">
            {filters.map((f, idx) => (
              <div
                key={idx}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-(--cf-border) bg-(--cf-surface-muted) p-3"
              >
                <select
                  value={f.field}
                  onChange={(e) =>
                    updateFilter(idx, {
                      field: e.target.value as FilterField,
                      operator: OPERATORS_BY_FIELD[e.target.value as FilterField][0],
                      value: "",
                    })
                  }
                  className="rounded-md border border-(--cf-border) bg-(--cf-surface) px-2 py-1 text-[12px] text-(--cf-text-1)"
                >
                  {(Object.keys(FIELD_LABELS) as FilterField[]).map((fld) => (
                    <option key={fld} value={fld}>
                      {FIELD_LABELS[fld]}
                    </option>
                  ))}
                </select>
                <select
                  value={f.operator}
                  onChange={(e) =>
                    updateFilter(idx, { operator: e.target.value as Operator })
                  }
                  className="rounded-md border border-(--cf-border) bg-(--cf-surface) px-2 py-1 text-[12px] text-(--cf-text-1)"
                >
                  {OPERATORS_BY_FIELD[f.field].map((op) => (
                    <option key={op} value={op}>
                      {OPERATOR_LABELS[op]}
                    </option>
                  ))}
                </select>
                {!["isEmpty", "isNotEmpty"].includes(f.operator) && (
                  <input
                    type="text"
                    value={String(f.value ?? "")}
                    onChange={(e) => updateFilter(idx, { value: e.target.value })}
                    placeholder={filterPlaceholder(f.field)}
                    className="flex-1 rounded-md border border-(--cf-border) bg-(--cf-surface) px-2 py-1 text-[12px] text-(--cf-text-1) placeholder:text-(--cf-text-soft) min-w-[120px]"
                  />
                )}
                {f.operator === "between" && (
                  <input
                    type="number"
                    value={String(f.valueMax ?? "")}
                    onChange={(e) =>
                      updateFilter(idx, { valueMax: Number(e.target.value) })
                    }
                    placeholder="and"
                    className="w-24 rounded-md border border-(--cf-border) bg-(--cf-surface) px-2 py-1 text-[12px] text-(--cf-text-1)"
                  />
                )}
                <button
                  type="button"
                  onClick={() => removeFilter(idx)}
                  className="rounded-md p-1 text-(--cf-text-soft) hover:bg-(--cf-surface) hover:text-(--cf-danger-text)"
                  aria-label="Remove filter"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={addFilter}
              className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-(--cf-border) bg-(--cf-surface) px-3 py-1.5 text-[12px] font-medium text-(--cf-text-2) hover:bg-(--cf-surface-muted)"
            >
              <Plus className="h-3.5 w-3.5" />
              Add filter
            </button>
          </div>

          <div className="mt-5 space-y-2 rounded-xl border border-(--cf-accent-border)/30 bg-(--cf-accent-soft)/20 p-3">
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-(--cf-text-3)">Matches</span>
              <span className="tabular-nums text-[18px] font-semibold text-(--cf-accent)">
                {previewing ? "…" : matchCount.toLocaleString()}
              </span>
            </div>
            <p className="text-[11px] text-(--cf-text-soft)">
              of {preview?.totalScanned.toLocaleString() ?? "—"} users scanned
            </p>
          </div>

          <div className="mt-4 space-y-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Segment name (e.g. 'PRO users in CA inactive 14d')"
              className="w-full rounded-lg border border-(--cf-border) bg-(--cf-surface) px-3 py-2 text-[13px] text-(--cf-text-1) placeholder:text-(--cf-text-soft) focus:border-(--cf-accent) focus:outline-none focus:ring focus:ring-(--cf-accent)/20"
            />
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description (optional)"
              className="w-full rounded-lg border border-(--cf-border) bg-(--cf-surface) px-3 py-2 text-[13px] text-(--cf-text-1) placeholder:text-(--cf-text-soft) focus:border-(--cf-accent) focus:outline-none"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={saveSegment}
                disabled={!name.trim() || filters.length === 0 || saving}
                className="inline-flex items-center gap-1.5 rounded-xl bg-(--cf-accent) px-3.5 py-1.5 text-[13px] font-semibold text-(--cf-accent-contrast) transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save className="h-3.5 w-3.5" />
                {saving ? "Saving..." : "Save segment"}
              </button>
              {preview && preview.preview.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const exported = downloadCSV(
                      preview.preview as unknown as Record<string, unknown>[],
                      `segment-preview-${new Date().toISOString().slice(0, 10)}.csv`,
                    );
                    if (!exported) setToast("Nothing to export.");
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-(--cf-border) bg-(--cf-surface) px-3 py-1.5 text-[12px] font-medium text-(--cf-text-2) hover:bg-(--cf-surface-muted)"
                >
                  <Download className="h-3.5 w-3.5" />
                  CSV preview
                </button>
              )}
            </div>
          </div>
        </AdminCard>

        <AdminCard title="Preview" description={`First 25 of ${matchCount} matches`}>
          {(preview?.preview.length ?? 0) === 0 ? (
            <EmptyState
              icon={Users}
              title="No matches"
              description="Adjust your filters to see matching users."
              compact
            />
          ) : (
            <div className="max-h-96 overflow-y-auto space-y-1.5">
              {preview?.preview.map((u) => (
                <div
                  key={u.userId}
                  className="rounded-lg border border-(--cf-border)/50 bg-(--cf-surface-muted)/40 px-2.5 py-1.5 text-[11px]"
                >
                  <p className="truncate text-(--cf-text-1)">{u.email ?? u.userId.slice(0, 12)}</p>
                  <p className="text-(--cf-text-soft)">
                    {u.plan}
                    {u.countryCode ? ` · ${u.countryCode}` : ""}
                    {u.booksCompleted > 0 ? ` · ${u.booksCompleted} books` : ""}
                    {u.flowPoints > 0 ? ` · ${u.flowPoints} IP` : ""}
                  </p>
                </div>
              ))}
            </div>
          )}
        </AdminCard>
      </div>

      <div className="mt-6">
        <AdminCard
          title={`Saved segments (${segments.length})`}
          description="Click a segment to run a bulk action"
        >
          {loading && segments.length === 0 ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl bg-(--cf-surface-muted)" />
              ))}
            </div>
          ) : segments.length === 0 ? (
            <EmptyState
              icon={Filter}
              title="No saved segments yet"
              description="Build and save segments above to run bulk actions later."
              compact
            />
          ) : (
            <div className="space-y-2">
              {segments.map((s) => (
                <div
                  key={s.segmentId}
                  className="cf-panel-muted rounded-xl p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-medium text-(--cf-text-1)">{s.name}</p>
                      {s.description && (
                        <p className="mt-0.5 text-[12px] text-(--cf-text-3)">{s.description}</p>
                      )}
                      <p className="mt-1 text-[11px] text-(--cf-text-soft)">
                        {s.filters.length} filter{s.filters.length === 1 ? "" : "s"} ·
                        {s.lastRunCount !== undefined
                          ? ` last run: ${s.lastRunCount} users`
                          : " never run"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setNotifyOpen(s)}
                        className="inline-flex items-center gap-1 rounded-md border border-(--cf-border) bg-(--cf-surface) px-2 py-1 text-[11px] text-(--cf-text-2) hover:bg-(--cf-accent-soft) hover:text-(--cf-accent)"
                      >
                        <Send className="h-3 w-3" />
                        Notify
                      </button>
                      {confirmDeleteId === s.segmentId ? (
                        <>
                          <button
                            type="button"
                            onClick={() => deleteSegment(s.segmentId)}
                            className="inline-flex items-center gap-1 rounded-md border border-(--cf-danger-border) bg-(--cf-danger-soft) px-2 py-1 text-[11px] font-semibold text-(--cf-danger-text) hover:opacity-90"
                          >
                            <Trash2 className="h-3 w-3" />
                            Confirm delete
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="rounded-md border border-(--cf-border) bg-(--cf-surface) px-2 py-1 text-[11px] text-(--cf-text-2) hover:bg-(--cf-surface-muted)"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(s.segmentId)}
                          className="rounded-md border border-(--cf-border) bg-(--cf-surface) p-1.5 text-(--cf-text-soft) hover:bg-(--cf-danger-soft) hover:text-(--cf-danger-text)"
                          aria-label="Delete segment"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </AdminCard>
      </div>

      {notifyOpen && (
        <NotifyModal
          segment={notifyOpen}
          onClose={() => setNotifyOpen(null)}
          onSuccess={(msg) => {
            setNotifyOpen(null);
            setToast(msg);
          }}
        />
      )}

      {toast && (
        <div className="fixed bottom-8 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-(--cf-border) bg-(--cf-surface-strong) px-3 py-2 text-sm text-(--cf-text-1) shadow-[0_14px_28px_rgba(0,0,0,0.22)]">
          {toast}
        </div>
      )}
    </div>
  );
}

function NotifyModal({
  segment,
  onClose,
  onSuccess,
}: {
  segment: Segment;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Live match count for this segment's filters (re-run on open so the admin
  // sees how many users will actually be notified before firing).
  const [matchCount, setMatchCount] = useState<number | null>(null);
  const [countLoading, setCountLoading] = useState(true);
  // Two-step send: first click reveals an inline confirm echoing the count.
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setCountLoading(true);
    adminPost<PreviewResp>("/segments/preview", { filters: segment.filters })
      .then((res) => {
        if (!cancelled) setMatchCount(res.matchCount);
      })
      .catch(() => {
        if (!cancelled) setMatchCount(null);
      })
      .finally(() => {
        if (!cancelled) setCountLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [segment.filters]);

  const send = async () => {
    setSending(true);
    setError(null);
    try {
      const res = await adminPost<{ sent: number; failed: number; targetedCount: number }>(
        `/segments/${segment.segmentId}/notify`,
        { title, message },
      );
      onSuccess(`Sent to ${res.sent} of ${res.targetedCount} users (${res.failed} failed).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send");
      setConfirming(false);
    } finally {
      setSending(false);
    }
  };

  const canSend = !!title.trim() && !!message.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="cf-panel-strong w-full max-w-md rounded-2xl p-5">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold text-(--cf-text-1)">
              Send notification
            </h2>
            <p className="mt-0.5 text-[12px] text-(--cf-text-3)">
              To segment: <span className="font-medium">{segment.name}</span>
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-(--cf-text-soft) hover:bg-(--cf-surface-muted)"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3">
          <div className="rounded-xl border border-(--cf-accent-border)/30 bg-(--cf-accent-soft)/20 px-3 py-2.5">
            {countLoading ? (
              <p className="text-[13px] text-(--cf-text-3)">
                Counting recipients…
              </p>
            ) : matchCount === null ? (
              <p className="text-[13px] text-(--cf-danger-text)">
                Could not load the recipient count. Re-run the segment before sending.
              </p>
            ) : (
              <p className="text-[13px] text-(--cf-text-1)">
                This will notify{" "}
                <span className="font-semibold tabular-nums text-(--cf-accent)">
                  {matchCount.toLocaleString()}
                </span>{" "}
                user{matchCount === 1 ? "" : "s"}
                {matchCount > MAX_SYNC_RECIPIENTS
                  ? ` (over the ${MAX_SYNC_RECIPIENTS.toLocaleString()}-recipient per-send cap — refine your filters)`
                  : ""}
                .
              </p>
            )}
          </div>
          <input
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setConfirming(false);
            }}
            placeholder="Notification title"
            className="w-full rounded-lg border border-(--cf-border) bg-(--cf-surface) px-3 py-2 text-[13px] text-(--cf-text-1) focus:border-(--cf-accent) focus:outline-none"
          />
          <textarea
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              setConfirming(false);
            }}
            placeholder="Message body"
            rows={4}
            className="w-full rounded-lg border border-(--cf-border) bg-(--cf-surface) px-3 py-2 text-[13px] text-(--cf-text-1) focus:border-(--cf-accent) focus:outline-none"
          />
          {error && <p className="text-[12px] text-(--cf-danger-text)">{error}</p>}
          {confirming && !sending && (
            <p className="text-[12px] font-medium text-(--cf-danger-text)">
              This sends an in-app and email notification to{" "}
              {matchCount !== null ? matchCount.toLocaleString() : "these"} user
              {matchCount === 1 ? "" : "s"} and cannot be undone. Send anyway?
            </p>
          )}
          <div className="flex items-center gap-2">
            {confirming ? (
              <button
                type="button"
                onClick={send}
                disabled={!canSend || sending || countLoading}
                className="inline-flex items-center gap-1.5 rounded-xl bg-(--cf-danger-text) px-3.5 py-1.5 text-[13px] font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
              >
                <Send className="h-3.5 w-3.5" />
                {sending
                  ? "Sending..."
                  : `Confirm send to ${
                      matchCount !== null ? matchCount.toLocaleString() : "users"
                    }`}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                disabled={!canSend || sending || countLoading}
                className="inline-flex items-center gap-1.5 rounded-xl bg-(--cf-accent) px-3.5 py-1.5 text-[13px] font-semibold text-(--cf-accent-contrast) transition hover:brightness-110 disabled:opacity-60"
              >
                <Send className="h-3.5 w-3.5" />
                Send now
              </button>
            )}
            <button
              type="button"
              onClick={confirming ? () => setConfirming(false) : onClose}
              disabled={sending}
              className="rounded-xl border border-(--cf-border) bg-(--cf-surface) px-3.5 py-1.5 text-[13px] font-medium text-(--cf-text-2) hover:bg-(--cf-surface-muted) disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function filterPlaceholder(field: FilterField): string {
  switch (field) {
    case "plan":
      return "FREE or PRO";
    case "proSource":
      return "stripe, license, flow_points, or gift_code";
    case "country":
      return "US, CA, GB…";
    case "lastActiveWithinDays":
    case "signupWithinDays":
      return "days (e.g. 7)";
    case "booksCompleted":
    case "flowPoints":
      return "number";
    case "hasBadge":
    case "hasCompletedOnboarding":
      return "true";
    default:
      return "value";
  }
}

