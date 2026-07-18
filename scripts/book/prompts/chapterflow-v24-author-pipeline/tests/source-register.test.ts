/**
 * IMP-04 — C37 plan-aware source-register critics + instruction-4 lead/cast register.
 *
 * Pins the master-plan §Tests list for IMP-04 at the shipped (advisory-MINOR,
 * calibration-pending) scope:
 *  - valid sourced-case / direct-explanation / generic-scenario / constructed-
 *    application prose passes CLEAN under the matching plan;
 *  - VARIED hypothetical framing passes — no magic phrase is required or checked;
 *  - negatives trip exactly one finding per C37 check (claim-strength overreach
 *    incl. quiz-explanation and memorable-line surfaces; unsupported scene
 *    completion for quote/thought/beat-close markers; fabricated year/metric/
 *    credential under an invented-origins-only plan);
 *  - each check is LICENSE-GATED: the same prose under a permitting plan is clean;
 *  - a chapter with NO plan (legacy) produces zero C37 findings, and the legacy
 *    1-arg collectRegisterAdvisories signature still works;
 *  - sourceRegisterRepairFindings emits schema-valid RepairFindingV1 records
 *    bound to plan field + evidence + bounded scope, and can NEVER relabel the
 *    plan (prohibitedChanges pins all five plan fields; instruction 9);
 *  - prompt-injection strings inside chapter prose stay data: findings remain
 *    typed C37 records and the repair scope constants cannot be broadened;
 *  - the compact evidence-sufficiency DECISION POLICY renders on the plan block
 *    (instruction 2), and the brief's CAST/LEAD THREAD render carries the
 *    role-label default + constructed-lead framing (instructions 4 and 6).
 */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import { fxChapter, fxPlan, fxPlanUnit } from "./migrationFixtures.js";
import { INJECTION_STRINGS } from "./hostileHome.js";
import { checkSourceRegister, planAggregate, sourceRegisterRepairFindings } from "../src/critics/sourceRegister.js";
import { collectRegisterAdvisories, registerAdvisoryRetryBlock } from "../src/critics/registerAdvisories.js";
import { validateRepairFinding } from "../src/contracts/repairContracts.js";
import { renderSourceUsePlanLines } from "../src/compiler/sourceUsePlanCompiler.js";
import { renderBriefMd } from "../src/compiler/chapterBrief.js";
import { OPENER_TYPES, CHALLENGE_FRAMES, PRACTICE_SHAPES } from "../src/compiler/briefRotation.js";
import { CHAPTER_BRIEF_SCHEMA_VERSION, type ChapterBriefV1 } from "../src/artifacts/artifactTypes.js";
import type { ChapterV21, ExampleV21 } from "../src/types.js";

const C37_IDS = ["C37.claim_strength_overreach", "C37.unsupported_scene_completion", "C37.generic_specific_leak"];

// ── fixture builders ──────────────────────────────────────────────────────────

function ex(scenario: string, whyItMatters = "It shows the move working under real constraints."): ExampleV21 {
  return {
    exampleId: "ex-01",
    title: "Fixture example",
    tags: ["fixture"],
    planSpec: { domain: "operations", audience: "professionals", stakes: "medium", format: "narrative", requiredBeat: "resolution" },
    scenario,
    whatToDo: "Apply the dealt move at the next natural decision point.",
    whyItMatters,
  };
}

function bd(fastRead: string): ChapterV21["breakdown"] {
  return { fastRead, deepRead: "The mechanism, stated plainly and expanded with one more angle.", fullRead: "The full treatment: depth, a third angle, and the limits of the idea." };
}

function quizWith(explanation: string): ChapterV21["quiz"] {
  return {
    passingScorePercent: 70,
    questions: [{
      questionId: "q-01",
      prompt: "A teammate proposes skipping the audit to save a day. What is the move?",
      choices: ["Skip it once", "Run the audit first", "Escalate to the manager"],
      correctIndex: 1,
      explanation,
      bloomsLevel: "apply",
      depthLevel: "standard",
    }],
  };
}

/** Invented-origins-only plan: exactly the compiler's chapter-level constructed +
 *  generic licenses, no source_bound unit → the most restrictive aggregate. */
