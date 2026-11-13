/**
 * Pure helpers for the per-book daily reader KPIs (API-08), used by the
 * books/[bookId]/metrics and books/reader-metrics routes.
 */

export type BookReaderMetrics = {
  readersToday: number;
  readersWeek: number;
  loopsToday: number;
  loopsWeek: number;
};

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
