/**
 * Shared fixtures for the WP-702 D7-judge bake-off tests (not a .test.ts — never
 * auto-run). Builds an INJECTED Claude-worker double that returns VALID rater /
 * adjudication records so the REAL D7 harness (rubricAuditHarness.ts) can be
 * driven to a chapter-diagnostic composite entirely model-free.
 *
 * The double reads the frozen batch manifest + the harness's own deterministic
 * binding envelope, so every record binds to the exact minted dispatch/custody
 * chain and passes the existing fail-closed validators. Candidate chapters get
 * synthetic (controllable-composite) integer ratings + the v25 layer-independence
 * gate; the hidden calibration item reuses the owner-adjudicated reference domains
 * (owner-run-compat, 6 base gates) so it stays inside the ±3.0 calibration
 * tolerance. Zero model/API calls.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { mkTestRoots } from "./testRoots.js";
import { PIPELINE_DIR } from "../src/bakeoff/paths.js";
import type { ChapterV21 } from "../src/types.js";
import type { D7WorkerRequest } from "../src/bakeoff/d7Judge.js";
import { artifactSha256FromText } from "../src/bakeoff/migration/rubricAuditCanonical.js";
import {
  RUBRIC_CALIBRATION_REFERENCES,
  RUBRIC_DOMAINS,
  RUBRIC_OWNER_RUN_REL_PATH,
  rubricAuditDirRelPath,
  rubricBand,
  type RubricAuditBatchManifestV1,
} from "../src/bakeoff/migration/rubricAuditInstrument.js";
import { raterBindingEnvelope } from "../src/bakeoff/migration/rubricAuditHarness.js";

export const REPOSITORY_ROOT = resolve(PIPELINE_DIR, "../../../..");

/** A full, app-faithful ChapterV21 that assembles cleanly (quiz key + explanation
 *  present) — so assembleAuditPackageFromChapters succeeds and the candidate is
 *  eligible for the D7 judge. */
export function fullFixtureChapter(bookId: string, n: number): ChapterV21 {
  const nn = String(n).padStart(2, "0");
  return {
    schemaVersion: "chapterflow-v21-authored",
    chapterId: `${bookId}-ch${nn}`,
    number: n,
    title: `Chapter ${n}: The Inspectable Claim`,
    readingTimeMinutes: 7,
    hook: `A fishmonger sets a temperature log beside the cod, and belief changes in chapter ${n}.`,
    counterintuition: "Confident delivery can weaken belief rather than strengthen it.",
    tryThisNow: "Pick one claim you need believed today and attach one thing a listener can check.",
    keyTakeaway: "Move credibility from the speaker's confidence to support the audience can inspect for themselves.",
    breakdown: {
      fastRead: "A scene and a rule: proof the audience can inspect beats confident assertion. The log is checkable; a dramatic story is not.",
      deepRead: "The mechanism: inspectable evidence removes the need to judge the speaker and lowers the social cost of changing one's mind.",
      fullRead: "Depth: scale, witnesses, and human-scale translation each let a claim survive the speaker; conditions must travel with the claim.",
    },
    examples: [
      { exampleId: `${bookId}-ch${nn}-ex01`, title: "Rachel sets the catch log beside the cod", tags: ["case"], planSpec: { domain: "work", audience: "adults", stakes: "real", format: "scene", requiredBeat: "decision" }, scenario: "A buyer doubts freshness.", whatToDo: "Place the temperature log beside the fish.", whyItMatters: "The claim becomes checkable instead of asserted." },
    ],
    quiz: {
      passingScorePercent: 70,
      questions: [
        { questionId: `${bookId}-ch${nn}-q1`, prompt: "What makes a claim credible to an audience?", choices: ["The speaker's confidence", "Support the audience can inspect", "Repetition"], correctIndex: 1, explanation: "Credibility comes from inspectable support, not confident delivery — the audience can check it themselves.", bloomsLevel: "understand", depthLevel: "standard" },
      ],
    },
    reviewCards: [
      { cardId: `${bookId}-ch${nn}-c1`, front: "Where should proof live?", back: "In something the audience can inspect, not in the speaker's confidence.", difficulty: "easy" },
    ],
    implementationPlan: {
      title: "Attach The Check",
      coreSkill: "Attach one inspectable piece of support to a claim before you assert it.",
      ifThenPlans: [{ context: "In a meeting", plan: "If you make a claim, then name one thing a listener can check." }],
      twentyFourHourChallenge: "Add one inspectable support to a claim you make today.",
      weeklyPractice: "Audit three claims this week for proof, witness, or human-scale support.",
    },
    memorableLines: [{ text: "Belief should rest on what the audience can inspect, not on how sure the speaker sounds.", location: "hook", why: "compresses the idea" }],
  } as unknown as ChapterV21;
}

