/**
 * IMP-20 §L — Static Layer-N v2 retrospective (WP-B9).
 *
 * PURE, DIAGNOSTIC-ONLY re-analysis of the three PRESERVED Layer-N v2 run dirs.
 * NO model call, NO qualification, NO write from the generator itself: the
 * generator loads the immutable preserved evidence and RETURNS strings (md +
 * json); a thin driver (Wave-C CLI subverb / one-off runner) does the write.
 *
 * The whole point of the split-lane redesign is that the monolithic Layer-N
 * reader judge was asked to block on source-truth it could not see. This module
 * re-projects each preserved review onto the FOUR separated analytical views the
 * split lanes will own — reader-only, source-related, quiz, legacy ship-bit — so
 * the closure can show, per case × judge, exactly which historical "failure"
 * depended on unavailable source evidence and which was genuinely reader-visible.
 *
 * It ADJUDICATES NOTHING. The 14 disputed gpt-5.6-sol source-register cases are
 * marked UNADJUDICATED (owner gate) and NEVER labeled true/false. This module
 * can NEVER emit a JudgeCapabilityQualificationV1 (asserted by a WP-B9 test) —
 * it produces no qualification of any kind.
 *
 * Reuses the `rescore-judge1-validation.mts` evidence-loader shape and the
 * `gen-sol-divergence-packet.mts` FAB_RE regex verbatim.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import { PIPELINE_DIR } from "../paths.js";
import type { ChapterReviewV1, ChapterReviewComplaint } from "../../artifacts/artifactTypes.js";

/** Retrospective self-describing schema id. NOT a qualification schema. */
export const LAYER_N_RETROSPECTIVE_SCHEMA = "s16-layer-n-v2-split-lane-retrospective-v1" as const;

/**
 * Verbatim from `gen-sol-divergence-packet.mts:40`. A mustFix complaint whose
 * problem text matches this regex is a SOURCE-TRUTH class claim — the reader
 * lane in the split redesign cannot express it (no source evidence in the
 * reviewer workspace), so it escalates to the source-integrity lane instead.
 */
export const FAB_RE =
  /fabricat|invent|misleading|presented as factual|hypothetical|did not happen|not established|fictional|as if (real|it happened)|appears? invented/i;

/** The ship bar the Layer-N v2 reviews were adjudicated against (legacy ship84
 *  GATE line). Used only to classify a ship-bit artifact when a review omits
 *  its own `bar` field; the review's own `bar` wins when present. */
export const RETROSPECTIVE_SHIP_BAR_FALLBACK = 80 as const;

/** The three PRESERVED run dirs (immutable evidence). */
export const RETROSPECTIVE_RUN_DIRS = [
  {
    slug: "layer-n-v2-qualification",
    label: "run-3 FINAL (gpt-5.5@high QUALIFIED; sol@high & gpt-5.5@xhigh NOT; sol partial 20/28)",
  },
  {
    slug: "layer-n-v2-qualification-RUN1-instrument-invalid",
    label: "run-1 INSTRUMENT_INVALID (ship84 hard-blocker detection defect)",
  },
  {
    slug: "layer-n-v2-qualification-RUN2-craft-borderline",
    label: "run-2 craft borderline (neutral craft fillers re-worded)",
  },
] as const;

/** Judge id ↔ on-disk judge dir. Model profiles are GPT-via-ChatGPT-codex. */
export const RETROSPECTIVE_JUDGES = [
  { id: "gpt-5.5@high", dir: "gpt-5-5-high", family: "gpt-5.5" },
  { id: "gpt-5.5@xhigh", dir: "gpt-5-5-xhigh", family: "gpt-5.5" },
  { id: "gpt-5.6-sol@high", dir: "gpt-5-6-sol-high", family: "gpt-5.6-sol" },
] as const;

/** The frozen owner-gate label for the disputed sol source-register cases. */
export const DISPUTED_SOL_GOLD_STATUS = "UNADJUDICATED (owner gate)" as const;
/** The neutral label for every non-disputed case — never affirms gold truth. */
export const NON_DISPUTED_GOLD_STATUS = "not-under-dispute (diagnostic; gold not affirmed)" as const;

