import type { ReadingDepth } from "@/lib/reader-content-types";
import type { ChapterTab, ExampleFilter, FontScale } from "@/lib/reader-state-types";

// Pure chapter-state sync for the reader (notes, bookmarks, tab, quiz state).
// useChapterState wires it to fetch, timers and page events.
//
// Rules:
//  - The baseline is the server copy from the last successful GET or PATCH.
//    The reader writes only when its state differs from that baseline, so
//    opening a chapter does not write, except once when the server has no row.
//  - Nothing is written until a GET has succeeded, so a failed read can never
//    replace the account copy with this device's (possibly empty) state.
//  - One request at a time; edits made meanwhile go out after it settles.
//  - A save the server answers with a different copy is merged in like a
//    re-read, and a state the server has just accepted is not sent again, so
//    a server that keeps its own notes can never cause a resend loop.
//  - Failures retry with backoff; after two in a row (or a refusal) the reader
//    shows "Changes saved on this device only." until a request succeeds.
//  - A sync belongs to the account signed in when it was created. Once another
//    account (or none) is signed in, it stops: nothing more is read, written or
//    merged. An empty read after an account copy was seen stops it too, instead
//    of writing this device's whole state as if the chapter were new.

export type QuizResult = {
  score: number;
  passed: boolean;
};

export type PersistedChapterState = {
  activeTab: ChapterTab;
  readingDepth: ReadingDepth;
  exampleFilter: ExampleFilter;
  quizAnswers: Record<string, number>;
  quizResult: QuizResult | null;
  quizRetakeCount: number;
  quizFailureStreak: number;
  quizCooldownUntil: string | null;
  notes: string;
  notesUpdatedAt: string | null;
  focusMode: boolean;
  fontScale: FontScale;
  showRecap: boolean;
  explanationOpen: Record<string, boolean>;
  bookmarkedTakeaways: number[];
  // Takeaway text keyed by its bookmarked index. Parallel companion to
  // bookmarkedTakeaways (the indices drive the SummaryCard highlight + the
  // save-to-notes / practice resolution); this captures the text the reader
  // actually saw so the /me/notebook feed can render the bookmark without
  // loading chapter content. Keyed by index (not a positional array) so it
  // stays robust across the union-merge and legacy data.
  //
  // The text is a SNAPSHOT at the reading depth active when bookmarking. Because
  // the index points at different prose per depth (takeawaysByDepth[depth]), the
  // notebook shows the depth-phrasing the reader saw when they bookmarked, which
  // can differ from the live in-reader Practice list at another depth. That is
  // intentional — the notebook reflects what was bookmarked.
  bookmarkedTakeawayTexts: Record<string, string>;
};

export const defaultChapterState: PersistedChapterState = {
  activeTab: "summary",
  readingDepth: "standard",
  exampleFilter: "all",
  quizAnswers: {},
  quizResult: null,
  quizRetakeCount: 0,
  quizFailureStreak: 0,
  quizCooldownUntil: null,
  notes: "",
  notesUpdatedAt: null,
  focusMode: false,
  fontScale: "md",
  showRecap: false,
  explanationOpen: {},
  bookmarkedTakeaways: [],
  bookmarkedTakeawayTexts: {},
};

function uniqueInts(values: number[]): number[] {
  const seen = new Set<number>();
  const result: number[] = [];
  for (const value of values) {
    if (!seen.has(value)) {
      seen.add(value);
      result.push(value);
    }
  }
  return result;
}

function laterTimestamp(a: string | null, b: string | null): string | null {
  if (a && b) return a > b ? a : b;
  return a ?? b;
}

function chooseQuizResult(
  local: QuizResult | null,
  server: QuizResult | null
): QuizResult | null {
  if (!local) return server;
  if (!server) return local;
  // Never lose a recorded pass: prefer a passing result, then the higher score.
  if (local.passed !== server.passed) return local.passed ? local : server;
  return server.score > local.score ? server : local;
}

