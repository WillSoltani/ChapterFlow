/**
 * WP-E71 red-team — ATTACK 4: chapter-diagnostic masquerade (NEW-05 boundary).
 *
 * A standalone chapter diagnostic reads one chapter and is NOT a book score. This
 * suite tries to launder a diagnostic into a book score through every machine seam
 * and asserts each is refused, and that every emitted artifact self-labels:
 *
 *   • a CANONICAL/catalog book id into a diagnostic path → refused on sight
 *     (`assertChapterDiagnosticBookId` / `resolveChapterDiagnosticRunRoot`), and a
 *     canonical id can never even be MINTED as a diagnostic id (the builder always
 *     prefixes `chapterdiag--`).
 *   • a diagnostic write target that escapes the segregated run root, or lands in
 *     the canonical full-book evaluation root → refused
 *     (`assertWithinChapterDiagnosticRoot`).
 *   • a diagnostic fed into a portfolio-aggregation script → refused by name
 *     (`assertNotPortfolioScript`), with/without `.py` and directory prefixes.
 *   • the NOT-A-BOOK-SCORE label is present on the human-facing surfaces
 *     (`withNotABookScoreLabel`, the `chapter-diagnostic` command output) and the
 *     record scope is book-unscorable (`full_book_score: null`).
 *
 * Pure/hermetic: boundary functions do no IO (paths are computed, not written);
 * the command handler only prints. Nothing lands under a guarded root.
 */

import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { test } from "./harness.js";
import {
  assertChapterDiagnosticBookId,
  assertNotPortfolioScript,
  assertWithinChapterDiagnosticRoot,
  isChapterDiagnosticBookId,
  registerChapterDiagnosticCommand,
  resolveChapterDiagnosticRunRoot,
  withNotABookScoreLabel,
  CHAPTER_DIAGNOSTIC_BOOK_ID_PREFIX,
  CANONICAL_EVALUATION_ROOT_MARKER,
  ChapterDiagnosticBoundaryError,
  FORBIDDEN_PORTFOLIO_SCRIPTS,
  NOT_A_BOOK_SCORE_LABEL,
} from "../src/evaluation/diagnosticBoundary.js";
import {
  buildChapterDiagnosticBookId,
  buildChapterDiagnosticPackage,
} from "../src/evaluation/chapterDiagnosticPackage.js";
import { STANDALONE_CHAPTER_SCOPE } from "../src/evaluation/chapterDiagnosticRun.js";
import { V21_SCHEMA_VERSION, type ChapterV21 } from "../src/types.js";

const CANONICAL = "the-effective-executive"; // a real catalog book id

// ── 1. book-id prefix wall ──────────────────────────────────────────────────────
test("attack4: a canonical/catalog book id is refused as a diagnostic id (masquerade wall)", () => {
  assert.equal(isChapterDiagnosticBookId(CANONICAL), false);
  assert.equal(isChapterDiagnosticBookId("chapterdiag--rh-nudge-ch03-w1"), true);
  assert.equal(isChapterDiagnosticBookId(""), false);
  assert.equal(isChapterDiagnosticBookId(null), false);

  assert.throws(
    () => assertChapterDiagnosticBookId(CANONICAL),
    (err: unknown) => err instanceof ChapterDiagnosticBoundaryError && (err as Error).message.includes(NOT_A_BOOK_SCORE_LABEL),
  );
  // A genuine blind id passes through unchanged.
  assert.equal(assertChapterDiagnosticBookId("chapterdiag--rh-nudge-ch03-w1"), "chapterdiag--rh-nudge-ch03-w1");
});

test("attack4: resolveChapterDiagnosticRunRoot refuses a canonical id and segregates a blind run", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "cf-rt4-state-"));
  assert.throws(() => resolveChapterDiagnosticRunRoot(CANONICAL, "run1", stateRoot), ChapterDiagnosticBoundaryError);

  const blind = "chapterdiag--rh-nudge-ch03-w1";
  const root = resolveChapterDiagnosticRunRoot(blind, "run1", stateRoot);
  assert.ok(root.includes("model-bakeoffs"), `root must live under the segregated bake-off tree: ${root}`);
  assert.ok(root.includes("chapter-diagnostics"), `root must be segregated under chapter-diagnostics: ${root}`);
  // The book id is normSlug'd into the path (`--` → `-`), but it is unmistakably a
  // chapter-diagnostic run scoped to this blind block/slot, never a canonical book.
  assert.ok(root.includes("chapterdiag") && root.includes("nudge-ch03-w1"), `root is scoped to the blind diagnostic id: ${root}`);
  assert.ok(!root.includes(CANONICAL_EVALUATION_ROOT_MARKER), "a diagnostic root is never the canonical evaluation root");
});