// ── Loaded-evidence shapes ─────────────────────────────────────────────────

/** One preserved review, loaded from `<judgeDir>/<caseId>/evidence.json`. */
export type LoadedReviewEvidence = {
  runDirSlug: string;
  judgeId: string;
  judgeFamily: string;
  caseId: string;
  /** evidence.json.kind (corpus kind: clean-pass / reader-visible-hard-blocker /
   *  quiz-key-mismatch / quiz-ambiguity / craft-nonblocker), best-effort. */
  kind: string | null;
  /** evidence.json.parsedReview — a full ChapterReviewV1 (or null if absent). */
  review: ChapterReviewV1 | null;
};

// ── Emitted view shapes (the FOUR separated analytical views) ───────────────

type Signal = { unit: string; problem: string };

/** View 1 — reader-only signals: composite + reader-decidable (non-FAB) blockers. */
export type ReaderOnlyView = {
  composite: number | null;
  /** mustFix complaints that are NOT source-truth (FAB) class — the split
   *  reader lane CAN block on these (self-contradiction, unusable, etc.). */
  blockersExcludingSourceTruthClaims: Signal[];
  /** non-blocking craft complaints (mustFix===false) — advisory in the new lane. */
  nonBlockingCraftFindings: Signal[];
};

/** View 2 — source-related signals: FAB-class mustFixes, flagged ungrounded. */
export type SourceRelatedView = {
  /** FAB-class mustFixes the reader raised but could not ground — these become
   *  source-lane escalation signals in the split redesign. */
  escalationSignals: Array<Signal & { note: "ungrounded: no source evidence" }>;
  /** structuralScreen.claimsScanned — always 0 across the preserved corpus (the
   *  reviewer never had source to scan). Recorded to make that explicit. */
  structuralClaimsScanned: number;
};

/** View 3 — quiz-related signals: per-item keyCorrect from quizAdjudication. */
export type QuizView = {
  /** Derived diagnostic label from the per-item key verdicts. Never a gate. */
  result: "PASS" | "BLOCK" | "INCONCLUSIVE" | "N/A";
  status: string | null;
  keyWrongCount: number;
  ambiguousCount: number;
  perItemKeyCorrect: Array<{ itemId: string; keyCorrect: "correct" | "ambiguous" | "wrong" }>;
};

/** View 4 — legacy ship84 effect: ship-bit vs mustFix divergence. */
export type Ship84EffectView = {
  ship84: boolean | null;
  mustFixCount: number;
  composite: number | null;
  bar: number;
  /** "pure-ship-bit-artifact" when composite>=bar AND 0 mustFix AND ship84===false
   *  (the conservative non-ships, e.g. both difficult-conversations-ch01 cases). */
  classification:
    | "pure-ship-bit-artifact"
    | "ship-consistent-with-mustfix"
    | "ship-true"
    | "no-review";
};

/** One case × judge, projected onto the four views (per §L reports). */
export type RetrospectiveCaseView = {
  runDirSlug: string;
  judgeId: string;
  caseId: string;
  kind: string | null;
  /** original preserved deterministic result. */
  originalResult: {
    pass: boolean | null;
    valid: boolean | null;
    composite: number | null;
    ship84: boolean | null;
    bar: number;
  };
  readerComposite: number | null;
  readerOnly: ReaderOnlyView;
  sourceRelated: SourceRelatedView;
  quiz: QuizView;
  ship84Effect: Ship84EffectView;
  /** true IFF the review had blocking mustFixes AND every one of them is
   *  FAB-class — i.e. the historical "failure" depended entirely on source
   *  evidence the reviewer never had. */
  failureDependedOnUnavailableSourceEvidence: boolean;
  /** owner-gate for the 14 disputed sol cases; neutral otherwise. NEVER true/false. */
  caseGoldValidity: typeof DISPUTED_SOL_GOLD_STATUS | typeof NON_DISPUTED_GOLD_STATUS;
};

