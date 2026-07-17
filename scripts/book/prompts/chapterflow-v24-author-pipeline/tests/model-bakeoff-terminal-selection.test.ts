/**
 * WP-E32 — terminal-gated selection minting, provisional markers, the
 * evaluator-primary ranking switch, and the INVALID-run annotator.
 *
 * Conductor-level (terminal gating; §1 of the WP spec):
 *   - a D7-pending candidate mints a PROVISIONAL selection and leaves "select"
 *     incomplete (never a false FINAL verdict on partial evidence);
 *   - curing the pending D7 record out-of-band (the real architecture: an
 *     external worker eventually writes the SAME d7.json path) lets the very
 *     next resume re-derive a FINAL selection from current state.
 *
 * Pure selectWinner-level (evaluator-primary ranking; §2):
 *   - eval-primary mode activates only when EVERY candidate carries a
 *     non-null evalDiagnostic input;
 *   - eval ranks A over B while D7 (secondary) disagrees by a real margin →
 *     A still wins, and the disagreement is RECORDED, never decisive;
 *   - legacy inputs (no evalDiagnostic field at all) stay D7-primary,
 *     byte-identical to the pre-WP-E32 scorecard shape.
 *
 * annotateInvalidRun (§3): fixture-only, never applied to a real tree here.
 */

import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { test } from "./harness.js";
import { chapterContentHash } from "../src/critics/qcAttestation.js";
import { bakeoffRoots } from "../src/bakeoff/paths.js";
import { slotChapterAbsPath } from "../src/bakeoff/candidates.js";
import { combinedContentHash } from "../src/bakeoff/review.js";
import { annotateInvalidRun, runBakeoff, type BakeoffStages, type RunBakeoffOptions } from "../src/bakeoff/runBakeoff.js";
import { selectWinner, type SelectionInputs } from "../src/bakeoff/selection.js";
import { D7_SELECTION_BAND } from "../src/bakeoff/d7Judge.js";
import type {
  BakeoffManifestV1,
  BlindLabel,
  CandidateD7JudgmentV1,
  CandidateEvalDiagnosticV1,
  CandidateReviewV1,
  CandidateSpec,
  CandidateStateV1,
  CandidateValidationV1,
  PromotionRecordV1,
  SharedInputsFreezeV1,
} from "../src/bakeoff/types.js";
import { fixtureChapter, tmpRoot, fakeBakeoffDeps } from "./model-bakeoff-helpers.js";

const MODELS = ["gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"];
const BOOK_ID = "the-terminal-ledger";
const DRAFT = "---\ntitle: The Terminal Ledger\nauthor: Ada Writer\n---\n# The Terminal Ledger\n\n" + "Evidence decides only once it is complete. ".repeat(20);

// ── Conductor-level fixture (terminal gating over runBakeoff) ─────────────────

type World = ReturnType<typeof makeWorld>;

/** `pendingSlots`: candidates whose D7 judge returns a genuinely PENDING record
 *  (verdict null, d7Composite null, NO ineligibleReason) — simulating "the
 *  external Claude worker has not concluded yet", distinct from a conclusive
 *  ineligible (assembly-refused) judgment. */
