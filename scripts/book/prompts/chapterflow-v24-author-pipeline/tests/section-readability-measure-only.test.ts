/**
 * WP-E31 (AUD-01) — measure-only readability in the bakeoff/screening lane.
 *
 * Three surfaces, one flag (BakeoffManifestV1.readabilityMeasureOnly, threaded as
 * a narrow option — never an env var / global):
 *
 *   1. sectionGate: the two SEC12 readability pushes flip from `blocker` to
 *      `measure-only` under the flag; with the flag OFF the emitted findings are
 *      byte-identical to production.
 *   2. candidates.validateCandidate: under the flag a readability-ONLY rubric
 *      failure never becomes a hard failure (the candidate stays JUDGED), the
 *      SEC12-parity measurement (per-tier FK + assembled ease + floor result) is
 *      recorded into validation.json, and a floor-failed candidate is marked
 *      not-promotable — a SEPARATE recorded fact. Without the flag it blocks.
 *   3. candidates.generateCandidate: under the flag the writer's rubric preflight
 *      completes a low-ease draft instead of retrying it to exhaustion.
 *
 * The candidate fixture is the FAITHFUL smoking gun: every per-tier FK ceiling
 * passes yet the assembled breakdown reads at Flesch ease 61.9 (< the 70 floor,
 * < the rubric ease band 72-84) — the exact shape of the censored Luna@xhigh
 * draft that scored 85.3 on the canonical evaluator.
 */

import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { test } from "./harness.js";
import {
  validateSummaryPack,
  validateSectionPack,
  type SectionFinding,
} from "../src/sections/sectionGate.js";
import type { ChapterBlueprintV1, SourcePacketV1, SummaryPackV1 } from "../src/artifacts/artifactTypes.js";
import {
  demoteReadabilityOnlyFailures,
  generateCandidate,
  measureChapterReadability,
  validateCandidate,
  slotChapterAbsPath,
} from "../src/bakeoff/candidates.js";
import { bakeoffRoots, PIPELINE_DIR } from "../src/bakeoff/paths.js";
import { computeBookRubricMetrics } from "../src/metrics/bookRubricMetrics.js";
import type { ChapterV21 } from "../src/types.js";
import type { CandidateSpec } from "../src/bakeoff/types.js";
import type { AutopilotDeps } from "../src/orchestrator/autopilot.js";
import type { SpawnCodexAgentOptions } from "../src/orchestrator/codexAgent.js";
import { fixtureChapter, fixturePacket, tmpRoot, fakeAutopilotDeps, writerSpawn } from "./model-bakeoff-helpers.js";

// ── Faithful low-ease breakdown: per-tier FK 3.97 / 6.17 / 8.08 (all UNDER
//    their 7.0 / 8.5 / 9.5 ceilings) yet assembled ease 61.9 < the 70 floor. ──
const AGG_FAST = "Pay before the snapshot. Lower the visible balance. Make the signal match the care you already show.";
const AGG_DEEP =
  "A card system records account information. It does not read your intent. The useful move is to reduce what the system sees before the signal travels to lenders.";
const AGG_FULL =
  "The reader-facing move is practical. Make the balance visible to yourself. Reduce avoidable utilization. Set a trigger before the reportable moment. This keeps the source idea intact without promising an exact score jump.";

const SOL: CandidateSpec = { model: "gpt-5.6-sol", slug: "gpt-5-6-sol", slot: "w1", effort: "xhigh" };

/** A whole ChapterV21 whose rubric fails ONLY on fleschEase (ease 61.9): 3 clean
 *  memorable lines, an imperative practice item, and an empty quiz (transfer →
 *  warn, never fail) keep every non-readability gate clean. */
function lowEaseChapter(bookId: string, n: number): ChapterV21 {
  return {
    ...fixtureChapter(bookId, n),
    breakdown: { fastRead: AGG_FAST, deepRead: AGG_DEEP, fullRead: AGG_FULL },
    memorableLines: [
      { text: "Retrieve before you reread." },
      { text: "Recall is the muscle memory learns by." },
      { text: "Test yourself, then check the page." },
    ],
  } as unknown as ChapterV21;
}