/** Per-run disputed-set descriptor. A disputed case = gpt-5.6-sol raised a
 *  FAB-class mustFix AND a present gpt-5.5 judge (high or xhigh) did NOT. */
export type DisputedRunSummary = {
  runDirSlug: string;
  caseIds: string[];
};

export type RetrospectiveReport = {
  schema: typeof LAYER_N_RETROSPECTIVE_SCHEMA;
  generatedFrom: string;
  diagnosticOnly: true;
  /** HARD invariant — this module produces NO qualification. */
  producesQualification: false;
  fabRegexSource: string;
  campaignCallLedger: {
    campaignTotalConsumed: 711;
    totalLiveCallsEverIncludingLayerNv1: 811;
    note: string;
  };
  runDirs: Array<{ slug: string; label: string; present: boolean; judgesPresent: string[] }>;
  disputedSolSourceRegisterCases: {
    definition: string;
    goldStatus: typeof DISPUTED_SOL_GOLD_STATUS;
    primaryRunDirSlug: string;
    primaryRunCount: number;
    perRunDir: DisputedRunSummary[];
  };
  cases: RetrospectiveCaseView[];
  summary: {
    totalCaseJudgeViews: number;
    shipBitArtifactCount: number;
    sourceDependentFailureCount: number;
    disputedCaseGoldMarkings: number;
    byRunDir: Record<string, number>;
  };
};

// ── Loader (reuses rescore-judge1-validation.mts shape) ─────────────────────

/** Default base dir: `<pipeline>/state/migration-experiments`. Built from path
 *  segments (never a canonical-tree literal) so the firewall grep stays clean. */
export function defaultMigrationExperimentsDir(): string {
  return resolve(PIPELINE_DIR, "state", "migration-experiments");
}

function loadOneReview(
  runDirSlug: string,
  judgeId: string,
  judgeFamily: string,
  judgeDirAbs: string,
  caseId: string,
): LoadedReviewEvidence {
  const evPath = resolve(judgeDirAbs, caseId, "evidence.json");
  let kind: string | null = null;
  let review: ChapterReviewV1 | null = null;
  if (existsSync(evPath)) {
    const e = JSON.parse(readFileSync(evPath, "utf8")) as {
      kind?: string;
      parsedReview?: unknown;
    };
    kind = typeof e.kind === "string" ? e.kind : null;
    review = (e.parsedReview as ChapterReviewV1 | null) ?? null;
  }
  return { runDirSlug, judgeId, judgeFamily, caseId, kind, review };
}

/**
 * Load every preserved review across the three run dirs × judges × cases.
 * Pure fs read (no write). Missing dirs/files are simply absent from the result
 * (a bare checkout without the preserved corpus yields an empty array).
 */
export function loadLayerNRetrospectiveEvidence(baseDir = defaultMigrationExperimentsDir()): LoadedReviewEvidence[] {
  const out: LoadedReviewEvidence[] = [];
  for (const run of RETROSPECTIVE_RUN_DIRS) {
    const nrv2 = resolve(baseDir, run.slug, "native-review-v2");
    if (!existsSync(nrv2)) continue;
    for (const judge of RETROSPECTIVE_JUDGES) {
      const judgeDirAbs = resolve(nrv2, judge.dir);
      if (!existsSync(judgeDirAbs)) continue;
      let caseIds: string[];
      try {
        caseIds = readdirSync(judgeDirAbs, { withFileTypes: true })
          .filter((d) => d.isDirectory())
          .map((d) => d.name)
          .sort();
      } catch {
        continue;
      }
      for (const caseId of caseIds) {
        out.push(loadOneReview(run.slug, judge.id, judge.family, judgeDirAbs, caseId));
      }
    }
  }
  return out;
}

// ── Pure projection helpers ─────────────────────────────────────────────────

function mustFixComplaints(review: ChapterReviewV1 | null): ChapterReviewComplaint[] {
  if (!review) return [];
  return (review.complaints ?? []).filter((c) => c.mustFix);
}

