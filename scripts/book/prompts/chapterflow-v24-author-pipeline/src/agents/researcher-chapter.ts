/**
 * Researcher — chapter source notes.
 *
 * Given a book and one chapter (number + title), produces dense source notes
 * that the downstream editor-in-chief / curriculum-planner / breakdown writer
 * ground on. This is the highest-leverage stage in the pipeline because the
 * downstream agents never see the actual book text — they see ONLY this output.
 *
 * For famous books the model's training knowledge is strong. The prompt asks
 * for specifics (named examples, real numbers, concrete claims) and refuses
 * vague "this chapter is about…" summaries.
 *
 * Multiple chapters can be researched in parallel — each call is independent.
 * The orchestrator (researcher.ts) handles the parallelism.
 */

import { readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { runJsonModelTask, type ModelCallerExecution } from "../app/modelTaskRunner.js";
import { evaluateSourceV2Integrity, isResearchRouteBlockingFinding } from "../source/sourceIntegrity.js";
import type { NamedFramework, TestableFact } from "../source/sidecarSchema.js";
import { BibliographyResult } from "./researcher-bibliography.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = resolve(__dirname, "../../prompts");

export type ChapterResearchResult = {
  schemaVersion?: "source-v2";
  chapterNumber: number;
  chapterTitle: string;
  focus: string;
  coreClaim: string;
  centralConcept: {
    id?: string;
    name: string;
    plainDefinition: string;
    whyItMatters: string;
  };
  keyClaims: string[];
  namedExamples: Array<{
    id?: string;
    label: string;
    summary: string;
    teachesWhat: string;
    hardSpecifics?: string[];
    realWorld?: boolean;
  }>;
  hardEdge: string;
  voiceCues: string[];
  forbiddenLeakage?: string[];
  paraphraseNotes: string;
  testableFacts?: TestableFact[];
  frameworks?: NamedFramework[];
};

export type ChapterResearchInput = {
  bibliography: BibliographyResult;
  chapter: { number: number; title: string };
  /** Optional: list of chapter titles already researched in this book, so the
   *  researcher can avoid leaking concepts from later chapters back into this
   *  one. */
  priorChapterTitles?: string[];
};

const META_REGEXES: RegExp[] = [
  /\bthis chapter\b/i,
  /\bthe chapter\b/i,
  /\bthe author\b/i,
  /\bthe book\b/i,
  /\bchapter\s+\d+\b/i,
  /\bin this (chapter|section|book)\b/i,
];

const META_VERBS: RegExp[] = [
  /\b(clear|kahneman|taleb|housel|tetlock|cialdini|greene|machiavelli|duhigg|eyal|covey|ries|brown|kolb|gladwell|fogg)\s+(argues|says|opens|notes|introduces|explains|writes|claims|points out|observes)\b/i,
];

/** Total chapter-research attempts (initial + retries). Sonnet occasionally
 *  returns a model-minted schema or trips the meta-reference content guard on
 *  the first try; a bounded retry that hands the validator's own error list
 *  back to the model recovers those cases without a route/envelope change. */
export const MAX_CHAPTER_RESEARCH_ATTEMPTS = 3;

/** Feedback line handed back to the model when the GATEWAY (not the in-process
 *  validator) rejected the previous output against its source-controlled schema.
 *  The raw invalid output never leaves the gateway, so — unlike an in-process
 *  rejection — there is no prior-output echo to include. */
const GATEWAY_SCHEMA_REJECTION_FEEDBACK = "gateway schema validation rejected the previous output";

/** Aggregate-error line for an attempt lost to a transient model process
 *  failure (rate-limit / overload / abrupt subprocess exit). No output ever
 *  reached this process, so there is nothing to echo — only the transient
 *  cause is reported. */
const TRANSIENT_PROCESS_FAILURE_FEEDBACK = "a transient model process failure occurred before any output was produced";

/**
 * In-loop backoff schedule (ms) between transient-process-failure retries,
 * indexed by (attempt − 1): the wait BEFORE attempt 2 is index 0, before
 * attempt 3 is index 1, clamping to the last entry for any higher attempt cap.
 * A provider rate-limit/overload incident clears on a short delay far more often
 * than on an immediate re-spawn, so a bounded escalating backoff turns a single
 * transient subprocess failure into a recovered chapter rather than a dead stage.
 */
export const TRANSIENT_RETRY_BACKOFF_MS: readonly number[] = Object.freeze([2000, 8000]);

/** Injectable dependencies for {@link runResearcherChapter}. The `sleep` hook
 *  is faked to resolve instantly in tests so the backoff schedule is asserted
 *  deterministically without a real wall-clock wait. Production uses setTimeout. */
export interface ChapterResearchRetryOptions {
  readonly sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms));