// Reconcile local state with a server copy. Mirrors useBookProgress's union /
// last-write-wins merge so a newer local edit is never silently clobbered by
// stale server data. By category:
//  - User-authored content (notes, bookmarked takeaways): preserved — notes via
//    last-write-wins on notesUpdatedAt, takeaways via union.
//  - Economy / abuse counters (retakes, failure streak, cooldown): take the more
//    restrictive value; the server is the source of truth for the quiz economy.
//  - Quiz progress: keep local in-progress answers; keep the better result.
//  - UI preferences: adopt the server value only where local is still at default.
export function mergeServerChapterState(
  local: PersistedChapterState,
  server: PersistedChapterState
): PersistedChapterState {
  const defaultState = defaultChapterState;
  // Notes: last-write-wins on notesUpdatedAt; never let an empty or stale server
  // copy overwrite notes the user has authored on this device.
  let notes = local.notes;
  let notesUpdatedAt = local.notesUpdatedAt;
  if (local.notesUpdatedAt && server.notesUpdatedAt) {
    if (server.notesUpdatedAt > local.notesUpdatedAt) {
      notes = server.notes;
      notesUpdatedAt = server.notesUpdatedAt;
    }
  } else if (server.notesUpdatedAt && !local.notesUpdatedAt) {
    // Only the server is timestamped: adopt it unless doing so would drop
    // unstamped (legacy) local notes the user wrote on this device.
    if (server.notes.trim() || !local.notes.trim()) {
      notes = server.notes;
      notesUpdatedAt = server.notesUpdatedAt;
    }
  } else if (!local.notesUpdatedAt && !server.notesUpdatedAt) {
    // Neither side is timestamped (legacy data): keep local content, only
    // filling in from the server when local has nothing.
    if (!local.notes.trim() && server.notes.trim()) {
      notes = server.notes;
    }
  }
  // (local timestamped, server not) → keep the newer local notes as-is.

  const mergedBookmarks = uniqueInts([
    ...local.bookmarkedTakeaways,
    ...server.bookmarkedTakeaways,
  ]);

  return {
    // UI preferences: the server fills in only where local is still at default.
    activeTab:
      local.activeTab === defaultState.activeTab ? server.activeTab : local.activeTab,
    readingDepth:
      local.readingDepth === defaultState.readingDepth
        ? server.readingDepth
        : local.readingDepth,
    exampleFilter:
      local.exampleFilter === defaultState.exampleFilter
        ? server.exampleFilter
        : local.exampleFilter,
    fontScale:
      local.fontScale === defaultState.fontScale ? server.fontScale : local.fontScale,
    focusMode: local.focusMode,
    showRecap: local.showRecap || server.showRecap,
    explanationOpen:
      Object.keys(local.explanationOpen).length > 0
        ? local.explanationOpen
        : server.explanationOpen,
    // Quiz progress: keep local in-progress answers; keep the better result.
    quizAnswers:
      Object.keys(local.quizAnswers).length > 0 ? local.quizAnswers : server.quizAnswers,
    quizResult: chooseQuizResult(local.quizResult, server.quizResult),
    // Economy / abuse counters: take the more restrictive value (server-truth).
    quizRetakeCount: Math.max(local.quizRetakeCount, server.quizRetakeCount),
    quizFailureStreak: Math.max(local.quizFailureStreak, server.quizFailureStreak),
    quizCooldownUntil: laterTimestamp(local.quizCooldownUntil, server.quizCooldownUntil),
    // User-authored content.
    notes,
    notesUpdatedAt,
    bookmarkedTakeaways: mergedBookmarks,
    // Keep the text map aligned with the merged index set: union the texts
    // (local wins on a key collision, matching the notes last-write-wins bias)
    // then prune to the MERGED index set so the map never carries a text for an
    // index that isn't bookmarked. NOTE: like all union-merges here, this can't
    // propagate a removal — an index the user un-bookmarked locally is re-added
    // (with its text) from the server copy on the next merge; that pre-existing
    // can't-delete behavior is unchanged by this fix.
    bookmarkedTakeawayTexts: Object.fromEntries(
      mergedBookmarks
        .map((index) => {
          const key = String(index);
          const text =
            local.bookmarkedTakeawayTexts[key] ?? server.bookmarkedTakeawayTexts[key];
          return [key, text] as const;
        })
        .filter((entry): entry is readonly [string, string] => typeof entry[1] === "string" && entry[1].trim().length > 0)
    ),
  };
}

