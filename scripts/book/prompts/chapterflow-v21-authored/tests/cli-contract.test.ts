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
import { resolve } from "path";

import { test, skip } from "./harness.js";
import {
  cleanTmp,
  goldChapterFiles,
  makeChapter,
  restoreGateAttempts,
  runCli,
  snapshotGateAttempts,
  TMP_DIR,
  writeFixtureBook,
} from "./helpers.js";

const gold = goldChapterFiles().find((g) => g.files.length > 0);

if (!gold) {
  skip("cli: gate-chapter exits 0 on a gold chapter", "no gold corpus on this machine");
} else {
  test("cli: gate-chapter exits 0 and prints 'Gate verdict: PASS' on a gold chapter", () => {
    const snapshot = snapshotGateAttempts();
    try {
      const { status, out } = runCli(["gate-chapter", gold.files[0]]);
      assert.equal(status, 0, `expected exit 0, got ${status}\n${out.slice(-1500)}`);
      assert.match(out, /Gate verdict: PASS/, "the authoritative verdict line must be present");
    } finally {
      restoreGateAttempts(snapshot);
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
  skip("cli: book-gate exits 0 on a gold book", "no gold corpus on this machine");
} else {
  test(`cli: book-gate exits 0 on gold book (${gold.bookId})`, () => {
    const { status, out } = runCli(["book-gate", gold.bookId]);
    assert.equal(status, 0, `book-gate should pass the gold corpus; output tail:\n${out.slice(-1500)}`);
  });
}

test("qc-verdict: mechanical reduction — corruption veto, floors, partial-read refusal", () => {
  const clean = JSON.stringify([
    { axis: "quiz_key_correctness", score: 1 }, { axis: "quiz_distractor_quality", score: 0.9 },
    { axis: "card_learning_value", score: 0.9 }, { axis: "example_coherence", score: 0.95 },
    { axis: "prose_coherence", score: 0.9 }, { axis: "memorable_line_quality", score: 0.85 },
    { axis: "plan_actionability", score: 0.9 }, { axis: "factual_accuracy", score: 0.95 },
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
