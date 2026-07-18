/**
 * Stage 0b — D7-lite calibration drill driver (protocol
 * docs/v25/implementation/V25_CHAPTER_EXPERIMENT_PROTOCOL.md §4 + §10.1-P3;
 * results context docs/v25/implementation/V25_STAGE0B_DRILL_RESULTS.md).
 *
 * D7-lite = ONE single-rater GPT-5.6 Sol @ ultra rubric-audit session per drill
 * unit — the "primary"-role rater task of the EXISTING rubric-audit harness
 * (renderRaterTaskDocument → codex ultra dispatch → ingestRaterRecord), NEVER
 * the full 3-role primary/verification/adjudicator choreography. The score per
 * unit is the DERIVED chapter diagnostic (deriveRecordAggregates — the atomic
 * 0-4 ratings are ground truth; V25-AUD-02/04 derive-don't-reject), compared to
 * the unit's owner-adjudicated anchor with the D7 instrument's own ±3.0
 * calibration tolerance (RUBRIC_AUDIT_BAR_D7.calibrationTolerance — reused,
 * never retyped).
 *
 * Registered drill units (protocol §5 Stage-0b row + §10.1-P3):
 *   1. made-to-stick-ch04            — mid-band legacy anchor (67.6644…)
 *   2. the-happiness-hypothesis-ch06 — the 2026-07-15 sealed reference filling
 *      the HIGH-BAND slot (68.8158…) — see D7LITE_HIGH_BAND_NOTE: the sealed
 *      owner-adjudicated set contains NO unit in the ~85-92 band, so true
 *      high-band coverage is NOT achievable from it (reported, not fabricated).
 *   3. nudge-ch03                    — drift unit (70.7566…)
 *
 * All anchor values are resolved from RUBRIC_CALIBRATION_REFERENCES (the sealed
 * run 20260715T110908Z constants) — never hand-typed here.
 *
 * P3 verdict (protocol §10.1): every drill unit shows |derived − anchor| ≤ 3.0
 * → decision-rule 7 stays ALIVE; ANY miss (or an incomplete drill — fail
 * closed) → rule 7 is DROPPED as uncalibrated and D7-lite is descriptive-only.
 *
 * Contract mirrors run-stage0b-calibration.mts: fail-closed --execute-live
 * flag (default prints the plan and spawns NOTHING); hard session cap
 * (D7LITE_SESSION_CAP = 5) checked BEFORE each spawn; the ultra-acceptance
 * probe sidecar from the E-drill is REUSED through the validated reuse path
 * (isValidUltraProbe — a stale/hand-planted sidecar is re-probed, never
 * trusted); every real spawn is ledgered by the codex dispatch itself
 * (sessionKind "session"; a resume re-ingest is "reingest" and never counts as
 * spend); summary JSON lands at
 * state/model-bakeoffs/_campaign/stage0b/d7lite-drill-summary-<runHash>.json.
 *
 * MODEL-FREE at import/typecheck time; a live call happens only under
 * --execute-live (orchestrator-owned).
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { PIPELINE_DIR } from "../../src/bakeoff/paths.js";
import {
  normalizeD7WorkerReturn,
  type D7WorkerDispatch,
} from "../../src/bakeoff/d7Judge.js";
import type { BlindLabel } from "../../src/bakeoff/types.js";
import { createD7CodexWorkerDispatch } from "../../src/bakeoff/d7WorkerDispatch.js";
import { resolveD7RaterRoute } from "../../src/orchestrator/modelPolicy.js";
import {
  PIPELINE_REL,
  RUBRIC_CALIBRATION_REFERENCES,
  deriveRecordAggregates,
} from "../../src/bakeoff/migration/rubricAuditInstrument.js";
import {
  ingestRaterRecord,
  renderRaterTaskDocument,
} from "../../src/bakeoff/migration/rubricAuditHarness.js";
import { loadRecord } from "../../src/bakeoff/migration/rubricAuditReceipts.js";
import {
  D7LITE_TOLERANCE,
  calibrationOnlyManifest,
  defaultProbeGate,
  toIngestMeta,
  type D7LiteProbeGateResult,
} from "./d7liteCore.mjs";

// The shared D7-lite core (extracted from this driver so the Stage-1 screening
// driver reuses the exact same mechanics) — re-exported so this driver's public
// surface (and its test imports) are unchanged by the refactor.
export { D7LITE_TOLERANCE, calibrationOnlyManifest, type D7LiteProbeGateResult } from "./d7liteCore.mjs";

// ── Registered drill constants ──────────────────────────────────────────────────

/** Hard session cap for the whole drill (probe spawn, if any, counts). The
 *  owner authorization is 3 D7-lite sessions; 5 leaves headroom for a fresh
 *  probe without ever letting a retry loop exist (there is none — one session
 *  per unit, fail-closed). */
