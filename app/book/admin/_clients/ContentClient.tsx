"use client";

import { useEffect, useState } from "react";
import { BookOpen } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { adminGet } from "@/app/book/admin/_components/admin-api";
import { AdminCard, PageHeader } from "@/app/book/admin/_components/AdminCard";
import { ErrorAlert } from "@/app/book/admin/_components/ErrorAlert";
import { EmptyState } from "@/app/book/admin/_components/EmptyState";
import { ChartSkeleton, TableSkeleton } from "@/app/book/admin/_components/Skeleton";
import { RangeSelector } from "@/app/book/admin/_components/RangeSelector";
import { DarkTooltip } from "@/app/book/admin/_components/DarkTooltip";

type BookStat = {
  bookId: string;
  title: string;
  author: string;
  categories: string[];
  quizAttempts: number;
  quizPasses: number;
  passRatePercent: number;
  bookCompletions: number;
  readingMinutes: number;
};

type ContentResponse = {
  generatedAt: string;
  range: number;
  books: BookStat[];
  scenarioSubmissions: { date: string; value: number }[];
  scenarioApprovals: { date: string; value: number }[];
};

type Sort = "readingMinutes" | "quizAttempts" | "passRatePercent" | "bookCompletions";

export function ContentClient() {
  const [range, setRange] = useState(30);
  const [data, setData] = useState<ContentResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>("readingMinutes");

  const reload = () => {
    setLoading(true);
    setError(null);
    adminGet<ContentResponse>(`/metrics/content?range=${range}`)
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
  }, [range]);

  const sortedBooks = data ? [...data.books].sort((a, b) => b[sort] - a[sort]) : [];
  const scenarioCombined = data
    ? data.scenarioSubmissions.map((s, i) => ({
        date: s.date,
        submitted: s.value,
        approved: data.scenarioApprovals[i]?.value ?? 0,
      }))
    : [];

  return (
    <div>
      <PageHeader
        title="Content"
        description={
          data ? `${data.books.length} published books · last ${data.range} days` : ""
        }
        action={<RangeSelector value={range} onChange={setRange} />}
      />

      {error && <ErrorAlert error={error} onRetry={reload} />}

      <AdminCard
        title="Books"
        description="Sorted by activity in range"
        action={
          <div className="inline-flex items-center gap-1 rounded-lg border border-(--cf-border) bg-(--cf-surface) p-0.5 text-[11px] shadow-(--cf-input-inset-shadow)">
            {(
              [
                ["readingMinutes", "Reading"],
                ["quizAttempts", "Attempts"],
                ["passRatePercent", "Pass rate"],
                ["bookCompletions", "Completions"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSort(key)}
                className={[
                  "rounded-md px-2.5 py-1 transition",
                  sort === key
                    ? "bg-(--cf-accent)/15 text-(--cf-accent) font-semibold"
                    : "text-(--cf-text-3) hover:text-(--cf-text-1) hover:bg-(--cf-surface-muted)",
                ].join(" ")}
              >
                {label}
              </button>
            ))}
          </div>
        }
      >
        {loading && !data ? (
          <TableSkeleton rows={6} cols={6} />
        ) : sortedBooks.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No books in catalog"
            description="Once books are published, their stats will appear here."
            compact
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-(--cf-border) text-left text-[11px] uppercase tracking-[0.08em] text-(--cf-text-soft)">
                  <th className="py-2 pr-3">Book</th>
                  <th className="py-2 pr-3">Categories</th>
                  <th className="py-2 pr-3 text-right">Reading</th>
                  <th className="py-2 pr-3 text-right">Quiz pass / attempts</th>
                  <th className="py-2 pr-3 text-right">Pass rate</th>
                  <th className="py-2 pr-3 text-right">Completions</th>
                </tr>
              </thead>
              <tbody>
                {sortedBooks.map((b) => (
                  <tr
                    key={b.bookId}
                    className="border-b border-(--cf-border)/50 transition hover:bg-(--cf-surface-muted)/40"
                  >
                    <td className="py-2 pr-3 text-(--cf-text-1)">
                      <p className="font-medium">{b.title}</p>
                      <p className="text-[11px] text-(--cf-text-3)">{b.author}</p>
                    </td>
                    <td className="py-2 pr-3 text-(--cf-text-3)">
                      {b.categories.slice(0, 2).join(", ") || "—"}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-(--cf-text-2)">
                      {b.readingMinutes.toLocaleString()}m
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-(--cf-text-2)">
                      {b.quizPasses}/{b.quizAttempts}
                    </td>
                    <td className="py-2 pr-3 text-right">
                      <span
                        className={[
                          "rounded-md px-1.5 py-0.5 text-[11px] font-medium",
                          b.passRatePercent >= 70
                            ? "bg-(--cf-success-soft) text-(--cf-success-text)"
                            : b.passRatePercent >= 40
                            ? "bg-(--cf-warning-soft) text-(--cf-warning-text)"
                            : "bg-(--cf-danger-soft) text-(--cf-danger-text)",
                        ].join(" ")}
                      >
                        {b.quizAttempts > 0 ? `${b.passRatePercent}%` : "—"}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-(--cf-text-2)">
                      {b.bookCompletions}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminCard>

      <div className="mt-6">
        <AdminCard title="Community scenarios" description="Submitted vs approved per day">
          {loading && !data ? (
            <ChartSkeleton />
          ) : (
            <div className="h-56">
              <ResponsiveContainer>
                <BarChart data={scenarioCombined} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
                  <CartesianGrid stroke="var(--cf-border)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "var(--cf-text-3)", fontSize: 11 }}
                    tickFormatter={fmtDate}
                  />
                  <YAxis tick={{ fill: "var(--cf-text-3)", fontSize: 11 }} width={32} />
                  <Tooltip content={<DarkTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11, color: "var(--cf-text-3)" }} />
                  <Bar dataKey="submitted" name="Submitted" fill="var(--cf-text-soft)" isAnimationActive={false} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="approved" name="Approved" fill="var(--cf-success-text)" isAnimationActive={false} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </AdminCard>
      </div>
    </div>
  );
}

function fmtDate(d: string): string {
  const date = new Date(d);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