function makeWorld(pendingSlots: Set<string> = new Set(), compositesBySlot: Record<string, number> = { w1: 90, w2: 84, w3: 78 }) {
  const dir = tmpRoot("cf-bakeoff-terminal-");
  const draftPath = join(dir, "draft.md");
  writeFileSync(draftPath, DRAFT);
  const stateRoot = join(dir, "state");
  const canonical = join(dir, "canonical-chapters");
  const bundle = fakeBakeoffDeps();
  const calls = { generate: [] as string[], validate: [] as string[], review: [] as string[], d7: [] as string[], promote: [] as string[] };

  const freeze: SharedInputsFreezeV1 = {
    schemaVersion: "model-bakeoff-shared-inputs-v1",
    frozenAt: "t",
    files: [],
    combinedSha256: "shared-hash",
    taskCardTemplateSha256: { ch01: "tpl" },
    retryBudget: { gateRetries: 1, leadDegradeRetries: 1 },
    chapterNumbers: [1],
  };

  const stages: Partial<BakeoffStages> = {
    freezeInputs: () => freeze,
    verifyInputs: () => [],
    generate: (async (bookId, spec, _deps, roots, _opts, persist) => {
      calls.generate.push(spec.model);
      const ch = fixtureChapter(bookId, 1, spec.slot);
      const abs = slotChapterAbsPath(roots, spec.slot, bookId, 1);
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, JSON.stringify(ch, null, 2));
      const state: CandidateStateV1 = {
        schemaVersion: "model-bakeoff-candidate-v1",
        spec,
        status: "complete",
        chapters: [{
          chapterNumber: 1, ok: true, firstAttemptPass: true, totalDurationMs: 60_000,
          attempts: [{ attempt: 1, sessionId: `auto-bakeoff-${spec.slot}-author-ch01#1`, ok: true, durationMs: 60_000, failure: "" }],
          contentSha256: chapterContentHash(ch),
        }],
        totalDurationMs: 60_000,
        totalRetries: 0,
        firstAttemptPasses: 1,
      };
      persist(state);
      return state;
    }) as BakeoffStages["generate"],
    validate: (async (_bookId, spec) => ({
      schemaVersion: "model-bakeoff-candidate-validation-v1",
      model: spec.model, validatedAt: "t", complete: true, hardFailures: [], advisories: [],
      bookGatePassed: true, rubricVerdict: "pass", readerBudgetBlockers: 0, shipGateBlockers: 0,
    } as CandidateValidationV1)) as BakeoffStages["validate"],
    review: (async (_bookId, label, chapters, _deps, roots) => {
      calls.review.push(label);
      const slot = (chapters[0].title.match(/w\d/) ?? ["w1"])[0];
      const composite = compositesBySlot[slot] ?? 70;
      const review: CandidateReviewV1 = {
        schemaVersion: "model-bakeoff-candidate-review-v1",
        label: label as CandidateReviewV1["label"],
        contentSha256: combinedContentHash(chapters),
        chapterReviews: [{ chapterNumber: 1, composite, ship: true, keysClean: true, valid: true, pass: true, reviewerSessionId: "r" }],
        bookReads: [],
        bookComposite: composite,
        bookGate: "PASS",
        bookChurn: "LOW",
        meanChapterComposite: composite,
        minChapterComposite: composite,
        chapterPassRate: 1,
        sampledChapterNumbers: [1],
        reviewedAt: "t",
      };
      const p = join(roots.reviewsDir, label, "review.json");
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, JSON.stringify(review, null, 2));
      return review;
    }) as BakeoffStages["review"],
    d7Judge: (async (_bookId: string, label: BlindLabel, chapters) => {
      calls.d7.push(label);
      const slot = (chapters[0].title.match(/w\d/) ?? ["w1"])[0];
      const composite = compositesBySlot[slot] ?? 70;
      if (pendingSlots.has(slot)) {
        // Genuinely PENDING: no verdict, no ineligibleReason — the external
        // worker has not concluded (WP-E24 attempt-tracking territory).
        const judgment: CandidateD7JudgmentV1 = {
          schemaVersion: "model-bakeoff-candidate-d7-v1",
          label,
          contentSha256: combinedContentHash(chapters),
          auditId: `bakeoff-bo-test-${label.toLowerCase()}`,
          d7Composite: null,
          d7CoreDomainMins: [],
          d7GatesPass: false,
          d7LayerIndependencePass: false,
          allCoreDomainsPass: false,
          min: null,
          meanPass: false,
          minPass: false,
          calibrationPass: false,
          verdict: null,
          chapters: [],
          judgedAt: "t",
        };
        return judgment;
      }
      const judgment: CandidateD7JudgmentV1 = {
        schemaVersion: "model-bakeoff-candidate-d7-v1",
        label,
        contentSha256: combinedContentHash(chapters),
        auditId: `bakeoff-bo-test-${label.toLowerCase()}`,
        d7Composite: composite,
        d7CoreDomainMins: [3.5],
        d7GatesPass: true,
        d7LayerIndependencePass: true,
        allCoreDomainsPass: true,
        min: composite,
        meanPass: composite >= 85,
        minPass: composite >= 80,
        calibrationPass: true,
        verdict: "PASS",
        chapters: [{ unit: `${BOOK_ID}-ch01`, chapterNumber: 1, chapterDiagnostic: composite, coreDomainMin: 3.5, coreDomainsPass: true, gatesPass: true, layerIndependencePass: true, pass: composite >= 80 }],
        judgedAt: "t",
      };
      return judgment;
    }) as BakeoffStages["d7Judge"],
    promote: ((args) => {
      calls.promote.push(args.winner.model);
      mkdirSync(canonical, { recursive: true });
      writeFileSync(join(canonical, `${args.bookId}-ch01.v21-native.chapter.json`), "PROMOTED");
      const rec: PromotionRecordV1 = {
        schemaVersion: "model-bakeoff-promotion-v1",
        promotedAt: "t",
        winnerModel: args.winner.model,
        winnerEffort: args.winner.effort,
        runId: args.manifest.runId,
        chapterFiles: [],
        byteIdentityVerified: true,
        sharedInputsSha256: "shared-hash",
        taskCardTemplateSha256: {},
        candidateChapterHashes: args.candidateChapterHashes,
        authorSessionIds: {},
      };
      return rec;
    }) as BakeoffStages["promote"],
  };

  const opts = (over?: Partial<RunBakeoffOptions>): RunBakeoffOptions => ({
    draftPath,
    runId: "bo-test",
    models: MODELS,
    judgeModel: "gpt-5.6-sol",
    publish: false,
    deps: bundle.deps,
    stateRoot,
    stages,
    ...over,
  });

  const roots = bakeoffRoots(BOOK_ID, "bo-test", stateRoot);
  return { dir, draftPath, stateRoot, canonical, bundle, calls, stages, opts, roots, freeze };
}