const inventedOnlyPlan = fxPlan({
  units: [
    fxPlanUnit({ unitId: "unit.ch01.constructed-application", origin: "constructed", form: "application", claimStrength: "descriptive", anchorIds: [], detailSufficiency: "concept_only", framingRequired: true }),
    fxPlanUnit({ unitId: "unit.ch01.generic-scenario", origin: "generic", form: "operational_scenario", claimStrength: "descriptive", anchorIds: [], detailSufficiency: "concept_only", framingRequired: false }),
  ],
});

/** Sourced plan WITH a scene license (partial-sufficiency case) + a mechanistic
 *  fact ceiling — permits scenes and grounded specifics; still below causal. */
const sourcedScenePlan = fxPlan({
  units: [
    fxPlanUnit({ unitId: "unit.fact.ch01.fact.1", claimStrength: "mechanistic" }),
    fxPlanUnit({ unitId: "unit.case.ch01.case.1", form: "case", caseId: "ch01.case.1", anchorIds: ["ch01.case.1"], detailSufficiency: "partial" }),
  ],
});

/** Sourced plan whose only case DEGRADED to explanation (no scene license) —
 *  the "sparse source" shape: grounded facts exist, but no scene may be staged. */
const sourcedNoScenePlan = fxPlan({
  units: [
    fxPlanUnit({ unitId: "unit.fact.ch01.fact.1", claimStrength: "mechanistic" }),
    fxPlanUnit({ unitId: "unit.case.ch01.case.1", form: "explanation", caseId: "ch01.case.1", anchorIds: ["ch01.case.1"], detailSufficiency: "concept_only" }),
  ],
});

/** A plan that genuinely licenses a causal claim (source_bound only — the frozen
 *  validator forbids causal strength on constructed/generic units). */
const causalPlan = fxPlan({
  units: [
    fxPlanUnit({ unitId: "unit.fact.ch01.fact.1", claimStrength: "causal" }),
    fxPlanUnit({ unitId: "unit.case.ch01.case.1", form: "case", caseId: "ch01.case.1", anchorIds: ["ch01.case.1"], detailSufficiency: "partial" }),
  ],
});

// ── planAggregate ─────────────────────────────────────────────────────────────

test("C37 planAggregate derives strength ceiling, scene license, and origin mix from the units", () => {
  const restrictive = planAggregate(inventedOnlyPlan);
  assert.equal(restrictive.strongestClaim, "descriptive");
  assert.equal(restrictive.anySceneLicense, false);
  assert.equal(restrictive.anySourceBound, false);
  assert.equal(restrictive.onlyInventedOrigins, true);

  const scened = planAggregate(sourcedScenePlan);
  assert.equal(scened.strongestClaim, "mechanistic");
  assert.equal(scened.anySceneLicense, true, "partial-sufficiency case grants the scene license");
  assert.equal(scened.anySourceBound, true);
  assert.equal(scened.onlyInventedOrigins, false);

  const degraded = planAggregate(sourcedNoScenePlan);
  assert.equal(degraded.anySceneLicense, false, "explanation-degraded case grants NO scene license");
  assert.equal(degraded.onlyInventedOrigins, false, "source_bound facts present");

  assert.equal(planAggregate(causalPlan).strongestClaim, "causal");
});

// ── valid forms pass clean ────────────────────────────────────────────────────

test("C37 valid: direct explanation + generic role-label scenario pass CLEAN under the most restrictive plan", () => {
  const chapter = fxChapter({
    hook: "The fastest team in the building is the one that argues about one decision, not four.",
    keyTakeaway: "Name the single blocking dependency before promising any date; the rest is parking-lot material.",
    breakdown: bd("A project lead inherits a stalled migration with two weeks of runway. She maps which of the four open decisions actually moves the date, defers the rest to a written parking lot, and walks the team through the single tradeoff that matters."),
    examples: [ex("An on-call engineer is paged for a service she has never touched. The move is reading the runbook's first failure branch before opening a dashboard, so the next action is chosen, not guessed.")],
    quiz: quizWith("The audit surfaces the blocking dependency early, which is where the mechanism does its work."),
  });
  assert.deepEqual(checkSourceRegister(chapter, inventedOnlyPlan), [], "role-label prose with no fabricated specifics is clean");
  assert.deepEqual(sourceRegisterRepairFindings(chapter, inventedOnlyPlan), []);
});