// ── sectionGate fixtures (mirrors tests/pedagogy-thresholds.ts) ──────────────
const EMPTY_PACKET = { allowedAnchors: [], facts: [], namedCases: [] } as unknown as SourcePacketV1;
function blueprint(): ChapterBlueprintV1 {
  return { chapterNumber: 1, chapterId: "zz-ro-ch01", sections: { quiz: [], cards: [] } } as unknown as ChapterBlueprintV1;
}
function lowEaseSummaryPack(): SummaryPackV1 {
  return {
    schemaVersion: "section-artifact-v1",
    artifactType: "summary-pack",
    chapterId: "zz-ro-ch01",
    hook: { hook: "A short hook that is long enough to exist for the fixture only.", sourceAnchorIds: [] },
    breakdown: { fastRead: AGG_FAST, deepRead: AGG_DEEP, fullRead: AGG_FULL, sourceAnchorIds: { fastRead: [], deepRead: [], fullRead: [] } },
    keyTakeaway: "Change what the system can see rather than trusting that intention will be read.",
    keyTakeawaySourceAnchorIds: [],
  } as unknown as SummaryPackV1;
}
const sec12 = (findings: SectionFinding[]): SectionFinding[] => findings.filter((f) => f.checkId === "SEC12.summary_readability");

// ── 1. sectionGate SEC12 severity flip (byte-identical when the flag is off) ──

test("sectionGate: SEC12 readability is a BLOCKER by default (production byte-identical)", () => {
  const off = sec12(validateSummaryPack(lowEaseSummaryPack(), blueprint(), EMPTY_PACKET));
  // The default 3-arg call and an explicit `false` must be identical.
  const explicitOff = sec12(validateSummaryPack(lowEaseSummaryPack(), blueprint(), EMPTY_PACKET, false));
  assert.ok(off.length >= 1, "the assembled ease floor fires on a 61.9-ease breakdown");
  assert.deepEqual(off, explicitOff, "explicit readabilityMeasureOnly=false is identical to the default");
  for (const f of off) assert.equal(f.severity, "blocker");
});

test("sectionGate: SEC12 readability records MEASURE-ONLY under the flag (never a blocker)", () => {
  const on = sec12(validateSummaryPack(lowEaseSummaryPack(), blueprint(), EMPTY_PACKET, true));
  assert.ok(on.length >= 1, "SEC12 still fires — it just records instead of blocking");
  for (const f of on) {
    assert.equal(f.severity, "measure-only");
    // The measured number rides in the message (ease/grade) — recorded outcome data.
    assert.ok(/ease|grade/i.test(f.message), "the measurement stays in the finding message");
  }
  // Only the SEC12 severity changed; every OTHER finding is untouched.
  const all = validateSummaryPack(lowEaseSummaryPack(), blueprint(), EMPTY_PACKET, true);
  const nonSec12 = all.filter((f) => f.checkId !== "SEC12.summary_readability");
  assert.ok(nonSec12.every((f) => f.severity !== "measure-only"), "no other finding is demoted to measure-only");
});

test("sectionGate: the flag threads through validateSectionPack to the summary pack", () => {
  const off = sec12(validateSectionPack(lowEaseSummaryPack(), blueprint(), EMPTY_PACKET));
  const on = sec12(validateSectionPack(lowEaseSummaryPack(), blueprint(), EMPTY_PACKET, true));
  assert.ok(off.length >= 1 && on.length >= 1);
  assert.ok(off.every((f) => f.severity === "blocker"));
  assert.ok(on.every((f) => f.severity === "measure-only"));
});

// ── 2. demoteReadabilityOnlyFailures + measureChapterReadability units ───────

