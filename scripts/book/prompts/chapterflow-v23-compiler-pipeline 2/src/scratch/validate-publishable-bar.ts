/**
 * Unit test for the publishable-bar reducer (computeVerdict). Proves the two
 * HARD RULES cannot be bypassed by either reader (human QC or future judge):
 *   1. a cited CORRUPTION hit RED-gates even at a high weighted overall;
 *   2. PUBLISHABLE requires overall ≥ 85 AND no axis < 0.6.
 * Run: npx tsx src/scratch/validate-publishable-bar.ts
 */
import { computeVerdict, AxisId, AxisScore, AXIS_WEIGHTS, FailureTier } from "../critics/semantic/publishableBar.js";

let failures = 0;
const ok = (c: boolean, msg: string) => { console.log(`  ${c ? "✓" : "✗ FAIL"} ${msg}`); if (!c) failures++; };

const ALL: AxisId[] = Object.keys(AXIS_WEIGHTS) as AxisId[];
/** Build all axes at a uniform score; optionally mark one axis as a CORRUPTION hit. */
function axes(score: number, opts?: { corrupt?: AxisId; floorAxis?: { axis: AxisId; score: number } }): AxisScore[] {
  return ALL.map((axis) => {
    let s = score;
    let tier: FailureTier = "PUBLISHABLE";
    const hits = [];
    if (opts?.floorAxis && opts.floorAxis.axis === axis) s = opts.floorAxis.score;
    if (opts?.corrupt === axis) { tier = "CORRUPTION"; hits.push({ unitId: "quiz.q03", quote: "wrong key", defect: "key contradicts explanation" }); }
    return { axis, score: s, tier, hits };
  });
}

console.log("publishable-bar reducer — hard-rule tests:");

// 0. Weights HARD INVARIANT: AXIS_WEIGHTS must sum to EXACTLY 100. PUBLISHABLE_FLOOR=85
//    and computeVerdict assume a 0–100 scale; a drifted sum (99/101) silently breaks the
//    floor semantics even though weightedOverall renormalizes by the weight-sum.
{ const sum = Object.values(AXIS_WEIGHTS).reduce((a, b) => a + b, 0);
  ok(sum === 100, `weights sum to EXACTLY 100 (got ${sum}) — drift breaks the 85 floor`); }

// 1. Corruption veto: one wrong key + everything else perfect -> RED, not GREEN.
{ const v = computeVerdict("c1", axes(1.0, { corrupt: "quiz_key_correctness" }));
  ok(v.gate === "RED" && v.tier === "CORRUPTION", `corruption veto: gate=${v.gate} overall=${v.overall} (one wrong key red-gates even at overall ${v.overall})`); }

// 2. Clean: all axes 0.9 -> GREEN.
{ const v = computeVerdict("c2", axes(0.9));
  ok(v.gate === "GREEN" && v.tier === "PUBLISHABLE", `clean: gate=${v.gate} overall=${v.overall} (≥85, no corruption, no sub-0.6 axis)`); }

// 3. Generated-draft: all axes 0.7, no corruption -> YELLOW (overall 70 < 85).
{ const v = computeVerdict("c3", axes(0.7));
  ok(v.gate === "YELLOW" && v.tier === "GENERATED_DRAFT", `draft: gate=${v.gate} overall=${v.overall} (the 61-75 chapter that passes the gate + a naive read)`); }

// 4. Axis-floor: overall high but one axis < 0.6 -> YELLOW (publishable != high-average).
{ const v = computeVerdict("c4", axes(0.95, { floorAxis: { axis: "card_learning_value", score: 0.4 } }));
  ok(v.gate === "YELLOW", `axis-floor: gate=${v.gate} overall=${v.overall} (a single sub-0.6 axis caps at YELLOW even with high overall)`); }

// 5. DID NOT RUN -> RED, never a pass.
{ const v = computeVerdict("c5", axes(0.9), false);
  ok(v.gate === "RED" && v.ran === false, `did-not-run: gate=${v.gate} ran=${v.ran} (infra/no-model never masquerades as a pass)`); }

console.log(`\n${failures === 0 ? "ALL PUBLISHABLE-BAR ASSERTIONS PASSED" : failures + " FAILURE(S)"}`);
process.exit(failures === 0 ? 0 : 1);