test("C37 valid: a sourced case scene under a scene-licensed plan passes with quotes, dates, and metrics", () => {
  const chapter = fxChapter({
    breakdown: bd("The documented case: in 2004 the plant crew cut changeover from four hours to sixty minutes, and the log shows how."),
    examples: [ex('The foreman told the auditors, "We stopped hiding the slow step and timed it instead," which is the documented turning point in the case record.')],
  });
  assert.deepEqual(checkSourceRegister(chapter, sourcedScenePlan), [], "scene license + source_bound anchors permit quotes and grounded specifics");
});

test("C37 valid: VARIED hypothetical framings pass — no magic phrase exists or is required", () => {
  const framings = [
    "Suppose a team lead inherits a stalled migration; the safe first move is naming the single blocking dependency before promising any date.",
    "Picture an on-call engineer paged at midnight for an unfamiliar service: the move is reading the runbook's first failure branch before touching anything.",
    "If the quarterly review were yours to run, the opening question would be which number the team stopped believing — and nothing changes until that answer lands.",
  ];
  for (const framing of framings) {
    const chapter = fxChapter({ examples: [ex(framing)] });
    assert.deepEqual(checkSourceRegister(chapter, inventedOnlyPlan), [], `framing must pass without a marker word: "${framing.slice(0, 40)}…"`);
    assert.ok(!/\bimagine\b/i.test(framing), "fixture guard: framings deliberately avoid the one obvious marker word");
  }
});

// ── C37.claim_strength_overreach ──────────────────────────────────────────────

test("C37.claim_strength_overreach fires on causal register in a quiz explanation when the plan ceiling is below causal", () => {
  const chapter = fxChapter({ quiz: quizWith("Right — adopting the audit habit causes the improvement and guarantees fewer regressions.") });
  const findings = checkSourceRegister(chapter, sourcedScenePlan);
  assert.equal(findings.length, 1, JSON.stringify(findings));
  assert.equal(findings[0].checkId, "C37.claim_strength_overreach");
  assert.equal(findings[0].severity, "minor", "advisory-MINOR, calibration-pending");
  assert.ok(findings[0].message.includes("quiz[0].explanation"), findings[0].message);
  assert.ok(findings[0].message.includes("mechanistic"), "names the permitted ceiling");
  assert.ok(findings[0].evidence && findings[0].evidence.length > 0, "carries the offending span as evidence");
});

test("C37.claim_strength_overreach fires on a memorable line and caps at ONE finding per chapter", () => {
  const chapter = fxChapter({
    keyTakeaway: "Skipping the audit causes the exact failure you fear.",
    breakdown: bd("Skipping the audit causes the failure, and it inevitably compounds."),
    memorableLines: [{ text: "One skipped audit inevitably becomes a quarter of rework.", location: "breakdown.deepRead", why: "It compresses the cost." }],
  });
  const findings = checkSourceRegister(chapter, inventedOnlyPlan).filter((f) => f.checkId === "C37.claim_strength_overreach");
  assert.equal(findings.length, 1, "one finding per check per chapter surfaces the pattern without flooding");
});

test("C37.claim_strength_overreach is LICENSE-GATED: the same causal prose is clean under a causal-licensed plan", () => {
  const chapter = fxChapter({ quiz: quizWith("Right — adopting the audit habit causes the improvement and guarantees fewer regressions.") });
  assert.deepEqual(checkSourceRegister(chapter, causalPlan), [], "a plan unit with causal strength licenses the register");
});

// ── C37.unsupported_scene_completion ──────────────────────────────────────────

test("C37.unsupported_scene_completion fires on invented dialogue in an example when every case is explanation-only", () => {
  const chapter = fxChapter({ examples: [ex('Maya said, "We are shipping on Friday no matter what happens," and the room went quiet.')] });
  const findings = checkSourceRegister(chapter, sourcedNoScenePlan);
  assert.equal(findings.length, 1, JSON.stringify(findings));
  assert.equal(findings[0].checkId, "C37.unsupported_scene_completion");
  assert.ok(findings[0].message.includes("examples[0]"), findings[0].message);
});