function isFab(problem: string): boolean {
  return FAB_RE.test(problem);
}

function fabMustFixes(review: ChapterReviewV1 | null): ChapterReviewComplaint[] {
  return mustFixComplaints(review).filter((c) => isFab(String(c.problem)));
}

function nonFabMustFixes(review: ChapterReviewV1 | null): ChapterReviewComplaint[] {
  return mustFixComplaints(review).filter((c) => !isFab(String(c.problem)));
}

function craftFindings(review: ChapterReviewV1 | null): ChapterReviewComplaint[] {
  if (!review) return [];
  return (review.complaints ?? []).filter((c) => !c.mustFix);
}

function toSignals(cs: ChapterReviewComplaint[]): Signal[] {
  return cs.map((c) => ({ unit: String(c.unit), problem: String(c.problem) }));
}

function quizViewOf(review: ChapterReviewV1 | null): QuizView {
  const adj = review?.quizAdjudication;
  const items = adj?.items ?? [];
  const perItemKeyCorrect = items.map((i) => ({ itemId: i.itemId, keyCorrect: i.keyCorrect }));
  const keyWrongCount = items.filter((i) => i.keyCorrect === "wrong").length;
  const ambiguousCount = items.filter((i) => i.keyCorrect === "ambiguous").length;
  let result: QuizView["result"];
  if (!adj || adj.status !== "adjudicated" || items.length === 0) {
    result = "N/A";
  } else if (keyWrongCount > 0 || ambiguousCount > 0) {
    result = "BLOCK";
  } else {
    result = "PASS";
  }
  return {
    result,
    status: adj?.status ?? null,
    keyWrongCount,
    ambiguousCount,
    perItemKeyCorrect,
  };
}

function ship84EffectOf(review: ChapterReviewV1 | null, bar: number): Ship84EffectView {
  if (!review) {
    return { ship84: null, mustFixCount: 0, composite: null, bar, classification: "no-review" };
  }
  const mustFixCount = mustFixComplaints(review).length;
  const composite = typeof review.composite === "number" ? review.composite : null;
  const ship84 = typeof review.ship84 === "boolean" ? review.ship84 : null;
  let classification: Ship84EffectView["classification"];
  if (ship84 === true) {
    classification = "ship-true";
  } else if (ship84 === false && mustFixCount === 0 && composite !== null && composite >= bar) {
    classification = "pure-ship-bit-artifact";
  } else {
    classification = "ship-consistent-with-mustfix";
  }
  return { ship84, mustFixCount, composite, bar, classification };
}

function structuralClaimsScannedOf(review: ChapterReviewV1 | null): number {
  const n = review?.structuralScreen?.claimsScanned;
  return typeof n === "number" ? n : 0;
}

/** Per-run disputed sol source-register set — the divergence definition from
 *  `gen-sol-divergence-packet.mts`, computed within a single run dir. */
function computeDisputedSet(runRows: LoadedReviewEvidence[]): string[] {
  const byCase = new Map<string, Map<string, LoadedReviewEvidence>>();
  for (const r of runRows) {
    if (!byCase.has(r.caseId)) byCase.set(r.caseId, new Map());
    byCase.get(r.caseId)!.set(r.judgeId, r);
  }
  const disputed: string[] = [];
  for (const [caseId, judges] of byCase) {
    const sol = judges.get("gpt-5.6-sol@high");
    if (!sol || !sol.review) continue;
    if (fabMustFixes(sol.review).length === 0) continue;
    const hi = judges.get("gpt-5.5@high");
    const xh = judges.get("gpt-5.5@xhigh");
    const hiDidNotFlag = hi && hi.review && fabMustFixes(hi.review).length === 0;
    const xhDidNotFlag = xh && xh.review && fabMustFixes(xh.review).length === 0;
    if (hiDidNotFlag || xhDidNotFlag) disputed.push(caseId);
  }
  return disputed.sort();
}

