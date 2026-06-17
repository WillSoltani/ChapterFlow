"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  FileText,
  Bookmark,
  Target,
  Search,
  Download,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { fetchBookJson } from "@/app/book/_lib/book-api";
import type { NotebookEntry, NotebookEntryType } from "@/app/app/api/book/_lib/types";
import { TopNav } from "@/app/book/home/components/TopNav";
import { useBookViewer } from "@/app/book/hooks/useBookViewer";

type NotebookResponse = { entries: NotebookEntry[]; totalCount: number };

// Only the entry types the /me/notebook route actually emits. The 'reflection'
// type is part of NotebookEntryType but is never produced by the API, so it is
// intentionally absent here (and from the filter tabs) to avoid a dead filter.
const TYPE_ICONS: Partial<Record<NotebookEntryType, typeof FileText>> = {
  note: FileText,
  bookmark: Bookmark,
  commitment: Target,
};

const TYPE_LABELS: Partial<Record<NotebookEntryType, string>> = {
  note: "Note",
  bookmark: "Bookmark",
  commitment: "Commitment",
};

export function NotebookClient() {
  const { identity: viewerIdentity } = useBookViewer();
  const [entries, setEntries] = useState<NotebookEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<NotebookEntryType | "all">("all");

  const loadEntries = useCallback(() => {
    setLoading(true);
    setError(false);
    fetchBookJson<NotebookResponse>("/app/api/book/me/notebook")
      .then((data) => {
        setEntries(data.entries);
        setError(false);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const filtered = useMemo(() => {
    let result = entries;
    if (typeFilter !== "all") {
      result = result.filter((e) => e.type === typeFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          e.content.toLowerCase().includes(q) ||
          e.bookTitle.toLowerCase().includes(q) ||
          e.chapterTitle.toLowerCase().includes(q),
      );
    }
    return result;
  }, [entries, typeFilter, searchQuery]);

  // Group entries by book so the list reads like a per-book notebook.
  const groups = useMemo(() => {
    const map = new Map<
      string,
      { bookId: string; bookTitle: string; entries: NotebookEntry[] }
    >();
    for (const e of filtered) {
      const g =
        map.get(e.bookId) ?? { bookId: e.bookId, bookTitle: e.bookTitle, entries: [] };
      g.entries.push(e);
      map.set(e.bookId, g);
    }
    return Array.from(map.values());
  }, [filtered]);

  const handleExport = async (format: string) => {
    try {
      const res = await fetch(`/app/api/book/me/export?format=${format}`);
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `chapterflow-notebook.${format === "markdown" ? "md" : format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {}
  };

  return (
    <main className="cf-app-shell">
      <TopNav
        name={viewerIdentity.displayName || "Reader"}
        avatarUrl={viewerIdentity.avatarDataUrl}
        searchQuery=""
        onSearchChange={() => {}}
        searchInputRef={{ current: null }}
        showSearch={false}
        showGlobalSearchPanel={false}
        logoVariant="dashboard"
      />

      <section className="mx-auto w-full max-w-450 px-4 pb-28 pt-7 sm:px-6 sm:pt-8 lg:px-10 xl:px-16">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-(--cf-text-1)">
              Notebook
            </h1>
            <p className="mt-1 text-sm text-(--cf-text-3)">
              {loading
                ? "Loading your notes…"
                : filtered.length === entries.length
                  ? `${entries.length} ${entries.length === 1 ? "entry" : "entries"} across all your books`
                  : `${filtered.length} of ${entries.length} entries`}
            </p>
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => handleExport("markdown")}
              disabled={loading || error || entries.length === 0}
              className="inline-flex items-center gap-1.5 rounded-xl border border-(--cf-border) bg-(--cf-surface) px-3 py-2 text-xs font-semibold text-(--cf-text-2) transition hover:bg-(--cf-surface-muted) disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              Export
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--cf-text-3)" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search notes..."
              className="w-full rounded-xl border border-(--cf-border) bg-(--cf-surface) py-2 pl-9 pr-3 text-sm text-(--cf-text-1) placeholder:text-(--cf-text-3) focus:border-(--cf-accent) focus:outline-none"
            />
          </div>
          <div className="flex gap-1.5">
            {(["all", "note", "bookmark", "commitment"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTypeFilter(t)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  typeFilter === t
                    ? "bg-(--cf-accent) text-(--cf-accent-contrast)"
                    : "border border-(--cf-border) bg-(--cf-surface) text-(--cf-text-2) hover:bg-(--cf-surface-muted)"
                }`}
              >
                {t === "all" ? "All" : TYPE_LABELS[t] ?? t}
              </button>
            ))}
          </div>
        </div>

        {/* Entries */}
        <div className="mt-5 space-y-3">
          {loading ? (
            <div className="animate-pulse space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 rounded-2xl bg-(--cf-surface-muted)" />
              ))}
            </div>
          ) : error ? (
            <div className="cf-panel rounded-2xl border border-(--cf-danger-border) bg-(--cf-danger-bg) p-8 text-center">
              <AlertTriangle className="mx-auto h-6 w-6 text-(--cf-danger-text)" />
              <p className="mt-2 text-sm font-medium text-(--cf-text-1)">
                Couldn&apos;t load your notebook
              </p>
              <p className="mt-1 text-sm text-(--cf-text-3)">
                Something went wrong fetching your notes. Please try again.
              </p>
              <button
                type="button"
                onClick={loadEntries}
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-(--cf-border) bg-(--cf-surface) px-3 py-2 text-xs font-semibold text-(--cf-text-2) transition hover:bg-(--cf-surface-muted)"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retry
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="cf-panel rounded-2xl p-8 text-center">
              <p className="text-sm text-(--cf-text-3)">
                {entries.length === 0
                  ? "Start taking notes while reading to see them here."
                  : "No entries match your search."}
              </p>
            </div>
          ) : (
            groups.map((group) => (
              <div key={group.bookId} className="space-y-3">
                <h2 className="flex items-center gap-2 px-1 pt-2 text-xs font-semibold uppercase tracking-wide text-(--cf-text-3)">
                  <span>{group.bookTitle}</span>
                  <span className="font-normal normal-case text-(--cf-text-3)">
                    {group.entries.length}
                  </span>
                </h2>
                {group.entries.map((entry) => {
                  const Icon = TYPE_ICONS[entry.type] ?? FileText;
                  // Only link when we have a real bookId; a blank one would
                  // produce /book/library//chapter/N which 404s.
                  const href = entry.bookId
                    ? `/book/library/${encodeURIComponent(entry.bookId)}/chapter/${entry.chapterNumber}`
                    : null;
                  const inner = (
                    <div className="flex items-start gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-(--cf-accent-soft)">
                        <Icon className="h-4 w-4 text-(--cf-accent)" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-(--cf-text-1) leading-relaxed">
                          {entry.content.length > 300
                            ? `${entry.content.slice(0, 300)}...`
                            : entry.content}
                        </p>
                        <div className="mt-2 flex items-center gap-2 text-xs text-(--cf-text-3)">
                          <span>Ch. {entry.chapterNumber}</span>
                          <span>·</span>
                          <span className="capitalize">{entry.type}</span>
                        </div>
                      </div>
                    </div>
                  );
                  return href ? (
                    <Link
                      key={entry.id}
                      href={href}
                      className="cf-panel block rounded-2xl border border-(--cf-border) p-4 transition hover:border-(--cf-border-strong) hover:bg-(--cf-surface-muted) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--cf-accent-border)"
                    >
                      {inner}
                    </Link>
                  ) : (
                    <div
                      key={entry.id}
                      className="cf-panel block rounded-2xl border border-(--cf-border) p-4"
                    >
                      {inner}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