function manifestOf(w: World): BakeoffManifestV1 {
  return JSON.parse(readFileSync(w.roots.manifestPath, "utf8")) as BakeoffManifestV1;
}

function d7RecordPath(w: World, label: string): string {
  return resolve(w.roots.reviewsDir, label, "d7.json");
}

test("a D7-pending candidate mints a PROVISIONAL selection and leaves 'select' incomplete — nothing promoted", async () => {
  const w = makeWorld(new Set(["w2"])); // gpt-5.6-terra (slot w2) stays pending
  const outcome = await runBakeoff(w.opts());
  assert.equal(outcome.status, "halt");
  assert.match(outcome.reason ?? "", /PROVISIONAL/);
  assert.match(outcome.reason ?? "", /gpt-5\.6-terra/);

  const manifest = manifestOf(w);
  assert.ok(!manifest.completedPhases.includes("select"), "the select phase is NOT marked done on a provisional mint");
  assert.ok(!manifest.completedPhases.includes("promote"), "nothing was promoted from provisional evidence");
  assert.equal(w.calls.promote.length, 0);

  const selection = manifest.selection!;
  assert.equal(selection.provisional, true);
  // No ledger entries were appended in this fixture (the fake stages never call
  // appendCallLedgerEntry), so the high-water mark is explicitly null — the key
  // is still PRESENT (never simply omitted) so a reader can tell "checked, empty"
  // from "field predates this feature".
  assert.ok("ledgerHighWaterAt" in selection, "the ledger high-water mark key is always recorded when provisional");
  assert.equal(selection.ledgerHighWaterAt, null);
  // The other two candidates ARE D7-terminal — the provisional gate is
  // per-run, not per-candidate silence.
  assert.equal(w.calls.d7.length, 3, "every floor-eligible candidate still got a D7 read");
});