// ── Report builder (PURE — returns strings; NEVER writes, NEVER qualifies) ───

/**
 * Build the retrospective report + rendered md/json from loaded evidence.
 * PURE: no fs, no model call. Returns the report object plus its md and json
 * string renderings. This function CANNOT emit a JudgeCapabilityQualificationV1
 * — `producesQualification` is a frozen `false`.
 */
export function buildLayerNRetrospective(evidence: LoadedReviewEvidence[]): {
  report: RetrospectiveReport;
  markdown: string;
  json: string;
} {
  // Per-run disputed sets (the 14 come from the FINAL run dir).
  const byRun = new Map<string, LoadedReviewEvidence[]>();
  for (const e of evidence) {
    if (!byRun.has(e.runDirSlug)) byRun.set(e.runDirSlug, []);
    byRun.get(e.runDirSlug)!.push(e);
  }
  const perRunDisputed: DisputedRunSummary[] = [];
  const disputedByRun = new Map<string, Set<string>>();
  for (const run of RETROSPECTIVE_RUN_DIRS) {
    const rows = byRun.get(run.slug) ?? [];
    const ids = computeDisputedSet(rows);
    perRunDisputed.push({ runDirSlug: run.slug, caseIds: ids });
    disputedByRun.set(run.slug, new Set(ids));
  }
  const primaryRun = RETROSPECTIVE_RUN_DIRS[0].slug;
  const primaryDisputed = disputedByRun.get(primaryRun) ?? new Set<string>();

  const cases: RetrospectiveCaseView[] = [];
  for (const e of evidence) {
    const review = e.review;
    const bar = typeof review?.bar === "number" ? review.bar : RETROSPECTIVE_SHIP_BAR_FALLBACK;
    const nonFab = nonFabMustFixes(review);
    const fab = fabMustFixes(review);
    const allMustFix = mustFixComplaints(review);
    const composite = typeof review?.composite === "number" ? review.composite : null;
    const disputedSet = disputedByRun.get(e.runDirSlug) ?? new Set<string>();
    const view: RetrospectiveCaseView = {
      runDirSlug: e.runDirSlug,
      judgeId: e.judgeId,
      caseId: e.caseId,
      kind: e.kind,
      originalResult: {
        pass: typeof review?.pass === "boolean" ? review.pass : null,
        valid: typeof review?.valid === "boolean" ? review.valid : null,
        composite,
        ship84: typeof review?.ship84 === "boolean" ? review.ship84 : null,
        bar,
      },
      readerComposite: composite,
      readerOnly: {
        composite,
        blockersExcludingSourceTruthClaims: toSignals(nonFab),
        nonBlockingCraftFindings: toSignals(craftFindings(review)),
      },
      sourceRelated: {
        escalationSignals: toSignals(fab).map((s) => ({
          ...s,
          note: "ungrounded: no source evidence" as const,
        })),
        structuralClaimsScanned: structuralClaimsScannedOf(review),
      },
      quiz: quizViewOf(review),
      ship84Effect: ship84EffectOf(review, bar),
      // Failure depended on unavailable source evidence IFF there were blocking
      // mustFixes AND every one of them was FAB-class.
      failureDependedOnUnavailableSourceEvidence:
        allMustFix.length > 0 && nonFab.length === 0 && fab.length > 0,
      caseGoldValidity: disputedSet.has(e.caseId)
        ? DISPUTED_SOL_GOLD_STATUS
        : NON_DISPUTED_GOLD_STATUS,
    };
    cases.push(view);
  }

  // Stable ordering: run dir order, then judge order, then caseId.
  const runOrder = new Map<string, number>(RETROSPECTIVE_RUN_DIRS.map((r, i) => [r.slug, i]));
  const judgeOrder = new Map<string, number>(RETROSPECTIVE_JUDGES.map((j, i) => [j.id, i]));
  cases.sort((a, b) => {
    const r = (runOrder.get(a.runDirSlug) ?? 99) - (runOrder.get(b.runDirSlug) ?? 99);
    if (r !== 0) return r;
    const j = (judgeOrder.get(a.judgeId) ?? 99) - (judgeOrder.get(b.judgeId) ?? 99);
    if (j !== 0) return j;
    return a.caseId < b.caseId ? -1 : a.caseId > b.caseId ? 1 : 0;
  });

  const byRunDirCounts: Record<string, number> = {};
  for (const c of cases) byRunDirCounts[c.runDirSlug] = (byRunDirCounts[c.runDirSlug] ?? 0) + 1;

  const runDirsMeta = RETROSPECTIVE_RUN_DIRS.map((run) => {
    const rows = byRun.get(run.slug) ?? [];
    const judgesPresent = [...new Set(rows.map((r) => r.judgeId))].sort();
    return { slug: run.slug, label: run.label, present: rows.length > 0, judgesPresent };
  });

  const report: RetrospectiveReport = {
    schema: LAYER_N_RETROSPECTIVE_SCHEMA,
    generatedFrom:
      "3 PRESERVED Layer-N v2 run dirs — pure static re-projection; NO model call, NO qualification, NO adjudication",
    diagnosticOnly: true,
    producesQualification: false,
    fabRegexSource: FAB_RE.source,
    campaignCallLedger: {
      campaignTotalConsumed: 711,
      totalLiveCallsEverIncludingLayerNv1: 811,
      note: "campaignTotalConsumed = Stage-Q Layer-O 540 + Layer-N v2 171; +100 earlier Layer-N v1 = 811 ever. Diagnostic re-analysis consumes ZERO additional calls.",
    },
    runDirs: runDirsMeta,
    disputedSolSourceRegisterCases: {
      definition:
        "A disputed case = gpt-5.6-sol@high raised a FAB-class (source-truth) mustFix AND a present gpt-5.5 judge (high or xhigh) did NOT. gpt-5.6-sol flags books' named illustrative examples as reserved fabrication with no source evidence to verify against; the gpt-5.5 judges do not. Owner adjudication is required; this module marks them UNADJUDICATED and never labels the gold true or false.",
      goldStatus: DISPUTED_SOL_GOLD_STATUS,
      primaryRunDirSlug: primaryRun,
      primaryRunCount: primaryDisputed.size,
      perRunDir: perRunDisputed,
    },
    cases,
    summary: {
      totalCaseJudgeViews: cases.length,
      shipBitArtifactCount: cases.filter((c) => c.ship84Effect.classification === "pure-ship-bit-artifact").length,
      sourceDependentFailureCount: cases.filter((c) => c.failureDependedOnUnavailableSourceEvidence).length,
      disputedCaseGoldMarkings: cases.filter((c) => c.caseGoldValidity === DISPUTED_SOL_GOLD_STATUS).length,
      byRunDir: byRunDirCounts,
    },
  };

  return {
    report,
    markdown: renderRetrospectiveMarkdown(report),
    json: JSON.stringify(report, null, 2) + "\n",
  };
}