test("C37.unsupported_scene_completion fires on interior thought and beat-closure markers too", () => {
  const thought = fxChapter({ examples: [ex("She realized that she had been solving the wrong problem for the whole quarter, and the backlog proved it.")] });
  const beat = fxChapter({ examples: [ex("The next morning, the numbers told a different story and the team re-planned around the real constraint.")] });
  for (const chapter of [thought, beat]) {
    const findings = checkSourceRegister(chapter, sourcedNoScenePlan);
    assert.equal(findings.length, 1, JSON.stringify(findings));
    assert.equal(findings[0].checkId, "C37.unsupported_scene_completion");
  }
});

test("C37.unsupported_scene_completion scopes to examples and is license-gated by a partial-sufficiency case", () => {
  // Dialogue in the HOOK is out of scope (scenes live in examples).
  const hookOnly = fxChapter({ hook: 'The foreman put it plainly: "Stop hiding the slow step and time it instead."' });
  assert.deepEqual(checkSourceRegister(hookOnly, sourcedNoScenePlan), []);
  // The same staged example is clean when a case unit carries a scene license.
  const scened = fxChapter({ examples: [ex('Maya said, "We are shipping on Friday no matter what happens," and the room went quiet.')] });
  assert.deepEqual(checkSourceRegister(scened, sourcedScenePlan), []);
});

// ── C37.generic_specific_leak ─────────────────────────────────────────────────

test("C37.generic_specific_leak fires on a bare year / exact metric / credential when the plan is invented-origins-only", () => {
  const year = fxChapter({ examples: [ex("In 2019, a regional operations manager rebuilt the intake process around one decision per handoff.")] });
  const metric = fxChapter({ examples: [ex("A mid-size support team cut churn by 34% in a single quarter after adopting the move.")] });
  const credential = fxChapter({ examples: [ex("A CEO at a logistics firm ran the same play on her leadership meeting cadence.")] });
  for (const chapter of [year, metric, credential]) {
    const findings = checkSourceRegister(chapter, inventedOnlyPlan);
    assert.equal(findings.length, 1, JSON.stringify(findings));
    assert.equal(findings[0].checkId, "C37.generic_specific_leak");
    assert.ok(findings[0].evidence && findings[0].evidence.length > 0);
  }
});

test("C37.generic_specific_leak is license-gated: the same specifics are clean when a source_bound anchor exists", () => {
  const chapter = fxChapter({ examples: [ex("In 2019, a regional operations manager rebuilt the intake process around one decision per handoff.")] });
  assert.deepEqual(checkSourceRegister(chapter, sourcedScenePlan), [], "grounded plans may carry real specifics — SC/source gates own their attestation");
});

// ── legacy: no plan → no C37 ──────────────────────────────────────────────────

const hotChapter = fxChapter({
  breakdown: bd("Skipping the audit causes the exact failure you fear, and it guarantees a slower quarter."),
  examples: [ex('Maya said, "We are shipping on Friday no matter what happens," and in 2019 her team cut churn by 34%.')],
});

test("C37 no-ops without a plan (legacy chapters) and on an empty-units plan", () => {
  assert.deepEqual(checkSourceRegister(hotChapter, null), [], "absence of a plan grants nothing and blocks nothing");
  assert.deepEqual(checkSourceRegister(hotChapter, fxPlan({ units: [] })), []);
  assert.deepEqual(sourceRegisterRepairFindings(hotChapter, null), []);
});

test("collectRegisterAdvisories keeps the legacy 1-arg signature: no plan → exactly the C31-C36 set", () => {
  const legacy = collectRegisterAdvisories(hotChapter);
  assert.ok(legacy.every((f) => !f.checkId.startsWith("C37.")), "no C37 finding without a plan");
  const withPlan = collectRegisterAdvisories(hotChapter, inventedOnlyPlan);
  assert.ok(withPlan.some((f) => f.checkId.startsWith("C37.")), "the same chapter trips C37 once the plan is threaded");
  const legacyBlock = registerAdvisoryRetryBlock(hotChapter);
  assert.ok(!legacyBlock.includes("C37."), "legacy retry block carries no C37 lines");
  const planBlock = registerAdvisoryRetryBlock(hotChapter, inventedOnlyPlan);
  assert.ok(planBlock.includes("ADVISORY REGISTER NOTES") && planBlock.includes("C37."), "plan-aware retry block surfaces C37 fix lines");
});

// ── repair findings: schema-valid, evidence-bound, can never relabel the plan ──

