/**
 * End-to-end CLI contract: exit codes and the ship path's sibling loading.
 *
 * These spawn the real CLI (npx tsx src/cli.ts …) so they cover what unit
 * tests can't: the gate-chapter handler's sibling discovery, the combined
 * "Gate verdict:" line, and the exit-code contract operators script against
 * (0 pass / 1 blocked / 2 usage / 3 circuit-breaker).
 *
 * gate-attempts.json is snapshotted and restored so repeated test runs don't
 * trip the stuck-blocker circuit breaker or pollute real attempt history.
 */

import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmdirSync, rmSync, writeFileSync } from "fs";
import { resolve } from "path";

import { test, skip } from "./harness.js";
import { createBookWriteLock } from "../src/books/bookLease.js";
import { createCandidateStore } from "../src/books/candidateStore.js";
import { createCurrentPointerStore } from "../src/books/currentPointer.js";
import { createTestRoots } from "./testRoots.js";
import {
  cleanTmp,
  goldChapterFiles,
  makeChapter,
  PIPELINE_DIR,
  restoreGateAttempts,
  runCli,
  snapshotGateAttempts,
  STATE_CHAPTERS,
  STATE_INDEXES,
  TMP_DIR,
  writeCanonicalIndexFixture,
  writeFixtureBook,
} from "./helpers.js";

const gold = goldChapterFiles().find((g) => g.files.length > 0);
const CLI_BOOK = "zz-gold-daring-greatly";

test("reader-only plan command requires explicit candidate selector", () => {
  const result = runCli(["shape-plan", "zz-cli-candidate", "--from", "1", "--to", "1"]);
  assert.equal(result.status, 2, result.out);
  assert.match(result.out, /V25_CANDIDATE_READER_REQUIRED/);
});

test("fanout and guardrail commands block without candidate selector", () => {
  for (const args of [["fanout", "zz-cli-candidate"], ["authoring-guardrails", "zz-cli-candidate", "--chapters", "1"]]) {
    const result = runCli(args);
    assert.equal(result.status, 2, `${args[0]}: ${result.out}`);
    assert.match(result.out, /V25_CANDIDATE_READER_REQUIRED/, args[0]);
  }
});

test("reader-only plan command opens candidate without model attempt or source flags", async () => {
  const roots = createTestRoots("cli-reader-only");
  const bookId = "zz-cli-candidate";
  const candidateId = "candidate-1";
  const planParent = resolve(PIPELINE_DIR, "state", "shape-plans");
  const planParentExisted = existsSync(planParent);
  const planPath = resolve(planParent, `${bookId}.shape-plan.json`);
  try {
    const writeLock = createBookWriteLock({ booksRoot: roots.booksRoot });
    const currentPointerStore = createCurrentPointerStore({ booksRoot: roots.booksRoot, writeLock });
    const store = createCandidateStore({ booksRoot: roots.booksRoot, writeLock, currentPointerStore });
    const bytes = Buffer.from("{}");
    const file = { kind: "SIDECAR" as const, logicalPath: "sidecars/ch01.json", mediaType: "application/json" as const, bytes };
    const staged = await store.stage({
      bookId,
      candidateId,
      createdByRunId: "cli-test",
      expectedInventory: [{ kind: file.kind, logicalPath: file.logicalPath, mediaType: file.mediaType }],
      files: [file],
      createdAt: "2026-07-20T12:00:00.000Z",
    });
    assert.equal(staged.ok, true, staged.ok ? "" : staged.error.message);
    if (!staged.ok) return;
    const result = runCli([
      "shape-plan", bookId, "--from", "1", "--to", "1",
      "--v25-root", roots.base,
      "--candidate-id", candidateId,
      "--manifest-digest", staged.value.manifestDigest,
    ]);
    assert.equal(result.status, 0, result.out);
    assert.match(result.out, /ch01:/);
    assert.doesNotMatch(result.out, /V25_COMPOSITION_REQUIRED/);
  } finally {
    rmSync(planPath, { force: true });
    if (!planParentExisted && existsSync(planParent) && readdirSync(planParent).length === 0) rmdirSync(planParent);
    roots.dispose();
  }
});

if (!gold) {
  skip("cli: gate-chapter exits 0 on a gold chapter", "no gold corpus on this machine");
} else {
  test("cli: gate-chapter exits 0 and prints 'Gate verdict: PASS' on a gold chapter", () => {
    const snapshot = snapshotGateAttempts();
    const isolated = resolve(TMP_DIR, "cli-gold-single", `${CLI_BOOK}-ch01.v21-native.chapter.json`);
    try {
      mkdirSync(resolve(TMP_DIR, "cli-gold-single"), { recursive: true });
      writeFileSync(isolated, readFileSync(gold.files[0], "utf8"), "utf8");
      const { status, out } = runCli(["gate-chapter", isolated]);
      assert.equal(status, 0, `expected exit 0, got ${status}\n${out.slice(-1500)}`);
      assert.match(out, /Gate verdict: PASS/, "the authoritative verdict line must be present");
    } finally {
      restoreGateAttempts(snapshot);
      rmSync(resolve(TMP_DIR, "cli-gold-single"), { recursive: true, force: true });
    }
  });
}

test("cli: gate-chapter exits 2 on a nonexistent file (usage contract)", () => {
  const { status } = runCli(["gate-chapter", resolve(TMP_DIR, "does-not-exist.chapter.json")]);
  assert.equal(status, 2, `expected exit 2 for missing input, got ${status}`);
});

