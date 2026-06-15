import assert from "node:assert/strict";

import { test } from "./harness.js";
import { planAnswerKeys, checkChapterAnswerBalance, AGGREGATE_CEILING } from "../src/librarian/answerKeyPlan.js";

test("answer-key plan aggregates under the F3 ceiling and balances each chapter", () => {
  const plan = planAnswerKeys("zz-fixture-book", 1, 13, 9, 3);
  assert.ok(plan.aggregate.maxFraction < AGGREGATE_CEILING, `maxFraction ${plan.aggregate.maxFraction} must be < ${AGGREGATE_CEILING}`);
  for (let n = 1; n <= 13; n++) {
    const seq = plan.allocation[n];
    assert.equal(seq.length, 9, `ch${n} target has 9 slots`);
    const counts = [0, 0, 0];
    for (const i of seq) counts[i]++;
    assert.deepEqual(counts, [3, 3, 3], `ch${n} is balanced 3-3-3, got ${counts.join(",")}`);
  }
});

test("answer-key plan is deterministic and hands distinct targets across chapters", () => {
  const a = planAnswerKeys("zz-fixture-book", 1, 13, 9, 3);
  const b = planAnswerKeys("zz-fixture-book", 1, 13, 9, 3);
  assert.deepEqual(a.allocation, b.allocation, "pure function of inputs");
  const seqs = Object.values(a.allocation).map((s) => s.join(""));
  assert.equal(new Set(seqs).size, seqs.length, "no two chapters share an identical target sequence");
});

test("a single-chapter redo gets the same target as the full-book deal (range-independent)", () => {
  const full = planAnswerKeys("zz-fixture-book", 1, 13, 9, 3);
  for (const ch of [1, 5, 9, 13]) {
    const redo = planAnswerKeys("zz-fixture-book", ch, ch, 9, 3);
    assert.deepEqual(redo.allocation[ch], full.allocation[ch], `ch${ch} redo target must match the full-book deal`);
  }
});

test("checkChapterAnswerBalance fires advisory only on distribution drift", () => {
  const plan = planAnswerKeys("zz-fixture-book", 1, 1, 9, 3);
  const target = plan.allocation[1];
  const balanced = { chapterId: "zz-fixture-book-ch01", number: 1, quiz: { questions: target.map((i) => ({ correctIndex: i })) } } as any;
  assert.deepEqual(checkChapterAnswerBalance(balanced, plan), [], "matching distribution → no finding");
  const skewed = { chapterId: "zz-fixture-book-ch01", number: 1, quiz: { questions: Array.from({ length: 9 }, () => ({ correctIndex: 0 })) } } as any;
  const findings = checkChapterAnswerBalance(skewed, plan);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].checkId, "AK1.answer_distribution_drift");
  assert.equal(findings[0].severity, "advisory");
  assert.deepEqual(checkChapterAnswerBalance(skewed, null), [], "no plan → no finding");
});
