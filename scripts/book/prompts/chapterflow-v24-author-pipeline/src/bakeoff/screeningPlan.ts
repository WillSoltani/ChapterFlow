/**
 * WP-703 — the pre-registered Stage-1 screening plan (BUILD half).
 *
 * This module is the SINGLE SOURCE OF TRUTH for the Stage-1 screening: the exact
 * candidate configs, the three compare-only chapter-subset runs, the per-book
 * cross-book D7 calibration assignments (satisfying the rt702-R1 disjointness
 * guard), the session caps, the advancement bar, and the STOP rule. The plan is
 * pre-registered BEFORE any live call — the doc
 * `docs/v25/implementation/V25_BAKEOFF_STAGE1_SCREENING.md` and its machine-
 * readable companion `V25_BAKEOFF_STAGE1_SCREENING.plan.json` both derive from
 * `SCREENING_PLAN` here (a test binds the on-disk companion to `screeningPlanJson()`
 * byte-for-byte so the registered numbers can never silently drift).
 *
 * This file contains NO model call, NO live-capable verb, and NO screening
 * EXECUTION — the execution (live authoring + D7 audits) is orchestrator-owned
 * (out of the BUILD scope). What lives here is the registered DATA + the pure,
 * model-free decision functions the execution lane and the tests drive:
 *   - enumerateScreeningPlan()      — the dry-run enumeration (configs/runs/caps)
 *   - calibrationCollision()        — the rt702-R1 disjointness check per run
 *   - dropProbeFailedConfigs()      — probe-fail ⇒ dropped + recorded, never substituted
 *   - ScreeningSessionBudget        — halts BEFORE a session that would breach a cap
 *   - decideAdvancement()           — mechanical bar → advance ≤3 (highest means first) or STOP
 *
 * The advancement bar and STOP rule are the ratified D-3 acknowledgment-(ii)
 * terms (ledger L-37): the bar is NEVER lowered mid-flight; a zero-passing
 * screening HALTS with an owner escalation (audit change-condition C→D).
 */

/** Machine-readable companion schema id (the on-disk `.plan.json` carries it). */
export const SCREENING_PLAN_SCHEMA = "v25-bakeoff-stage1-screening-plan-v1" as const;

export type ReasoningEffortLevel = "minimal" | "low" | "medium" | "high" | "xhigh";

/** One screening CONFIG = a (model family, effort) pair the bakeoff authors a
 *  candidate chapter with. All four are probe-SUPPORTED per L-39 /
 *  docs/v25/reports/V25_CAPABILITY_PROBE_RESULTS.md. */
export type ScreeningConfig = {
  /** Stable config id used across the plan, the ledger, and the report. */
  id: string;
  family: string;
  effort: ReasoningEffortLevel;
  /** The WP-502 live capability probe verdict for this exact (family, effort). */
  probeSupported: boolean;
};

/** How ONE registered book-run decomposes into `runBakeoff` invocations. The
 *  conductor pins ONE effort + a UNIQUE model-id set per invocation
 *  (runBakeoff.ts: `if (new Set(models).size !== models.length) throw` + a single
 *  `opts.effort`), so a book-run whose four configs include the SAME family at
 *  two efforts (sol@high + sol@xhigh) cannot be one invocation. It decomposes
 *  into: an xhigh trio (sol/terra/luna @ xhigh) + a high solo (sol @ high). Both
 *  invocations of a book share the book's disjoint calibration unit. */
export type ConductorInvocation = {
  runId: string;
  models: string[];
  effort: ReasoningEffortLevel;
  /** Config ids this invocation authors (subset of the run's `configIds`). */
  configIds: string[];
};

/** One registered COMPARE-ONLY chapter-subset run (one per corpus book). */
export type ScreeningRun = {
  /** Human/registry id for the book-run (distinct from the conductor runIds). */
  id: string;
  bookId: string;
  /** The single frozen chapter number under test (a strict subset ⇒ compare-only). */
  chapters: number[];
  /** The corpus unit under test (bookId-ch<nn>). */
  unit: string;
  /** The hidden D7 calibration reference unit — from a book DISJOINT from
   *  `bookId` (rt702-R1). Never collides with `unit`. */
  calibrationUnit: string;
  /** Why this calibration unit (registered rationale). */
  calibrationRationale: string;
  /** The four config ids this book-run screens. */
  configIds: string[];
  /** The fixed, NON-BLOCKING, blinded advisory codex judge for this run's
   *  invocations (a supported 5.6 id; never the retired baseline family). Advisory only — it never
   *  changes eligibility or the D7-primary ranking (WP-702). */
  advisoryJudge: { model: string; effort: ReasoningEffortLevel };
  /** The concrete runBakeoff invocations this book-run expands into. */
  conductorInvocations: ConductorInvocation[];
};