test("demoteReadabilityOnlyFailures: a readability-ONLY fail drops to warn; a mixed fail stays fail", () => {
  const raw = computeBookRubricMetrics("zz-ro", { chapters: [lowEaseChapter("zz-ro", 1)] });
  assert.equal(raw.verdict, "fail");
  assert.deepEqual(raw.chapters[0].failing, ["fleschEase"], "the crafted fixture fails ONLY readability");
  const demoted = demoteReadabilityOnlyFailures(raw);
  assert.equal(demoted.verdict, "warn", "readability-only fail is demoted");
  assert.equal(demoted.chapters[0].verdict, "warn");
  assert.deepEqual(demoted.chapters[0].failing, [], "fleschEase removed from the fail set");

  // A chapter that ALSO fails a non-readability gate stays fail (readability is
  // not a licence to ship a genuinely broken chapter).
  const mixed = {
    ...raw,
    chapters: [{ ...raw.chapters[0], verdict: "fail" as const, failing: ["fleschEase", "practiceFloor"] }],
  };
  const mixedDemoted = demoteReadabilityOnlyFailures(mixed);
  assert.equal(mixedDemoted.chapters[0].verdict, "fail");
  assert.deepEqual(mixedDemoted.chapters[0].failing, ["practiceFloor"]);
});

test("measureChapterReadability: SEC12-parity per-tier FK + assembled ease + floor result", () => {
  const m = measureChapterReadability(lowEaseChapter("zz-ro", 1));
  assert.equal(m.easeFloor, 70);
  assert.ok(m.assembledEase < 70 && m.assembledEase > 55, `assembled ease ${m.assembledEase} is the ~61.9 smoking gun`);
  assert.equal(m.floorFailed, true);
  assert.equal(m.shipEligible, false, "floor failed ⇒ not ship-eligible (recorded, still judged)");
  assert.deepEqual(m.tiers.map((t) => t.tier), ["fastRead", "deepRead", "fullRead"]);
  assert.ok(m.tiers.every((t) => t.exceedsCeiling === false), "every per-tier ceiling PASSES — only the aggregate floor fails");
});

// ── 3. validateCandidate: blocks without the flag, measure-only with it ──────

function seedCandidate(bookId: string, runId: string): { roots: ReturnType<typeof bakeoffRoots>; } {
  const roots = bakeoffRoots(bookId, runId, tmpRoot("cf-e31-validate-"));
  const abs = slotChapterAbsPath(roots, SOL.slot, bookId, 1);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, JSON.stringify(lowEaseChapter(bookId, 1), null, 2));
  return { roots };
}
const validateInputs = (measureOnly: boolean) => ({
  chapterNumbers: [1],
  readPacket: (b: string, n: number) => fixturePacket(b, n),
  readBrief: () => null,
  readabilityMeasureOnly: measureOnly,
});

test("validateCandidate: WITHOUT the flag a low-ease candidate is blocked (readability hard failure)", async () => {
  const { roots } = seedCandidate("zz-e31-block", "r1");
  const v = await validateCandidate("zz-e31-block", SOL, roots, validateInputs(false));
  assert.ok(v.hardFailures.some((h) => /rubric-metrics: ch01 FAIL/.test(h)), "readability drives a rubric hard failure");
  assert.equal(v.rubricVerdict, "fail");
  assert.ok(!v.advisories.some((a) => a.startsWith("readability(measure-only)")), "no measure-only record without the flag");
  assert.ok(!v.advisories.some((a) => a.startsWith("not-promotable")), "no not-promotable marker without the flag");
});

