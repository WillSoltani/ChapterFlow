/**
 * Pure pagination core for DynamoDB full-partition Query reads.
 *
 * `repo.ts` (and its sibling `*-repo.ts`) import `server-only` transitively via
 * `aws.ts`, so the real `queryAllItems` cannot be imported into a unit test. This
 * module holds the page-following logic with no AWS/`server-only` dependency: the
 * caller injects a `fetchPage` function that runs one Query page (given the prior
 * page's `ExclusiveStartKey`) and returns that page's items + `LastEvaluatedKey`.
 * `repo.ts.queryAllItems` is a thin wrapper that supplies `ddbDoc.send`.
 */

/**
 * Hard cap on the number of 1MB pages a full-partition query will follow.
 * Guards against a pathological/runaway partition pinning a request forever.
 * 50 pages × 1MB is well beyond any realistic per-user or catalog partition.
 */
export const MAX_QUERY_PAGES = 50;

export interface QueryPage<TKey = Record<string, unknown>> {
  items: Record<string, unknown>[];
  lastEvaluatedKey?: TKey | undefined;
}

/**
 * Follow `LastEvaluatedKey` until the full result set has been read (or the page
 * cap is hit), accumulating every page's items in order. A single DynamoDB Query
 * returns at most 1MB, so any unbounded full-partition list MUST paginate or it
 * silently truncates as the partition grows. Because each page resumes from the
 * prior page's `ExclusiveStartKey`, the server-side sort order (e.g.
 * `ScanIndexForward:false`, newest-first) is preserved across page boundaries.
 *
 * @param fetchPage Runs one Query page. Receives the previous page's
 *   `LastEvaluatedKey` (`undefined` on the first call) as `ExclusiveStartKey`.
 * @param maxPages Page cap; defaults to {@link MAX_QUERY_PAGES}.
 */
export async function paginateQuery<TKey = Record<string, unknown>>(
  fetchPage: (exclusiveStartKey: TKey | undefined) => Promise<QueryPage<TKey>>,
  maxPages: number = MAX_QUERY_PAGES
): Promise<Record<string, unknown>[]> {
  const items: Record<string, unknown>[] = [];
  let lastKey: TKey | undefined;
  let pages = 0;
  do {
    const page = await fetchPage(lastKey);
    for (const item of page.items ?? []) {
      items.push(item);
    }
    lastKey = page.lastEvaluatedKey;
    pages += 1;
  } while (lastKey && pages < maxPages);
  return items;
}
