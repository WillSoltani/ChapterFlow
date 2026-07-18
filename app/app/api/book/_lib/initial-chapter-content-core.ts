export interface ReadOnlyChapterHydrationEntitlement {
  plan: "FREE" | "PRO";
  unlockedBookIds: string[];
}

/**
 * Run an optional chapter-content read only when the current entitlement still
 * grants that book. Progress alone is not proof: a Pro-started book may remain
 * in progress after a downgrade without occupying a Free unlocked slot.
 */
export async function runAuthorizedChapterHydration<T>(params: {
  entitlement: ReadOnlyChapterHydrationEntitlement | null;
  bookId: string;
  load: () => Promise<T>;
}): Promise<T | null> {
  const allowed =
    params.entitlement?.plan === "PRO" ||
    params.entitlement?.unlockedBookIds.includes(params.bookId) === true;
  if (!allowed) return null;
  return params.load();
}