function backoffMsForAttempt(attempt: number): number {
  const index = Math.min(Math.max(attempt - 1, 0), TRANSIENT_RETRY_BACKOFF_MS.length - 1);
  return TRANSIENT_RETRY_BACKOFF_MS[index];
}

/** Per-attempt failure record. Drives both the next attempt's retry feedback
 *  and the final fail-closed aggregate message. */
type AttemptFailure =
  | { readonly kind: "validator"; readonly problems: string[]; readonly output: unknown }
  | { readonly kind: "gateway-schema" }
  | { readonly kind: "transient-process" };

function failureProblems(failure: AttemptFailure): string[] {
  if (failure.kind === "validator") return failure.problems;
  if (failure.kind === "gateway-schema") return [GATEWAY_SCHEMA_REJECTION_FEEDBACK];
  return [TRANSIENT_PROCESS_FAILURE_FEEDBACK];
}

function describeFailure(failure: AttemptFailure): string {
  return failureProblems(failure).join("; ");
}

/**
 * Classify a thrown `runJsonModelTask` error as a gateway-level schema
 * rejection (validator-class, retryable) versus genuine model infrastructure
 * (cancellation, capacity, admission collision — propagate immediately).
 *
 * `runJsonModelTask` throws `MODEL_TASK_${outcome}:${errorCode}:${message}`. The
 * gateway emits `MODEL_OUTPUT_INVALID` (with outcome FAILED) ONLY when a bounded,
 * exit-0 model process produced output that failed the route's output schema —
 * exactly the same variance class the in-process validator catches, just caught
 * one layer out. Every other `MODEL_TASK_*` code (MODEL_RUN_CANCELLED,
 * MODEL_ATTEMPT_EXISTS, MODEL_CAPACITY_EXHAUSTED, MODEL_EXECUTION_UNCERTAIN, …)
 * is real infrastructure and must NOT burn a retry.
 */
function isGatewaySchemaRejection(message: string): boolean {
  return /^MODEL_TASK_FAILED:MODEL_OUTPUT_INVALID(:|$)/.test(message);
}

/**
 * Classify a thrown error as a TRANSIENT model-process failure: a bounded,
 * exit-nonzero subprocess (`outcome=FAILED`, `MODEL_PROCESS_FAILED`) — the shape
 * a rate-limited / overloaded provider CLI returns when it writes a small error
 * envelope and exits 1. Unlike a cancellation, capacity, or admission-collision
 * code (real, non-retryable infrastructure state), a transient process failure
 * routinely clears on a short backoff, so it is retried with a fresh attempt.
 * Scoped to `outcome=FAILED` only: TIMED_OUT / UNKNOWN teardown carry the same
 * error code but a different outcome and stay fail-closed.
 */
function isTransientProcessFailure(message: string): boolean {
  return /^MODEL_TASK_FAILED:MODEL_PROCESS_FAILED(:|$)/.test(message);
}