// ── 2. segregated root wall ─────────────────────────────────────────────────────
test("attack4: a diagnostic write into the canonical evaluation root, or outside the run root, is refused", () => {
  const runRoot = mkdtempSync(join(tmpdir(), "cf-rt4-run-"));

  // (a) the canonical full-book evaluation root — refused even if it were "inside".
  assert.throws(
    () => assertWithinChapterDiagnosticRoot(join(runRoot, "artifacts/chapterflow-evaluation/portfolio.json"), runRoot),
    (err: unknown) => err instanceof ChapterDiagnosticBoundaryError && (err as Error).message.includes(CANONICAL_EVALUATION_ROOT_MARKER),
  );
  // (b) a path escaping the run root.
  assert.throws(
    () => assertWithinChapterDiagnosticRoot("/tmp/somewhere-else/record.json", runRoot),
    ChapterDiagnosticBoundaryError,
  );
  // (c) a legitimate in-root write returns its resolved absolute path.
  const ok = assertWithinChapterDiagnosticRoot(join(runRoot, "raw/adjudicated/adjudicated.json"), runRoot);
  assert.ok(ok.startsWith(runRoot));
});

// ── 3. no portfolio scripts ─────────────────────────────────────────────────────
test("attack4: every portfolio-aggregation script is refused on a diagnostic (bare, .py, and dir-prefixed)", () => {
  for (const bare of FORBIDDEN_PORTFOLIO_SCRIPTS) {
    for (const form of [bare, `${bare}.py`, `scripts/${bare}.py`, `.agents/skills/x/scripts/${bare}.py`]) {
      assert.throws(
        () => assertNotPortfolioScript(form),
        (err: unknown) => err instanceof ChapterDiagnosticBoundaryError && (err as Error).message.includes(NOT_A_BOOK_SCORE_LABEL),
        `portfolio script form "${form}" must be refused`,
      );
    }
  }
  // A non-portfolio script is allowed (the guard is a denylist, not a lockout).
  assert.doesNotThrow(() => assertNotPortfolioScript("inspect_package.py"));
  assert.doesNotThrow(() => assertNotPortfolioScript("scripts/validate_book_result.py"));
});

// ── 4. labels on outputs ────────────────────────────────────────────────────────
test("attack4: the NOT-A-BOOK-SCORE label prefixes any human-facing string (idempotent)", () => {
  const labeled = withNotABookScoreLabel("chapter_diagnostic_score=61.9");
  assert.ok(labeled.startsWith(NOT_A_BOOK_SCORE_LABEL));
  assert.ok(labeled.includes("chapter_diagnostic_score=61.9"));
  // Idempotent — never double-labels.
  assert.equal(withNotABookScoreLabel(labeled), labeled);
});

test("attack4: the standalone-chapter scope is book-unscorable by construction", () => {
  assert.equal(STANDALONE_CHAPTER_SCOPE.scope_type, "standalone_chapter_audit");
  assert.equal(STANDALONE_CHAPTER_SCOPE.full_book_score, null);
  assert.equal(STANDALONE_CHAPTER_SCOPE.full_book_certification, "unevaluable");
  assert.equal(STANDALONE_CHAPTER_SCOPE.domain_9, "unassessable");
  assert.equal(STANDALONE_CHAPTER_SCOPE.actual_book_inventory_complete, false);
});

// ── 5. the builder can never mint a canonical id as a diagnostic id ─────────────
test("attack4: even a canonical id fed as a blind component yields a chapterdiag-- id, never the bare canonical id", () => {
  const blindId = buildChapterDiagnosticBookId(CANONICAL, "nudge-ch03", "w1");
  assert.ok(blindId.startsWith(CHAPTER_DIAGNOSTIC_BOOK_ID_PREFIX));
  assert.notEqual(blindId, CANONICAL, "the blind id is never the raw canonical id");

  const built = buildChapterDiagnosticPackage({
    runHash: CANONICAL, blockCode: "nudge-ch03", slot: "w1",
    chapter: cleanChapter(), book: { title: "The Effective Executive", categories: ["Management"], tags: ["decisions"] },
  });
  assert.ok(built.blindBookId.startsWith(CHAPTER_DIAGNOSTIC_BOOK_ID_PREFIX));
  assert.equal(built.package.book.bookId, built.blindBookId, "the package book id is the blind id, not the canonical id");
  // The chapter's rebuilt id is also blind.
  assert.ok((built.package.chapters[0].chapterId as string).startsWith(CHAPTER_DIAGNOSTIC_BOOK_ID_PREFIX));
});