export const D7LITE_SESSION_CAP = 5;

export type D7LiteDrillBand = "mid-band-legacy" | "high-band-reference" | "drift";

export type D7LiteDrillUnitSpec = {
  unit: string;
  band: D7LiteDrillBand;
  label: BlindLabel;
  /** The sealed owner-adjudicated chapter diagnostic this unit is compared to. */
  anchorValue: number;
};

/**
 * BAND-COVERAGE FINDING (reported, not papered over): protocol §5's Stage-0b
 * row asks for "≥1 high-band unit from the sealed 2026-07-15 owner-adjudicated
 * reference set (~90 band)", but the sealed set (docs/v25/rubric-audit-2026-07-15,
 * run 20260715T110908Z) contains EXACTLY three units, all adjudicated in the
 * 67.7-70.8 band (nudge-ch03 70.756, the-happiness-hypothesis-ch06 68.816,
 * made-to-stick-ch04 67.664). The "~90" traces to the anchor BOOKS' portfolio
 * scores, which Stage-0b measured as NOT transferring to the chapter construct
 * (V25_STAGE0B_DRILL_RESULTS.md — mean(A_high) = 70.59). The high-band slot is
 * therefore filled by the only remaining sealed owner-adjudicated reference
 * (the-happiness-hypothesis-ch06, 68.8158…): the P3 |Δ| ≤ 3.0 comparison stays
 * well-defined against a true owner adjudication, but TRUE ~85-92 coverage
 * (red-team F2's concern — a 75 threshold validated only at mid-band) is NOT
 * achieved and rule 7's 75 gate keeps that caveat wherever it is reported.
 */
export const D7LITE_HIGH_BAND_NOTE =
  "high-band slot filled by the-happiness-hypothesis-ch06 (owner-adjudicated 68.8158) — the sealed 2026-07-15 set " +
  "contains NO ~85-92 unit (all three adjudications sit at 67.7-70.8; the protocol's '~90 band' traces to book " +
  "portfolio scores Stage-0b proved do not transfer to the chapter construct). True high-band calibration coverage " +
  "for decision-rule 7's 75 floor is NOT achieved by this drill; the caveat travels with every rule-7 report.";

function anchorFor(unit: string): number {
  const ref = RUBRIC_CALIBRATION_REFERENCES.find((r) => r.unit === unit);
  if (ref === undefined) {
    throw new Error(`drill unit '${unit}' is not one of the sealed owner-adjudicated calibration references`);
  }
  return ref.expectedChapterDiagnostic;
}

/** The three registered drill units, in dispatch order. Anchors resolved from
 *  the sealed-run constants at module init (a typo here cannot invent a unit). */
export const D7LITE_DRILL_UNITS: readonly D7LiteDrillUnitSpec[] = [
  { unit: "made-to-stick-ch04", band: "mid-band-legacy", label: "A", anchorValue: anchorFor("made-to-stick-ch04") },
  { unit: "the-happiness-hypothesis-ch06", band: "high-band-reference", label: "B", anchorValue: anchorFor("the-happiness-hypothesis-ch06") },
  { unit: "nudge-ch03", band: "drift", label: "C", anchorValue: anchorFor("nudge-ch03") },
];

const REPO_ROOT = resolve(PIPELINE_DIR, "..", "..", "..", "..");
const RUN_HASH_RE = /^[a-z0-9][a-z0-9-]*$/;

// ── Drill result types ──────────────────────────────────────────────────────────

export type D7LiteUnitOutcomeV1 = {
  unit: string;
  band: D7LiteDrillBand;
  anchorValue: number;
  /** The DERIVED chapter diagnostic from the ingested record's atomic ratings
   *  (null when the unit never completed — dispatch/ingest failure or skip). */
  derivedDiagnostic: number | null;
  delta: number | null;
  pass: boolean;
  raterModel: string | null;
  raterEffort: string | null;
  sessionKind: "session" | "reingest" | null;
  attemptIndex: number | null;
  persistedPath: string | null;
  error: string | null;
  skipped: string | null;
};