export async function runResearcherChapter(
  input: ChapterResearchInput,
  execution?: ModelCallerExecution,
  options?: ChapterResearchRetryOptions,
): Promise<ChapterResearchResult> {
  const systemPrompt = readFileSync(resolve(PROMPTS_DIR, "researcher-chapter.system.md"), "utf8");
  const baseUserPrompt = buildUserPrompt(input);
  const sleep = options?.sleep ?? defaultSleep;

  const attemptFailures: AttemptFailure[] = [];

  for (let attempt = 1; attempt <= MAX_CHAPTER_RESEARCH_ATTEMPTS; attempt++) {
    const userPrompt = attempt === 1
      ? baseUserPrompt
      : `${baseUserPrompt}\n\n${buildRetryFeedback(attemptFailures[attemptFailures.length - 1])}`;

    // A model-infrastructure failure (cancellation, admission collision,
    // capacity, uncertain teardown) throws out of runJsonModelTask and is NOT
    // retried — let it propagate immediately. Two thrown classes ARE retried:
    //  - GATEWAY-level schema rejection (MODEL_OUTPUT_INVALID): the model
    //    produced output that failed the route's source-controlled schema one
    //    layer out from the in-process validator — the same variance class the
    //    retry loop exists for — retried with schema-reminder feedback (the raw
    //    invalid output is unavailable from the gateway, so there is no echo).
    //  - TRANSIENT process failure (MODEL_PROCESS_FAILED, outcome FAILED): a
    //    rate-limited/overloaded subprocess that exited nonzero. Retried after a
    //    bounded in-loop backoff so one provider blip does not kill the stage.
    let output: ChapterResearchResult;
    try {
      output = await runJsonModelTask<ChapterResearchResult>(execution, "researcher-chapter", systemPrompt, userPrompt);
    } catch (error) {
      const message = (error as Error).message;
      if (isGatewaySchemaRejection(message)) {
        attemptFailures.push({ kind: "gateway-schema" });
        continue;
      }
      if (isTransientProcessFailure(message)) {
        attemptFailures.push({ kind: "transient-process" });
        if (attempt < MAX_CHAPTER_RESEARCH_ATTEMPTS) await sleep(backoffMsForAttempt(attempt));
        continue;
      }
      throw error;
    }

    const problems = collectChapterResearchProblems(output, input);
    if (problems.length === 0) return output;

    attemptFailures.push({ kind: "validator", problems, output });
  }

  const accumulated = attemptFailures
    .map((failure, index) => `attempt ${index + 1}: ${describeFailure(failure)}`)
    .join(" | ");
  throw new Error(`chapter research invalid after ${MAX_CHAPTER_RESEARCH_ATTEMPTS} attempts: ${accumulated}`);
}

/** Build the retry block appended to the user prompt after a failed attempt.
 *  For a validator/gateway rejection it names the exact errors (and, for an
 *  in-process rejection, echoes the prior output verbatim) so the model repairs
 *  precisely what failed. For a transient process failure there is nothing wrong
 *  with the model's content and no output to echo — the note simply asks for a
 *  correct result. */
