/**
 * Model bake-off — the PRIMARY selection judge (WP-702).
 *
 * The bake-off ranks candidates on the Claude-side D7 rubric-audit instrument,
 * NEVER on a codex model read. For each blinded candidate this module:
 *
 *   1. assembles its authored slot chapters into an APP-FAITHFUL audit package
 *      (quiz keys + explanations included) — through the SAME fail-closed
 *      integrity gate the ship gate uses (assembleAuditPackageFromChapters). A
 *      candidate missing a quiz key/explanation cannot assemble and is INELIGIBLE
 *      (d7Composite = null); keys are never synthesized, the read is never
 *      downgraded to a codex score;
 *   2. materializes the frozen rubric-audit batch (app-faithful docs + per-layer
 *      docs + hidden calibration item) via the D7 instrument;
 *   3. drives the D7 harness (rubricAuditHarness.ts — CONSUMED, never edited) to
 *      an adjudicated report: per (unit, role) it renders a self-contained rater
 *      task, LEAK-CHECKS it (the same forbidden-token gate every reviewer-visible
 *      bake-off artifact passes), dispatches it to an injected Claude worker, and
 *      ingests the returned record fail-closed through the existing validators;
 *   4. composes the deterministic report → a chapter-diagnostic composite.
 *
 * This module NEVER invokes a codex/API model. The only model turn is the
 * injected Claude worker (external isolated session in production; a double in
 * tests). Ingest ledgers every Claude-side call (WP-503, inside the harness).
 * The harness invocation is BOUNDED — exactly one dispatch per (unit, role), no
 * retry loop.
 */

import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { writeFileAtomic } from "../lib/atomicWrite.js";
import { normSlug } from "../lib/chapterPaths.js";
import type { ChapterV21 } from "../types.js";
import {
  AuditPackageAssemblyError,
  assembleAuditPackageFromChapters,
} from "./auditPackageAssembler.js";
import { assertNoIdentityLeak } from "./review.js";
import { combinedContentHash } from "./review.js";
import type { BlindLabel, CandidateD7JudgmentV1, CandidateD7ChapterResultV1 } from "./types.js";
import {
  buildRubricAuditReport,
  materializeRubricAuditBatch,
  rubricAuditDirRelPath,
  type RubricAuditBatchManifestV1,
} from "./migration/rubricAuditInstrument.js";
import {
  ingestAdjudicationRecord,
  ingestRaterRecord,
  renderRaterTaskDocument,
  summarizeAudit,
  type RubricAuditHarnessRole,
} from "./migration/rubricAuditHarness.js";
import type { JsonRecord } from "./migration/rubricAuditReceipts.js";

/**
 * The D7 selection band (WP-702): PINNED at 2.0 and DISTINCT from both the codex
 * advisory panel's ±3.7 noise band (BAKEOFF_NOISE_BAND) and the D7 instrument's
 * ±3.0 calibration tolerance. Two candidates whose D7 composites differ by at
 * most 2.0 are a tie deferred to the WP-705 tie-break ladder.
 */
export const D7_SELECTION_BAND = 2.0;

export class D7JudgeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "D7JudgeError";
  }
}

export type D7WorkerRole = RubricAuditHarnessRole;

/** One dispatch to an isolated Claude worker. The `task` is self-contained and
 *  has already passed the identity-leak check — the worker sees no model id,
 *  slug, slot, or filesystem path. Returns the worker's record JSON text. */
export type D7WorkerRequest = {
  auditId: string;
  bookId: string;
  label: BlindLabel;
  unit: string;
  role: D7WorkerRole;
  kind: "candidate" | "calibration";
  task: string;
};

export type D7WorkerDispatch = (req: D7WorkerRequest) => Promise<string>;

/** The default worker is fail-closed: the bake-off PRIMARY judge is the Claude-
 *  side D7 instrument, and its rating is NEVER a codex read and NEVER a stubbed
 *  score. An automated run must inject a real Claude-worker dispatch (the
 *  execution lane, WP-703, wires the isolated-session dispatch); absent one, the
 *  judge refuses rather than fabricate. */
export const unwiredD7Worker: D7WorkerDispatch = async (req) => {
  throw new D7JudgeError(
    `D7 judge has no Claude-worker dispatch wired (unit ${req.unit} ${req.role}). The bake-off primary ` +
      "judge is the Claude-side D7 rubric-audit instrument — its rating is never a codex read and never a " +
      "stubbed score. Inject a D7WorkerDispatch (deps.d7Worker) that drives an isolated Claude session.",
  );
};

export type JudgeCandidateD7Options = {
  bookId: string;
  label: BlindLabel;
  chapters: ChapterV21[];
  /** Git repo root — resolves the retained audit dir + the calibration reference
   *  doc + the WP-503 call ledger (via PIPELINE_REL). */
  repositoryRoot: string;
  /** Retained rubric-audit id (kebab). Stable per (run, label) so resume re-enters
   *  idempotently. */
  auditId: string;
  /** The hidden calibration reference unit (one of RUBRIC_CALIBRATION_REFERENCES). */
  calibrationUnit: string;
  /** Injected Claude-worker dispatch. Production wires an isolated session; tests
   *  inject a double. */
  worker: D7WorkerDispatch;
  /** Forbidden model-identity tokens; every rendered rater task is leak-checked
   *  against these BEFORE dispatch. */
  forbidden: string[];
  log?: (m: string) => void;
  heartbeat?: () => boolean;
};

