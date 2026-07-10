/**
 * shippedControl — the AUTO control-read (WS7 prereq): derive the beat-shipped
 * bar from the SHIPPED package on its own, git-pinned bytes, with no env-var
 * juggling.
 *
 * When a book is a REGEN of an already-published book, acceptance must not only
 * clear the 80 bar — it must BEAT the book it replaces on the SAME instrument.
 * Previously the operator had to run a control read by hand and export
 * CHAPTERFLOW_BEAT_SHIPPED_COMPOSITE. This automates it:
 *
 *   - If CHAPTERFLOW_BEAT_SHIPPED_COMPOSITE is SET → it OVERRIDES; skip entirely
 *     (the operator pinned a value on purpose).
 *   - Else, if a tracked shipped package exists at
 *     <outerRoot>/book-packages/<bookId>.v21.json:
 *       * pin the outer repo HEAD sha;
 *       * load the SHIPPED bytes via `git show <pin>:book-packages/<bookId>.v21.json`
 *         (the committed bytes, NEVER the working tree — a dirty tree can't skew
 *         the bar);
 *       * run the SAME 3-reader book-level read the acceptance uses
 *         (selectSeededChapters → renderBookSampleDoc → buildBookReviewTask →
 *         adjudicateBookReview → composeBookVerdict — reused, not forked);
 *       * the median composite becomes the beat-shipped bar;
 *       * persist to state/reviews/<bookId>/shipped-control.json and REUSE it on
 *         re-entry while the pin still matches (a control read is expensive; it
 *         doesn't change until the shipped bytes do).
 *       * If the control read FAILS after one retry → FAIL-CLOSED infra halt
 *         (never silently drop the beat-shipped protection).
 *   - No shipped package → no beat-shipped bar (bar-80-only, as today).
 *
 * Everything is injectable (readShippedPackage / pinHead / spawn) so tests never
 * spawn a real reader and never shell out to git.
 */

import { execFileSync } from "child_process";
import { existsSync, mkdirSync, readFileSync } from "fs";
import { dirname, resolve } from "path";

import type { BookPackageV21, ChapterV21 } from "../types.js";
import { MONOREPO_ANCESTOR, CANONICAL_STATE } from "../lib/chapterPaths.js";
import { writeFileAtomic } from "../lib/atomicWrite.js";
import {
  adjudicateBookReview,
  buildBookReviewTask,
  composeBookVerdict,
  parseBookReview,
  renderBookSampleDoc,
  selectSeededChapters,
  type BookReaderResult,
} from "../review/evalBookProxy.js";
import { REVIEW_FACTORS, type ReviewFactor } from "../artifacts/artifactTypes.js";
import type { AutopilotDeps } from "./autopilot.js";
import type { AuthorReviewIo } from "./authorReview.js";
import { AUTHOR_BOOK_READERS } from "./authorReview.js";

const CONTROL_SCHEMA_VERSION = "shipped-control-v1" as const;

export type ShippedControlRecord = {
  schemaVersion: typeof CONTROL_SCHEMA_VERSION;
  bookId: string;
  /** The outer-repo HEAD sha the shipped bytes were read at. */
  pin: string;
  /** The median composite (the beat-shipped bar), or null when the panel had
   *  no valid readers. */
  composite: number | null;
  gate: "PASS" | "FAIL" | null;
  churn: string;
  /** F-05 quorum guard: the valid-reader count behind `composite`. A control
   *  composite may set the +5 margin baseline ONLY at the same quorum acceptance
   *  requires (AUTHOR_BOOK_READERS). Optional so records predating this field
   *  still parse — their effective count is DERIVED from `readers` on read. */
  validCount?: number;
  readers: BookReaderResult[];
  at: string;
};

export type ShippedControlIo = {
  /** The outer-repo path where a tracked shipped package would live. */
  shippedPackagePath: (bookId: string) => string;
  /** Whether the tracked shipped package exists. */
  shippedPackageExists: (bookId: string) => boolean;
  /** Pin the outer repo HEAD sha (git rev-parse HEAD). Returns "" on failure. */
  pinHead: () => string;
  /** Load the SHIPPED package BYTES at the pinned sha (git show <pin>:<path>),
   *  parsed. Throws on any failure (unreadable pin, parse error). */
  readShippedPackageAtPin: (bookId: string, pin: string) => BookPackageV21;
  /** Persist path for the control record. */
  controlRecordPath: (bookId: string) => string;
};

const OUTER_BOOK_PACKAGES = resolve(MONOREPO_ANCESTOR, "book-packages");