/** Load + build in one call (fs read only; no write). Convenience for the driver. */
export function generateLayerNRetrospective(baseDir = defaultMigrationExperimentsDir()): {
  report: RetrospectiveReport;
  markdown: string;
  json: string;
} {
  return buildLayerNRetrospective(loadLayerNRetrospectiveEvidence(baseDir));
}

// ── Markdown rendering (pure string) ────────────────────────────────────────

function renderRetrospectiveMarkdown(report: RetrospectiveReport): string {
  const L: string[] = [];
  L.push("# Layer-N v2 → Split-Lane Retrospective");
  L.push("");
  L.push(
    "Static, diagnostic-only re-projection of the three preserved Layer-N v2 run dirs onto the four separated review lanes (reader-only, source-related, quiz, legacy ship-bit). **No model call. No qualification. No adjudication.** Generated by `src/bakeoff/migration/layerNRetrospective.ts` (WP-B9, IMP-20 §L).",
  );
  L.push("");
  L.push(
    `- Campaign call ledger: **campaignTotalConsumed = ${report.campaignCallLedger.campaignTotalConsumed}** (Stage-Q Layer-O 540 + Layer-N v2 171); **total live calls ever = ${report.campaignCallLedger.totalLiveCallsEverIncludingLayerNv1}** (+100 earlier Layer-N v1). This re-analysis adds **0**.`,
  );
  L.push(`- FAB (source-truth) regex: \`${report.fabRegexSource}\``);
  L.push(`- Total case × judge views: **${report.summary.totalCaseJudgeViews}**`);
  L.push(`- Pure ship-bit artifacts (composite ≥ bar, 0 mustFix, ship84 false): **${report.summary.shipBitArtifactCount}**`);
  L.push(
    `- Failures that depended ONLY on unavailable source evidence: **${report.summary.sourceDependentFailureCount}**`,
  );
  L.push(
    `- Disputed sol source-register case-gold markings (\`${DISPUTED_SOL_GOLD_STATUS}\`): **${report.summary.disputedCaseGoldMarkings}** views`,
  );
  L.push("");

  L.push("## Preserved run dirs");
  L.push("");
  L.push("| run dir | present | judges present | label |");
  L.push("|---|---|---|---|");
  for (const r of report.runDirs) {
    L.push(`| \`${r.slug}\` | ${r.present ? "yes" : "no"} | ${r.judgesPresent.join(", ") || "—"} | ${r.label} |`);
  }
  L.push("");

  L.push("## Disputed gpt-5.6-sol source-register cases — UNADJUDICATED (owner gate)");
  L.push("");
  L.push(report.disputedSolSourceRegisterCases.definition);
  L.push("");
  L.push(
    `Gold status for every disputed case: **${report.disputedSolSourceRegisterCases.goldStatus}** — never labeled true or false. Primary (final) run \`${report.disputedSolSourceRegisterCases.primaryRunDirSlug}\`: **${report.disputedSolSourceRegisterCases.primaryRunCount}** disputed cases.`,
  );
  L.push("");
  for (const d of report.disputedSolSourceRegisterCases.perRunDir) {
    L.push(`- \`${d.runDirSlug}\` (${d.caseIds.length}): ${d.caseIds.map((c) => `\`${c}\``).join(", ") || "—"}`);
  }
  L.push("");

  L.push("## Per case × judge — four separated views");
  L.push("");
  L.push(
    "| run | judge | case | kind | pass | reader composite | reader blockers (non-source) | source escalations (ungrounded) | quiz | ship84 effect | fail⇐source-only | case gold |",
  );
  L.push("|---|---|---|---|---|---|---|---|---|---|---|---|");
  for (const c of report.cases) {
    L.push(
      `| ${shortRun(c.runDirSlug)} | ${c.judgeId} | \`${c.caseId}\` | ${c.kind ?? "—"} | ${fmt(c.originalResult.pass)} | ${c.readerComposite ?? "—"} | ${c.readerOnly.blockersExcludingSourceTruthClaims.length} | ${c.sourceRelated.escalationSignals.length} | ${c.quiz.result} | ${c.ship84Effect.classification} | ${c.failureDependedOnUnavailableSourceEvidence ? "YES" : "no"} | ${c.caseGoldValidity === DISPUTED_SOL_GOLD_STATUS ? "UNADJUDICATED" : "—"} |`,
    );
  }
  L.push("");
  L.push(
    "_This retrospective adjudicates nothing and qualifies no judge. `producesQualification: false` is a hard invariant asserted by the WP-B9 test. Owner adjudication of the disputed source-register cases and the panel-design decision remain pre-live gates for `s16-reviewer-recovery-v1`._",
  );
  L.push("");
  return L.join("\n");
}

function shortRun(slug: string): string {
  if (slug === "layer-n-v2-qualification") return "run-3";
  if (slug.includes("RUN1")) return "run-1";
  if (slug.includes("RUN2")) return "run-2";
  return slug;
}

function fmt(v: boolean | null): string {
  return v === null ? "—" : v ? "true" : "false";
}