/** A temp git-root that carries the calibration reference doc at its real
 *  repo-relative path — the D7 judge resolves the audit dir + the calibration doc
 *  + the WP-503 ledger under this root. */
export function makeD7Repo(prefix: string, calibrationUnit: string): { base: string; dispose: () => void } {
  const roots = mkTestRoots(prefix);
  const ref = RUBRIC_CALIBRATION_REFERENCES.find((r) => r.unit === calibrationUnit);
  if (!ref) throw new Error(`unknown calibration unit ${calibrationUnit}`);
  const abs = resolve(roots.base, ref.docRelPath);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, readFileSync(resolve(REPOSITORY_ROOT, ref.docRelPath)));
  return { base: roots.base, dispose: roots.dispose };
}

function readManifest(repositoryRoot: string, auditId: string): RubricAuditBatchManifestV1 {
  const path = resolve(repositoryRoot, rubricAuditDirRelPath(auditId), "batch-manifest.json");
  return JSON.parse(readFileSync(path, "utf8")) as RubricAuditBatchManifestV1;
}

const GENERIC_ANALYSIS = {
  evaluation_construct: "standalone chapter learning value under rubric v2",
  strongest_qualities: ["clear inspectable-evidence throughline"],
  weakest_qualities: ["a few unstated boundary conditions"],
  engagement_curve: "opens on a concrete scene and sustains momentum",
  comprehension_retention_analysis: "retrieval cue and worked example reinforce the core move",
  practical_use_judgment_analysis: "the if-then plan is directly actionable",
  best_fit_readers: ["adult self-directed learners"],
  struggling_readers: ["readers wanting more counterexamples"],
  improvements: ["add one contrasting failure case", "state the boundary condition explicitly", "add a second retrieval cue"],
  verdict: "A solid, self-contained chapter whose credibility move transfers cleanly.",
};

function baseGates(): Record<string, unknown> {
  return {
    chapter_artifact_completeness: { status: "pass", rationale: "all reader-facing artifacts present" },
    epistemic_instructional_safety: { status: "pass", rationale: "no unsafe instruction" },
    ethics_reader_autonomy: { status: "pass", rationale: "non-coercive, autonomy-preserving" },
    purpose_audience_declaration: { status: "pass", rationale: "purpose and audience are clear" },
    external_accuracy: { status: "not_assessed", rationale: "standalone chapter scope" },
    actual_book_completeness: { status: "unevaluable", rationale: "single chapter audited" },
  };
}

function layerIndependenceGate(): Record<string, unknown> {
  return {
    layer_independence: {
      status: "pass",
      rationale: "each read layer re-establishes its own case, characters, and core lesson",
      layers: {
        fast: { self_contained: true, findings: [] },
        deep: { self_contained: true, findings: [] },
        full: { self_contained: true, findings: [] },
      },
    },
  };
}

/** Build the domains block + chapter_diagnostic_score for a candidate chapter from
 *  a per-domain integer rating (default uniform). */
function syntheticDomains(ratingOf: (domainKey: string) => number): { domains: Record<string, unknown>; cds: number } {
  const domains: Record<string, unknown> = {};
  let weightedTotal = 0;
  for (const spec of RUBRIC_DOMAINS) {
    const r = ratingOf(spec.key);
    const subcriteria: Record<string, unknown> = {};
    for (const sub of spec.subcriteria) {
      subcriteria[sub] = { rating: r, rationale: `anchor-linked rationale for ${sub}`, evidence: [{ locator: "section 1", paraphrase: "observed support" }] };
    }
    const domainScore = r; // sum of four identical ratings / 4
    const weightedPoints = (domainScore / 4) * spec.weight;
    weightedTotal += weightedPoints;
    domains[spec.key] = {
      weight: spec.weight,
      subcriteria,
      domain_score: domainScore,
      weighted_points: weightedPoints,
      strengths: ["clear support", "concrete worked example"],
      limitations: ["one unstated boundary"],
      within_chapter_pattern: "consistent across the chapter",
      rationale: "anchor-linked chapter-local judgment",
      scope_note: "scored on chapter-local support only",
    };
  }
  return { domains, cds: (weightedTotal / 95) * 100 };
}

export type D7WorkerDoubleOptions = {
  repositoryRoot: string;
  calibrationUnit: string;
  /** Per-candidate-unit uniform integer rating (0-4). Default 4 (a passing D7). */
  ratingForUnit?: (unit: string) => number;
  /** Fine-grained per-domain override (candidate units only). */
  ratingForDomain?: (unit: string, domainKey: string) => number;
  /** Called with every dispatched request (test spy). */
  onDispatch?: (req: D7WorkerRequest) => void;
};