export function defaultShippedControlIo(): ShippedControlIo {
  return {
    shippedPackagePath: (bookId) => resolve(OUTER_BOOK_PACKAGES, `${bookId}.v21.json`),
    shippedPackageExists: (bookId) => existsSync(resolve(OUTER_BOOK_PACKAGES, `${bookId}.v21.json`)),
    pinHead: () => {
      try {
        return execFileSync("git", ["rev-parse", "HEAD"], { cwd: MONOREPO_ANCESTOR, encoding: "utf8" }).trim();
      } catch {
        return "";
      }
    },
    readShippedPackageAtPin: (bookId, pin) => {
      // The COMMITTED bytes at the pin — never the working tree.
      const raw = execFileSync("git", ["show", `${pin}:book-packages/${bookId}.v21.json`], { cwd: MONOREPO_ANCESTOR, encoding: "utf8" });
      const pkg = JSON.parse(raw) as BookPackageV21;
      if (!Array.isArray(pkg.chapters) || pkg.chapters.length === 0) throw new Error(`shipped package at ${pin} has no chapters`);
      return pkg;
    },
    controlRecordPath: (bookId) => resolve(CANONICAL_STATE, "reviews", bookId, "shipped-control.json"),
  };
}

export function loadShippedControlRecord(bookId: string, io: ShippedControlIo): ShippedControlRecord | null {
  const p = io.controlRecordPath(bookId);
  if (!existsSync(p)) return null;
  try {
    const rec = JSON.parse(readFileSync(p, "utf8")) as ShippedControlRecord;
    if (rec && rec.schemaVersion === CONTROL_SCHEMA_VERSION && rec.bookId === bookId) return rec;
  } catch { /* torn → recompute */ }
  return null;
}

export type BeatShippedResult =
  | { ok: true; composite: number | null; source: "env" | "control" | "none" | "degraded"; pin?: string }
  | { ok: false; reason: string };

/** F-05 quorum guard helper: the valid-reader count that stands behind a cached
 *  control composite. New records carry `validCount`; records that predate the
 *  field DERIVE it from the persisted `readers` array (the exact count
 *  composeBookVerdict used) — this is computation from evidence, not a guess. A
 *  record with no usable readers array yields 0 (degraded → floor-only). */
export function effectiveControlValidCount(rec: ShippedControlRecord): number {
  if (typeof rec.validCount === "number") return rec.validCount;
  if (Array.isArray(rec.readers)) return rec.readers.filter((r) => r && r.valid).length;
  return 0;
}

function envOverride(): number | null | undefined {
  const raw = process.env.CHAPTERFLOW_BEAT_SHIPPED_COMPOSITE;
  if (raw === undefined || raw === "") return undefined; // not set
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** Run the 3-reader control read over the shipped sample doc, reusing the SAME
 *  book-review instrument the acceptance uses. Returns the composed verdict's
 *  readers + median. One respawn per reader on unparseable output. */
async function runControlPanel(
  bookId: string,
  sampled: ChapterV21[],
  docText: string,
  relPath: string,
  deps: AutopilotDeps,
): Promise<{ readers: BookReaderResult[] }> {
  const task = buildBookReviewTask(relPath);
  const readers: BookReaderResult[] = [];
  for (let readerNo = 1; readerNo <= AUTHOR_BOOK_READERS; readerNo++) {
    let result: BookReaderResult | null = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      const sessionId = deps.mkSessionId(`shipped-control-r${readerNo}${attempt > 1 ? "-r2" : ""}`);
      const r = await deps.spawn({
        task,
        sessionId,
        cwd: resolve(dirname(relPath)),
        sandbox: "read-only",
        skipGitRepoCheck: true,
        reasoningEffort: "high",
      });
      try { deps.logSession(bookId, `shipped-control-r${readerNo}`, r); } catch { /* best-effort */ }
      const parsed = parseBookReview(r.finalMessage) ?? parseBookReview(r.stdout);
      if (!parsed) continue;
      result = adjudicateBookReview(parsed, docText, sampled, sessionId);
      if (result.valid || attempt === 2) break;
    }
    readers.push(result ?? adjudicateBookReview(
      { gate_verdict: "FAIL", book3_churn: "HIGH", quizDerivation: {}, scores: Object.fromEntries(REVIEW_FACTORS.map((f) => [f, 0])) as Record<ReviewFactor, number>, quotes: [], oneParagraphVerdict: "INVALID: unparseable after retry" },
      docText,
      sampled,
      `shipped-control-r${readerNo}-invalid`,
    ));
  }
  return { readers };
}

/**
 * Resolve the beat-shipped bar for `bookId`. See the module header for the full
 * decision. Fail-CLOSED: a shipped package that exists but whose control read
 * cannot be produced (after one retry) returns { ok: false } — the caller HALTS
 * infra rather than silently dropping the beat-shipped protection.
 */
