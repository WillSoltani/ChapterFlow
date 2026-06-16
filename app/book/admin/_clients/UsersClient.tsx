"use client";

import { useEffect, useState } from "react";
import {
  ChevronRight,
  Download,
  Search,
  Users as UsersIcon,
  X,
  RotateCcw,
  UserX,
  Trash2,
  ShieldAlert,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { adminGet, adminPost } from "@/app/book/admin/_components/admin-api";
import { downloadCSV } from "@/app/book/admin/_components/csv";
import { AdminCard, PageHeader } from "@/app/book/admin/_components/AdminCard";
import { ErrorAlert } from "@/app/book/admin/_components/ErrorAlert";
import { EmptyState } from "@/components/ui/EmptyState";
import { TableSkeleton } from "@/app/book/admin/_components/Skeleton";
import { StatBox } from "@/app/book/admin/_components/StatBox";

type UserRow = {
  userId: string;
  email: string | null;
  plan: string;
  proStatus: string | null;
  proSource: string | null;
  firstSeenAt: string | null;
  lastActiveAt: string | null;
  totalReadingMs: number;
  totalQuizAttempts: number;
  totalQuizPasses: number;
  flowPoints: number;
  booksCompleted: number;
  badgeCount: number;
  onboardingCompletedAt: string | null;
};

type SearchResp = { users: UserRow[]; total: number };

type UserDetailResp = {
  userId: string;
  snapshot: Record<string, unknown> | null;
  entitlement: Record<string, unknown> | null;
  engagement: Record<string, unknown> | null;
  progress: Array<{
    bookId: string;
    currentChapterNumber: number;
    unlockedThroughChapterNumber: number;
    completedChapters: number[];
    lastActiveAt: string;
    preferredVariant?: string;
  }>;
  events: Array<{
    eventId: string;
    eventType: string;
    occurredAt: string;
    bookId?: string;
    chapterNumber?: number;
  }>;
  accountStatus?: "active" | "deactivated" | "deleted";
  accountStatusChangedAt?: string | null;
  accountStatusHistory?: Array<{
    status: string;
    previousStatus?: string | null;
    changedAt: string;
    changedBy: string;
    reason?: string;
  }>;
};

export function UsersClient() {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<UserRow | null>(null);
  const [detail, setDetail] = useState<UserDetailResp | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const reload = async (q?: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (q) params.set("q", q);
      const data = await adminGet<SearchResp>(`/users/search?${params.toString()}`);
      setUsers(data.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    reload(query.trim());
  };

  const openDetail = async (user: UserRow) => {
    setSelected(user);
    setDetailLoading(true);
    setDetail(null);
    try {
      const data = await adminGet<UserDetailResp>(
        `/users/${encodeURIComponent(user.userId)}`,
      );
      setDetail(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load user detail");
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setSelected(null);
    setDetail(null);
  };

  // ESC closes drawer + body scroll lock
  useEffect(() => {
    if (!selected) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDetail();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [selected]);

  return (
    <div>
      <PageHeader
        title="Users"
        description={users.length > 0 ? `${users.length} users loaded` : "Search and inspect any user"}
        action={
          <div className="flex items-center gap-2">
            <form onSubmit={onSearch} className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-(--cf-text-soft)" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by email"
                  className="w-72 rounded-lg border border-(--cf-border) bg-(--cf-surface) py-1.5 pl-8 pr-3 text-[12px] text-(--cf-text-1) placeholder:text-(--cf-text-soft) shadow-(--cf-input-inset-shadow) focus:border-(--cf-accent) focus:outline-none focus:ring focus:ring-(--cf-accent)/20"
                />
              </div>
              <button
                type="submit"
                className="rounded-lg border border-(--cf-border) bg-(--cf-surface) px-3 py-1.5 text-[12px] font-medium text-(--cf-text-2) shadow-(--cf-input-inset-shadow) transition hover:bg-(--cf-surface-muted) hover:text-(--cf-text-1)"
              >
                Search
              </button>
            </form>
            <button
              type="button"
              onClick={() =>
                downloadCSV(
                  users as unknown as Record<string, unknown>[],
                  `users-${new Date().toISOString().slice(0, 10)}.csv`,
                )
              }
              disabled={users.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-(--cf-border) bg-(--cf-surface) px-3 py-1.5 text-[12px] font-medium text-(--cf-text-2) shadow-(--cf-input-inset-shadow) transition hover:bg-(--cf-surface-muted) hover:text-(--cf-text-1) disabled:cursor-not-allowed disabled:opacity-60"
              title="Export visible rows as CSV"
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </button>
          </div>
        }
      />

      {error && <ErrorAlert error={error} onRetry={() => reload(query)} />}

      <AdminCard>
        {loading && users.length === 0 ? (
          <TableSkeleton rows={8} cols={8} />
        ) : users.length === 0 ? (
          <EmptyState
            icon={UsersIcon}
            title={query ? `No matches for "${query}"` : "No users found"}
            description={query ? "Try a different email substring." : "Once people sign up, they'll appear here."}
            compact
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-(--cf-border) text-left text-[11px] uppercase tracking-[0.08em] text-(--cf-text-soft)">
                  <th className="py-2 pr-3">Email</th>
                  <th className="py-2 pr-3">Plan</th>
                  <th className="py-2 pr-3 text-right">IP</th>
                  <th className="py-2 pr-3 text-right">Books</th>
                  <th className="py-2 pr-3 text-right">Quiz pass / attempts</th>
                  <th className="py-2 pr-3 text-right">Reading</th>
                  <th className="py-2 pr-3 text-right">Badges</th>
                  <th className="py-2 pr-3">Last active</th>
                  <th className="w-6" />
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr
                    key={u.userId}
                    role="button"
                    tabIndex={0}
                    aria-label={`Open detail for ${u.email ?? u.userId}`}
                    className="group cursor-pointer border-b border-(--cf-border)/50 transition hover:bg-(--cf-accent-soft)/30 focus:bg-(--cf-accent-soft)/30 focus:outline-none"
                    onClick={() => openDetail(u)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openDetail(u);
                      }
                    }}
                  >
                    <td className="py-2 pr-3 text-(--cf-text-1)" title={u.userId}>
                      {u.email ?? (
                        <span className="font-mono text-[11px] text-(--cf-text-3)">
                          {u.userId.slice(0, 12)}…
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={[
                            "inline-block rounded-md px-1.5 py-0.5 text-[11px] font-medium",
                            u.plan === "PRO"
                              ? "border border-(--cf-accent-border) bg-(--cf-accent-soft) text-(--cf-accent)"
                              : "border border-(--cf-border) bg-(--cf-surface-muted) text-(--cf-text-soft)",
                          ].join(" ")}
                        >
                          {u.plan}
                        </span>
                        {u.plan === "PRO" && u.proSource && (
                          <span className="text-[10px] font-medium uppercase tracking-[0.06em] text-(--cf-text-soft)">
                            {u.proSource}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-(--cf-text-2)">
                      {u.flowPoints.toLocaleString()}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-(--cf-text-2)">
                      {u.booksCompleted}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-(--cf-text-2)">
                      {u.totalQuizPasses}/{u.totalQuizAttempts}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-(--cf-text-2)">
                      {Math.round(u.totalReadingMs / 60000).toLocaleString()}m
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-(--cf-text-2)">
                      {u.badgeCount}
                    </td>
                    <td className="py-2 pr-3 text-(--cf-text-3)">
                      {formatRelative(u.lastActiveAt)}
                    </td>
                    <td className="py-2 pr-1 text-right">
                      <ChevronRight
                        className="h-3.5 w-3.5 text-(--cf-text-soft) opacity-0 transition group-hover:opacity-100 group-focus:opacity-100"
                        aria-hidden="true"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminCard>

      <AnimatePresence>
        {selected && (
          <UserDetailDrawer
            user={selected}
            detail={detail}
            loading={detailLoading}
            onClose={closeDetail}
            onRefresh={() => openDetail(selected)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function UserDetailDrawer({
  user,
  detail,
  loading,
  onClose,
  onRefresh,
}: {
  user: UserRow;
  detail: UserDetailResp | null;
  loading: boolean;
  onClose: () => void;
  onRefresh: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex">
      <motion.div
        className="flex-1 bg-black/60 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        onClick={onClose}
        aria-hidden="true"
      />
      <motion.aside
        role="dialog"
        aria-modal="true"
        aria-label={`User detail for ${user.email ?? user.userId}`}
        className="cf-panel-strong w-full max-w-xl overflow-y-auto border-l border-(--cf-border) shadow-2xl"
        initial={{ x: 24, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 24, opacity: 0 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-(--cf-border) bg-(--cf-surface-strong) p-5">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold tracking-tight text-(--cf-text-1)">
              {user.email ?? user.userId}
            </h2>
            <p className="font-mono text-[11px] text-(--cf-text-3)">{user.userId}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close drawer"
            className="rounded-md border border-(--cf-border) p-1.5 text-(--cf-text-2) transition hover:bg-(--cf-surface-muted) hover:text-(--cf-text-1)"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-5 p-5">
          {loading && (
            <div className="space-y-2">
              <div className="h-4 animate-pulse rounded bg-(--cf-surface-muted)" />
              <div className="h-4 w-3/4 animate-pulse rounded bg-(--cf-surface-muted)" />
              <div className="grid grid-cols-2 gap-2 pt-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-12 animate-pulse rounded-lg bg-(--cf-surface-muted)" />
                ))}
              </div>
            </div>
          )}

          {detail && (
            <>
              <Section title="Snapshot">
                <div className="grid grid-cols-2 gap-2">
                  <StatBox
                    label="Plan"
                    value={
                      user.plan === "PRO" && user.proSource
                        ? `PRO · ${user.proSource}`
                        : user.plan
                    }
                  />
                  <StatBox label="PRO status" value={user.proStatus ?? "—"} />
                  <StatBox label="Insight Points" value={user.flowPoints.toLocaleString()} />
                  <StatBox label="Books completed" value={user.booksCompleted} />
                  <StatBox
                    label="Quiz pass / attempts"
                    value={`${user.totalQuizPasses}/${user.totalQuizAttempts}`}
                  />
                  <StatBox
                    label="Reading minutes"
                    value={Math.round(user.totalReadingMs / 60000).toLocaleString()}
                  />
                  <StatBox label="Badges" value={user.badgeCount} />
                  <StatBox label="First seen" value={formatRelative(user.firstSeenAt)} />
                  <StatBox label="Last active" value={formatRelative(user.lastActiveAt)} />
                  <StatBox
                    label="Onboarded"
                    value={user.onboardingCompletedAt ? "Yes" : "No"}
                  />
                </div>
              </Section>

              <AccountLifecycleSection
                userId={user.userId}
                status={detail.accountStatus ?? "active"}
                history={detail.accountStatusHistory ?? []}
                onRefresh={onRefresh}
              />

              {detail.entitlement && (
                <Section title="Entitlement">
                  <EntitlementView entitlement={detail.entitlement} />
                </Section>
              )}

              {detail.progress.length > 0 && (
                <Section title={`Progress (${detail.progress.length} books)`}>
                  <div className="space-y-1.5">
                    {detail.progress.map((p) => (
                      <div
                        key={p.bookId}
                        className="cf-panel-muted rounded-lg px-3 py-2 text-[12px]"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[11px] text-(--cf-text-2)">
                            {p.bookId}
                          </span>
                          <span className="text-(--cf-text-3)">
                            ch{p.currentChapterNumber} · unlocked {p.unlockedThroughChapterNumber}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-(--cf-text-soft)">
                          {p.completedChapters.length} completed · last active{" "}
                          {formatRelative(p.lastActiveAt)}
                          {p.preferredVariant ? ` · variant ${p.preferredVariant}` : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              <Section title={`Recent events (${detail.events.length})`}>
                {detail.events.length === 0 ? (
                  <p className="text-[12px] text-(--cf-text-soft)">No recent events.</p>
                ) : (
                  <div className="cf-panel-muted max-h-80 overflow-y-auto rounded-lg">
                    <table className="w-full text-[11px]">
                      <tbody>
                        {detail.events.map((e) => (
                          <tr
                            key={e.eventId}
                            className="border-b border-(--cf-border)/40 last:border-0"
                          >
                            <td className="px-2 py-1 text-(--cf-text-3)">
                              {formatTime(e.occurredAt)}
                            </td>
                            <td className="px-2 py-1">
                              <span className="rounded-md border border-(--cf-accent-border)/50 bg-(--cf-accent-soft) px-1.5 py-0.5 text-(--cf-accent)">
                                {e.eventType}
                              </span>
                            </td>
                            <td className="px-2 py-1 text-(--cf-text-soft)">
                              {e.bookId
                                ? `${e.bookId.slice(0, 14)}${
                                    e.chapterNumber ? ` ch${e.chapterNumber}` : ""
                                  }`
                                : ""}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Section>
            </>
          )}
        </div>
      </motion.aside>
    </div>
  );
}

function AccountLifecycleSection({
  userId,
  status,
  history,
  onRefresh,
}: {
  userId: string;
  status: "active" | "deactivated" | "deleted";
  history: NonNullable<UserDetailResp["accountStatusHistory"]>;
  onRefresh: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [eraseOpen, setEraseOpen] = useState(false);
  const [eraseConfirm, setEraseConfirm] = useState("");
  const [eraseSummary, setEraseSummary] = useState<Record<string, unknown> | null>(null);

  const statusStyle =
    status === "active"
      ? "border-(--cf-success-border) bg-(--cf-success-soft) text-(--cf-success-text)"
      : status === "deactivated"
        ? "border-(--cf-warning-border) bg-(--cf-warning-soft) text-(--cf-warning-text)"
        : "border-(--cf-danger-border) bg-(--cf-danger-soft) text-(--cf-danger-text)";

  const runStatus = async (action: "reactivate" | "deactivate" | "delete") => {
    setBusy(action);
    setErr(null);
    try {
      await adminPost(`/users/${encodeURIComponent(userId)}/account-status`, { action });
      onRefresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(null);
    }
  };

  const runErase = async () => {
    setBusy("erase");
    setErr(null);
    try {
      const res = await adminPost<{ result: Record<string, unknown> }>(
        `/users/${encodeURIComponent(userId)}/erase`,
        { confirm: "ERASE" },
      );
      setEraseSummary(res.result);
      setEraseOpen(false);
      setEraseConfirm("");
      onRefresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erase failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Section title="Account lifecycle">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className={`inline-flex rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${statusStyle}`}>
            {status}
          </span>
        </div>

        {err && (
          <div className="rounded-lg border border-(--cf-danger-border) bg-(--cf-danger-soft) p-2 text-[12px] text-(--cf-danger-text)">
            {err}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {status !== "active" && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => runStatus("reactivate")}
              className="inline-flex items-center gap-1 rounded-lg border border-(--cf-border) bg-(--cf-surface) px-2.5 py-1 text-[12px] font-medium text-(--cf-text-1) transition hover:bg-(--cf-surface-muted) disabled:opacity-50"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reactivate
            </button>
          )}
          {status !== "deactivated" && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => runStatus("deactivate")}
              className="inline-flex items-center gap-1 rounded-lg border border-(--cf-border) bg-(--cf-surface) px-2.5 py-1 text-[12px] font-medium text-(--cf-text-2) transition hover:bg-(--cf-surface-muted) disabled:opacity-50"
            >
              <UserX className="h-3.5 w-3.5" /> Deactivate
            </button>
          )}
          {status !== "deleted" && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => runStatus("delete")}
              className="inline-flex items-center gap-1 rounded-lg border border-(--cf-danger-border) bg-(--cf-surface) px-2.5 py-1 text-[12px] font-medium text-(--cf-danger-text) transition hover:bg-(--cf-danger-soft) disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" /> Mark deleted
            </button>
          )}
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => setEraseOpen((v) => !v)}
            className="inline-flex items-center gap-1 rounded-lg border border-(--cf-danger-border) bg-(--cf-danger-soft) px-2.5 py-1 text-[12px] font-semibold text-(--cf-danger-text) transition hover:opacity-90 disabled:opacity-50"
          >
            <ShieldAlert className="h-3.5 w-3.5" /> Erase permanently…
          </button>
        </div>

        {eraseOpen && (
          <div className="rounded-lg border border-(--cf-danger-border) bg-(--cf-danger-soft)/40 p-3">
            <p className="text-[12px] text-(--cf-danger-text)">
              Irreversibly erases this user across DynamoDB, analytics, Stripe, and Cognito. Type{" "}
              <span className="font-mono font-semibold">ERASE</span> to confirm.
            </p>
            <div className="mt-2 flex items-center gap-2">
              <input
                value={eraseConfirm}
                onChange={(e) => setEraseConfirm(e.target.value.toUpperCase())}
                placeholder="ERASE"
                className="w-32 rounded-lg border border-(--cf-border) bg-(--cf-surface) px-2 py-1 text-[12px] font-mono text-(--cf-text-1) focus:border-(--cf-danger-border) focus:outline-none"
              />
              <button
                type="button"
                disabled={eraseConfirm !== "ERASE" || busy !== null}
                onClick={runErase}
                className="rounded-lg border border-(--cf-danger-border) bg-(--cf-danger-soft) px-2.5 py-1 text-[12px] font-semibold text-(--cf-danger-text) transition hover:opacity-90 disabled:opacity-40"
              >
                {busy === "erase" ? "Erasing…" : "Erase now"}
              </button>
            </div>
          </div>
        )}

        {eraseSummary && <EraseSummaryView summary={eraseSummary} />}

        {history.length > 0 && (
          <div className="cf-panel-muted max-h-56 overflow-y-auto rounded-lg">
            <table className="w-full text-[11px]">
              <tbody>
                {history.map((h, i) => (
                  <tr key={i} className="border-b border-(--cf-border)/40 last:border-0">
                    <td className="px-2 py-1 text-(--cf-text-3)">{formatTime(h.changedAt)}</td>
                    <td className="px-2 py-1 text-(--cf-text-2)">
                      {h.previousStatus ? `${h.previousStatus} → ` : ""}
                      {h.status}
                    </td>
                    <td className="px-2 py-1 text-(--cf-text-soft)" title={h.reason}>
                      {h.changedBy}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-(--cf-text-soft)">
        {title}
      </h3>
      {children}
    </div>
  );
}

/** Mask an identifier, keeping a short suffix for cross-referencing without exposing it verbatim. */
function maskIdentifier(value: unknown): string {
  if (typeof value !== "string" || !value) return "—";
  if (value.length <= 6) return "••••";
  return `••••${value.slice(-4)}`;
}

function asString(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return value.toLocaleString();
  return String(value);
}

function formatCents(value: unknown, currency: unknown): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  const amount = (value / 100).toFixed(2);
  const code = typeof currency === "string" && currency ? currency.toUpperCase() : "";
  return code ? `${amount} ${code}` : amount;
}

/**
 * Render the entitlement as labeled StatBox rows (mirroring the Snapshot section),
 * masking raw Stripe / license identifiers. The full raw object stays available
 * behind a collapsible "Show raw" for debugging.
 */
function EntitlementView({ entitlement }: { entitlement: Record<string, unknown> }) {
  const e = entitlement;
  const rows: Array<{ label: string; value: string; hint?: string }> = [
    { label: "Plan", value: asString(e.plan) },
    { label: "PRO status", value: asString(e.proStatus) },
    { label: "PRO source", value: asString(e.proSource) },
    { label: "Free book slots", value: asString(e.freeBookSlots) },
    {
      label: "Current period end",
      value: formatRelative(typeof e.currentPeriodEnd === "string" ? e.currentPeriodEnd : null),
    },
    { label: "Cancel at period end", value: asString(e.cancelAtPeriodEnd) },
    { label: "Subscription interval", value: asString(e.subscriptionInterval) },
    {
      label: "Subscription amount",
      value: formatCents(e.subscriptionAmountCents, e.billingCurrency),
    },
    { label: "Billing country", value: asString(e.billingCountry) },
    { label: "Card brand", value: asString(e.cardBrand) },
    {
      label: "Last invoice",
      value: formatCents(e.lastInvoiceAmountCents, e.lastInvoiceCurrency),
      hint:
        typeof e.lastInvoicePaidAt === "string"
          ? `paid ${formatRelative(e.lastInvoicePaidAt)}`
          : undefined,
    },
    {
      label: "License expires",
      value: formatRelative(typeof e.licenseExpiresAt === "string" ? e.licenseExpiresAt : null),
    },
    { label: "Stripe customer", value: maskIdentifier(e.stripeCustomerId) },
    { label: "Stripe subscription", value: maskIdentifier(e.stripeSubscriptionId) },
    { label: "License key", value: maskIdentifier(e.licenseKey) },
    { label: "Updated", value: formatRelative(typeof e.updatedAt === "string" ? e.updatedAt : null) },
  ];

  const unlocked = Array.isArray(e.unlockedBookIds) ? e.unlockedBookIds.length : null;
  if (unlocked !== null) rows.push({ label: "Unlocked books", value: asString(unlocked) });

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {rows.map((r) => (
          <StatBox key={r.label} label={r.label} value={r.value} hint={r.hint} />
        ))}
      </div>
      <RawDetails data={entitlement} />
    </div>
  );
}

/**
 * Render the hard-erasure summary as labeled StatBox rows with a clear
 * partial / residual-warning treatment. Raw JSON stays behind "Show raw".
 */
function EraseSummaryView({ summary }: { summary: Record<string, unknown> }) {
  const s = summary;
  const partial = s.partial === true;
  const warnings = Array.isArray(s.residualWarnings)
    ? s.residualWarnings.filter((w): w is string => typeof w === "string")
    : [];

  return (
    <div className="space-y-2">
      <div
        className={[
          "rounded-lg border px-3 py-2 text-[12px] font-medium",
          partial
            ? "border-(--cf-warning-border) bg-(--cf-warning-soft) text-(--cf-warning-text)"
            : "border-(--cf-success-border) bg-(--cf-success-soft) text-(--cf-success-text)",
        ].join(" ")}
      >
        {partial ? "Erasure completed with residual items" : "Erasure completed"}
        {typeof s.erasedAt === "string" ? ` · ${formatTime(s.erasedAt)}` : ""}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <StatBox label="Main items deleted" value={asString(s.mainItemsDeleted)} />
        <StatBox label="Quiz attempts deleted" value={asString(s.quizAttemptItemsDeleted)} />
        <StatBox label="Quiz partitions" value={asString(s.quizAttemptPartitions)} />
        <StatBox label="Analytics deleted" value={asString(s.analyticsItemsDeleted)} />
        <StatBox label="Pair invites deleted" value={asString(s.pairInviteItemsDeleted)} />
        <StatBox label="Unprocessed items" value={asString(s.unprocessedItems)} />
        <StatBox label="Stripe customer" value={asString(s.stripeCustomer)} />
        <StatBox label="Cognito user" value={asString(s.cognitoUser)} />
      </div>

      {warnings.length > 0 && (
        <div className="rounded-lg border border-(--cf-warning-border) bg-(--cf-warning-soft)/50 p-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-(--cf-warning-text)">
            Residual warnings
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[12px] text-(--cf-warning-text)">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <RawDetails data={summary} />
    </div>
  );
}

/** Collapsible raw-JSON escape hatch for debugging (collapsed by default). */
function RawDetails({ data }: { data: unknown }) {
  return (
    <details className="cf-panel-muted rounded-lg">
      <summary className="cursor-pointer select-none px-3 py-2 text-[11px] font-medium text-(--cf-text-soft) transition hover:text-(--cf-text-2)">
        Show raw
      </summary>
      <pre className="overflow-x-auto px-3 pb-3 text-[11px] text-(--cf-text-2)">
        {JSON.stringify(data, null, 2)}
      </pre>
    </details>
  );
}

function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 30) return `${diffD}d ago`;
  return date.toLocaleDateString();
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