test("validateCandidate: WITH the flag the candidate is judged, readability is recorded, and it is marked not-promotable", async () => {
  const { roots } = seedCandidate("zz-e31-measure", "r1");
  const v = await validateCandidate("zz-e31-measure", SOL, roots, validateInputs(true));
  // The readability-only rubric fail no longer blocks eligibility.
  assert.ok(!v.hardFailures.some((h) => /rubric-metrics: ch01 FAIL/.test(h)), "readability no longer a rubric hard failure");
  assert.notEqual(v.rubricVerdict, "fail", "the readability-only rubric fail is demoted");
  // The measurement is recorded into validation.json (advisories) …
  const measure = v.advisories.find((a) => a.startsWith("readability(measure-only) ch01:"));
  assert.ok(measure, "SEC12-parity measurement recorded");
  assert.ok(/assembled ease 61\.\d+ \(floor 70\) → FLOOR FAILED/.test(measure!), `measurement carries ease + floor result: ${measure}`);
  assert.ok(/fastRead FK 4\.0\/7, deepRead FK 6\.2\/8\.5, fullRead FK 8\.1\/9\.5/.test(measure!), `measurement carries per-tier FK vs ceiling: ${measure}`);
  // … and the SEPARATE ship-eligibility fact is the not-promotable marker.
  assert.ok(v.advisories.some((a) => /^not-promotable ch01:/.test(a)), "floor-failed candidate is marked not-promotable");
});

// ── 4. generateCandidate: the draft completes under the flag, blocks without ─

function genOpts(bookId: string, measureOnly: boolean) {
  return {
    chapterNumbers: [1],
    chapterParallel: 1,
    log: () => {},
    readabilityMeasureOnly: measureOnly,
    // Stub the STRUCTURAL gate to PASS (its readability, E1, is warn-only anyway) —
    // the readability enforcer under test is the rubric preflight, left REAL so the
    // measure-only rubric verb actually runs. Never inject rubricVerb here.
    ioOverrides: {
      readBriefMd: () => "# BRIEF",
      readBrief: () => null,
      readPacket: (b: string, n: number) => fixturePacket(b, n),
      voiceCard: () => null,
      gateCandidate: async () => ({ code: 0, stdout: "Gate verdict: PASS — 0 blockers", stderr: "" }),
    },
  };
}

test("generateCandidate: a low-ease draft COMPLETES under the measure-only flag", async () => {
  const bookId = "zz-e31-gen-ok";
  const roots = bakeoffRoots(bookId, "r1", tmpRoot("cf-e31-gen-ok-"));
  const spawns: SpawnCodexAgentOptions[] = [];
  const spawn = writerSpawn(spawns, () => JSON.stringify(lowEaseChapter(bookId, 1), null, 2), (rel) => resolve(PIPELINE_DIR, rel));
  const deps = fakeAutopilotDeps({ spawn: spawn as unknown as AutopilotDeps["spawn"] }) as AutopilotDeps;
  const state = await generateCandidate(bookId, SOL, deps, roots, genOpts(bookId, true) as never, () => {});
  assert.equal(state.status, "complete", "the writer's rubric preflight accepts the low-ease draft");
  assert.equal(state.chapters[0].firstAttemptPass, true, "no readability retry consumed");
  assert.ok(existsSync(slotChapterAbsPath(roots, SOL.slot, bookId, 1)), "the draft landed in its slot");
});

test("generateCandidate: WITHOUT the flag the SAME draft blocks (rubric preflight fails every attempt)", async () => {
  const bookId = "zz-e31-gen-block";
  const roots = bakeoffRoots(bookId, "r1", tmpRoot("cf-e31-gen-block-"));
  const spawns: SpawnCodexAgentOptions[] = [];
  const spawn = writerSpawn(spawns, () => JSON.stringify(lowEaseChapter(bookId, 1), null, 2), (rel) => resolve(PIPELINE_DIR, rel));
  const deps = fakeAutopilotDeps({ spawn: spawn as unknown as AutopilotDeps["spawn"] }) as AutopilotDeps;
  const state = await generateCandidate(bookId, SOL, deps, roots, genOpts(bookId, false) as never, () => {});
  assert.equal(state.status, "failed", "the real rubric preflight FAILs the low-ease draft on every attempt");
  assert.equal(state.chapters[0].ok, false);
});