test("curing the pending D7 record out-of-band lets the very next resume re-derive a FINAL selection", async () => {
  const w = makeWorld(new Set(["w2"]));
  const first = await runBakeoff(w.opts());
  assert.equal(first.status, "halt");
  const manifestBefore = manifestOf(w);
  const terraLabel = Object.entries(manifestBefore.blindMap).find(([, m]) => m === "gpt-5.6-terra")![0];

  // Cure: an external actor (the real D7/evaluator worker) writes a CONCLUSIVE
  // verdict to the SAME d7.json path, same content hash — exactly what resume's
  // "reuse if content unchanged" rule is built to pick up.
  const cured: CandidateD7JudgmentV1 = JSON.parse(readFileSync(d7RecordPath(w, terraLabel), "utf8"));
  cured.verdict = "PASS";
  cured.d7Composite = 84;
  cured.min = 84;
  cured.meanPass = false;
  cured.minPass = true;
  cured.d7GatesPass = true;
  cured.d7LayerIndependencePass = true;
  cured.allCoreDomainsPass = true;
  cured.calibrationPass = true;
  cured.d7CoreDomainMins = [3.5];
  cured.chapters = [{ unit: `${BOOK_ID}-ch01`, chapterNumber: 1, chapterDiagnostic: 84, coreDomainMin: 3.5, coreDomainsPass: true, gatesPass: true, layerIndependencePass: true, pass: true }];
  writeFileSync(d7RecordPath(w, terraLabel), JSON.stringify(cured, null, 2));

  w.calls.d7.length = 0;
  const second = await runBakeoff(w.opts());
  assert.equal(second.status, "ready", "the cured record let the run mint a FINAL selection and proceed");
  assert.equal(w.calls.d7.length, 0, "the cured record was REUSED, not re-driven (same content hash)");

  const manifestAfter = manifestOf(w);
  assert.ok(manifestAfter.completedPhases.includes("select"), "the select phase is now marked done");
  assert.ok(manifestAfter.completedPhases.includes("promote"));
  assert.equal(manifestAfter.selection!.provisional, undefined, "a FINAL selection carries no provisional flag");
  assert.equal(second.winner, "gpt-5.6-sol", "the highest D7 composite (w1, 90) still wins");
});

test("a deterministic-floor-failed candidate never blocks terminal gating — it is conclusively resolved without a D7 read", async () => {
  const w = makeWorld();
  const stages: Partial<BakeoffStages> = {
    ...w.stages,
    validate: (async (_bookId, spec) => ({
      schemaVersion: "model-bakeoff-candidate-validation-v1",
      model: spec.model, validatedAt: "t", complete: true,
      hardFailures: spec.model === "gpt-5.6-luna" ? ["book-gate: [AS5] templated quiz"] : [],
      advisories: [], bookGatePassed: spec.model !== "gpt-5.6-luna", rubricVerdict: "pass",
      readerBudgetBlockers: 0, shipGateBlockers: 0,
    })) as BakeoffStages["validate"],
  };
  const outcome = await runBakeoff(w.opts({ stages }));
  assert.equal(outcome.status, "ready", "the run completes even though luna never reaches the D7 judge");
  assert.equal(w.calls.d7.length, 2, "the floor-disqualified candidate got no D7 spend, and is not on the hook for terminal-gating");
  const manifest = manifestOf(w);
  assert.equal(manifest.selection!.provisional, undefined);
});

// ── Pure selectWinner-level: evaluator-primary ranking (§2) ───────────────────

