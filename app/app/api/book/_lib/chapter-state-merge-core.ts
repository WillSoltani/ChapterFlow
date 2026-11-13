// Pure merge rules for the chapter-state PATCH (no AWS imports, unit-testable).

/** Serialized size cap for `state.quizResult`. */
export const CHAPTER_STATE_QUIZ_RESULT_MAX_CHARS = 20_000;
/** Length cap for the top-level `chapterId`. */
export const CHAPTER_STATE_CHAPTER_ID_MAX_CHARS = 200;

function readStamp(state: Record<string, unknown> | undefined): string | null {
  const value = state?.notesUpdatedAt;
  return typeof value === "string" && value.trim() ? value : null;
}

function stampMs(stamp: string): number {
  const ms = Date.parse(stamp);
  return Number.isFinite(ms) ? ms : Number.NaN;
}

/** True when stamp `a` is strictly older than stamp `b`. */
function isOlder(a: string, b: string): boolean {
  const am = stampMs(a);
  const bm = stampMs(b);
  if (Number.isFinite(am) && Number.isFinite(bm)) return am < bm;
  return a < b;
}

/**
 * Shallow-merge an incoming chapter state over the stored one, so a write that
 * omits a key never erases it. Notes follow last-write-wins on `notesUpdatedAt`:
 * the stored notes (and their stamp) are kept only when the stored copy is
 * stamped and the incoming copy is unstamped or older. In every other case the
 * incoming notes win, which keeps today's behaviour when neither side has a stamp.
 */
export function mergeChapterState(
  stored: Record<string, unknown> | undefined,
  incoming: Record<string, unknown>
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...(stored ?? {}), ...incoming };
  const storedStamp = readStamp(stored);
  if (!storedStamp) return merged;

  const incomingStamp = readStamp(incoming);
  if (!incomingStamp || isOlder(incomingStamp, storedStamp)) {
    if (stored && "notes" in stored) merged.notes = stored.notes;
    else delete merged.notes;
    merged.notesUpdatedAt = stored?.notesUpdatedAt;
  }
  return merged;
}

/**
 * Optimistic-concurrency check for the optional top-level `expectedUpdatedAt`.
 * `undefined` means the caller did not ask for a check. `null` means the caller
 * expects no stored row yet.
 */
export function isChapterStateStale(
  expectedUpdatedAt: string | null | undefined,
  currentUpdatedAt: string | null | undefined
): boolean {
  if (expectedUpdatedAt === undefined) return false;
  return (currentUpdatedAt || null) !== expectedUpdatedAt;
}
