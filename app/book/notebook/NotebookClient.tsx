"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, FileText, Bookmark, Target, Search, Download } from "lucide-react";
import { fetchBookJson } from "@/app/book/_lib/book-api";
import type { NotebookEntry, NotebookEntryType } from "@/app/app/api/book/_lib/types";
import { TopNav } from "@/app/book/home/components/TopNav";
import { useBookViewer } from "@/app/book/hooks/useBookViewer";

type NotebookResponse = { entries: NotebookEntry[]; totalCount: number };

const TYPE_ICONS: Record<NotebookEntryType, typeof FileText> = {
  note: FileText,
  reflection: BookOpen,
  bookmark: Bookmark,
  commitment: Target,
};

const TYPE_LABELS: Record<NotebookEntryType, string> = {
  note: "Note",
  reflection: "Reflection",
  bookmark: "Bookmark",
  commitment: "Commitment",
};

export function NotebookClient() {
  const router = useRouter();
  const { identity: viewerIdentity } = useBookViewer();
  const [entries, setEntries] = useState<NotebookEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<NotebookEntryType | "all">("all");

  useEffect(() => {
    fetchBookJson<NotebookResponse>("/app/api/book/me/notebook")
      .then((data) => setEntries(data.entries))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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
        activeTab="home"
        searchQuery=""
        onSearchChange={() => {}}
        searchInputRef={{ current: null }}
        logoVariant="dashboard"
      />

      <section className="mx-auto w-full max-w-450 px-4 pb-28 pt-7 sm:px-6 sm:pt-8 lg:px-10 xl:px-16">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-(--cf-text-1)">
              Notebook
            </h1>
            <p className="mt-1 text-sm text-(--cf-text-3)">
              {entries.length} entries across all your books
            </p>
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => handleExport("markdown")}
              className="inline-flex items-center gap-1.5 rounded-xl border border-(--cf-border) bg-(--cf-surface) px-3 py-2 text-xs font-semibold text-(--cf-text-2) transition hover:bg-(--cf-surface-muted)"
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
            {(["all", "note", "reflection", "bookmark", "commitment"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTypeFilter(t)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  typeFilter === t
                    ? "bg-(--cf-accent) text-white"
                    : "border border-(--cf-border) bg-(--cf-surface) text-(--cf-text-2) hover:bg-(--cf-surface-muted)"
                }`}
              >
                {t === "all" ? "All" : TYPE_LABELS[t]}
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
          ) : filtered.length === 0 ? (
            <div className="cf-panel rounded-2xl p-8 text-center">
              <p className="text-sm text-(--cf-text-3)">
                {entries.length === 0
                  ? "Start taking notes while reading to see them here."
                  : "No entries match your search."}
              </p>
            </div>
          ) : (
            filtered.map((entry) => {
              const Icon = TYPE_ICONS[entry.type];
              return (
                <div
                  key={entry.id}
                  className="cf-panel rounded-2xl border border-(--cf-border) p-4"
                >
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
                        <span>{entry.bookTitle}</span>
                        <span>·</span>
                        <span>Ch. {entry.chapterNumber}</span>
                        <span>·</span>
                        <span className="capitalize">{entry.type}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </main>
  );
}