export type ScreeningCaps = {
  /** The 12 planned authoring runs (4 configs × 3 chapters × 1 sample). */
  plannedAuthoringRuns: number;
  /** HARD cap on authoring runs (planned 12 + headroom for the odd re-emit). */
  maxAuthoringRuns: number;
  /** HARD cap on TOTAL sessions (authoring + repairs + D7 dispatches accounted
   *  in the unified ledger for this campaign phase). */
  maxTotalSessions: number;
};

export type ScreeningBar = {
  /** VERBATIM registered advancement bar (D-3 acknowledgment (ii), L-37). */
  statement: string;
  /** A config advances only with ZERO hard-gate (deterministic floor + D7 gate)
   *  failures. */
  hardGateFailuresAllowed: 0;
  /** …AND a D7 chapter-diagnostic mean at or above this floor. */
  d7ChapterDiagnosticMeanMin: number;
  /** At most this many configs advance to Stage-2 (WP-704). */
  maxAdvance: number;
  /** Ordering among advancers. */
  ordering: "highest-d7-mean-first";
};

export type ScreeningStopRule = {
  statement: string;
  /** The audit change-condition transition a STOP triggers. */
  changeCondition: "C->D";
  /** Registered invariant: the bar is never lowered to manufacture an advancer. */
  barNeverLowered: true;
};

/** The unified-ledger accounting contract. The running total is READ FROM the
 *  ledger (state/run-ledger/**), never hardcoded here. */
export type ScreeningLedgerAccounting = {
  /** The owner-authorized hard ceiling for the whole Phase-6 campaign (D-3, L-37). */
  campaignSessionCeiling: number;
  /** WHERE the authoritative running total lives (WP-503). */
  ledgerSourceOfTruth: string;
  /** WHAT counts against the ceiling. */
  countsAgainstCeiling: string;
  /** The enforcement rule. */
  enforcement: string;
};

export type ScreeningPlan = {
  schema: typeof SCREENING_PLAN_SCHEMA;
  corpusId: string;
  corpusManifestRelPath: string;
  configs: ScreeningConfig[];
  runs: ScreeningRun[];
  caps: ScreeningCaps;
  advancementBar: ScreeningBar;
  stopRule: ScreeningStopRule;
  ledgerAccounting: ScreeningLedgerAccounting;
  /** Registered blinding requirements (mirror the bakeoff harness's guarantees). */
  blinding: string[];
  /** Registered evidence/storage layout for the run trees. */
  evidenceLayout: string[];
};

// ── The registered plan (pre-registered BEFORE any live call) ─────────────────

const SOL_XHIGH: ScreeningConfig = { id: "gpt-5.6-sol@xhigh", family: "gpt-5.6-sol", effort: "xhigh", probeSupported: true };
const TERRA_XHIGH: ScreeningConfig = { id: "gpt-5.6-terra@xhigh", family: "gpt-5.6-terra", effort: "xhigh", probeSupported: true };
const LUNA_XHIGH: ScreeningConfig = { id: "gpt-5.6-luna@xhigh", family: "gpt-5.6-luna", effort: "xhigh", probeSupported: true };
const SOL_HIGH: ScreeningConfig = { id: "gpt-5.6-sol@high", family: "gpt-5.6-sol", effort: "high", probeSupported: true };

/** The fixed advisory codex judge for every screening invocation. A supported
 *  5.6 id (NEVER the retired baseline family). It is NON-BLOCKING + blinded: the PRIMARY judge is the
 *  Claude-side D7 rubric-audit instrument (WP-702), and the advisory read never
 *  changes eligibility or ranking. All three families author in every run, so an
 *  advisory judge that never coincides with a candidate is unavailable; blinding
 *  (opaque labels + the forbidden-token leak check) preserves independence and
 *  the non-blocking demotion makes any residual overlap immaterial. */
const ADVISORY_JUDGE = { model: "gpt-5.6-terra", effort: "high" as ReasoningEffortLevel };