// ── 6. the command handler refuses a canonical id and self-labels its output ────
test("attack4: the chapter-diagnostic command refuses a canonical book id (nonzero) with a NOT-A-BOOK-SCORE banner", async () => {
  const cmd = registerChapterDiagnosticCommand();
  const cap = captureStdio();
  try {
    const code = await cmd.run([CANONICAL], {});
    assert.equal(code, 2, "a canonical id is refused with a nonzero exit");
    assert.ok(cap.err().includes(NOT_A_BOOK_SCORE_LABEL), "the refusal carries the banner");
  } finally {
    cap.restore();
  }

  const cap2 = captureStdio();
  try {
    const code = await cmd.run(["chapterdiag--rh-nudge-ch03-w1"], { "run-id": "run1" });
    assert.equal(code, 0, "a genuine blind id is accepted");
    assert.ok(cap2.out().includes(NOT_A_BOOK_SCORE_LABEL), "the accepted-path stdout still carries the banner");
    assert.ok(cap2.out().includes("chapter-diagnostics"), "the printed root is the segregated one");
  } finally {
    cap2.restore();
  }
});

// ── helpers ─────────────────────────────────────────────────────────────────────

function captureStdio(): { out: () => string; err: () => string; restore: () => void } {
  let outBuf = "";
  let errBuf = "";
  const origOut = process.stdout.write.bind(process.stdout);
  const origErr = process.stderr.write.bind(process.stderr);
  (process.stdout.write as unknown as (s: string) => boolean) = (s: string) => { outBuf += s; return true; };
  (process.stderr.write as unknown as (s: string) => boolean) = (s: string) => { errBuf += s; return true; };
  return {
    out: () => outBuf,
    err: () => errBuf,
    restore: () => {
      (process.stdout.write as unknown) = origOut;
      (process.stderr.write as unknown) = origErr;
    },
  };
}

/** A model-token-free, fully-populated v21 chapter the blind builder accepts. */
function cleanChapter(): ChapterV21 {
  return {
    schemaVersion: V21_SCHEMA_VERSION,
    chapterId: "the-effective-executive-ch01",
    number: 1,
    title: "First Things First",
    readingTimeMinutes: 8,
    hook: "A short arresting hook line about deciding what deserves your scarce attention.",
    counterintuition: "The obvious priority is usually the one you should drop.",
    tryThisNow: "List today's tasks and cross out the two that only feel urgent.",
    keyTakeaway: "Decide what NOT to do before you decide what to do next.",
    breakdown: {
      fastRead: "Fast read paragraph with enough words to look like real prose content for testing here.",
      deepRead: "Deep read paragraph explaining the mechanism of concentration in a bit more depth here.",
      fullRead: "Full read paragraph going into the mechanism, its limits, and a second worked case here.",
    },
    examples: [
      { exampleId: "ex01", title: "The Full Calendar", tags: ["case"], scenario: "An executive faces a calendar packed with meetings and cannot find focus time.", whatToDo: "Cut the two lowest-value recurring meetings this week.", whyItMatters: "Reclaimed hours go to the one task that actually moves the goal." },
    ],
    quiz: {
      passingScorePercent: 70,
      questions: [
        { questionId: "q01", prompt: "What should you decide first, per the chapter?", choices: ["What to do", "What NOT to do", "Who to blame"], correctIndex: 1, explanation: "The prose argues you concentrate by first eliminating.", bloomsLevel: "understand" },
      ],
    },
    reviewCards: [{ cardId: "c01", front: "What comes before choosing what to do?", back: "Deciding what to stop doing.", difficulty: "medium" }],
    implementationPlan: {
      coreSkill: "Concentration through deliberate elimination of the trivial many.",
      ifThenPlans: [{ context: "A new request lands on a full week.", plan: "If the week is full, then decline unless it beats the current top task." }],
      twentyFourHourChallenge: "Within 24 hours, drop one recurring commitment and note what you gained.",
      weeklyPractice: "Each Monday, list what you will NOT do that week and hold the line.",
    },
    memorableLines: [{ text: "Concentration is the secret of every effective executive." }],
  } as unknown as ChapterV21;
}