export type D7LiteDrillSummaryV1 = {
  schema: "v25-d7lite-drill-summary-v1";
  at: string;
  runHash: string;
  auditId: string;
  tolerance: number;
  sessionsSpent: number;
  sessionCap: number;
  probe: { ok: boolean; reused: boolean | null; sidecarSha256: string | null; detail: string | null };
  raterModels: string[];
  units: D7LiteUnitOutcomeV1[];
  verdict: {
    allUnitsComplete: boolean;
    allPass: boolean;
    /** P3: alive ⇔ the drill COMPLETED and every unit's |Δ| ≤ tolerance;
     *  anything else — a miss, an error, a halt — drops rule 7 (fail closed). */
    rule7: "alive" | "dropped";
    detail: string;
  };
  bandNote: string;
  note: string;
};

export type D7LiteDrillRunResultV1 = {
  summary: D7LiteDrillSummaryV1;
  outPath: string | null;
  /** 0 drill complete (either verdict); 2 probe gate failed; 3 budget halt;
   *  4 rater-uniformity halt; 5 a unit's session/ingest failed (fail-closed). */
  exitCode: number;
};

export type D7LiteDrillDeps = {
  /** The D7 rating dispatch (default: the production Sol-ultra codex dispatch,
   *  createD7CodexWorkerDispatch). Tests inject a double — nothing spawns. */
  dispatch?: D7WorkerDispatch;
  /** Repo root the harness resolves sealed docs + custody under (default: this
   *  checkout's root). Tests inject a temp root. */
  repositoryRoot?: string;
  /** Summary sink dir (default <repositoryRoot>/<PIPELINE_REL>/state/model-bakeoffs/_campaign/stage0b). */
  outDir?: string;
  /** Probe gate seam (default: E-drill sidecar reuse + live probe fallback). */
  probeGate?: (probeDir: string, log: (m: string) => void) => Promise<D7LiteProbeGateResult>;
  log?: (m: string) => void;
  clock?: () => Date;
};

// ── The drill ───────────────────────────────────────────────────────────────────