const XHIGH_TRIO_MODELS = [SOL_XHIGH.family, TERRA_XHIGH.family, LUNA_XHIGH.family];
const XHIGH_TRIO_CONFIG_IDS = [SOL_XHIGH.id, TERRA_XHIGH.id, LUNA_XHIGH.id];

function bookRun(args: {
  id: string;
  bookId: string;
  chapter: number;
  calibrationUnit: string;
  calibrationRationale: string;
}): ScreeningRun {
  const nn = String(args.chapter).padStart(2, "0");
  const unit = `${args.bookId}-ch${nn}`;
  return {
    id: args.id,
    bookId: args.bookId,
    chapters: [args.chapter],
    unit,
    calibrationUnit: args.calibrationUnit,
    calibrationRationale: args.calibrationRationale,
    configIds: [SOL_XHIGH.id, TERRA_XHIGH.id, LUNA_XHIGH.id, SOL_HIGH.id],
    advisoryJudge: { ...ADVISORY_JUDGE },
    conductorInvocations: [
      { runId: `stage1-${unit}-xhigh-trio`, models: [...XHIGH_TRIO_MODELS], effort: "xhigh", configIds: [...XHIGH_TRIO_CONFIG_IDS] },
      { runId: `stage1-${unit}-sol-high`, models: [SOL_HIGH.family], effort: "high", configIds: [SOL_HIGH.id] },
    ],
  };
}

/** The registered Stage-1 screening plan. IMMUTABLE reference data — the caps,
 *  configs, calibration assignments, and bar are fixed before the first live call. */
export const SCREENING_PLAN: ScreeningPlan = {
  schema: SCREENING_PLAN_SCHEMA,
  corpusId: "bakeoff-corpus-v1",
  corpusManifestRelPath: "docs/v25/bakeoff-corpus-v1/corpus-manifest.json",
  configs: [SOL_XHIGH, TERRA_XHIGH, LUNA_XHIGH, SOL_HIGH],
  runs: [
    bookRun({
      id: "stage1-nudge-ch03",
      bookId: "nudge",
      chapter: 3,
      calibrationUnit: "made-to-stick-ch04",
      calibrationRationale:
        "made-to-stick-ch04 is a sealed corpus unit from a DIFFERENT book than nudge, so it can never collide with the nudge-ch03 candidate unit (rt702-R1); it is also the DEFAULT_D7_CALIBRATION_UNIT, valid here without an override.",
    }),
    bookRun({
      id: "stage1-made-to-stick-ch04",
      bookId: "made-to-stick",
      chapter: 4,
      calibrationUnit: "nudge-ch03",
      calibrationRationale:
        "the DEFAULT_D7_CALIBRATION_UNIT (made-to-stick-ch04) IS the unit under test here and would trip the rt702-R1 collision guard, so this run overrides to nudge-ch03 — the lowest-numbered sealed unit from a disjoint book (the-happiness-hypothesis-ch06 would also be disjoint; nudge-ch03 is the neutral default choice).",
    }),
    bookRun({
      id: "stage1-the-happiness-hypothesis-ch06",
      bookId: "the-happiness-hypothesis",
      chapter: 6,
      calibrationUnit: "made-to-stick-ch04",
      calibrationRationale:
        "made-to-stick-ch04 is a sealed corpus unit from a DIFFERENT book than the-happiness-hypothesis, so it can never collide with the the-happiness-hypothesis-ch06 candidate unit (rt702-R1); the DEFAULT_D7_CALIBRATION_UNIT is valid here without an override.",
    }),
  ],
  caps: {
    plannedAuthoringRuns: 12,
    maxAuthoringRuns: 18,
    maxTotalSessions: 40,
  },
  advancementBar: {
    statement:
      "A config advances to Stage-2 confirmation iff it has 0 hard-gate failures (deterministic floor AND D7 gate) AND a D7 chapter-diagnostic mean >= 75 across the 3 chapters. At most 3 configs advance, highest D7 means first.",
    hardGateFailuresAllowed: 0,
    d7ChapterDiagnosticMeanMin: 75,
    maxAdvance: 3,
    ordering: "highest-d7-mean-first",
  },
  stopRule: {
    statement:
      "If NO config meets the advancement bar, the screening STOPS and emits an owner-escalation note (a format/architecture question, not a model-quality retry). The bar is NEVER lowered to manufacture an advancer, and no model is ever substituted for a dropped one.",
    changeCondition: "C->D",
    barNeverLowered: true,
  },
  ledgerAccounting: {
    campaignSessionCeiling: 150,
    ledgerSourceOfTruth:
      "state/run-ledger/** (WP-503 unified per-run ledger). The running Phase-6 total is READ from the ledger slices — it is never hardcoded in this plan; the prior probe spend (L-39) is already recorded there.",
    countsAgainstCeiling:
      "every codex-exec authoring/repair session AND every Claude-side D7 rater/adjudicator dispatch (family claude-side), summed across all run-ledger slices for this campaign phase.",
    enforcement:
      "the execution lane reserves each session through ScreeningSessionBudget and checks the cumulative ledger total against the 150 ceiling BEFORE spawning; a would-be overshoot HALTS before the offending session (never a warning).",
  },
  blinding: [
    "Candidates are mapped to opaque labels (A/B/C…) once per run and the mapping lives only in the run manifest + final report, never in a reviewer-visible artifact.",
    "Every reviewer-visible artifact (D7 rater task, advisory review doc/task) passes the forbidden-token leak check (model ids, family suffixes, slugs, slots, price/tier words) BEFORE any dispatch — a leak is fail-closed, never a warning.",
    "The D7 hidden calibration unit is disjoint from the book under test (rt702-R1), so the calibration pass can never be shadowed by a candidate chapter.",
  ],
  evidenceLayout: [
    "Per conductor invocation: state/model-bakeoffs/<bookId>/<runId>/ — manifest.json (resume SoT), shared-inputs/ freeze record (combinedSha256), work/<slot>/ candidate chapters, reviews/<label>/d7.json (PRIMARY) + review.json (advisory), selection/selection.json, report.json + report.md.",
    "Per D7 audit: the retained rubric-audit tree under its auditId (bakeoff-<runId>-<label>) — batch manifest, per-(unit,role) rater/adjudication records, blind-pair seals.",
    "Ledger: state/run-ledger/<bookId>/<runId>.jsonl + <runId>.summary.json (WP-503) — one entry per codex authoring/repair session and per Claude-side D7 dispatch.",
    "The advancement/STOP decision record and the per-config D7 means are written alongside the plan doc as the Stage-1 outcome evidence.",
  ],
};

