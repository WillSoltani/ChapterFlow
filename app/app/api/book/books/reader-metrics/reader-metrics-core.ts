/**
 * Collect independent per-book reads without letting one repository failure
 * discard every healthy result in the batch. Null remains the caller's
 * authorization/availability omission signal.
 */
export async function collectReaderMetricEntries<T>(
  bookIds: string[],
  load: (bookId: string) => Promise<readonly [string, T] | null>,
): Promise<Record<string, T>> {
  const settled = await Promise.allSettled(bookIds.map((bookId) => load(bookId)));
  const metrics: Record<string, T> = {};
  for (const result of settled) {
    if (result.status === "fulfilled" && result.value) {
      metrics[result.value[0]] = result.value[1];
    }
  }
  return metrics;
}
