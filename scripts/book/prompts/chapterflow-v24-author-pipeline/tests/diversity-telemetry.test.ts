/**
 * IMP-06 — passive diversity telemetry: features, first-write ledger, activation
 * contract, anti-taxonomy leakage.
 *
 * Pins the master-plan §Tests items at the shipped (all-shadow) scope:
 *  - feature extraction distinguishes varied VALID structures and equates
 *    DISGUISED clones (same structure, different nouns);
 *  - the ledger separates immutable first writes from repaired versions, is
 *    OPT-IN (no root → zero writes, null return), never throws into a commit
 *    path, and stamps configHash + feature schema (instruction 12);
 *  - shadow mode has NO writer/gate effect: telemetry modules have no render
 *    path, and recording without a root is a structural no-op;
 *  - the activation contract rejects ad hoc activation (no evidence, no frozen
 *    thresholds, no reason), rejects blocking outside exact-clone, caps active
 *    constraints at 2, and degrades an INVALID config to shadow LOUDLY;
 *  - internal taxonomy labels never render on the de-reciped brief and are
 *    detected verbatim in reader prose.
 */

import assert from "node:assert/strict";
import { appendFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { test } from "./harness.js";
import { fxChapter, fxPlan, fxPlanUnit } from "./migrationFixtures.js";
import {
  classifyActorRegister,
  classifyMemorableLinePattern,
  classifyOpenerFunction,
  classifyPropDependence,
  classifySourceOriginForm,
  extractDiversityFeatures,
} from "../src/telemetry/diversityFeatures.js";
import {
  appendDiversityLedger,
  diversityLedgerPath,
  featureConcentration,
  firstWriteRecords,
  readDiversityLedger,
  recordChapterDiversity,
  resolveDiversityLedgerRoot,
} from "../src/telemetry/diversityLedger.js";
import {
  DEFAULT_DIVERSITY_CONFIG,
  diversityConfigHash,
  effectiveMode,
  validateDiversityConfig,
  type DiversityConfigV1,
} from "../src/telemetry/diversityConfig.js";
import { CARD_FORBIDDEN_LABELS, PROSE_FORBIDDEN_LABELS, isDistinctiveLabel, taxonomyLeaksInProse } from "../src/telemetry/internalTaxonomy.js";
import type { ChapterV21, ExampleV21 } from "../src/types.js";

function ex(scenario: string): ExampleV21 {
  return {
    exampleId: "ex-01",
    title: "Fixture",
    tags: ["fixture"],
    planSpec: { domain: "ops", audience: "pros", stakes: "medium", format: "narrative", requiredBeat: "resolution" },
    scenario,
    whatToDo: "Apply the move at the next decision point.",
    whyItMatters: "It shows the move under constraint.",
  };
}

// ── feature extraction ────────────────────────────────────────────────────────

test("IMP-06 features: varied valid structures classify differently; the honest unknown/none answers exist", () => {
  const question = fxChapter({ hook: "What does the fastest team in the building argue about?" });
  const statistic = fxChapter({ hook: "Two teams shipped 40% more after one change to their standup." });
  const scene = fxChapter({ hook: "The foreman stands at the dock while the count comes up wrong again." });
  assert.equal(classifyOpenerFunction(question), "question-opener");
  assert.equal(classifyOpenerFunction(statistic), "statistic-opener");
  assert.equal(classifyOpenerFunction(scene), "scene-opener");
  assert.equal(classifyOpenerFunction(fxChapter({})), "unknown", "no hook → honest unknown");

  const you = fxChapter({ examples: [ex("You inherit a stalled migration and you map the two decisions that matter before your next standup.")] });
  const roles = fxChapter({ examples: [ex("A manager inherits a stalled migration. The engineer maps the decisions; the analyst defers the rest.")] });
  assert.equal(classifyActorRegister(you), "second-person-you");
  assert.equal(classifyActorRegister(roles), "role-labels");

  assert.equal(classifyPropDependence(fxChapter({ examples: [ex("A checklist on the clipboard, a whiteboard grid, and a printout of the counts anchor the review.")] })), "prop-heavy");
  assert.equal(classifyPropDependence(fxChapter({ examples: [ex("The team names the single blocking dependency and defers the rest.")] })), "none");

  const mixedLines = fxChapter({ memorableLines: [
    { text: "Who owns the return?", location: "hook", why: "w" },
    { text: "A promise is a debt with a date.", location: "hook", why: "w" },
  ] });
  assert.equal(classifyMemorableLinePattern(mixedLines), "mixed-lines");
  assert.equal(classifyMemorableLinePattern(fxChapter({})), "none");
});

test("IMP-06 features: a DISGUISED clone (same structure, different nouns) extracts the SAME feature vector", () => {
  // The swap keeps the STRUCTURE (opener function, actor register, setting
  // domain, timings, line pattern) and varies the vocabulary — the lexical
  // clone detector must miss it (tested in clone-detection.test.ts) while the
  // feature vector stays identical. Nouns stay within one setting domain
  // because settingCategory is legitimately a noun-level feature.
  const a = fxChapter({
    number: 1,
    hook: "The fastest crew in the plant argues about one decision, not four.",
    examples: [ex("A manager at the plant inherits a stalled changeover with two weeks of runway. The crew maps which of the four open calls actually moves the date and defers the rest to a written parking lot.")],
    memorableLines: [{ text: "Name the blocker before you promise the date.", location: "hook", why: "w" }],
  });
  const b = fxChapter({
    number: 2,
    hook: "The fastest team at the factory argues about one decision, not five.",
    examples: [ex("A director at the factory inherits a stalled retooling with three weeks of runway. The team maps which of the five open calls actually moves the launch and defers the rest to a shared backlog.")],
    memorableLines: [{ text: "Name the constraint before you promise the quarter.", location: "hook", why: "w" }],
  });
  const fa = extractDiversityFeatures("zz-fixture-book", a).features;
  const fb = extractDiversityFeatures("zz-fixture-book", b).features;
  assert.deepEqual(fa, fb, "structure-preserving noun swaps cannot hide from the feature extractor");
});

test("IMP-06 features: sourceOriginForm reads the compiler-owned plan, never prose", () => {
  const caseLed = fxPlan({ units: [fxPlanUnit({ unitId: "u.case", form: "case", caseId: "c1", anchorIds: ["a"], detailSufficiency: "partial" })] });
  const factsOnly = fxPlan({ units: [fxPlanUnit({})] });
  const inventedOnly = fxPlan({ units: [fxPlanUnit({ unitId: "u.gen", origin: "generic", form: "operational_scenario", anchorIds: [] })] });
  assert.equal(classifySourceOriginForm(caseLed), "sourced-case-led");
  assert.equal(classifySourceOriginForm(factsOnly), "sourced-facts-only");
  assert.equal(classifySourceOriginForm(inventedOnly), "invented-only");
  assert.equal(classifySourceOriginForm(null), "unknown");
});

// ── ledger ────────────────────────────────────────────────────────────────────

test("IMP-06 ledger: OPT-IN — no root and no env means null return and ZERO writes; bad root never throws", () => {
  const prevEnv = process.env.CHAPTERFLOW_DIVERSITY_LEDGER_ROOT;
  delete process.env.CHAPTERFLOW_DIVERSITY_LEDGER_ROOT;
  try {
    assert.equal(resolveDiversityLedgerRoot(null), null);
    const rec = recordChapterDiversity({
      bookId: "zz-fixture-book", chapterNumber: 1, chapter: fxChapter({}),
      attemptKind: "author-initial", committedGeneration: 1,
    });
    assert.equal(rec, null, "no root → structural no-op");
    // A root that cannot be created is contained (telemetry may never fail a commit).
    const bad = recordChapterDiversity({
      root: "/dev/null/impossible-root", bookId: "zz-fixture-book", chapterNumber: 1,
      chapter: fxChapter({}), attemptKind: "author-initial", committedGeneration: 1,
    });
    assert.equal(bad, null, "write failure contained, never thrown");
  } finally {
    if (prevEnv !== undefined) process.env.CHAPTERFLOW_DIVERSITY_LEDGER_ROOT = prevEnv;
  }
});

test("IMP-06 ledger: first writes are immutable and separated from repaired versions; config + schema stamped", () => {
  const root = mkdtempSync(join(tmpdir(), "div-ledger-"));
  try {
    const mk = (n: number, kind: "author-initial" | "surgical-repair", gen: number, hook: string) =>
      recordChapterDiversity({
        root, bookId: "zz-fixture-book", chapterNumber: n,
        chapter: fxChapter({ number: n, hook }),
        attemptKind: kind, committedGeneration: gen, nowIso: "2026-07-10T00:00:00.000Z",
      });
    const first1 = mk(1, "author-initial", 1, "What does the fastest team argue about?");
    const repair1 = mk(1, "surgical-repair", 2, "The foreman stands at the dock while the count comes up wrong.");
    const first2 = mk(2, "author-initial", 1, "Two teams shipped 40% more after one change.");
    assert.ok(first1 && repair1 && first2);
    assert.equal(first1.firstWrite, true);
    assert.equal(repair1.firstWrite, false, "a repair is a diagnosis version, never the denominator");
    assert.equal(first1.configHash, diversityConfigHash(DEFAULT_DIVERSITY_CONFIG), "instruction 12: config hash stamped");
    assert.equal(first1.featureSchema, "diversity-features-v1");

    const records = readDiversityLedger(root, "zz-fixture-book");
    assert.equal(records.length, 3);
    const first = firstWriteRecords(records);
    assert.deepEqual(first.map((r) => r.chapterNumber), [1, 2], "one immutable first write per chapter");
    assert.equal(first[0].features.openerFunction, "question-opener", "the FIRST bytes' features survive the repair");

    // Diversity is never inferred from final chapters: the repaired features
    // exist in the ledger (diagnosis) but not in the first-write set.
    assert.ok(records.some((r) => !r.firstWrite && r.features.openerFunction === "scene-opener"));
    assert.ok(first.every((r) => r.firstWrite));

    const conc = featureConcentration(first);
    const opener = conc.find((c) => c.feature === "openerFunction");
    assert.ok(opener && Math.abs(opener.maxShare - 0.5) < 1e-9, "two first writes, two opener classes → 50% max share");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("IMP-06 ledger: append + tolerant read skip malformed lines (a diagnosis tool reads partial ledgers)", () => {
  const root = mkdtempSync(join(tmpdir(), "div-ledger-tol-"));
  try {
    const rec = recordChapterDiversity({
      root, bookId: "zz-fixture-book", chapterNumber: 1, chapter: fxChapter({ number: 1 }),
      attemptKind: "author-initial", committedGeneration: 1,
    });
    assert.ok(rec);
    const path = diversityLedgerPath(root, "zz-fixture-book");
    assert.ok(existsSync(path));
    // Corrupt a line, then append a valid one — read must return both valid records.
    appendFileSync(path, "{not json\n");
    appendDiversityLedger(root, { ...rec, chapterNumber: 2 });
    const records = readDiversityLedger(root, "zz-fixture-book");
    assert.deepEqual(records.map((r) => r.chapterNumber), [1, 2]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ── activation contract ───────────────────────────────────────────────────────

test("IMP-06 activation contract: the shipped default is ALL-SHADOW and valid; hash is key-order independent", () => {
  assert.deepEqual(validateDiversityConfig(DEFAULT_DIVERSITY_CONFIG), []);
  for (const cls of ["exact-clone", "near-clone", "feature-concentration"] as const) {
    assert.equal(DEFAULT_DIVERSITY_CONFIG.checks[cls].mode, "shadow", `${cls} ships shadow`);
  }
  const reordered = JSON.parse(JSON.stringify(DEFAULT_DIVERSITY_CONFIG)) as DiversityConfigV1;
  assert.equal(diversityConfigHash(reordered), diversityConfigHash(DEFAULT_DIVERSITY_CONFIG));
});

test("IMP-06 activation contract: ad hoc activation is rejected — evidence, reason, and frozen thresholds are required", () => {
  const adHoc = JSON.parse(JSON.stringify(DEFAULT_DIVERSITY_CONFIG)) as DiversityConfigV1;
  adHoc.checks["near-clone"].mode = "advisory"; // no evidenceRef, no selectionReason
  const errors = validateDiversityConfig(adHoc);
  assert.ok(errors.some((e) => e.includes("evidenceRef")), JSON.stringify(errors));
  assert.ok(errors.some((e) => e.includes("selectionReason")), JSON.stringify(errors));
  // And an invalid config NEVER activates: effectiveMode degrades to shadow LOUDLY.
  const eff = effectiveMode(adHoc, "near-clone");
  assert.equal(eff.mode, "shadow");
  assert.ok(eff.configErrors.length > 0, "the degradation carries the errors — no silent fallback");

  const noThresholds = JSON.parse(JSON.stringify(DEFAULT_DIVERSITY_CONFIG)) as DiversityConfigV1;
  noThresholds.checks["exact-clone"] = { mode: "advisory", thresholds: {}, evidenceRef: "docs/x.md", selectionReason: "calibrated" };
  assert.ok(validateDiversityConfig(noThresholds).some((e) => e.includes("thresholds")));
});

test("IMP-06 activation contract: blocking is exact-clone-only in v1; active constraints cap at 2; valid activation accepted", () => {
  const broadBlock = JSON.parse(JSON.stringify(DEFAULT_DIVERSITY_CONFIG)) as DiversityConfigV1;
  broadBlock.checks["feature-concentration"] = { mode: "blocking", thresholds: { maxShare: 0.9 }, evidenceRef: "ref", selectionReason: "why" };
  assert.ok(validateDiversityConfig(broadBlock).some((e) => e.includes("only exact-clone may block")), "broad similarity stays shadow-first");

  const overCap = JSON.parse(JSON.stringify(DEFAULT_DIVERSITY_CONFIG)) as DiversityConfigV1;
  overCap.maxActiveConstraintsPerChapter = 3;
  assert.ok(validateDiversityConfig(overCap).some((e) => e.includes("at most one or two")));

  const valid = JSON.parse(JSON.stringify(DEFAULT_DIVERSITY_CONFIG)) as DiversityConfigV1;
  valid.checks["exact-clone"] = {
    mode: "blocking",
    thresholds: { minNgramWords: 12, minHookChars: 24 },
    evidenceRef: "docs/v25/reports/clone-calibration.md",
    selectionReason: "zero FP on the clean cross-book fixtures; exact copies only",
  };
  assert.deepEqual(validateDiversityConfig(valid), [], "a properly evidenced exact-clone activation is accepted");
  assert.equal(effectiveMode(valid, "exact-clone").mode, "blocking");
});

// ── anti-taxonomy leakage ─────────────────────────────────────────────────────

test("IMP-06 anti-leakage: the prose scan set is DISTINCTIVE-only, and leaks are detected verbatim in reader prose", () => {
  assert.ok(PROSE_FORBIDDEN_LABELS.length > 30, "the catalog covers the dealt pools");
  assert.ok(PROSE_FORBIDDEN_LABELS.every(isDistinctiveLabel), "single dictionary words never enter the prose scan (FP guard)");
  assert.ok(!PROSE_FORBIDDEN_LABELS.includes("failure"), "common words excluded");
  assert.ok(!PROSE_FORBIDDEN_LABELS.includes("reversal"), "common words excluded");

  const leaky = fxChapter({
    breakdown: { fastRead: "This chapter uses a prop-tableau to open the scene.", deepRead: "d", fullRead: "f" },
  });
  assert.deepEqual(taxonomyLeaksInProse(leaky), ["prop-tableau"]);
  const clean = fxChapter({
    breakdown: { fastRead: "A shift lead maps the single blocking dependency before promising a date.", deepRead: "d", fullRead: "f" },
  });
  assert.deepEqual(taxonomyLeaksInProse(clean), [], "ordinary prose is clean");
});

test("IMP-06 anti-leakage: CARD_FORBIDDEN_LABELS names the demoted taxonomy, not the retained dials", () => {
  assert.ok(CARD_FORBIDDEN_LABELS.includes("prop-tableau"), "lens taxonomy is card-forbidden");
  assert.ok(CARD_FORBIDDEN_LABELS.includes("mechanism-speak"), "idiom taxonomy is card-forbidden");
  assert.ok(CARD_FORBIDDEN_LABELS.includes("at-the-demand"), "arc entry taxonomy is card-forbidden");
  // Retained allocation dials render their label by design and must NOT be here.
  for (const retained of ["single-deep-case", "audit-one-artifact", "two-step-sequence", "cold-diagnosis"]) {
    assert.ok(!CARD_FORBIDDEN_LABELS.includes(retained), `retained dial wrongly card-forbidden: ${retained}`);
  }
});