test("C37 repair findings are schema-valid RepairFindingV1 records bound to plan field, evidence, and bounded scope", () => {
  const findings = sourceRegisterRepairFindings(hotChapter, inventedOnlyPlan);
  assert.equal(findings.length, 3, `expected all three checks to trip: ${JSON.stringify(findings.map((f) => f.findingId))}`);
  const planUnitIds = new Set(inventedOnlyPlan.units.map((u) => u.unitId));
  const SCOPES: Record<string, { planField: string; scope: string[] }> = {
    "C37.claim_strength_overreach": { planField: "claimStrength", scope: ["breakdown", "quiz", "keyTakeaway", "memorableLines"] },
    "C37.unsupported_scene_completion": { planField: "detailSufficiency", scope: ["examples"] },
    "C37.generic_specific_leak": { planField: "origin", scope: ["examples", "breakdown"] },
  };
  for (const f of findings) {
    assert.deepEqual(validateRepairFinding(f), [], `must satisfy the frozen contract: ${JSON.stringify(f)}`);
    assert.equal(f.severity, "advisory");
    assert.equal(f.recommendedRoute, "surgical", "prose softens to the permitted register; a plan change routes upstream, never local");
    assert.deepEqual(
      f.prohibitedChanges,
      ["origin", "form", "claimStrength", "detailSufficiency", "framingRequired"],
      "every plan field is pinned non-relabelable (instruction 9)",
    );
    assert.ok(f.evidenceQuotes.length >= 1, "bound to the offending span");
    const checkId = f.violatedInvariantIds[0];
    assert.ok(f.findingId.startsWith(checkId), "findingId keys on the check");
    const spec = SCOPES[checkId];
    assert.ok(spec, `unknown C37 check ${checkId}`);
    assert.deepEqual(f.sourcePlanDependencies, [spec.planField]);
    assert.deepEqual(f.permittedRepairScope, spec.scope, "free-form prose cannot authorize broader edits");
    assert.ok(f.unitIds.every((u) => planUnitIds.has(u)), "unit references stay within the plan");
  }
  assert.deepEqual(sourceRegisterRepairFindings(fxChapter({}), inventedOnlyPlan), [], "a clean chapter emits no repair findings");
});

// ── injection: hostile prose stays data ───────────────────────────────────────

test("C37 treats prompt-injection strings in chapter prose as data: typed findings only, scope constants unbroadened", () => {
  const hostile = fxChapter({
    hook: INJECTION_STRINGS[0],
    keyTakeaway: INJECTION_STRINGS[1],
    breakdown: bd(INJECTION_STRINGS.join(" ")),
    examples: [ex(INJECTION_STRINGS.join(" ")), ex(INJECTION_STRINGS[5])],
    quiz: quizWith(INJECTION_STRINGS[6]),
    memorableLines: [{ text: INJECTION_STRINGS[2], location: "hook", why: "hostile fixture" }],
  });
  const critFindings = checkSourceRegister(hostile, inventedOnlyPlan);
  assert.ok(critFindings.every((f) => C37_IDS.includes(f.checkId)), "output stays within the three typed C37 checks");
  const repairs = sourceRegisterRepairFindings(hostile, inventedOnlyPlan);
  for (const f of repairs) {
    assert.deepEqual(validateRepairFinding(f), []);
    assert.deepEqual(f.prohibitedChanges, ["origin", "form", "claimStrength", "detailSufficiency", "framingRequired"]);
    assert.equal(f.recommendedRoute, "surgical");
    assert.ok(f.permittedRepairScope.every((s) => ["breakdown", "quiz", "keyTakeaway", "memorableLines", "examples"].includes(s)), "hostile text cannot broaden the repair scope");
  }
  // Hostile text inside PLAN strings is equally inert: unitIds pass through as data.
  const hostilePlan = fxPlan({
    units: [fxPlanUnit({ unitId: `unit.ch01.constructed-application ${INJECTION_STRINGS[0]}`, origin: "constructed", form: "application", anchorIds: [], framingRequired: true })],
  });
  const viaHostilePlan = sourceRegisterRepairFindings(hotChapter, hostilePlan);
  for (const f of viaHostilePlan) assert.deepEqual(validateRepairFinding(f), []);
});