// ── Pure, model-free decision functions ───────────────────────────────────────

/** Canonical JSON serialization of the registered plan. The committed companion
 *  `V25_BAKEOFF_STAGE1_SCREENING.plan.json` is EXACTLY this string (a test binds
 *  the two byte-for-byte so the registered numbers cannot drift from code). */
export function screeningPlanJson(plan: ScreeningPlan = SCREENING_PLAN): string {
  return JSON.stringify(plan, null, 2) + "\n";
}

export type ScreeningEnumeration = {
  configIds: string[];
  runIds: string[];
  conductorRunIds: string[];
  caps: ScreeningCaps;
  advancementBar: ScreeningBar;
};

/** The plan/dry-run enumeration: exactly the registered configs, book-runs, the
 *  concrete conductor invocations, and the caps — no live call. */
export function enumerateScreeningPlan(plan: ScreeningPlan = SCREENING_PLAN): ScreeningEnumeration {
  return {
    configIds: plan.configs.map((c) => c.id),
    runIds: plan.runs.map((r) => r.id),
    conductorRunIds: plan.runs.flatMap((r) => r.conductorInvocations.map((i) => i.runId)),
    caps: plan.caps,
    advancementBar: plan.advancementBar,
  };
}

/** The rt702-R1 disjointness check for ONE run: the hidden D7 calibration unit
 *  MUST come from a book DIFFERENT from the run's book, or the candidate's raw
 *  records shadow the calibration pass and every candidate dies "audit
 *  incomplete". Returns a collision reason, or null when disjoint. Mirrors the
 *  runBakeoff/d7Judge guard (`calibrationUnit.startsWith(bookId + "-ch")`). */
export function calibrationCollision(run: Pick<ScreeningRun, "bookId" | "unit" | "calibrationUnit">): string | null {
  if (run.calibrationUnit === run.unit || run.calibrationUnit.startsWith(`${run.bookId}-ch`)) {
    return `D7 calibration unit "${run.calibrationUnit}" belongs to the book under test (${run.bookId}) — the rt702-R1 guard would fire; pick a disjoint sealed reference.`;
  }
  return null;
}