function buildRetryFeedback(failure: AttemptFailure): string {
  const lines: string[] = [];
  if (failure.kind === "transient-process") {
    lines.push("PREVIOUS ATTEMPT DID NOT COMPLETE — a transient model process error occurred before any output was produced. Nothing was wrong with your content; simply produce a correct result this time.");
    lines.push("");
  } else {
    lines.push("PREVIOUS ATTEMPT WAS REJECTED — fix exactly these:");
    for (const problem of failureProblems(failure)) lines.push(`- ${problem}`);
    lines.push("");
    if (failure.kind === "validator") {
      lines.push("Your previous (rejected) output was — do not repeat these mistakes:");
      lines.push(safeJson(failure.output));
    } else {
      // Gateway-level schema rejection: the raw invalid output stays inside the
      // gateway and is not available to echo back. Do not fabricate one.
      lines.push("Your previous output was rejected by the output-schema gate before it reached this process, so it cannot be echoed back here.");
    }
    lines.push("");
  }
  lines.push('Return a corrected ChapterResearchResult JSON. Output MUST be a single JSON object whose schemaVersion is exactly "source-v2". Never invent a different schemaVersion.');
  return lines.join("\n");
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function buildUserPrompt(input: ChapterResearchInput): string {
  const parts: string[] = [];
  parts.push(`# Book context`);
  parts.push(`Title: ${input.bibliography.title}`);
  parts.push(`Author: ${input.bibliography.author}`);
  parts.push(`Thesis: ${input.bibliography.thesis}`);
  parts.push(`Teaching arc: ${input.bibliography.teachingArc}`);
  parts.push("");
  parts.push(`# Chapter to research`);
  parts.push(`Chapter ${input.chapter.number}: ${input.chapter.title}`);
  parts.push("");
  if (input.priorChapterTitles && input.priorChapterTitles.length > 0) {
    parts.push(`# Prior chapter titles in this book (for context, not for content leakage)`);
    for (const t of input.priorChapterTitles) parts.push(`- ${t}`);
    parts.push("");
  }
  parts.push(`Return the ChapterResearchResult JSON. Be specific: named examples, real numbers, concrete claims. Paraphrase only — no verbatim text from the book. No meta-references.`);
  return parts.join("\n");
}

/** Gather every validator + content-guard + source-v2-integrity problem with a
 *  rejected chapter-research output. Returns [] when the output is admissible.
 *  Kept separate from the throwing wrapper so the retry loop can feed the exact
 *  error lines back to the model. */
function collectChapterResearchProblems(r: ChapterResearchResult, input: ChapterResearchInput): string[] {
  const problems: string[] = [];
  if (!r || typeof r !== "object") return ["chapter researcher returned a non-object output"];

  if (r.chapterNumber !== input.chapter.number) {
    problems.push(`chapterNumber mismatch: got ${r.chapterNumber}, expected ${input.chapter.number}`);
  }

  // Length floors
  if (typeof r.focus !== "string" || r.focus.length < 50) {
    problems.push(`focus too short (${r.focus?.length ?? 0} chars) — write 1-2 specific sentences`);
  }
  if (typeof r.coreClaim !== "string" || r.coreClaim.length < 30) {
    problems.push(`coreClaim too short — write 1 specific sentence`);
  }
  if (!r.centralConcept || typeof r.centralConcept !== "object") {
    problems.push("centralConcept missing");
  } else {
    if (typeof r.centralConcept.name !== "string" || !r.centralConcept.name.trim()) {
      problems.push("centralConcept.name missing");
    }
    if (typeof r.centralConcept.plainDefinition !== "string" || r.centralConcept.plainDefinition.length < 40) {
      problems.push("centralConcept.plainDefinition too short");
    }
    if (typeof r.centralConcept.whyItMatters !== "string" || r.centralConcept.whyItMatters.length < 30) {
      problems.push("centralConcept.whyItMatters too short");
    }
  }
  if (!Array.isArray(r.keyClaims) || r.keyClaims.length < 4) {
    problems.push(`keyClaims needs 4-8 items (got ${r.keyClaims?.length ?? 0})`);
  }
  if (!Array.isArray(r.namedExamples) || r.namedExamples.length < 1) {
    problems.push(`namedExamples needs 1-5 items (got ${r.namedExamples?.length ?? 0})`);
  } else {
    for (const ex of r.namedExamples) {
      if (typeof ex.label !== "string" || !ex.label) problems.push("namedExamples item missing label");
      if (typeof ex.summary !== "string" || ex.summary.length < 30) problems.push(`namedExamples "${ex.label}" summary too short`);
      if (typeof ex.teachesWhat !== "string" || !ex.teachesWhat) problems.push(`namedExamples "${ex.label}" teachesWhat missing`);
    }
  }
  if (typeof r.hardEdge !== "string" || r.hardEdge.length < 80) {
    problems.push(`hardEdge too short (${r.hardEdge?.length ?? 0}) — write 2-3 sentences about typical misreadings`);
  }
  if (!Array.isArray(r.voiceCues) || r.voiceCues.length < 2) {
    problems.push("voiceCues needs 2-4 items");
  }
  if (typeof r.paraphraseNotes !== "string" || r.paraphraseNotes.length < 600 || r.paraphraseNotes.length > 3000) {
    problems.push(`paraphraseNotes length ${r.paraphraseNotes?.length ?? 0} outside 600-3000 char range (target 200-400 words ≈ 1200-2400 chars)`);
  }

  const sourceV2 = evaluateSourceV2Integrity(r, {
    chapterNumber: input.chapter.number,
    chapterTitle: input.chapter.title,
  });
  // Admission MUST mirror the port's route-blocking decision (requireSourceV2),
  // not a subset of it — otherwise a structurally-complete but fabricated
  // sidecar (SV2.realness_fabricated_sidecar, advisory severity) is admitted on
  // attempt 1 with zero retries and then hard-rejected by the port, aborting the
  // whole research stage. Sharing isResearchRouteBlockingFinding keeps them in lockstep.
  for (const finding of sourceV2.findings) {
    if (isResearchRouteBlockingFinding(finding)) problems.push(`${finding.checkId}: ${finding.message}`);
  }

  // Meta-reference checks across every text field.
  const allText = [
    r.focus,
    r.coreClaim,
    r.centralConcept?.plainDefinition ?? "",
    r.centralConcept?.whyItMatters ?? "",
    ...(r.keyClaims ?? []),
    ...(r.namedExamples ?? []).flatMap((ex) => [ex.summary, ex.teachesWhat]),
    r.hardEdge,
    r.paraphraseNotes,
  ].join(" \n ");

  for (const re of META_REGEXES) {
    const m = allText.match(re);
    if (m) {
      problems.push(`meta-reference "${m[0]}" found — paraphrase the claim directly without naming the chapter`);
      break;
    }
  }
  for (const re of META_VERBS) {
    const m = allText.match(re);
    if (m) {
      problems.push(`author-surname-verb construction "${m[0]}" found — state the claim directly`);
      break;
    }
  }

  // Title match (loose — capitalization-insensitive)
  if (typeof r.chapterTitle === "string" && input.chapter.title) {
    if (r.chapterTitle.toLowerCase() !== input.chapter.title.toLowerCase()) {
      // not a blocker; some agents normalize case, but warn
    }
  }

  return problems;
}

/** Render a ChapterResearchResult to the plain-text sidecar shape that
 *  source-loader.ts reads. Mirrors the existing atomic-habits sidecar shape:
 *  focus line + bulleted claim list + paraphrase notes. Stripped of any
 *  meta-references by the validator above. */
export function renderChapterSidecar(r: ChapterResearchResult): string {
  const lines: string[] = [];
  lines.push(`Chapter ${r.chapterNumber} focus: ${r.focus}`);
  lines.push("");
  lines.push(`Core claim: ${r.coreClaim}`);
  lines.push("");
  lines.push(`Central concept (${r.centralConcept.name}):`);
  lines.push(`  ${r.centralConcept.plainDefinition}`);
  lines.push(`  Why it matters: ${r.centralConcept.whyItMatters}`);
  lines.push("");
  lines.push(`Key claims:`);
  for (const claim of r.keyClaims) lines.push(`- ${claim}`);
  lines.push("");
  lines.push(`Named examples:`);
  for (const ex of r.namedExamples) {
    lines.push(`- ${ex.label}: ${ex.summary} (teaches: ${ex.teachesWhat})`);
  }
  lines.push("");
  lines.push(`Hard edge / typical misreading:`);
  lines.push(`  ${r.hardEdge}`);
  lines.push("");
  lines.push(`Voice cues observed in this chapter:`);
  for (const cue of r.voiceCues) lines.push(`- ${cue}`);
  if (r.forbiddenLeakage && r.forbiddenLeakage.length > 0) {
    lines.push("");
    lines.push(`Forbidden leakage (concepts that belong to later chapters):`);
    for (const c of r.forbiddenLeakage) lines.push(`- ${c}`);
  }
  lines.push("");
  lines.push(`Paraphrase notes:`);
  lines.push(r.paraphraseNotes);
  return lines.join("\n");
}