export async function resolveBeatShippedBar(
  bookId: string,
  deps: AutopilotDeps,
  reviewIo: AuthorReviewIo,
  io: ShippedControlIo = defaultShippedControlIo(),
): Promise<BeatShippedResult> {
  // 1. Env override — pinned on purpose; skip everything.
  const env = envOverride();
  // Red-team BREAK-1 (publish calibration): a SET but non-numeric override must
  // FAIL CLOSED — silently returning null would judge a regen floor-only,
  // exactly the "never below the book it replaces" case the margin exists for.
  if (env === null) return { ok: false, reason: `CHAPTERFLOW_BEAT_SHIPPED_COMPOSITE is set but not a finite number: "${process.env.CHAPTERFLOW_BEAT_SHIPPED_COMPOSITE}"` };
  if (env !== undefined) return { ok: true, composite: env, source: "env" };

  // 2. No tracked shipped package → bar-80-only as today.
  if (!io.shippedPackageExists(bookId)) return { ok: true, composite: null, source: "none" };

  // 3. Pin the outer HEAD.
  const pin = io.pinHead();
  if (!pin) return { ok: false, reason: "could not pin the outer repo HEAD sha for the shipped control read" };

  // 4. Reuse a persisted control record when the pin still matches (expensive read).
  const cached = loadShippedControlRecord(bookId, io);
  if (cached && cached.pin === pin) {
    const cachedValid = effectiveControlValidCount(cached);
    if (cached.composite !== null && cachedValid >= AUTHOR_BOOK_READERS) {
      return { ok: true, composite: cached.composite, source: "control", pin };
    }
    // F-05 quorum guard: a cached record below quorum (or with a null composite,
    // or an old record whose valid count cannot be established) must NOT set the
    // beat-shipped baseline. Fall to floor-only and log loudly — never guess a
    // count and never trust a partial-panel composite.
    deps.log(`[autopilot] shipped-control ${bookId}: cached control record at ${pin.slice(0, 12)} is BELOW the valid-reader quorum (${cachedValid}/${AUTHOR_BOOK_READERS}${cached.composite === null ? ", null composite" : ""}) — NOT trusting it as the beat-shipped baseline (F-05). Falling to FLOOR-ONLY (74) mode this entry.`);
    return { ok: true, composite: null, source: "degraded", pin };
  }

  // 5. Load the SHIPPED bytes at the pin (committed, never the working tree).
  let pkg: BookPackageV21;
  try {
    pkg = io.readShippedPackageAtPin(bookId, pin);
  } catch (err) {
    return { ok: false, reason: `could not load the shipped package bytes at ${pin}: ${(err as Error).message}` };
  }

  // 6. The SAME 3-reader book-level read the acceptance uses, over the shipped bytes.
  const sampled = selectSeededChapters(bookId, pkg.chapters, 4);
  const docText = renderBookSampleDoc(sampled);
  const { relPath } = reviewIo.writeReviewDoc(bookId, `shipped-control-${pin.slice(0, 12)}.txt`, docText);

  let readers: BookReaderResult[];
  try {
    ({ readers } = await runControlPanel(bookId, sampled, docText, relPath, deps));
  } catch (err) {
    return { ok: false, reason: `shipped control read failed: ${(err as Error).message}` };
  }
  const verdict = composeBookVerdict(bookId, sampled.map((c) => c.number), readers);
  // A control read that produced NO valid reader is a total-panel (likely infra)
  // failure — FAIL-CLOSED, never silently drop the beat-shipped protection with a
  // null bar (halts the run so the operator fixes the reader infra).
  if (verdict.validCount < 1 || verdict.medianComposite === null) {
    return { ok: false, reason: `shipped control read produced no valid reader (${verdict.validCount}/${readers.length}) — cannot derive a beat-shipped bar` };
  }
  // F-05 quorum guard: a PARTIAL panel (1-2 valid) produced signal but not the
  // AUTHOR_BOOK_READERS quorum acceptance requires. composeBookVerdict ties favor
  // PASS, so a 2-reader control could set a distorted baseline the +5 margin is
  // then measured against. Do NOT trust it: fall to floor-only (shipped === null)
  // and log loudly. We return BEFORE persisting so the next entry re-runs the
  // panel (a partial panel is usually transient reader flakiness — retry rather
  // than cache a degraded baseline). This does not fabricate a control where none
  // exists; it declines to trust a degraded one.
  if (verdict.validCount < AUTHOR_BOOK_READERS) {
    deps.log(`[autopilot] shipped-control ${bookId}: DEGRADED control read — only ${verdict.validCount}/${AUTHOR_BOOK_READERS} valid readers; a partial panel cannot set the beat-shipped baseline (F-05 quorum guard). Falling to FLOOR-ONLY (74) mode — the regen is NOT held to beat the shipped composite this entry. Fix the reader infra to restore beat-shipped protection.`);
    return { ok: true, composite: null, source: "degraded", pin };
  }

  const record: ShippedControlRecord = {
    schemaVersion: CONTROL_SCHEMA_VERSION,
    bookId,
    pin,
    composite: verdict.medianComposite,
    gate: verdict.gate,
    churn: verdict.churn,
    validCount: verdict.validCount,
    readers,
    at: new Date().toISOString(),
  };
  try {
    const p = io.controlRecordPath(bookId);
    mkdirSync(dirname(p), { recursive: true });
    writeFileAtomic(p, JSON.stringify(record, null, 2) + "\n");
  } catch (err) {
    // The record is a cache; a write failure must not fail the read — but it
    // must be LOUD (F7): a persistently unwritable cache re-runs this 3-reader
    // control panel on every conductor entry.
    deps.log(`[autopilot] shipped-control ${bookId}: WARNING cache write failed (${(err as Error).message}) — the 3-reader control read will RE-RUN next entry; fix the state dir to stop re-spending readers`);
  }

  return { ok: true, composite: verdict.medianComposite, source: "control", pin };
}
