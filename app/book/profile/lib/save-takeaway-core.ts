// "Save takeaway" on Profile (DATA-04): append the takeaway to the chapter's
// notes on the account, not only on this device.
//
// The chapter-state PATCH replaces the whole stored state, so the current
// server state is read first and sent back in full with the new notes and a
// fresh `notesUpdatedAt` (C7). Only keys the endpoint accepts are sent; any
// other key would fail the whole write.

// Mirrors the chapter-state route's allowlist.
const CHAPTER_STATE_KEYS = new Set([
  "activeTab",
  "readingDepth",
  "exampleFilter",
  "fontScale",
  "focusMode",
  "showRecap",
  "quizRetakeCount",
  "quizFailureStreak",
  "notesUpdatedAt",
  "quizCooldownUntil",
  "notes",
  "quizResult",
  "quizAnswers",
  "explanationOpen",
  "bookmarkedTakeaways",
  "bookmarkedTakeawayTexts",
]);

export type SaveTakeawayDeps = {
  fetchJson: <T>(url: string, init?: RequestInit) => Promise<T>;
  refetchNotebook: () => Promise<unknown>;
  readLocal: (key: string) => string | null;
  writeLocal: (key: string, value: string) => void;
  now: () => string;
};

export type SaveTakeawayInput = {
  bookId: string;
  chapterId: string;
  chapterNumber: number;
  text: string;
  /** This device's reader-state key for the chapter. */
  localKey: string;
};

export type TakeawayTarget = { bookId: string; chapterId: string; chapterNumber: number };

/**
 * Where Profile's takeaway box saves, or null to hide the box. Saving writes a
 * chapter-state row, and that row marks a book as started (C5), so the box is
 * offered only for a book the reader has started or finished, and only when
 * the chapter number is known (the account write needs it).
 */
export function takeawayTarget(input: {
  bookId: string;
  status: "completed" | "in_progress" | "not_started";
  chapterId: string | null | undefined;
  chapters: ReadonlyArray<{ id: string; order: number }>;
}): TakeawayTarget | null {
  if (input.status === "not_started") return null;
  const chapter = input.chapters.find((c) => c.id === input.chapterId);
  return chapter ? { bookId: input.bookId, chapterId: chapter.id, chapterNumber: chapter.order } : null;
}

type ChapterStateItem = { chapterId?: unknown; state?: unknown } | null;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stampOf(state: Record<string, unknown> | null): number {
  const raw = state?.notesUpdatedAt;
  const ms = typeof raw === "string" ? Date.parse(raw) : Number.NaN;
  return Number.isFinite(ms) ? ms : 0;
}

function notesOf(state: Record<string, unknown> | null): string {
  return typeof state?.notes === "string" ? state.notes : "";
}

function readLocalState(deps: SaveTakeawayDeps, key: string): Record<string, unknown> | null {
  try {
    const raw = deps.readLocal(key);
    return raw ? asRecord(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export async function saveTakeaway(
  deps: SaveTakeawayDeps,
  input: SaveTakeawayInput
): Promise<{ notes: string }> {
  const url = `/app/api/book/me/books/${encodeURIComponent(input.bookId)}/chapters/${input.chapterNumber}/state`;
  const { state: item } = await deps.fetchJson<{ state: ChapterStateItem }>(url);
  const serverState = asRecord(item?.state) ?? {};
  const localState = readLocalState(deps, input.localKey);

  // Append to the newer notes (same rule as the reader's merge): notes edited
  // on this device after the server copy are not dropped.
  const baseNotes =
    stampOf(localState) > stampOf(serverState) ? notesOf(localState) : notesOf(serverState);
  const notes = baseNotes.trim() ? `${baseNotes}\n\n${input.text}` : input.text;
  const notesUpdatedAt = deps.now();

  const kept = Object.fromEntries(
    Object.entries(serverState).filter(([key]) => CHAPTER_STATE_KEYS.has(key))
  );
  const chapterId = typeof item?.chapterId === "string" ? item.chapterId : input.chapterId;
  await deps.fetchJson(url, {
    method: "PATCH",
    body: JSON.stringify({ chapterId, state: { ...kept, notes, notesUpdatedAt } }),
  });

  // Keep this device's copy in step (bookmarks and other fields preserved).
  if (localState) {
    try {
      deps.writeLocal(input.localKey, JSON.stringify({ ...localState, notes, notesUpdatedAt }));
    } catch {
      // Storage full or blocked: the account copy is already saved.
    }
  }
  await deps.refetchNotebook().catch(() => undefined);
  return { notes };
}
