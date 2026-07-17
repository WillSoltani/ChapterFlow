/**
 * Model bake-off — the permanent comparison report (JSON + Markdown).
 *
 * The report is the ONLY place the blind label→model mapping is revealed. It
 * must let a future reader reconstruct: what was compared, on what inputs, how
 * each candidate did (deterministic + blinded), why the winner won, why the
 * others lost, how confident to be, and where all retained evidence lives.
 */

import { writeFileAtomic } from "../lib/atomicWrite.js";
import type {
  BakeoffManifestV1,
  CandidateD7JudgmentV1,
  CandidateReviewV1,
  CandidateScorecardV1,
  CandidateStateV1,
  CandidateValidationV1,
  SelectionV1,
} from "./types.js";
import { BAKEOFF_REPORT_SCHEMA } from "./types.js";
import { pipelineRel, type BakeoffRoots } from "./paths.js";

export type ReportInputs = {
  manifest: BakeoffManifestV1;
  roots: BakeoffRoots;
  candidates: Array<{
    model: string;
    label: string;
    generation: CandidateStateV1 | null;
    validation: CandidateValidationV1 | null;
    /** ADVISORY (non-blocking): the codex whole-book panel read. */
    review: CandidateReviewV1 | null;
    /** OPERATIONAL REVIEWER (SECONDARY) — the Claude-side D7 rubric-audit
     *  judgment. Never labeled "primary" in the rendered report (WP-E34). */
    d7: CandidateD7JudgmentV1 | null;
  }>;
  selection: SelectionV1 | null;
  qcOutcome: string | null;
  publishOutcome: string | null;
  codexVersion: string | null;
};

export function buildReportJson(inputs: ReportInputs): Record<string, unknown> {
  const m = inputs.manifest;
  const noValidComparison = hasNoValidComparison(inputs.selection);
  return {
    schemaVersion: BAKEOFF_REPORT_SCHEMA,
    generatedAt: new Date().toISOString(),
    book: {
      bookId: m.bookId,
      title: m.intake?.title ?? null,
      author: m.intake?.author ?? null,
      identityConfident: m.intake?.identityConfident ?? false,
    },
    draft: m.intake ?? null,
    runConfiguration: {
      runId: m.runId,
      candidates: m.candidates.map((c) => ({ model: c.model, effort: c.effort })),
      judge: m.judge,
      maxParallel: m.maxParallel,
      publishRequested: m.publish,
      codexVersion: inputs.codexVersion,
      retryBudget: m.freeze?.retryBudget ?? null,
    },
    sharedInputs: m.freeze
      ? {
          combinedSha256: m.freeze.combinedSha256,
          taskCardTemplateSha256: m.freeze.taskCardTemplateSha256,
          fileCount: m.freeze.files.length,
          chapterNumbers: m.freeze.chapterNumbers,
          files: m.freeze.files,
        }
      : null,
    preflight: m.preflight ?? null,
    /** Revealed ONLY here + the manifest: which blind label was which model. */
    blindMapping: m.blindMap,
    candidates: inputs.candidates.map((c) => ({
      model: c.model,
      blindLabel: c.label,
      generation: c.generation,
      validation: c.validation,
      /** OPERATIONAL REVIEWER (SECONDARY) — never the report's PRIMARY judge;
       *  see `comparisonValidity`/the evaluator-diagnostic record for that. */
      d7: c.d7,
      /** ADVISORY (non-blocking) — recorded, never used for selection. */
      advisoryReview: c.review,
    })),
    selection: inputs.selection,
    /** WP-E34 (AUD-07): machine-readable mirror of the report's own banner —
     *  a consumer must check this before treating `selection` as a decided
     *  comparison. `null` reason ⇒ a real comparison ran. */
    comparisonValidity: {
      noValidComparison,
      reason: noValidComparison
        ? !inputs.selection || inputs.selection.scorecards.length === 0
          ? "selection has not run / no scorecards"
          : inputs.selection.provisional === true
            ? "selection is provisional (not every candidate is D7-terminal)"
            : "every candidate's primary composite is null"
        : null,
    },
    promotion: m.promotion ?? null,
    qcOutcome: inputs.qcOutcome,
    publishOutcome: inputs.publishOutcome,
    evidencePaths: {
      runRoot: pipelineRel(inputs.roots.runRoot),
      manifest: pipelineRel(inputs.roots.manifestPath),
      sharedInputs: pipelineRel(inputs.roots.sharedInputsDir),
      candidates: pipelineRel(inputs.roots.candidatesDir),
      reviews: pipelineRel(inputs.roots.reviewsDir),
      reportJson: pipelineRel(inputs.roots.reportJsonPath),
      reportMd: pipelineRel(inputs.roots.reportMdPath),
    },
  };
}