test("cli: gate-chapter loads siblings from disk and blocks on AS7 card reuse end-to-end", () => {
  const snapshot = snapshotGateAttempts();
  const dir = resolve(TMP_DIR, "uh-e2e");
  try {
    const book = "zz-fixture-e2e";
    const ch1 = makeChapter(book, 1);
    const ch2 = makeChapter(book, 2);
    const ch3 = makeChapter(book, 3, { overrides: { reviewCards: structuredClone(ch1.reviewCards) } });
    const files = writeFixtureBook(dir, [ch1, ch2, ch3]);
    const { status, out } = runCli(["gate-chapter", files[2]]);
    // The fixture is not gate-clean overall; the contract under test is that
    // sibling loading surfaced the PLANTED cross-chapter defect and blocked.
    assert.notEqual(status, 0, "a chapter with verbatim card reuse must not pass");
    assert.match(out, /AS7/, `AS7 must surface via sibling loading; output tail:\n${out.slice(-1500)}`);
    assert.doesNotMatch(
      out,
      /intra-book critics DID NOT RUN/,
      "sibling discovery failed — the AS suite silently skipped (the casing-bug class)",
    );
  } finally {
    restoreGateAttempts(snapshot);
    cleanTmp();
  }
});

if (!gold) {
  skip("cli: book-gate fails closed when synthetic gold is unbound", "synthetic gold corpus did not generate files");
} else {
  test("cli: book-gate fails closed when synthetic gold lacks explicit candidate-bound pattern audit", () => {
    const freshGold = goldChapterFiles().find((g) => g.bookId === CLI_BOOK);
    assert.ok(freshGold, "synthetic CLI gold corpus should regenerate after tmp cleanup");
    const stateBrief = resolve(PIPELINE_DIR, "state", "briefs", `${CLI_BOOK}.manual-brief.json`);
    const statePlan = resolve(PIPELINE_DIR, "state", "plans", `${CLI_BOOK}-ch01.manual-plan.json`);
    const stateChapter = resolve(STATE_CHAPTERS, `${CLI_BOOK}-ch01.v21-native.chapter.json`);
    const stateIndex = resolve(STATE_INDEXES, `${CLI_BOOK}.json`);
    try {
      const chapter = JSON.parse(readFileSync(freshGold.files[0], "utf8"));
      writeFixtureBook(STATE_CHAPTERS, [chapter]);
      writeCanonicalIndexFixture(CLI_BOOK, [chapter]);
      mkdirSync(resolve(PIPELINE_DIR, "state", "briefs"), { recursive: true });
      mkdirSync(resolve(PIPELINE_DIR, "state", "plans"), { recursive: true });
      writeFileSync(stateBrief, JSON.stringify({
        schemaVersion: "manual-book-brief-v1",
        bookId: CLI_BOOK,
        title: "Synthetic CLI Gold",
        audience: "pipeline CLI contract",
        corePromise: "Verify records against source notes.",
      }, null, 2) + "\n", "utf8");
      writeFileSync(statePlan, JSON.stringify({
        schemaVersion: "manual-chapter-plan-v1",
        bookId: CLI_BOOK,
        chapterId: chapter.chapterId,
        chapterNumber: chapter.number,
        title: chapter.title,
        coreMove: "Compare the active record with its source note before handoff.",
      }, null, 2) + "\n", "utf8");

      const { status, out } = runCli(["book-gate", CLI_BOOK]);
      assert.equal(status, 1, `unbound book-gate should block; output tail:\n${out.slice(-1500)}`);
      assert.match(out, /Book gate: BLOCK/, "unbound book-gate must not report PASS");
      assert.match(out, /Pattern audit: BLOCK/, "missing candidate-bound pattern audit must fail closed");
    } finally {
      rmSync(stateChapter, { force: true });
      rmSync(stateIndex, { force: true });
      rmSync(stateBrief, { force: true });
      rmSync(statePlan, { force: true });
    }
  });
}

test("qc-verdict: mechanical reduction — corruption veto, floors, partial-read refusal", () => {
  const clean = JSON.stringify([
    { axis: "quiz_key_correctness", score: 1 }, { axis: "quiz_distractor_quality", score: 0.9 },
    { axis: "card_learning_value", score: 0.9 }, { axis: "example_coherence", score: 0.95 },
    { axis: "prose_coherence", score: 0.9 }, { axis: "memorable_line_quality", score: 0.85 },
    { axis: "plan_actionability", score: 0.9 }, { axis: "factual_accuracy", score: 0.95 },
    { axis: "behavioral_naturalness", score: 0.9 },
  ]);
  const green = runCli(["qc-verdict", "zz-t", "--scores", clean]);
  assert.equal(green.status, 0, green.out);
  assert.match(green.out, /GREEN/);

  // corruption veto: high overall cannot launder a cited corruption hit
  const corrupt = JSON.parse(clean);
  corrupt[0] = { axis: "quiz_key_correctness", score: 0.9, tier: "CORRUPTION", hits: [{ unitId: "q3", quote: "x", defect: "wrong key" }] };
  const red = runCli(["qc-verdict", "zz-t", "--scores", JSON.stringify(corrupt)]);
  assert.equal(red.status, 2, red.out);
  assert.match(red.out, /RED/);

  // axis floor: one axis under 0.6 caps at YELLOW even with high overall
  const floored = JSON.parse(clean);
  floored[5] = { axis: "memorable_line_quality", score: 0.5 };
  const yellow = runCli(["qc-verdict", "zz-t", "--scores", JSON.stringify(floored)]);
  assert.equal(yellow.status, 1, yellow.out);

  // partial read refused: missing axes are never defaulted
  const partial = JSON.stringify(JSON.parse(clean).slice(0, 5));
  const refused = runCli(["qc-verdict", "zz-t", "--scores", partial]);
  assert.equal(refused.status, 3, refused.out);
  assert.match(refused.out, /INCOMPLETE READ/);
});