// Reader choices kept as they are when changed since the last sync. The quiz
// counters are not here: they always keep the stricter value.
const KEPT_WHEN_CHANGED = [
  "activeTab",
  "readingDepth",
  "exampleFilter",
  "fontScale",
  "focusMode",
  "showRecap",
  "explanationOpen",
  "quizAnswers",
  "quizResult",
] as const;

// Where the reader is and how the page looks. Only the first read may fill
// these in from the account (so a chapter reopens at the saved step); a later
// read or a save answer never changes them under the reader.
const VIEW_FIELDS = [
  "activeTab",
  "readingDepth",
  "exampleFilter",
  "fontScale",
  "showRecap",
  "explanationOpen",
] as const;

/**
 * Merge a server copy read while the reader was already open. `previousBaseline`
 * is what the reader last synced (or the copy it opened with): anything the
 * reader changed since then, such as notes still being typed, an un-bookmark,
 * a step change or a quiz retake, stays as it is. With `keepView` (every read
 * after the first, and every save answer) the step, depth and other view
 * choices also stay, so returning to the tab never moves the reader to a step
 * another device saved; notes, bookmarks and quiz results still arrive.
 */
export function mergeRefreshedChapterState(
  local: PersistedChapterState,
  server: PersistedChapterState,
  previousBaseline: PersistedChapterState | null,
  keepView = false
): PersistedChapterState {
  const merged = mergeServerChapterState(local, server);
  const keep = <K extends keyof PersistedChapterState>(key: K) => {
    merged[key] = local[key];
  };
  if (keepView) {
    for (const key of VIEW_FIELDS) keep(key);
  }
  if (!previousBaseline) return merged;
  const base = previousBaseline;
  const changed = (key: keyof PersistedChapterState) =>
    stableJson(local[key]) !== stableJson(base[key]);
  for (const key of KEPT_WHEN_CHANGED) {
    if (changed(key)) keep(key);
  }
  if (changed("notes")) {
    keep("notes");
    keep("notesUpdatedAt");
  }
  if (changed("bookmarkedTakeaways") || changed("bookmarkedTakeawayTexts")) {
    keep("bookmarkedTakeaways");
    keep("bookmarkedTakeawayTexts");
  }
  return merged;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/** Same content, whatever the key order. */
export function chapterStatesEqual(
  a: PersistedChapterState | null,
  b: PersistedChapterState | null
): boolean {
  if (!a || !b) return a === b;
  return stableJson(a) === stableJson(b);
}

export const CHAPTER_STATE_SAVE_DELAY_MS = 200;
// Browsers cap keepalive request bodies at 64 KiB in total.
export const KEEPALIVE_BODY_LIMIT_BYTES = 60_000;
const RETRY_BASE_MS = 1_000;
const RETRY_MAX_MS = 30_000;
// Focus and visibilitychange often fire together; one read covers both.
const REFRESH_MIN_GAP_MS = 1_000;

export function chapterStateRetryDelayMs(failures: number): number {
  return Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** Math.max(0, failures - 1));
}

/** keepalive only for bodies the browser will accept. */
export function canSendWithKeepalive(body: string): boolean {
  return new TextEncoder().encode(body).length <= KEEPALIVE_BODY_LIMIT_BYTES;
}

/** Network errors, 5xx, 408 and 429 are worth retrying; other 4xx are not. */
export function isRetryableSyncError(error: unknown): boolean {
  const status =
    error && typeof error === "object" && "status" in error
      ? (error as { status?: unknown }).status
      : undefined;
  if (typeof status !== "number") return true;
  return status >= 500 || status === 408 || status === 429;
}

export type ServerChapterCopy = {
  state: PersistedChapterState | null;
  updatedAt: string | null;
};