function fmt(n: number | null | undefined, digits = 1): string {
  return n === null || n === undefined || !Number.isFinite(n) ? "—" : n.toFixed(digits);
}

function minutes(ms: number | undefined): string {
  return ms === undefined ? "—" : `${Math.round(ms / 60000)}m`;
}

// ── Report-truthfulness labels (WP-E34; AUD-07) ───────────────────────────────
//
// Two rules the report must never violate:
//   1. Only the adjudicated canonical-evaluator chapter diagnostic is ever
//      labeled a primary result, and ONLY under the label
//      "CHAPTER DIAGNOSTIC — NOT A BOOK SCORE" — it is a single-chapter read,
//      never the certified whole-book score. Wherever a D7 value is printed it
//      is labeled "OPERATIONAL REVIEWER (SECONDARY)", never "primary judge" —
//      current owner policy (§8.1/§10.5) demotes D7 to a downgrade-only review
//      signal even on legacy (pre-evaluator) runs.
//   2. A run whose selection is provisional (WP-E00 terminal gating — minted
//      while a candidate was still non-terminal) or whose primary composites
//      are ALL null carries NO valid comparison. The report must say so first,
//      in a banner, and must not print a numeric scoreboard alongside it — the
//      exact "Terra/Luna failed, Sol scored 92.8" misreading V25-AUD-07 found.

const EVAL_LABEL = "CHAPTER DIAGNOSTIC — NOT A BOOK SCORE";
const D7_LABEL = "OPERATIONAL REVIEWER (SECONDARY)";

/** True once ANY scorecard carries the evaluator-primary field (WP-E32: the
 *  field is all-or-nothing across one selection, so any one hit is decisive). */
function isEvalPrimary(sel: SelectionV1 | null): boolean {
  return !!sel && sel.scorecards.some((s) => s.evalDiagnostic !== undefined);
}

/** The metric this report treats as PRIMARY for one scorecard: the evaluator
 *  chapter diagnostic under evaluator-primary mode, else the (legacy) D7
 *  composite — mirrors selectWinner's own `primaryOf` (selection.ts). */
function primaryComposite(sc: CandidateScorecardV1, evalPrimary: boolean): number | null {
  return evalPrimary ? (sc.evalDiagnostic ?? null) : sc.d7Composite;
}

/** No valid comparison exists when the selection was never minted, is
 *  provisional (evidence still incomplete by construction — WP-E00), or every
 *  candidate's primary composite is null (no scoreable candidate at all). */
function hasNoValidComparison(sel: SelectionV1 | null): boolean {
  if (!sel || sel.provisional === true || sel.scorecards.length === 0) return true;
  const evalPrimary = isEvalPrimary(sel);
  return sel.scorecards.every((sc) => primaryComposite(sc, evalPrimary) === null);
}

/** Lines from a candidate's deterministic-validation advisories that are the
 *  measure-only readability record (WP-E31; never a hard failure/disqualifier
 *  by construction — see candidates.ts:readabilityAdvisoryLine). */
function readabilityMeasurements(validation: CandidateValidationV1 | null): string[] {
  return (validation?.advisories ?? []).filter((a) => a.startsWith("readability(measure-only)"));
}