// ── instruction 2: the decision policy renders on the plan block ──────────────

test("IMP-04 decision policy renders on the SOURCE-USE PLAN block with all five arms and both invented licenses", () => {
  const text = renderSourceUsePlanLines(inventedOnlyPlan).join("\n");
  assert.ok(text.includes("CHOOSE THE SAFE FORM BY EVIDENCE"), "policy header present");
  for (const arm of [
    "the permitted sourced form only",
    "direct explanation",
    "a generic operational scenario with role labels",
    "a constructed application framed as hypothetical at first entry",
    "stop and request an upstream source-plan action",
  ]) {
    assert.ok(text.includes(arm), `decision-policy arm missing: "${arm}"`);
  }
  assert.ok(text.includes("CONSTRUCTED APPLICATION — licensed"), "constructed license line renders");
  assert.ok(text.includes("GENERIC OPERATIONAL SCENARIO — licensed"), "generic license line renders");
  assert.ok(text.includes("role labels"), "role-label register named on the generic license");
});

// ── instruction 4 + 6: brief CAST role-label default and constructed-lead framing ──

function fxBrief(over: Partial<ChapterBriefV1> = {}): ChapterBriefV1 {
  return {
    schemaVersion: CHAPTER_BRIEF_SCHEMA_VERSION,
    chapterId: "zz-fixture-book-ch01",
    chapterNumber: 1,
    title: "Synthetic Chapter",
    coreMove: "name the single blocking dependency before promising a date",
    thesis: "Focus beats effort when the runway is short.",
    readerPromise: "After this chapter, a reader can name the blocking dependency first.",
    ownedCases: [],
    notYours: [],
    cast: ["Rowan", "Tessa"],
    answerIndexPattern: [0, 1, 2],
    avoid: [],
    lengthBudget: { renderedChars: 9000, tolerance: 0.15 },
    flavor: [],
    openerType: OPENER_TYPES[0],
    challengeFrame: CHALLENGE_FRAMES[0],
    practiceShape: PRACTICE_SHAPES[0],
    ...over,
  };
}

test("IMP-04 instr 4: the CAST block defaults invented people to ROLE LABELS; names spend only in a constructed application", () => {
  const md = renderBriefMd(fxBrief());
  assert.ok(md.includes("## CAST"));
  assert.ok(md.includes("ROLE LABEL"), "role-label default is explicit");
  assert.ok(md.includes("constructed application"), "the only license for spending a name");
  assert.ok(md.includes("never a real source-person name"), "the protected-name invariant is retained verbatim");
  assert.ok(md.includes("Rowan, Tessa"), "the reserved names still render (the reservation system is unchanged)");
});

test("IMP-04 instr 6: an invented lead renders as a typed CONSTRUCTED application with first-entry framing, no fixed phrase", () => {
  const md = renderBriefMd(fxBrief({ leadThread: { kind: "invented", name: "Rowan" } }));
  assert.ok(md.includes("This thread is a CONSTRUCTED application"), "the lead device is typed, not implicit");
  assert.ok(md.includes("non-factual status clear at first entry"), "semantic first-entry register");
  assert.ok(md.includes("no single fixed phrase"), "framing stays varied — no magic phrase");
  assert.ok(md.includes("never let a later paragraph report the invented events as history"), "the deceptive-conditional failure is named");
  assert.ok(md.includes("role-BEFORE-name"), "the existing introduction rule is retained");
});

test("IMP-04 instr 4: an owned-case lead keeps its sourced register — no constructed framing on real cases", () => {
  const withCast = renderBriefMd(fxBrief({ leadThread: { kind: "owned-case", name: "Antonio Damasio / Descartes' Error" } }));
  assert.ok(withCast.includes('runs on YOUR case "Antonio Damasio / Descartes\' Error"'));
  assert.ok(!withCast.includes("This thread is a CONSTRUCTED application"), "a sourced case must never be framed as fiction");
  assert.ok(withCast.includes("Invented cast appears only in supporting scenes"), "cast licence retained when a cast was dealt");
  const noCast = renderBriefMd(fxBrief({ leadThread: { kind: "owned-case", name: "Antonio Damasio / Descartes' Error" }, cast: [] }));
  assert.ok(noCast.includes("NO invented stand-in characters"), "proxy-banned chapters keep the hard ban line");
});
