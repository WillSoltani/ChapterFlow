"use client";

import { useEffect, useState } from "react";
import { ChevronRight, Search, Users as UsersIcon, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { adminGet } from "@/app/book/admin/_components/admin-api";
import { AdminCard, PageHeader } from "@/app/book/admin/_components/AdminCard";
import { ErrorAlert } from "@/app/book/admin/_components/ErrorAlert";
import { EmptyState } from "@/app/book/admin/_components/EmptyState";
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
}: {
  user: UserRow;
  detail: UserDetailResp | null;
  loading: boolean;
  onClose: () => void;
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

              {detail.entitlement && (
                <Section title="Entitlement">
                  <pre className="cf-panel-muted overflow-x-auto rounded-lg p-3 text-[11px] text-(--cf-text-2)">
                    {JSON.stringify(detail.entitlement, null, 2)}
                  </pre>
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