/** Assert every registered run's calibration assignment is collision-free.
 *  Throws with ALL collisions on the first offending plan (pre-registration
 *  invariant). */
export function assertNoCalibrationCollisions(plan: ScreeningPlan = SCREENING_PLAN): void {
  const collisions = plan.runs
    .map((r) => ({ run: r.id, reason: calibrationCollision(r) }))
    .filter((x) => x.reason !== null);
  if (collisions.length > 0) {
    throw new ScreeningPlanError(
      `registered plan has calibration collisions (rt702-R1): ${collisions.map((c) => `${c.run}: ${c.reason}`).join(" | ")}`,
    );
  }
}

export class ScreeningPlanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScreeningPlanError";
  }
}

/** A per-config live capability probe verdict (WP-502 / L-39). */
export type ProbeVerdict = { configId: string; supported: boolean; detail?: string };

export type ProbeScreeningResult = {
  advancing: ScreeningConfig[];
  dropped: Array<{ configId: string; reason: string }>;
};

/** Apply the WP-502 probe verdicts to the registered configs: a config whose
 *  probe FAILED is DROPPED and RECORDED — never silently substituted by another
 *  model (D-3 acknowledgment (i), L-37). A config with no probe verdict is treated
 *  as unproven and dropped (fail-closed), never assumed supported. */
export function dropProbeFailedConfigs(
  configs: ScreeningConfig[],
  probe: ProbeVerdict[],
): ProbeScreeningResult {
  const byId = new Map(probe.map((p) => [p.configId, p]));
  const advancing: ScreeningConfig[] = [];
  const dropped: Array<{ configId: string; reason: string }> = [];
  for (const config of configs) {
    const verdict = byId.get(config.id);
    if (verdict === undefined) {
      dropped.push({ configId: config.id, reason: "no capability-probe verdict on record — fail-closed drop (never assumed supported, never substituted)." });
    } else if (!verdict.supported) {
      dropped.push({ configId: config.id, reason: `capability probe FAILED${verdict.detail ? ` (${verdict.detail})` : ""} — dropped and recorded, never substituted.` });
    } else {
      advancing.push(config);
    }
  }
  return { advancing, dropped };
}

// ── Session-budget cap enforcement (halts BEFORE the offending session) ────────

export class ScreeningCapError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScreeningCapError";
  }
}

/** Tracks authoring + total session spend for the screening and REFUSES (throws
 *  BEFORE the caller spawns) a reservation that would breach the ≤18 authoring or
 *  ≤40 total caps. Repairs count against the total cap only. */
export class ScreeningSessionBudget {
  private authoring = 0;
  private total = 0;
  constructor(private readonly caps: ScreeningCaps = SCREENING_PLAN.caps) {}

  get authoringUsed(): number { return this.authoring; }
  get totalUsed(): number { return this.total; }

  /** Reserve ONE authoring session. Throws before the offending session when it
   *  would breach either the authoring cap or the total cap. */
  reserveAuthoring(label: string): void {
    if (this.authoring + 1 > this.caps.maxAuthoringRuns) {
      throw new ScreeningCapError(
        `authoring cap reached: ${this.authoring}/${this.caps.maxAuthoringRuns} authoring runs already used — refusing to start "${label}" (halt BEFORE the offending session; the bar/caps are never raised to fit).`,
      );
    }
    if (this.total + 1 > this.caps.maxTotalSessions) {
      throw new ScreeningCapError(
        `total session cap reached: ${this.total}/${this.caps.maxTotalSessions} sessions already used — refusing to start authoring "${label}" (halt BEFORE the offending session).`,
      );
    }
    this.authoring += 1;
    this.total += 1;
  }

  /** Reserve ONE repair (or other non-authoring) session. Throws before the
   *  offending session when it would breach the total cap. */
  reserveRepair(label: string): void {
    if (this.total + 1 > this.caps.maxTotalSessions) {
      throw new ScreeningCapError(
        `total session cap reached: ${this.total}/${this.caps.maxTotalSessions} sessions already used — refusing to start repair "${label}" (halt BEFORE the offending session).`,
      );
    }
    this.total += 1;
  }
}

// ── Advancement / STOP decision (mechanical from the registered bar) ───────────

