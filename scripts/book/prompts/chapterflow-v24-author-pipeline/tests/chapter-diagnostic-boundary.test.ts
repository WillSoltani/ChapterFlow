/**
 * WP-E14 — the NEW-05 masquerade boundary tests. A chapter diagnostic must never
 * be mistaken for, filed as, or aggregated into a full-book score. These tests
 * pin every machine-path refusal (canonical book id, canonical evaluation root,
 * portfolio scripts) plus the verbatim NOT-A-BOOK-SCORE label. Pure TS — no python.
 */

import assert from "node:assert/strict";
import { join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";

import { test } from "./harness.js";
import {
  assertChapterDiagnosticBookId,
  assertNotPortfolioScript,
  assertWithinChapterDiagnosticRoot,
  CHAPTER_DIAGNOSTIC_BOOK_ID_PREFIX,
  ChapterDiagnosticBoundaryError,
  FORBIDDEN_PORTFOLIO_SCRIPTS,
  isChapterDiagnosticBookId,
  NOT_A_BOOK_SCORE_LABEL,
  registerChapterDiagnosticCommand,
  resolveChapterDiagnosticRunRoot,
  withNotABookScoreLabel,
} from "../src/evaluation/diagnosticBoundary.js";

const CHAPTERDIAG_ID = `${CHAPTER_DIAGNOSTIC_BOOK_ID_PREFIX}abc123-nudge-ch03-w1`;

// ── 1. book-id prefix (masquerade wall) ───────────────────────────────────────

test("assertChapterDiagnosticBookId refuses a canonical/catalog book id", () => {
  for (const canonical of ["the-effective-executive", "nudge", "nudge-ch03-sol", "chapterdiag-missing-double-dash", ""]) {
    assert.throws(
      () => assertChapterDiagnosticBookId(canonical),
      (err: unknown) => err instanceof ChapterDiagnosticBoundaryError && err.message.includes(NOT_A_BOOK_SCORE_LABEL),
      `expected refusal for ${JSON.stringify(canonical)}`,
    );
  }
});

test("assertChapterDiagnosticBookId accepts a chapterdiag-- blind id and returns it", () => {
  assert.equal(assertChapterDiagnosticBookId(CHAPTERDIAG_ID), CHAPTERDIAG_ID);
  assert.equal(isChapterDiagnosticBookId(CHAPTERDIAG_ID), true);
  assert.equal(isChapterDiagnosticBookId("nudge"), false);
  // prefix with nothing after it is NOT a valid diagnostic id.
  assert.equal(isChapterDiagnosticBookId(CHAPTER_DIAGNOSTIC_BOOK_ID_PREFIX), false);
  assert.equal(isChapterDiagnosticBookId(42), false);
});

test("resolveChapterDiagnosticRunRoot refuses a canonical id and segregates a diagnostic id", () => {
  assert.throws(() => resolveChapterDiagnosticRunRoot("the-effective-executive", "run1"), ChapterDiagnosticBoundaryError);
  const root = resolveChapterDiagnosticRunRoot(CHAPTERDIAG_ID, "20260717T140020Z", join(tmpdir(), "cd-state"));
  assert.ok(root.split(sep).join("/").includes("model-bakeoffs"), root);
  assert.ok(root.split(sep).join("/").includes("chapter-diagnostics"), root);
});

// ── 2. segregated root (never the canonical evaluation root) ──────────────────

test("assertWithinChapterDiagnosticRoot accepts a path inside the run root", () => {
  const root = join(tmpdir(), "cd-root", "run1");
  const ok = assertWithinChapterDiagnosticRoot(join(root, "receipts", "primary.dispatch.json"), root);
  assert.equal(ok, resolve(root, "receipts", "primary.dispatch.json"));
  // the root itself is inside itself.
  assert.equal(assertWithinChapterDiagnosticRoot(root, root), resolve(root));
});

test("assertWithinChapterDiagnosticRoot refuses a write that escapes the run root", () => {
  const root = join(tmpdir(), "cd-root", "run1");
  assert.throws(
    () => assertWithinChapterDiagnosticRoot(join(tmpdir(), "cd-root", "elsewhere", "x.json"), root),
    (err: unknown) => err instanceof ChapterDiagnosticBoundaryError && /outside its segregated run root/.test(err.message),
  );
  // a sibling-prefix path (…/run1x) must not be treated as inside …/run1.
  assert.throws(() => assertWithinChapterDiagnosticRoot(`${root}x/y.json`, root), ChapterDiagnosticBoundaryError);
});

test("assertWithinChapterDiagnosticRoot refuses the canonical full-book evaluation root explicitly", () => {
  // Even if a caller (mis)resolves the run root INTO the canonical evaluation
  // tree, the marker substring is refused before the containment check passes.
  const canonicalRoot = join(tmpdir(), "artifacts", "chapterflow-evaluation", "some-book");
  assert.throws(
    () => assertWithinChapterDiagnosticRoot(join(canonicalRoot, "result.json"), canonicalRoot),
    (err: unknown) => err instanceof ChapterDiagnosticBoundaryError && /canonical full-book evaluation root/.test(err.message),
  );
});

// ── 3. no portfolio scripts ───────────────────────────────────────────────────

test("assertNotPortfolioScript refuses every portfolio-aggregation script by bare name", () => {
  const forms = [
    "aggregate_results.py",
    "export_portfolio_book_update.py",
    "update_portfolio_report.py",
    "render_report.py",
    "scripts/render_report.py",
    ".agents/skills/chapterflow-book-evaluator/scripts/aggregate_results.py",
    "aggregate_results",
  ];
  for (const form of forms) {
    assert.throws(
      () => assertNotPortfolioScript(form),
      (err: unknown) => err instanceof ChapterDiagnosticBoundaryError && err.message.includes(NOT_A_BOOK_SCORE_LABEL),
      `expected refusal for ${form}`,
    );
  }
  assert.equal(FORBIDDEN_PORTFOLIO_SCRIPTS.length, 4);
});

test("assertNotPortfolioScript allows the diagnostic's own receipt/validation scripts", () => {
  for (const ok of ["inspect_package.py", "issue_worker_receipts.py", "seal_blind_pair_receipt.py", "validate_book_result.py"]) {
    assert.doesNotThrow(() => assertNotPortfolioScript(ok));
  }
});

// ── 4. labels ─────────────────────────────────────────────────────────────────

test("withNotABookScoreLabel prefixes the verbatim banner and is idempotent", () => {
  const once = withNotABookScoreLabel("score is 81.4");
  assert.ok(once.startsWith(NOT_A_BOOK_SCORE_LABEL));
  assert.equal(withNotABookScoreLabel(once), once, "must not double-label");
  assert.equal(NOT_A_BOOK_SCORE_LABEL, "CHAPTER DIAGNOSTIC — NOT A BOOK SCORE");
});

// ── CLI registration (registration function only; no cli.ts edit) ─────────────

test("registerChapterDiagnosticCommand returns a descriptor whose handler enforces the boundary", async () => {
  const cmd = registerChapterDiagnosticCommand();
  assert.equal(cmd.name, "chapter-diagnostic");
  assert.ok(cmd.summary.length > 0);

  // canonical id → refusal (nonzero); chapterdiag-- id → 0.
  const refusedCanonical = await cmd.run(["the-effective-executive"], {});
  assert.equal(refusedCanonical, 2);
  const refusedFlag = await cmd.run([], { "book-id": "nudge" });
  assert.equal(refusedFlag, 2);
  const accepted = await cmd.run([], { "book-id": CHAPTERDIAG_ID, "run-id": "run1" });
  assert.equal(accepted, 0);
});