function spec(model: string, slot: string): CandidateSpec {
  return { model, slug: model.replace(/[^a-z0-9]+/gi, "-"), slot, effort: "xhigh" };
}
function generation(model: string, slot: string): CandidateStateV1 {
  return { schemaVersion: "model-bakeoff-candidate-v1", spec: spec(model, slot), status: "complete", chapters: [], totalDurationMs: 60_000, totalRetries: 0, firstAttemptPasses: 1 };
}
function validation(model: string): CandidateValidationV1 {
  return { schemaVersion: "model-bakeoff-candidate-validation-v1", model, validatedAt: "t", complete: true, hardFailures: [], advisories: [], bookGatePassed: true, rubricVerdict: "pass", readerBudgetBlockers: 0, shipGateBlockers: 0 };
}
function d7(label: string, composite: number | null, over?: Partial<CandidateD7JudgmentV1>): CandidateD7JudgmentV1 {
  return {
    schemaVersion: "model-bakeoff-candidate-d7-v1",
    label: label as CandidateD7JudgmentV1["label"],
    contentSha256: "x",
    auditId: `bakeoff-t-${label.toLowerCase()}`,
    d7Composite: composite,
    d7CoreDomainMins: [3.4],
    d7GatesPass: true,
    d7LayerIndependencePass: true,
    allCoreDomainsPass: true,
    min: composite,
    meanPass: composite !== null && composite >= 85,
    minPass: composite !== null && composite >= 80,
    calibrationPass: true,
    verdict: composite === null ? null : "PASS",
    chapters: [{ unit: `book-ch01`, chapterNumber: 1, chapterDiagnostic: composite ?? 0, coreDomainMin: 3.4, coreDomainsPass: true, gatesPass: true, layerIndependencePass: true, pass: composite !== null && composite >= 80 }],
    judgedAt: "t",
    ...over,
  };
}
function evalDiag(label: string, chapterDiagnostic: number | null, over?: Partial<CandidateEvalDiagnosticV1>): CandidateEvalDiagnosticV1 {
  return {
    schemaVersion: "model-bakeoff-candidate-eval-diagnostic-v1",
    label: label as CandidateEvalDiagnosticV1["label"],
    contentSha256: "x",
    evalRunId: `eval-t-${label.toLowerCase()}`,
    chapterDiagnostic,
    confidence: chapterDiagnostic === null ? null : "high",
    gatesPass: chapterDiagnostic === null ? null : true,
    raterModels: { primary: null, verification: null, adjudicator: null },
    terminalState: chapterDiagnostic === null ? "pending" : "judged",
    receipts: { primaryDispatch: "p", verificationDispatch: "v", pairSeal: "s", adjudicated: "a" },
    judgedAt: "t",
    ...over,
  };
}

test("evaluator-primary mode: eval ranks A over B; D7 disagrees by a real margin favoring B — A still wins, and the disagreement is RECORDED", () => {
  const inputs: SelectionInputs = [
    {
      spec: spec("gpt-5.6-luna", "w1"), label: "A", generation: generation("gpt-5.6-luna", "w1"), validation: validation("gpt-5.6-luna"),
      review: null, d7: d7("A", 79), evalDiagnostic: evalDiag("A", 88),
    },
    {
      spec: spec("gpt-5.6-sol", "w2"), label: "B", generation: generation("gpt-5.6-sol", "w2"), validation: validation("gpt-5.6-sol"),
      review: null, d7: d7("B", 90), evalDiagnostic: evalDiag("B", 82),
    },
  ];
  const sel = selectWinner(inputs);
  assert.equal(sel.winner, "gpt-5.6-luna", "the evaluator diagnostic (88 > 82) decides — D7 (79 < 90) never re-ranks");
  const lunaCard = sel.scorecards.find((s) => s.model === "gpt-5.6-luna")!;
  assert.equal(lunaCard.evalDiagnostic, 88);
  assert.equal(lunaCard.d7Composite, 79, "the D7 composite is still MIRRORED on the scorecard for visibility");
  assert.ok(
    sel.reasons.some((r) => /disqualification-review flag/.test(r) && /gpt-5\.6-sol/.test(r) && /gpt-5\.6-luna/.test(r)),
    "the D7/evaluator disagreement is recorded as a review flag, never a re-ranking",
  );
});