/** One config's screened result across the 3 chapters. */
export type ConfigScreeningResult = {
  configId: string;
  /** Count of hard-gate (deterministic floor + D7 gate) failures across chapters. */
  hardGateFailures: number;
  /** The D7 chapter-diagnostic mean across the 3 chapters (null ⇒ not scored /
   *  ineligible ⇒ never advances). */
  d7ChapterDiagnosticMean: number | null;
};

export type AdvancementDecision = {
  outcome: "ADVANCE" | "STOP";
  /** Configs that meet BOTH bar conditions, ≤ maxAdvance, highest means first. */
  advancing: Array<{ configId: string; d7ChapterDiagnosticMean: number }>;
  /** Every config with the reason it did or did not advance (audit trail). */
  reasons: string[];
  /** Set on a STOP (zero-passing screening): the owner-escalation note. */
  escalation?: string;
};

/** The registered owner-escalation note emitted on a zero-passing screening. */
export const SCREENING_STOP_ESCALATION =
  "STOP — no candidate config cleared the pre-registered Stage-1 bar (0 hard-gate failures AND D7 mean >= 75). " +
  "This is a format/architecture question, not a model-quality retry: escalate to the owner and audit the change-condition C->D. " +
  "The bar is NOT lowered and no model is substituted; Stage-2 does not begin.";

/** Decide advancement MECHANICALLY from the registered bar: a config advances iff
 *  it has ZERO hard-gate failures AND a D7 mean >= the registered floor; at most
 *  `maxAdvance` advance, highest means first. A zero-passing screening yields a
 *  STOP with the owner-escalation note (the bar is never lowered). */
export function decideAdvancement(
  results: ConfigScreeningResult[],
  bar: ScreeningBar = SCREENING_PLAN.advancementBar,
): AdvancementDecision {
  const reasons: string[] = [];
  const eligible: Array<{ configId: string; d7ChapterDiagnosticMean: number }> = [];
  for (const r of results) {
    if (r.hardGateFailures > bar.hardGateFailuresAllowed) {
      reasons.push(`${r.configId}: NOT advancing — ${r.hardGateFailures} hard-gate failure(s) (bar allows ${bar.hardGateFailuresAllowed}).`);
      continue;
    }
    // rt703 FINDING-1: the bar is applied in its POSITIVE form — a config is
    // eligible only when its mean is a FINITE number >= the floor. Reject-guards
    // alone let NaN/Infinity slip through (NaN < 75 is false), which would
    // advance a config with no valid diagnostic past the pre-registered bar.
    if (r.d7ChapterDiagnosticMean === null || !Number.isFinite(r.d7ChapterDiagnosticMean)) {
      reasons.push(`${r.configId}: NOT advancing — no finite D7 chapter-diagnostic mean (ineligible / not scored).`);
      continue;
    }
    if (r.d7ChapterDiagnosticMean < bar.d7ChapterDiagnosticMeanMin) {
      reasons.push(`${r.configId}: NOT advancing — D7 mean ${r.d7ChapterDiagnosticMean.toFixed(2)} < ${bar.d7ChapterDiagnosticMeanMin}.`);
      continue;
    }
    eligible.push({ configId: r.configId, d7ChapterDiagnosticMean: r.d7ChapterDiagnosticMean });
  }
  // Highest means first; ties broken by config id for a deterministic order.
  eligible.sort((a, b) => b.d7ChapterDiagnosticMean - a.d7ChapterDiagnosticMean || a.configId.localeCompare(b.configId));
  const advancing = eligible.slice(0, bar.maxAdvance);
  for (const a of advancing) {
    reasons.push(`${a.configId}: ADVANCING — 0 hard-gate failures AND D7 mean ${a.d7ChapterDiagnosticMean.toFixed(2)} >= ${bar.d7ChapterDiagnosticMeanMin}.`);
  }
  if (eligible.length > bar.maxAdvance) {
    for (const dropped of eligible.slice(bar.maxAdvance)) {
      reasons.push(`${dropped.configId}: not carried — beyond the top ${bar.maxAdvance} advancers (D7 mean ${dropped.d7ChapterDiagnosticMean.toFixed(2)}).`);
    }
  }
  if (advancing.length === 0) {
    return { outcome: "STOP", advancing: [], reasons, escalation: SCREENING_STOP_ESCALATION };
  }
  return { outcome: "ADVANCE", advancing, reasons };
}
