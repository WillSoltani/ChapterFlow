/**
 * Pure helpers for the per-book daily reader KPIs (API-08). Shared by
 * books/[bookId]/metrics, books/reader-metrics and book-metrics-repo.
 */

export type BookReaderMetrics = {
  readersToday: number;
  readersWeek: number;
  loopsToday: number;
  loopsWeek: number;
};

/**
 * Sort key of the once-per-day reader marker, written under bookMetricsPk.
 * It sorts after every `DAY#` row, so the KPI range query never returns it.
 */
export function dailyReaderMarkerSk(dayKey: string, userId: string): string {
  return `METRICSREADER#${dayKey}#${userId}`;
}

/**
 * Aggregate the daily KPI rows into today/week totals. The weekly reader
 * number sums daily readers (reader-days), as before.
 */
export function aggregateMetrics(
  items: Record<string, unknown>[],
  today: string,
): BookReaderMetrics {
  let readersToday = 0;
  let readersWeek = 0;
  let loopsToday = 0;
  let loopsWeek = 0;
  for (const item of items) {
    const readers = typeof item.uniqueReaders === "number" ? item.uniqueReaders : 0;
    const loops = typeof item.loopCompletions === "number" ? item.loopCompletions : 0;
    readersWeek += readers;
    loopsWeek += loops;
    if (item.dayKey === today) {
      readersToday = readers;
      loopsToday = loops;
    }
  }
  return { readersToday, readersWeek, loopsToday, loopsWeek };
}