export async function runD7LiteDrill(args: {
  runHash: string;
  sessionCap?: number;
  deps?: D7LiteDrillDeps;
}): Promise<D7LiteDrillRunResultV1> {
  const { runHash } = args;
  if (!RUN_HASH_RE.test(runHash)) throw new Error(`runHash '${runHash}' must be kebab-case [a-z0-9-]`);
  const sessionCap = args.sessionCap ?? D7LITE_SESSION_CAP;
  const deps = args.deps ?? {};
  const log = deps.log ?? ((m: string) => process.stdout.write(`${m}\n`));
  const clock = deps.clock ?? (() => new Date());
  const repositoryRoot = resolve(deps.repositoryRoot ?? REPO_ROOT);
  const pipelineDir = resolve(repositoryRoot, PIPELINE_REL);
  const outDir = deps.outDir ?? resolve(pipelineDir, "state", "model-bakeoffs", "_campaign", "stage0b");
  const probeDir = resolve(pipelineDir, "state", "model-bakeoffs", "_campaign", "ultra-acceptance");
  const probeGate = deps.probeGate ?? defaultProbeGate;
  const dispatch = deps.dispatch ?? createD7CodexWorkerDispatch({ pipelineDir, log });
  const auditId = `d7lite-${runHash}`;

  let sessionsSpent = 0;
  const raterModels = new Set<string>();
  const units: D7LiteUnitOutcomeV1[] = [];
  let budgetHalt = false;
  let uniformityHalt = false;
  let unitFailure = false;

  const blank = (spec: D7LiteDrillUnitSpec): D7LiteUnitOutcomeV1 => ({
    unit: spec.unit,
    band: spec.band,
    anchorValue: spec.anchorValue,
    derivedDiagnostic: null,
    delta: null,
    pass: false,
    raterModel: null,
    raterEffort: null,
    sessionKind: null,
    attemptIndex: null,
    persistedPath: null,
    error: null,
    skipped: null,
  });

  // ── Probe gate BEFORE any rating spawn (fail closed). ──
  const probe = await probeGate(probeDir, log);
  sessionsSpent += probe.sessionsSpent;
  if (!probe.ok) {
    log(`[d7lite] ULTRA PROBE GATE FAILED — no rating session spawned. ${probe.detail}`);
    for (const spec of D7LITE_DRILL_UNITS) units.push({ ...blank(spec), skipped: "probe gate failed" });
    const summary = buildSummary();
    const outPath = writeSummary(summary);
    return { summary, outPath, exitCode: 2 };
  }

  // ── One single-rater "primary" session per registered unit. ──
  for (const spec of D7LITE_DRILL_UNITS) {
    const outcome = blank(spec);
    units.push(outcome);
    if (uniformityHalt) {
      outcome.skipped = "rater-uniformity halt";
      continue;
    }
    if (sessionsSpent + 1 > sessionCap) {
      budgetHalt = true;
      outcome.skipped = `BUDGET HALT: ${sessionsSpent}/${sessionCap} sessions spent — the next spawn would breach the cap`;
      log(`[d7lite] ${outcome.skipped} (unit ${spec.unit} not dispatched)`);
      continue;
    }

    const manifest = calibrationOnlyManifest(auditId, spec.unit);
    log(`[d7lite] [${spec.label}] ${spec.unit} (${spec.band}, anchor ${spec.anchorValue}) — rendering primary rater task…`);
    try {
      const task = renderRaterTaskDocument({ repositoryRoot, manifest, unit: spec.unit, role: "primary" });
      const ret = await dispatch({
        auditId,
        bookId: spec.unit,
        label: spec.label,
        unit: spec.unit,
        role: "primary",
        kind: "calibration",
        task,
        attempt: 1,
      });
      const { record, dispatchMeta } = normalizeD7WorkerReturn(ret);
      const spendKind = dispatchMeta?.sessionKind ?? "session"; // no observed meta ⇒ count conservatively
      if (spendKind !== "reingest") sessionsSpent += 1;
      outcome.sessionKind = spendKind;
      outcome.raterModel = dispatchMeta?.model ?? null;
      outcome.raterEffort = dispatchMeta?.effort ?? null;
      outcome.attemptIndex = dispatchMeta?.attemptIndex ?? null;
      if (outcome.raterModel !== null) raterModels.add(outcome.raterModel);

      const ingest = ingestRaterRecord({
        repositoryRoot,
        manifest,
        unit: spec.unit,
        role: "primary",
        recordText: record,
        dispatchMeta: toIngestMeta(dispatchMeta),
      });
      outcome.persistedPath = ingest.persistedPath;

      const derived = deriveRecordAggregates(loadRecord(record).value);
      if (derived === null) {
        // Unreachable after a valid ingest (atomic ratings are hard-required);
        // fail closed rather than fall back to a self-reported number.
        throw new Error("ingested record yielded no derivable aggregates (atomic ratings missing)");
      }
      outcome.derivedDiagnostic = derived.chapterDiagnostic;
      outcome.delta = Math.abs(derived.chapterDiagnostic - spec.anchorValue);
      outcome.pass = outcome.delta <= D7LITE_TOLERANCE;
      log(
        `[d7lite] [${spec.label}] ${spec.unit}: derived=${derived.chapterDiagnostic} anchor=${spec.anchorValue} ` +
          `|Δ|=${outcome.delta} → ${outcome.pass ? "PASS" : "MISS"} (tolerance ${D7LITE_TOLERANCE}; ${outcome.sessionKind}; ${outcome.raterModel ?? "?"}@${outcome.raterEffort ?? "?"})`,
      );
    } catch (err) {
      // A dispatch throw may have spent a real session (the codex dispatch
      // ledgers before rethrowing) — count it conservatively, never under.
      if (outcome.sessionKind === null) {
        sessionsSpent += 1;
        outcome.sessionKind = "session";
      }
      unitFailure = true;
      outcome.error = (err as Error).message;
      log(`[d7lite] [${spec.label}] ${spec.unit}: FAILED fail-closed — ${outcome.error.split("\n")[0]}`);
    }

    if (raterModels.size > 1) {
      uniformityHalt = true;
      log("[d7lite] UNIFORMITY HALT: more than one resolved rater model in the drill — stratify + owner decision (protocol §10.2b).");
    }
  }

  const summary = buildSummary();
  const outPath = writeSummary(summary);
  log(`[d7lite] drill summary → ${outPath}`);
  log(`D7LITE_DRILL_SUMMARY ${JSON.stringify(summary)}`);
  const exitCode = uniformityHalt ? 4 : unitFailure ? 5 : budgetHalt ? 3 : 0;
  return { summary, outPath, exitCode };

  function buildSummary(): D7LiteDrillSummaryV1 {
    const allUnitsComplete =
      units.length === D7LITE_DRILL_UNITS.length && units.every((u) => u.derivedDiagnostic !== null);
    const allPass = allUnitsComplete && units.every((u) => u.pass);
    const rule7: "alive" | "dropped" = allPass ? "alive" : "dropped";
    return {
      schema: "v25-d7lite-drill-summary-v1",
      at: clock().toISOString(),
      runHash,
      auditId,
      tolerance: D7LITE_TOLERANCE,
      sessionsSpent,
      sessionCap,
      probe: probe.ok
        ? { ok: true, reused: probe.reused, sidecarSha256: probe.sidecarSha256, detail: null }
        : { ok: false, reused: null, sidecarSha256: null, detail: probe.detail },
      raterModels: [...raterModels],
      units,
      verdict: {
        allUnitsComplete,
        allPass,
        rule7,
        detail: allPass
          ? `all ${units.length} drill units within |Δ| ≤ ${D7LITE_TOLERANCE} — decision-rule 7's 75 gate stays alive (with the high-band coverage caveat)`
          : `rule 7 DROPPED as uncalibrated — D7-lite is descriptive-only (protocol §10.1-P3): ` +
            (allUnitsComplete
              ? `unit(s) missed the ±${D7LITE_TOLERANCE} tolerance: ${units.filter((u) => !u.pass).map((u) => u.unit).join(", ")}`
              : `the drill did not complete all ${D7LITE_DRILL_UNITS.length} units (fail closed)`),
      },
      bandNote: D7LITE_HIGH_BAND_NOTE,
      note: "CHAPTER DIAGNOSTIC — NOT A BOOK SCORE. Single-rater D7-lite sessions; secondary instrument (protocol §3.2).",
    };
  }

  function writeSummary(summary: D7LiteDrillSummaryV1): string {
    mkdirSync(outDir, { recursive: true });
    const outPath = resolve(outDir, `d7lite-drill-summary-${runHash}.json`);
    writeFileSync(outPath, `${JSON.stringify(summary, null, 2)}\n`);
    return outPath;
  }
}