test("evaluator-primary mode: a D7 gate failure on the evaluator winner is a review flag, NOT a disqualification", () => {
  const inputs: SelectionInputs = [
    {
      spec: spec("gpt-5.6-luna", "w1"), label: "A", generation: generation("gpt-5.6-luna", "w1"), validation: validation("gpt-5.6-luna"),
      review: null, d7: d7("A", 92, { d7GatesPass: false }), evalDiagnostic: evalDiag("A", 88),
    },
    {
      spec: spec("gpt-5.6-sol", "w2"), label: "B", generation: generation("gpt-5.6-sol", "w2"), validation: validation("gpt-5.6-sol"),
      review: null, d7: d7("B", 80), evalDiagnostic: evalDiag("B", 70),
    },
  ];
  const sel = selectWinner(inputs);
  assert.equal(sel.winner, "gpt-5.6-luna", "a D7 gate failure alone never disqualifies under evaluator-primary ranking");
  const lunaCard = sel.scorecards.find((s) => s.model === "gpt-5.6-luna")!;
  assert.equal(lunaCard.eligible, true);
  assert.ok(sel.reasons.some((r) => /disqualification-review flag/.test(r) && /D7 required-gate FAIL/.test(r)));
});

test("evaluator-primary mode: a null evaluator diagnostic DISQUALIFIES — never a D7 fallback", () => {
  const inputs: SelectionInputs = [
    {
      spec: spec("gpt-5.6-luna", "w1"), label: "A", generation: generation("gpt-5.6-luna", "w1"), validation: validation("gpt-5.6-luna"),
      review: null, d7: d7("A", 99), evalDiagnostic: evalDiag("A", null, { ineligibleReason: "evaluator dispatch timed out" }),
    },
    {
      spec: spec("gpt-5.6-sol", "w2"), label: "B", generation: generation("gpt-5.6-sol", "w2"), validation: validation("gpt-5.6-sol"),
      review: null, d7: d7("B", 60), evalDiagnostic: evalDiag("B", 75),
    },
  ];
  const sel = selectWinner(inputs);
  assert.equal(sel.winner, "gpt-5.6-sol", "luna cannot win on its stellar D7 composite — the evaluator diagnostic is null");
  const lunaCard = sel.scorecards.find((s) => s.model === "gpt-5.6-luna")!;
  assert.equal(lunaCard.eligible, false);
  assert.ok(lunaCard.disqualifications.some((d) => /no evaluator chapter diagnostic/.test(d) && /dispatch timed out/.test(d)));
});

test("legacy inputs (no evalDiagnostic field on ANY candidate) stay D7-primary — scorecards carry no eval* keys, byte-identical to pre-WP-E32", () => {
  const inputs: SelectionInputs = [
    { spec: spec("gpt-5.6-sol", "w1"), label: "A", generation: generation("gpt-5.6-sol", "w1"), validation: validation("gpt-5.6-sol"), review: null, d7: d7("A", 92) },
    { spec: spec("gpt-5.6-terra", "w2"), label: "B", generation: generation("gpt-5.6-terra", "w2"), validation: validation("gpt-5.6-terra"), review: null, d7: d7("B", 82) },
  ];
  const sel = selectWinner(inputs);
  assert.equal(sel.winner, "gpt-5.6-sol");
  for (const sc of sel.scorecards) {
    assert.ok(!("evalDiagnostic" in sc), "no eval* key is inserted when no candidate carries an evalDiagnostic input");
    assert.ok(!("evalGatesPass" in sc));
    assert.ok(!("evalConfidence" in sc));
    assert.ok(!("evalTerminalState" in sc));
  }
  assert.ok(!sel.reasons.some((r) => /disqualification-review flag/.test(r)), "no D7 review-flag machinery runs under legacy D7-primary mode");
});

