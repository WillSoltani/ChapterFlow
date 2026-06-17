import assert from "node:assert/strict";

import { test } from "./harness.js";
import { planRhetoric, COUNTER_SHAPES, HOOK_OPENER_CLASSES } from "../src/librarian/rhetoricPlan.js";
import { ACTION_MECHANISMS } from "../src/librarian/actionMechanismPlan.js";
import { RECALL_FRAMES } from "../src/librarian/callbackPlan.js";
import { WEEKLY_PRACTICE_FORMS } from "../src/librarian/weeklyPracticePlan.js";
import { FULLREAD_BOUNDARY_BEATS } from "../src/librarian/fullReadSkeletonPlan.js";
import { TRIGGER_CLASSES } from "../src/librarian/timingPlan.js";
import { loadPedagogyPalettes } from "../src/librarian/pedagogyPlan.js";
import { loadBannedPhrases } from "../src/critics/shared.js";

// WS-3 — deal↔gate invariant (the generalizable fix). An allocator must never DEAL
// a writer an instruction whose canonical form a critic BANS (the paradox_colon ⇄ B4
// trap that cost digital-minimalism a QC round: the rhetoric plan said open "The
// paradox: …" while banned-phrases.json hard-bans that exact stem). This guard scans
// every directive the pipeline pastes into a writer card and fails if any contains a
// hard-banned phrase — so no future allocator edit can re-create the contradiction.
test("no allocator directive contains a hard-banned phrase (deal↔gate consistency)", () => {
  const banned: string[] = loadBannedPhrases().hardBanned.map((b: { phrase: string }) => b.phrase);
  const ped = loadPedagogyPalettes();
  const directives: Array<{ label: string; text: string }> = [
    ...COUNTER_SHAPES.map((s) => ({ label: `counter:${s.id}`, text: s.directive })),
    ...HOOK_OPENER_CLASSES.map((s) => ({ label: `hook:${s.id}`, text: s.directive })),
    ...ACTION_MECHANISMS.map((m) => ({ label: `actionMechanism:${m.id}`, text: m.directive })),
    ...RECALL_FRAMES.map((r) => ({ label: `callback:${r.id}`, text: r.directive })),
    ...WEEKLY_PRACTICE_FORMS.map((w) => ({ label: `weekly:${w.id}`, text: w.directive })),
    ...FULLREAD_BOUNDARY_BEATS.map((b) => ({ label: `fullread:${b.id}`, text: b.directive })),
    ...TRIGGER_CLASSES.map((t) => ({ label: `timing:${t.id}`, text: t.directive })),
    // pedagogy palettes — BOTH halves of what formatPedagogyPlan pastes to writers
    // ("<definition> Example: <example>").
    ...ped.tryThisNowGrammars.flatMap((g: any) => [
      { label: `grammar.def:${g.id}`, text: g.definition ?? "" },
      { label: `grammar.ex:${g.id}`, text: g.example ?? "" },
    ]),
    ...ped.tacticFamilies.flatMap((f: any) => [
      { label: `tactic.def:${f.id}`, text: f.definition ?? "" },
      { label: `tactic.ex:${f.id}`, text: f.example ?? "" },
    ]),
    ...ped.quizOpeners.flatMap((q: any) => [
      { label: `quiz.def:${q.id}`, text: q.definition ?? "" },
      { label: `quiz.ex:${q.id}`, text: q.example ?? "" },
    ]),
    ...ped.hookShapes.map((h: any) => ({ label: `hookShape:${h.id}`, text: h.definition ?? "" })),
  ];
  const violations: string[] = [];
  for (const { label, text } of directives) {
    for (const phrase of banned) {
      if (text.toLowerCase().includes(phrase.toLowerCase())) violations.push(`${label} deals banned phrase "${phrase}"`);
    }
  }
  assert.deepEqual(violations, [], `allocator directives must not instruct a banned phrase:\n${violations.join("\n")}`);
});

test("rhetoric plan keeps the negation shell and every hook class under their book-gate caps", () => {
  for (const N of [13, 20, 32]) {
    const plan = planRhetoric("zz-fixture-rhetoric", 1, N);
    const negation = plan.diagnostics.counterShapeCounts["negation_correction"] ?? 0;
    assert.ok(negation / N < 0.4, `negation_correction ${negation}/${N} must stay < 0.40 (B11/B14)`);
    const maxHook = Math.max(...Object.values(plan.diagnostics.hookClassCounts));
    assert.ok(maxHook / N < 0.5, `max hook class ${maxHook}/${N} must stay < 0.50 (B13)`);
  }
});

test("rhetoric plan is deterministic, adjacent chapters differ, and shapes are valid", () => {
  const a = planRhetoric("zz-fixture-rhetoric", 1, 13);
  const b = planRhetoric("zz-fixture-rhetoric", 1, 13);
  assert.deepEqual(a.allocation, b.allocation, "pure function of inputs");
  const counterIds = new Set(COUNTER_SHAPES.map((s) => s.id));
  const hookIds = new Set(HOOK_OPENER_CLASSES.map((s) => s.id));
  for (let n = 1; n <= 13; n++) {
    assert.ok(counterIds.has(a.allocation[n].counterShape), `valid counterShape ch${n}`);
    assert.ok(hookIds.has(a.allocation[n].hookOpenerClass), `valid hookOpenerClass ch${n}`);
    if (n > 1) {
      assert.notEqual(a.allocation[n].counterShape, a.allocation[n - 1].counterShape, `ch${n} counter differs from ch${n - 1}`);
      assert.notEqual(a.allocation[n].hookOpenerClass, a.allocation[n - 1].hookOpenerClass, `ch${n} hook class differs from ch${n - 1}`);
    }
  }
});