// ── CLI ─────────────────────────────────────────────────────────────────────────

function printDryPlan(runHash: string): number {
  const log = (m: string) => process.stdout.write(`${m}\n`);
  log(`D7-lite drill — DRY PLAN (no --execute-live: nothing spawns, nothing is written)`);
  log(`  route ${JSON.stringify(resolveD7RaterRoute())}; session cap ${D7LITE_SESSION_CAP}; tolerance ±${D7LITE_TOLERANCE}`);
  log(`  auditId d7lite-${runHash}; summary → state/model-bakeoffs/_campaign/stage0b/d7lite-drill-summary-${runHash}.json`);
  log(`  probe: reuse the E-drill ultra-acceptance sidecar via the validated path (re-probe only if invalid/absent)`);
  log(`  BAND NOTE: ${D7LITE_HIGH_BAND_NOTE}`);
  let blockers = 0;
  for (const spec of D7LITE_DRILL_UNITS) {
    const manifest = calibrationOnlyManifest(`d7lite-${runHash}`, spec.unit);
    try {
      const task = renderRaterTaskDocument({ repositoryRoot: REPO_ROOT, manifest, unit: spec.unit, role: "primary" });
      log(
        `  [${spec.label}] ${spec.unit} (${spec.band}) anchor=${spec.anchorValue} ` +
          `doc=${manifest.calibration.docRelPath} sha=OK task=${task.length} chars → 1 primary Sol-ultra session`,
      );
    } catch (err) {
      blockers += 1;
      log(`  [${spec.label}] ${spec.unit} (${spec.band}) BLOCKER: ${(err as Error).message.split("\n")[0]}`);
    }
  }
  log(`  live command: env -u OPENAI_API_KEY npx tsx scripts/screening/run-d7lite-drill.mts --execute-live --run-hash=${runHash}`);
  return blockers === 0 ? 0 : 6;
}

async function main(argv: string[]): Promise<number> {
  const executeLive = argv.includes("--execute-live");
  const runHash = (argv.find((a) => a.startsWith("--run-hash=")) ?? "").split("=")[1] || "d7l1";
  if (!RUN_HASH_RE.test(runHash)) {
    process.stderr.write(`--run-hash '${runHash}' must be kebab-case [a-z0-9-]\n`);
    return 2;
  }
  if (!executeLive) return printDryPlan(runHash);
  const { exitCode } = await runD7LiteDrill({ runHash });
  return exitCode;
}

// Execute ONLY when run as a script (never on import/typecheck).
const isMain = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((err) => {
      process.stderr.write(`[d7lite] UNEXPECTED: ${(err as Error).stack ?? String(err)}\n`);
      process.exit(1);
    });
}
