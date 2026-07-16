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
  CandidateReviewV1,
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
    review: CandidateReviewV1 | null;
  }>;
  selection: SelectionV1 | null;
  qcOutcome: string | null;
  publishOutcome: string | null;
  codexVersion: string | null;
};

export function buildReportJson(inputs: ReportInputs): Record<string, unknown> {
  const m = inputs.manifest;
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
      review: c.review,
    })),
    selection: inputs.selection,
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

export function buildReportMd(inputs: ReportInputs): string {
  const m = inputs.manifest;
  const sel = inputs.selection;
  const lines: string[] = [];
  const winner = sel?.winner ?? null;

  lines.push(`# Model bake-off report — ${m.intake?.title ?? m.bookId}`);
  lines.push("");
  lines.push(`- **Book**: ${m.intake?.title ?? m.bookId}${m.intake?.author ? ` by ${m.intake.author}` : ""} (\`${m.bookId}\`)`);
  lines.push(`- **Run**: \`${m.runId}\` (created ${m.createdAt})`);
  lines.push(`- **Candidates**: ${m.candidates.map((c) => `\`${c.model}\` @ ${c.effort}`).join(", ")}`);
  lines.push(`- **Judge (fixed)**: \`${m.judge.model}\` @ ${m.judge.effort}`);
  lines.push(`- **Codex version**: ${inputs.codexVersion ?? "unknown"}`);
  lines.push(`- **Shared-input identity**: \`${m.freeze?.combinedSha256?.slice(0, 16) ?? "—"}\` over ${m.freeze?.files.length ?? 0} frozen files, ${m.freeze?.chapterNumbers.length ?? 0} chapters`);
  lines.push(`- **Winner**: ${winner ? `**\`${winner}\`**` : "**none (no eligible candidate)**"}${sel?.runnerUp ? ` — runner-up \`${sel.runnerUp}\`` : ""}${sel?.decidedByTieBreak ? " *(quality effectively tied; decided on retries/latency)*" : ""}`);
  lines.push(`- **Formal QC**: ${inputs.qcOutcome ?? "not started"}`);
  lines.push(`- **Publication**: ${inputs.publishOutcome ?? (m.publish ? "requested" : "not requested (PUBLISH=false)")}`);
  lines.push("");

  lines.push("## Blind mapping (revealed only here)");
  lines.push("");
  for (const [label, model] of Object.entries(m.blindMap)) lines.push(`- Candidate **${label}** → \`${model}\``);
  lines.push("");

  lines.push("## Scoreboard");
  lines.push("");
  lines.push("| Model | Label | Eligible | Book composite (blinded) | Gate | Churn | Mean ch | Min ch | Ch pass rate | 1st-attempt passes | Retries | Latency |");
  lines.push("|---|---|---|---|---|---|---|---|---|---|---|---|");
  for (const sc of sel?.scorecards ?? []) {
    const gen = inputs.candidates.find((c) => c.model === sc.model)?.generation;
    lines.push(
      `| \`${sc.model}\` | ${sc.label} | ${sc.eligible ? "yes" : "**NO**"} | ${fmt(sc.bookComposite)} | ${sc.bookGate ?? "—"} | ${sc.churn} | ${fmt(sc.meanChapterComposite)} | ${fmt(sc.minChapterComposite)} | ${sc.chapterPassRate === null ? "—" : `${Math.round((sc.chapterPassRate ?? 0) * 100)}%`} | ${sc.firstAttemptPasses}/${gen?.chapters.length ?? "?"} | ${sc.totalRetries} | ${minutes(sc.totalDurationMs)} |`,
    );
  }
  lines.push("");

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
        lines.push(`- \`${s.model}\`: eligible, but ranked below the winner (book composite ${fmt(s.bookComposite)}, churn ${s.churn}, min chapter ${fmt(s.minChapterComposite)}).`);
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

  lines.push("## Confidence & limitations");
  lines.push("");
  lines.push("- This is a SINGLE-BOOK comparison — one draft, one genre, one research snapshot. It identifies the winner **for this book** and an operational tendency, not a statistically significant model ranking.");
  if (sel?.decidedByTieBreak) {
    lines.push(`- The top candidates scored inside the ±${sel.tieBand} noise band of the blinded rubric: treat the quality result as a TIE; the winner was chosen on retries/latency.`);
  }
  lines.push("- Blinded reads are stochastic instruments (the pipeline's own acceptance machinery treats ±3.7 composite as noise). Chapter-level differences smaller than that band are not meaningful.");
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