export type ChapterStateSyncDeps = {
  get: () => Promise<ServerChapterCopy>;
  patch: (
    state: PersistedChapterState,
    options: { keepalive: boolean }
  ) => Promise<ServerChapterCopy>;
  /** Merge a server copy into the reader's current state. */
  applyServer: (
    server: PersistedChapterState,
    merge: (local: PersistedChapterState) => PersistedChapterState
  ) => void;
  onSyncFailedChange: (failed: boolean) => void;
  /** Which account is signed in now (null when unknown or signed out). */
  account: () => string | null;
  setTimer: (callback: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
  now: () => number;
};

export type ChapterStateSync = {
  /** First read. */
  start: () => void;
  /** The reader's current state (call after every change once hydrated). */
  setLocal: (state: PersistedChapterState) => void;
  /** Re-read and merge before the next write (focus / tab visible again). */
  refresh: () => void;
  /** Send unsynced changes now, with keepalive (hidden / pagehide / unmount). */
  flush: () => void;
  dispose: () => void;
};

export function createChapterStateSync(deps: ChapterStateSyncDeps): ChapterStateSync {
  let disposed = false;
  let local: PersistedChapterState | null = null;
  let baseline: PersistedChapterState | null = null;
  let baselineAt: string | null = null;
  let loaded = false;
  let getInFlight = false;
  let patchesInFlight = 0;
  let inFlightState: PersistedChapterState | null = null;
  let refreshWanted = false;
  let lastGetAt = Number.NEGATIVE_INFINITY;
  let saveTimer: unknown = null;
  let retryTimer: unknown = null;
  let getFailures = 0;
  let patchFailures = 0;
  // A state the server refused (4xx); not resent until the reader changes it.
  let refusedJson: string | null = null;
  // The last state a save delivered (cleared by a read): never sent again.
  let acceptedJson: string | null = null;
  let syncFailed = false;
  // The reader's state when the chapter opened: the base for a first read, so
  // changes made before it lands stay as they are.
  let openedWith: PersistedChapterState | null = null;
  // Null means not known yet (sessions from before the owner cookie existed
  // get it on their next refresh): the first known account is adopted.
  let owner = deps.account();

  function stop() {
    disposed = true;
    clearSaveTimer();
    if (retryTimer !== null) deps.clearTimer(retryTimer);
    retryTimer = null;
  }

  // False (and stopped for good, with the warning shown) once a known
  // account changes to another one or signs out.
  function sameAccount(): boolean {
    if (disposed) return false;
    const current = deps.account();
    if (current === owner) return true;
    if (owner === null) {
      owner = current;
      return true;
    }
    stop();
    setSyncFailed(true);
    return false;
  }

  function setSyncFailed(next: boolean) {
    if (syncFailed === next) return;
    syncFailed = next;
    deps.onSyncFailedChange(next);
  }

  function clearSaveTimer() {
    if (saveTimer !== null) deps.clearTimer(saveTimer);
    saveTimer = null;
  }

  function needsWrite(state: PersistedChapterState | null): state is PersistedChapterState {
    if (!state || !loaded) return false;
    if (baseline && chapterStatesEqual(state, baseline)) return false;
    if (acceptedJson !== null && stableJson(state) === acceptedJson) return false;
    return refusedJson === null || stableJson(state) !== refusedJson;
  }

  // Writes wait for the reader to stop changing state for a moment.
  function scheduleSave() {
    clearSaveTimer();
    if (!needsWrite(local)) return;
    saveTimer = deps.setTimer(() => {
      saveTimer = null;
      pump();
    }, CHAPTER_STATE_SAVE_DELAY_MS);
  }

  function scheduleRetry(failures: number) {
    retryTimer = deps.setTimer(() => {
      retryTimer = null;
      pump();
    }, chapterStateRetryDelayMs(failures));
  }

  function acceptServerCopy(copy: ServerChapterCopy) {
    if (baselineAt && copy.updatedAt && copy.updatedAt < baselineAt) return false;
    baseline = copy.state;
    baselineAt = copy.updatedAt;
    return true;
  }

  function runGet() {
    if (!sameAccount()) return;
    getInFlight = true;
    deps.get().then(
      (copy) => {
        if (disposed) return;
        getInFlight = false;
        if (!sameAccount()) return;
        if (copy.state === null && baseline !== null) {
          // The account copy seen earlier is gone. Writing now would replace
          // it with this device's whole state, so stop syncing instead.
          setSyncFailed(true);
          stop();
          return;
        }
        getFailures = 0;
        const firstRead = !loaded;
        loaded = true;
        refreshWanted = false;
        lastGetAt = deps.now();
        // A read clears the warning only while no save is failing or refused:
        // those changes have still not reached the account.
        if (refusedJson === null && patchFailures === 0) setSyncFailed(false);
        const previousBaseline = baseline ?? openedWith;
        const accepted = acceptServerCopy(copy);
        if (accepted) acceptedJson = null;
        if (accepted && copy.state) {
          const server = copy.state;
          const merge = (current: PersistedChapterState) =>
            mergeRefreshedChapterState(current, server, previousBaseline, !firstRead);
          // Write from the merged state now; the reader's own copy catches up
          // on its next render.
          if (local) local = merge(local);
          deps.applyServer(server, merge);
        }
        scheduleSave();
      },
      (error: unknown) => {
        if (disposed) return;
        getInFlight = false;
        if (!sameAccount()) return;
        if (!isRetryableSyncError(error)) {
          setSyncFailed(true);
          // A refused first read stops here (the next focus tries again); a
          // refused re-read does not hold back saving once a read succeeded.
          if (loaded) {
            refreshWanted = false;
            pump();
          }
          return;
        }
        getFailures += 1;
        if (getFailures >= 2) setSyncFailed(true);
        scheduleRetry(getFailures);
      }
    );
  }

  function runPatch(state: PersistedChapterState, keepalive: boolean) {
    if (!sameAccount()) return;
    patchesInFlight += 1;
    inFlightState = state;
    deps.patch(state, { keepalive }).then(
      (copy) => {
        if (disposed) return;
        patchesInFlight -= 1;
        if (patchesInFlight === 0) inFlightState = null;
        if (!sameAccount()) return;
        patchFailures = 0;
        refusedJson = null;
        setSyncFailed(false);
        if (acceptServerCopy(copy)) {
          const sentJson = stableJson(state);
          acceptedJson = sentJson;
          if (copy.state && stableJson(copy.state) !== sentJson) {
            // The server kept something else (say, newer notes from another
            // device): merge it in; changes made since this save stay.
            const server = copy.state;
            const merge = (current: PersistedChapterState) =>
              mergeRefreshedChapterState(current, server, state, true);
            if (local) local = merge(local);
            deps.applyServer(server, merge);
          }
        }
        pump();
      },
      (error: unknown) => {
        if (disposed) return;
        patchesInFlight -= 1;
        if (patchesInFlight === 0) inFlightState = null;
        if (!sameAccount()) return;
        if (!isRetryableSyncError(error)) {
          refusedJson = stableJson(state);
          setSyncFailed(true);
          pump();
          return;
        }
        patchFailures += 1;
        if (patchFailures >= 2) setSyncFailed(true);
        if (retryTimer === null) scheduleRetry(patchFailures);
      }
    );
  }

  function pump() {
    if (disposed || getInFlight || patchesInFlight > 0 || retryTimer !== null) return;
    if (!loaded || refreshWanted) {
      runGet();
      return;
    }
    if (saveTimer !== null) return;
    if (needsWrite(local)) runPatch(local, false);
  }

  return {
    start() {
      pump();
    },
    setLocal(state) {
      local = state;
      if (openedWith === null) openedWith = state;
      if (disposed || !loaded) return;
      scheduleSave();
    },
    refresh() {
      if (disposed) return;
      if (!loaded) {
        // Still waiting on a first read: try again now instead of after backoff.
        if (retryTimer !== null) {
          deps.clearTimer(retryTimer);
          retryTimer = null;
        }
        pump();
        return;
      }
      if (deps.now() - lastGetAt < REFRESH_MIN_GAP_MS) return;
      refreshWanted = true;
      clearSaveTimer();
      pump();
    },
    flush() {
      if (!sameAccount()) return;
      clearSaveTimer();
      if (!needsWrite(local)) return;
      if (patchesInFlight > 0 && inFlightState && chapterStatesEqual(local, inFlightState)) {
        return;
      }
      runPatch(local, true);
    },
    dispose() {
      stop();
    },
  };
}