/** Build the ineligible judgment (d7Composite null) — the candidate is out of the
 *  running. Never a codex fallback. */
function ineligible(opts: JudgeCandidateD7Options, reason: string): CandidateD7JudgmentV1 {
  return {
    schemaVersion: "model-bakeoff-candidate-d7-v1",
    label: opts.label,
    contentSha256: safeContentHash(opts.chapters),
    auditId: opts.auditId,
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
    ineligibleReason: reason,
    judgedAt: new Date().toISOString(),
  };
}

function safeContentHash(chapters: ChapterV21[]): string {
  try {
    return combinedContentHash(chapters);
  } catch {
    return "";
  }
}

/** Drive the Claude-side D7 harness to a chapter-diagnostic composite for ONE
 *  blinded candidate. Fail-closed: an unassemblable package or any harness/worker
 *  failure returns an INELIGIBLE judgment (d7Composite null) — never a stubbed
 *  score, never a codex read. */
export async function judgeCandidateD7(opts: JudgeCandidateD7Options): Promise<CandidateD7JudgmentV1> {
  const log = opts.log ?? (() => {});
  const bookId = normSlug(opts.bookId);
  const contentSha256 = safeContentHash(opts.chapters);

  // ── 1. Assemble the APP-FAITHFUL audit package (fail-closed on missing key/explanation)
  let pkg;
  try {
    pkg = assembleAuditPackageFromChapters({ bookId, chapters: opts.chapters });
  } catch (error) {
    if (error instanceof AuditPackageAssemblyError) {
      log(`[bakeoff] d7-judge ${opts.label}: INELIGIBLE — audit package could not fail-closed-assemble: ${error.message}`);
      return ineligible(opts, `audit package assembly refused: ${error.message}`);
    }
    throw error;
  }

  // rt702 R1: the calibration reference must be DISJOINT from the book under
  // test. A colliding unit id makes the candidate's raw records shadow the
  // calibration pass (d7RecordPath matches), starving its adjudication and
  // returning an opaque "audit incomplete" for every candidate. This is a
  // CONFIG error, not a candidate defect — throw (halting the run) instead of
  // returning ineligible, before materializing or dispatching anything.
  const candidateUnits = pkg.chapters.map((c) => `${bookId}-ch${String(c.number).padStart(2, "0")}`);
  if (candidateUnits.includes(opts.calibrationUnit)) {
    throw new D7JudgeError(
      `D7 calibration unit "${opts.calibrationUnit}" collides with a candidate chapter unit of ${bookId} ` +
        `(${candidateUnits.join(", ")}) — configure a calibrationUnit from a DIFFERENT book (rt702 R1).`,
    );
  }

  try {
    // ── 2. Materialize the frozen rubric-audit batch (docs + hidden calibration).
    const packageRelPath = `${rubricAuditDirRelPath(opts.auditId)}/candidate-package.json`;
    const packageAbs = resolve(opts.repositoryRoot, packageRelPath);
    mkdirSync(dirname(packageAbs), { recursive: true });
    writeFileAtomic(packageAbs, JSON.stringify(pkg, null, 2) + "\n");

    const chapterNumbers = pkg.chapters.map((c) => c.number);
    const materialization = materializeRubricAuditBatch({
      repositoryRoot: opts.repositoryRoot,
      auditId: opts.auditId,
      purpose: `bake-off D7 primary judge (label ${opts.label})`,
      packagePath: packageRelPath,
      chapterNumbers,
      calibrationUnit: opts.calibrationUnit,
      write: true,
    });
    const manifest = JSON.parse(readFileSync(materialization.manifestPath, "utf8")) as RubricAuditBatchManifestV1;

    // ── 3. Drive the harness: per (unit, role) render → leak-check → dispatch → ingest.
    const units: Array<{ unit: string; kind: "candidate" | "calibration" }> = [
      ...manifest.chapters.map((c) => ({ unit: c.unit, kind: "candidate" as const })),
      { unit: manifest.calibration.unit, kind: "calibration" as const },
    ];
    const auditDir = resolve(opts.repositoryRoot, rubricAuditDirRelPath(opts.auditId));
    const roleOrder: D7WorkerRole[] = ["primary", "verification", "adjudicator"];
    for (const { unit, kind } of units) {
      if (opts.heartbeat && !opts.heartbeat()) {
        return ineligible(opts, "lost the run lock during the D7 audit");
      }
      for (const role of roleOrder) {
        const existingPath = d7RecordPath(auditDir, unit, role);
        if (existingPath !== null) {
          // Idempotent resume: NEVER re-dispatch the worker (a real Claude session
          // returns different bytes, which the immutable-evidence store rejects).
          // A rater record retained from a prior partial run is RE-INGESTED from its
          // persisted bytes so maybeSealPair re-mints the blind-pair seal if the
          // prior run crashed between persisting the pair and sealing it.
          if (role !== "adjudicator") {
            ingestRaterRecord({
              repositoryRoot: opts.repositoryRoot, manifest, unit, role,
              recordText: readFileSync(existingPath, "utf8"),
            });
          }
          continue;
        }
        // renderRaterTaskDocument for `adjudicator` reads the sealed blind pair,
        // so primary+verification MUST be ingested first (roleOrder guarantees it).
        const task = renderRaterTaskDocument({ repositoryRoot: opts.repositoryRoot, manifest, unit, role });
        assertNoIdentityLeak(task, opts.forbidden, `D7 ${role} task (label ${opts.label}, unit ${unit})`);
        const recordText = await opts.worker({
          auditId: opts.auditId, bookId, label: opts.label, unit, role, kind, task,
        });
        if (role === "adjudicator") {
          ingestAdjudicationRecord({ repositoryRoot: opts.repositoryRoot, manifest, unit, recordText });
        } else {
          ingestRaterRecord({ repositoryRoot: opts.repositoryRoot, manifest, unit, role, recordText });
        }
      }
    }

    // ── 4. Compose the deterministic report → chapter-diagnostic composite.
    const status = summarizeAudit({ repositoryRoot: opts.repositoryRoot, manifest });
    if (!status.allComplete) {
      const missing = status.units.filter((u) => !u.complete).map((u) => `${u.unit}[${u.missing.join(",")}]`);
      return ineligible(opts, `D7 audit is incomplete: ${missing.join("; ")}`);
    }
    const adjudications = new Map<string, JsonRecord>();
    for (const chapter of manifest.chapters) {
      adjudications.set(
        chapter.unit,
        JSON.parse(readFileSync(resolve(auditDir, `raw/adjudicated/${chapter.unit}.json`), "utf8")) as JsonRecord,
      );
    }
    const calibrationAdjudication = JSON.parse(
      readFileSync(resolve(auditDir, `calibration/${manifest.calibration.unit}.adjudicated.json`), "utf8"),
    ) as JsonRecord;

    const report = buildRubricAuditReport({ manifest, adjudications, calibrationAdjudication });
    const chapters: CandidateD7ChapterResultV1[] = report.chapters.map((chapter) => {
      const binding = manifest.chapters.find((c) => c.unit === chapter.unit);
      return {
        unit: chapter.unit,
        chapterNumber: binding?.chapterNumber ?? 0,
        chapterDiagnostic: chapter.chapterDiagnostic,
        coreDomainMin: chapter.coreDomainMin,
        coreDomainsPass: chapter.coreDomainsPass,
        gatesPass: chapter.gatesPass,
        layerIndependencePass: chapter.layerIndependencePass,
        pass: chapter.pass,
      };
    });
    log(
      `[bakeoff] d7-judge ${opts.label}: composite ${report.summary.mean.toFixed(2)} (min ${report.summary.min.toFixed(2)}, ` +
        `verdict ${report.summary.verdict}, gates ${report.summary.allGatesPass ? "pass" : "FAIL"}, ` +
        `layer-independence ${report.summary.allLayerIndependencePass ? "pass" : "FAIL"}, ` +
        `calibration ${report.summary.calibrationPass ? "pass" : "FAIL"})`,
    );
    return {
      schemaVersion: "model-bakeoff-candidate-d7-v1",
      label: opts.label,
      contentSha256,
      auditId: opts.auditId,
      d7Composite: report.summary.mean,
      d7CoreDomainMins: chapters.map((c) => c.coreDomainMin),
      d7GatesPass: report.summary.allGatesPass,
      d7LayerIndependencePass: report.summary.allLayerIndependencePass,
      allCoreDomainsPass: report.summary.allCoreDomainsPass,
      min: report.summary.min,
      meanPass: report.summary.meanPass,
      minPass: report.summary.minPass,
      calibrationPass: report.summary.calibrationPass,
      verdict: report.summary.verdict,
      chapters,
      judgedAt: new Date().toISOString(),
    };
  } catch (error) {
    // A worker/ingest/report failure disqualifies THIS candidate (d7Composite
    // null) — the run continues and reports the reason; it never silently reverts
    // to the codex advisory composite.
    const message = error instanceof Error ? error.message : String(error);
    log(`[bakeoff] d7-judge ${opts.label}: INELIGIBLE — D7 audit could not be driven to a composite: ${message}`);
    return ineligible(opts, `D7 audit failed: ${message}`);
  }
}

/** The persisted-record path for (unit, role) if it exists, else null. The
 *  calibration unit's adjudication lands under calibration/, a chapter's under
 *  raw/adjudicated/. */
function d7RecordPath(auditDir: string, unit: string, role: D7WorkerRole): string | null {
  const candidates = role === "adjudicator"
    ? [`raw/adjudicated/${unit}.json`, `calibration/${unit}.adjudicated.json`]
    : [`raw/${role}/${unit}.json`];
  for (const rel of candidates) {
    const abs = resolve(auditDir, rel);
    if (existsSync(abs)) return abs;
  }
  return null;
}