export function buildReportMd(inputs: ReportInputs): string {
  const m = inputs.manifest;
  const sel = inputs.selection;
  const lines: string[] = [];
  const noValidComparison = hasNoValidComparison(sel);
  const evalPrimary = isEvalPrimary(sel);
  // Once suppressed, "winner" is never printed as a decided fact — see the
  // banner below (AUD-07: a provisional/all-null selection is NOT evidence).
  const winner = noValidComparison ? null : (sel?.winner ?? null);

  lines.push(`# Model bake-off report — ${m.intake?.title ?? m.bookId}`);
  lines.push("");

  if (noValidComparison) {
    lines.push("> ## ⚠️ NO VALID COMPARISON — provisional/incomplete evidence");
    lines.push(">");
    lines.push(
      !sel || sel.scorecards.length === 0
        ? "> Selection has not run, or minted zero scorecards. There is nothing to compare yet."
        : sel.provisional === true
          ? "> This selection was minted while at least one candidate was still non-terminal (its judge is pending or capped instrument-fail — see WP-E00 terminal gating). It is a snapshot, NOT a comparison result: resume MUST re-derive it once every candidate reaches a terminal state before any number below can be read as evidence."
          : `> Every candidate's primary composite (${evalPrimary ? EVAL_LABEL : D7_LABEL}) is null — no candidate produced a scoreable result. There is no eligible candidate in this run.`,
    );
    lines.push(">");
    lines.push('> Do NOT read this report as "X beat Y" — the numeric scoreboard below is withheld while this banner is showing.');
    lines.push("");
  }

  lines.push(`- **Book**: ${m.intake?.title ?? m.bookId}${m.intake?.author ? ` by ${m.intake.author}` : ""} (\`${m.bookId}\`)`);
  lines.push(`- **Run**: \`${m.runId}\` (created ${m.createdAt})`);
  lines.push(`- **Candidates**: ${m.candidates.map((c) => `\`${c.model}\` @ ${c.effort}`).join(", ")}`);
  lines.push(
    evalPrimary
      ? `- **Primary metric — ${EVAL_LABEL}**: adjudicated canonical-evaluator chapter diagnostic (dual mutually-blind raters + adjudication; single-chapter scope only; selection band ±${sel?.tieBand ?? 2.0})`
      : `- **D7 rubric-audit — ${D7_LABEL}**: chapter-diagnostic composite (selection band ±${sel?.tieBand ?? 2.0}); no canonical-evaluator evidence is present on this run, so D7 is the only judge that ran — it is still reported as an operational/secondary read, never as a certified book score`,
  );
  if (evalPrimary) {
    lines.push(`- **D7 rubric-audit — ${D7_LABEL}**: downgrade-only cross-check — can flag a candidate for review, never disqualify or re-rank one`);
  }
  lines.push(`- **Advisory judge (non-blocking)**: \`${m.judge.model}\` @ ${m.judge.effort} — recorded cross-model read, never used for eligibility or ranking`);
  lines.push(`- **Codex version**: ${inputs.codexVersion ?? "unknown"}`);
  lines.push(`- **Shared-input identity**: \`${m.freeze?.combinedSha256?.slice(0, 16) ?? "—"}\` over ${m.freeze?.files.length ?? 0} frozen files, ${m.freeze?.chapterNumbers.length ?? 0} chapters`);
  lines.push(
    `- **Winner**: ${noValidComparison ? "**WITHHELD — see NO VALID COMPARISON banner above**" : winner ? `**\`${winner}\`**` : "**none (no eligible candidate)**"}${!noValidComparison && sel?.runnerUp ? ` — runner-up \`${sel.runnerUp}\`` : ""}${!noValidComparison && sel?.decidedByTieBreak ? " *(quality effectively tied; decided on retries/latency)*" : ""}`,
  );
  lines.push(`- **Formal QC**: ${inputs.qcOutcome ?? "not started"}`);
  lines.push(`- **Publication**: ${inputs.publishOutcome ?? (m.publish ? "requested" : "not requested (PUBLISH=false)")}`);
  lines.push("");

  lines.push("## Blind mapping (revealed only here)");
  lines.push("");
  for (const [label, model] of Object.entries(m.blindMap)) lines.push(`- Candidate **${label}** → \`${model}\``);
  lines.push("");

  lines.push("## Scoreboard");
  lines.push("");
  if (noValidComparison) {
    lines.push(
      "**NO VALID COMPARISON** — the numeric scoreboard is withheld (see the banner above): the selection is provisional, or no candidate carries a non-null primary composite.",
    );
    lines.push("");
  } else {
    lines.push(
      evalPrimary
        ? `PRIMARY = **${EVAL_LABEL}** (adjudicated canonical evaluator). D7 below is the **${D7_LABEL}** — recorded, never used for selection. The codex *book composite* is ADVISORY only.`
        : `PRIMARY (this run) = **D7 — ${D7_LABEL}** composite; no canonical-evaluator evidence is present. The codex *book composite* is ADVISORY only (recorded, never used for selection).`,
    );
    lines.push("");
    if (evalPrimary) {
      lines.push(`| Model | Label | Eligible | **${EVAL_LABEL}** | Eval gates | Eval confidence | D7 (${D7_LABEL}) | D7 min | *book composite (advisory)* | 1st-attempt passes | Retries | Latency |`);
      lines.push("|---|---|---|---|---|---|---|---|---|---|---|---|");
      for (const sc of sel?.scorecards ?? []) {
        const gen = inputs.candidates.find((c) => c.model === sc.model)?.generation;
        lines.push(
          `| \`${sc.model}\` | ${sc.label} | ${sc.eligible ? "yes" : "**NO**"} | **${fmt(sc.evalDiagnostic ?? null, 2)}** | ${sc.evalGatesPass === null || sc.evalGatesPass === undefined ? "—" : sc.evalGatesPass ? "pass" : "FAIL"} | ${sc.evalConfidence ?? "—"} | ${fmt(sc.d7Composite, 2)} | ${fmt(sc.d7Min, 2)} | *${fmt(sc.bookComposite)}* | ${sc.firstAttemptPasses}/${gen?.chapters.length ?? "?"} | ${sc.totalRetries} | ${minutes(sc.totalDurationMs)} |`,
        );
      }
    } else {
      lines.push(`| Model | Label | Eligible | **D7 (${D7_LABEL})** | D7 min | D7 gates | D7 verdict | *book composite (advisory)* | *gate (adv.)* | 1st-attempt passes | Retries | Latency |`);
      lines.push("|---|---|---|---|---|---|---|---|---|---|---|---|");
      for (const sc of sel?.scorecards ?? []) {
        const gen = inputs.candidates.find((c) => c.model === sc.model)?.generation;
        const d7gates = sc.d7GatesPass === null ? "—" : `${sc.d7GatesPass ? "pass" : "FAIL"}/${sc.d7LayerIndependencePass ? "layer✓" : "layer✗"}`;
        lines.push(
          `| \`${sc.model}\` | ${sc.label} | ${sc.eligible ? "yes" : "**NO**"} | **${fmt(sc.d7Composite, 2)}** | ${fmt(sc.d7Min, 2)} | ${d7gates} | ${sc.d7Verdict ?? "—"} | *${fmt(sc.bookComposite)}* | *${sc.bookGate ?? "—"}* | ${sc.firstAttemptPasses}/${gen?.chapters.length ?? "?"} | ${sc.totalRetries} | ${minutes(sc.totalDurationMs)} |`,
        );
      }
    }
    lines.push("");
  }

  lines.push("## Readability (measure-only — a recorded measurement, never a disqualification)");
  lines.push("");
  lines.push("WP-E31/AUD-01: in this lane readability never blocks a candidate. Below are the raw measurements (per-tier grade-level target + assembled Flesch ease vs. floor) recorded for the record only.");
  lines.push("");
  const anyReadability = inputs.candidates.some((c) => readabilityMeasurements(c.validation).length > 0);
  if (anyReadability) {
    for (const c of inputs.candidates) {
      const lines2 = readabilityMeasurements(c.validation);
      if (lines2.length === 0) continue;
      lines.push(`- \`${c.model}\`:`);
      for (const l of lines2) lines.push(`  - ${l}`);
    }
  } else {
    lines.push("(no measure-only readability advisories recorded on this run)");
  }
  lines.push("");

  if (noValidComparison) {
    lines.push("## Decision trace, per-candidate ranking, and per-chapter tendencies");
    lines.push("");
    lines.push("**SUPPRESSED** — no valid comparison (see the banner above). Re-run this report once every candidate is terminal, or once at least one candidate produces a non-null primary composite.");
    lines.push("");
  } else {
    lines.push("## Why the winner won (decision trace)");
    lines.push("");
    for (const r of sel?.reasons ?? ["Selection has not run."]) lines.push(`1. ${r}`);
    lines.push("");

    const losers = (sel?.scorecards ?? []).filter((s) => s.model !== winner);
    if (losers.length > 0) {
      lines.push("## Why the others lost");
      lines.push("");
      for (const s of losers) {
        if (!s.eligible) {
          lines.push(`- \`${s.model}\`: ineligible — ${s.disqualifications.join("; ")}`);
        } else {
          const primary = fmt(primaryComposite(s, evalPrimary), 2);
          lines.push(
            `- \`${s.model}\`: eligible, but ranked below the winner (${evalPrimary ? EVAL_LABEL : D7_LABEL} ${primary}; D7 (${D7_LABEL}) ${fmt(s.d7Composite, 2)}, worst-chapter D7 min ${fmt(s.d7Min, 2)}; advisory book composite ${fmt(s.bookComposite)}).`,
          );
        }
      }
      lines.push("");
    }

    lines.push("## Per-chapter tendencies (analysis only — the promoted book is single-model)");
    lines.push("");
    if (sel && sel.perChapterWinners.length > 0) {
      const models = m.candidates.map((c) => c.model);
      lines.push(`| Chapter | Best | ${models.map((mm) => `\`${mm}\``).join(" | ")} |`);
      lines.push(`|---|---|${models.map(() => "---").join("|")}|`);
      for (const row of sel.perChapterWinners) {
        lines.push(`| ch${String(row.chapterNumber).padStart(2, "0")} | ${row.model ? `\`${row.model}\`` : "—"} | ${models.map((mm) => fmt(row.composites[mm] ?? null)).join(" | ")} |`);
      }
    } else {
      lines.push("(no per-chapter reviews)");
    }
    lines.push("");
  }

  lines.push("## Confidence & limitations");
  lines.push("");
  lines.push("- This is a SINGLE-BOOK comparison — one draft, one genre, one research snapshot. It identifies the winner **for this book** and an operational tendency, not a statistically significant model ranking.");
  if (!noValidComparison && sel?.decidedByTieBreak) {
    lines.push(`- The top candidates scored inside the ±${sel.tieBand} selection band: treat the quality result as a TIE; the winner was deferred to the tie-break ladder (WP-705).`);
  }
  lines.push(
    evalPrimary
      ? `- The PRIMARY metric is the adjudicated **${EVAL_LABEL}**; differences smaller than the ±${sel?.tieBand ?? 2.0} selection band are treated as a tie. D7 (${D7_LABEL}) and the codex whole-book composite are both recorded but never entered selection.`
      : `- D7 (${D7_LABEL}) was the only judge that ran on this record; differences smaller than the ±${sel?.tieBand ?? 2.0} selection band are treated as a tie. The codex whole-book composite is ADVISORY only and never entered selection. No canonical-evaluator chapter diagnostic is present — do not read D7 alone as a certified result (owner policy §8.1/§10.5).`,
  );
  lines.push(`- **Recommendation**: before changing ChapterFlow's permanent default author model${winner ? ` to \`${winner}\`` : ""}, run at least 2–3 more bake-offs on different books/genres and compare formal QC repair burden, not just first-pass scores. The permanent default (the central model policy, currently the provisional gpt-5.6-sol pending WP-705) was intentionally NOT changed by this run.`);
  lines.push("");

  if (m.promotion) {
    lines.push("## Canonical promotion proof");
    lines.push("");
    lines.push(`- Promoted \`${m.promotion.winnerModel}\` @ ${m.promotion.winnerEffort} (run \`${m.promotion.runId}\`) at ${m.promotion.promotedAt}`);
    lines.push(`- Byte-identity verified: ${m.promotion.byteIdentityVerified ? "YES (every promoted file read back byte-equal to the selected candidate)" : "NO"}`);
    lines.push(`- Shared-inputs hash: \`${m.promotion.sharedInputsSha256.slice(0, 16)}\``);
    for (const f of m.promotion.chapterFiles) lines.push(`  - \`${f.relPath}\` — \`${f.sha256.slice(0, 16)}\``);
    lines.push("");
  }

  lines.push("## Retained evidence");
  lines.push("");
  lines.push(`- Run root: \`${pipelineRel(inputs.roots.runRoot)}\``);
  lines.push(`- Shared inputs (draft copy + freeze record): \`${pipelineRel(inputs.roots.sharedInputsDir)}\``);
  lines.push(`- ALL candidates (including losers — never deleted): \`${pipelineRel(inputs.roots.candidatesDir)}\``);
  lines.push(`- Blinded review docs + per-read records: \`${pipelineRel(inputs.roots.reviewsDir)}\``);
  lines.push(`- Machine-readable report: \`${pipelineRel(inputs.roots.reportJsonPath)}\``);
  lines.push("");
  return lines.join("\n");
}

export function writeReports(inputs: ReportInputs): { jsonPath: string; mdPath: string } {
  writeFileAtomic(inputs.roots.reportJsonPath, JSON.stringify(buildReportJson(inputs), null, 2) + "\n");
  writeFileAtomic(inputs.roots.reportMdPath, buildReportMd(inputs) + "\n");
  return { jsonPath: inputs.roots.reportJsonPath, mdPath: inputs.roots.reportMdPath };
}