/** A model-free Claude-worker double: returns VALID rater / adjudication records
 *  (as raw record TEXT — no observed dispatch metadata) for every (unit, role) the
 *  D7 judge dispatches. Typed to `Promise<string>` (narrower than, and assignable
 *  to, `D7WorkerDispatch`) so callers that wrap/mutate the returned text keep a
 *  string in hand. */
export function d7WorkerDouble(opts: D7WorkerDoubleOptions): (req: D7WorkerRequest) => Promise<string> {
  const ownerDir = resolve(REPOSITORY_ROOT, RUBRIC_OWNER_RUN_REL_PATH);
  return async (req) => {
    opts.onDispatch?.(req);
    const manifest = readManifest(opts.repositoryRoot, req.auditId);
    const auditDir = resolve(opts.repositoryRoot, rubricAuditDirRelPath(req.auditId));
    const isCalibration = req.kind === "calibration";

    // Domains + gates + cds for this unit.
    let domains: Record<string, unknown>;
    let cds: number;
    let gates: Record<string, unknown>;
    if (isCalibration) {
      // Reuse the owner-adjudicated reference primary domains (owner-run-compat:
      // 6 base gates, no layer-independence) — keeps the calibration item inside
      // the ±3.0 tolerance without a codex read.
      const owner = JSON.parse(readFileSync(resolve(ownerDir, `raw/primary/${req.unit}.json`), "utf8")) as Record<string, unknown>;
      domains = owner.domains as Record<string, unknown>;
      cds = Number(owner.chapter_diagnostic_score);
      gates = owner.gates as Record<string, unknown>;
    } else {
      const uniform = opts.ratingForUnit?.(req.unit) ?? 4;
      const built = syntheticDomains((key) => opts.ratingForDomain?.(req.unit, key) ?? uniform);
      domains = built.domains;
      cds = built.cds;
      gates = { ...baseGates(), ...layerIndependenceGate() };
    }

    if (req.role !== "adjudicator") {
      const envelope = raterBindingEnvelope({ repositoryRoot: opts.repositoryRoot, manifest, unit: req.unit, role: req.role });
      const record = {
        schema_version: envelope.schema_version,
        artifact_type: envelope.artifact_type,
        run_id: envelope.run_id,
        job_id: envelope.job_id,
        rater_role: envelope.rater_role,
        worker_task_id: envelope.worker_task_id,
        worker_session_id: envelope.worker_session_id,
        worker_dispatch_receipt_sha256: envelope.worker_dispatch_receipt_sha256,
        book: { book_id: envelope.book.book_id, source_book_title: "Fixture Source" },
        source_hash: envelope.source_hash,
        chapter: envelope.chapter,
        scope: envelope.scope,
        ...GENERIC_ANALYSIS,
        gates,
        domains,
        chapter_diagnostic_score: cds,
        diagnostic_band: rubricBand(cds),
      };
      return JSON.stringify(record, null, 2);
    }

    // Adjudicator: read the sealed blind pair; zero-disagreement adjudication.
    const penv = raterBindingEnvelope({ repositoryRoot: opts.repositoryRoot, manifest, unit: req.unit, role: "primary" });
    const primaryRaw = readFileSync(resolve(auditDir, `raw/primary/${req.unit}.json`), "utf8");
    const verificationRaw = readFileSync(resolve(auditDir, `raw/verification/${req.unit}.json`), "utf8");
    const sealRaw = readFileSync(resolve(auditDir, `jobs/${req.unit}.receipts/pair.seal.json`), "utf8");
    const record = {
      schema_version: "1.0.0",
      artifact_type: "chapterflow_standalone_chapter_adjudication",
      rater_role: "adjudicated",
      run_id: penv.run_id,
      source_hash: penv.source_hash,
      book: { book_id: penv.book.book_id, source_book_title: "Fixture Source" },
      chapter: penv.chapter,
      scope: penv.scope,
      blind_pair_seal_sha256: artifactSha256FromText(sealRaw),
      ...GENERIC_ANALYSIS,
      gates,
      domains,
      chapter_diagnostic_score: cds,
      diagnostic_band: rubricBand(cds),
      rater_agreement: {
        mean_absolute_subcriterion_difference: 0,
        maximum_subcriterion_difference: 0,
        chapter_diagnostic_score_difference: 0,
        gate_conflicts: [],
        disagreements: [],
        input_records: {
          primary_canonical_sha256: artifactSha256FromText(primaryRaw),
          verification_canonical_sha256: artifactSha256FromText(verificationRaw),
        },
      },
      confidence: {
        level: "high",
        rationale: "the blind pair agreed and the source review confirmed the ratings",
        supplied_chapter_completeness_ratio: 1.0,
        actual_book_ambiguity: "material",
        unresolved_issues: [],
      },
      calibration_changes: [],
    };
    return JSON.stringify(record, null, 2);
  };
}