test("ONE candidate missing its evalDiagnostic input keeps the WHOLE selection on D7-primary — modes are never mixed", () => {
  const inputs: SelectionInputs = [
    { spec: spec("gpt-5.6-sol", "w1"), label: "A", generation: generation("gpt-5.6-sol", "w1"), validation: validation("gpt-5.6-sol"), review: null, d7: d7("A", 92), evalDiagnostic: evalDiag("A", 70) },
    { spec: spec("gpt-5.6-terra", "w2"), label: "B", generation: generation("gpt-5.6-terra", "w2"), validation: validation("gpt-5.6-terra"), review: null, d7: d7("B", 82), evalDiagnostic: null },
  ];
  const sel = selectWinner(inputs);
  assert.equal(sel.winner, "gpt-5.6-sol", "sol wins on the D7 composite (92 > 82) — evaluator data is ignored, not partially applied");
  const solCard = sel.scorecards.find((s) => s.model === "gpt-5.6-sol")!;
  assert.ok(!("evalDiagnostic" in solCard), "eval fields stay absent even though ONE candidate happened to carry an evalDiagnostic record");
});

// ── annotateInvalidRun (§3): fixture-only ──────────────────────────────────────

test("annotateInvalidRun writes an INVALID-<slug>.json marker beside the manifest, and never mutates existing records", () => {
  const dir = tmpRoot("cf-bakeoff-invalid-marker-");
  const manifestPath = join(dir, "manifest.json");
  writeFileSync(manifestPath, JSON.stringify({ untouched: true }, null, 2));
  const manifestBytesBefore = readFileSync(manifestPath, "utf8");

  const markerPath = annotateInvalidRun(dir, "instrument shakedown — PM-7 disposition");
  assert.ok(existsSync(markerPath));
  assert.match(markerPath, /INVALID-instrument-shakedown.*\.json$/);
  assert.equal(dirname(markerPath), dir, "the marker lands directly beside the manifest, not in a subdirectory");
  const marker = JSON.parse(readFileSync(markerPath, "utf8"));
  assert.equal(marker.reason, "instrument shakedown — PM-7 disposition");
  assert.ok(typeof marker.annotatedAt === "string" && marker.annotatedAt.length > 0);

  // The manifest itself is untouched.
  assert.equal(readFileSync(manifestPath, "utf8"), manifestBytesBefore);
});

test("annotateInvalidRun NEVER overwrites an existing marker — a same-reason call adds a distinctly-named file", () => {
  const dir = tmpRoot("cf-bakeoff-invalid-marker-2-");
  const first = annotateInvalidRun(dir, "stale evidence");
  const firstBytes = readFileSync(first, "utf8");
  const second = annotateInvalidRun(dir, "stale evidence");
  assert.notEqual(first, second, "a second call with the SAME reason gets a distinct path");
  assert.equal(readFileSync(first, "utf8"), firstBytes, "the first marker's bytes are untouched");
  assert.ok(existsSync(second));

  // Also refuses to clobber a hand-placed file that happens to occupy the exact
  // slug path a third call would compute.
  const sentinelPath = join(dir, "INVALID-stale-evidence-3.json");
  writeFileSync(sentinelPath, "SENTINEL — must never be overwritten");
  const third = annotateInvalidRun(dir, "stale evidence");
  assert.notEqual(third, sentinelPath, "the writer probes past an occupied slug rather than overwriting it");
  assert.equal(readFileSync(sentinelPath, "utf8"), "SENTINEL — must never be overwritten");

  const invalidFiles = readdirSync(dir).filter((f) => f.startsWith("INVALID-"));
  assert.ok(invalidFiles.length >= 3, "every call produced its own file — none were clobbered");
});

// D7_SELECTION_BAND import proves the tests above exercise the SAME frozen band
// the conductor uses by default (no hidden re-derivation of the constant).
test("selectWinner's default band is the frozen D7_SELECTION_BAND, in both modes", () => {
  const sel = selectWinner([
    { spec: spec("a", "w1"), label: "A", generation: generation("a", "w1"), validation: validation("a"), review: null, d7: null, evalDiagnostic: evalDiag("A", 87.0) },
    { spec: spec("b", "w2"), label: "B", generation: generation("b", "w2"), validation: validation("b"), review: null, d7: null, evalDiagnostic: evalDiag("B", 85.5) },
  ]);
  assert.equal(sel.tieBand, D7_SELECTION_BAND);
  assert.equal(sel.decidedByTieBreak, true, "1.5 < 2.0 band → tie, even under evaluator-primary ranking");
});
