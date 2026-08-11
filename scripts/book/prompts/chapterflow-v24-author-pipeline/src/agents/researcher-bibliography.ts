/**
 * Researcher — bibliography.
 *
 * Given a book title and author, produces the canonical bibliographic record
 * plus a full chapter list. Output is the foundation for downstream pipeline
 * stages — getting the chapter count, titles, and slug right at this stage
 * propagates correctness through the whole book. Mistakes propagate equally.
 *
 * For famous business / non-fiction books, the model's training knowledge is
 * the primary source. The model is asked to self-report `confidence` so the
 * orchestrator can fail-close on `low` rather than ship a guess.
 */

import { readFileSync } from "fs";
import { isUnretryableProviderMessage } from "../runtime/modelErrors.js";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { runJsonModelTask, type ModelCallerExecution } from "../app/modelTaskRunner.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = resolve(__dirname, "../../prompts");

export type BibliographyResult = {
  bookId: string;
  title: string;
  author: string;
  edition: {
    name?: string;
    publisher?: string;
    publishedYear?: number;
    isbn13?: string;
    language?: string;
    chapterCount: number;
    sectionCount?: number;
  };
  introduction?: string;
  sections?: Array<{
    number: number;
    title: string;
    chapters: Array<{ number: number; title: string }>;
  }>;
  flatChapters?: Array<{ number: number; title: string }>;
  thesis: string;
  teachingArc: string;
  authorVoice: {
    register: "warm" | "analytical" | "plainspoken" | "literary" | "clinical";
    signatureMoves: string[];
    avoidMoves: string[];
  };
  confidence: "high" | "medium" | "low";
  notes?: string;
};

export type BibliographyInput = {
  title: string;
  author: string;
  /** If provided, the model is asked to use this slug instead of generating one.
   *  Useful for resuming a research run on an existing bookId. */
  bookIdHint?: string;
};

const REGISTER_VALUES = new Set(["warm", "analytical", "plainspoken", "literary", "clinical"]);
const CONFIDENCE_VALUES = new Set(["high", "medium", "low"]);

/** Task 11ag: bibliography is step 1 of a book run and was the ONE research
 *  surface without bounded retry — a single degenerate or transient response
 *  aborted the whole run before any chapter work began (live 2026-07-28: a bare
 *  {} killed the Franklin canary). Mirrors researcher-chapter's proven shape. */
export const MAX_BIBLIOGRAPHY_ATTEMPTS = 3;

/** Backoff before attempt N+1, indexed by (attempt - 1). Same schedule as
 *  chapter research so operators see one cadence across the research stage. */
const BIBLIOGRAPHY_BACKOFF_MS = Object.freeze([2000, 8000]);

export interface BibliographyRetryOptions {
  /** Injectable for tests; production uses a real timer. */
  readonly sleep?: (ms: number) => Promise<void>;
}

function backoffMsForAttempt(attempt: number): number {
  return BIBLIOGRAPHY_BACKOFF_MS[attempt - 1] ?? BIBLIOGRAPHY_BACKOFF_MS[BIBLIOGRAPHY_BACKOFF_MS.length - 1] ?? 8000;
}

/** A structurally empty/near-empty record carries nothing to repair; echoing it
 *  back entrenches the empty (11ad). Detect it so the retry demands a COMPLETE
 *  object instead of quoting the blob. */
export function isDegenerateBibliographyOutput(output: unknown): boolean {
  if (output === null || typeof output !== "object" || Array.isArray(output)) return true;
  const record = output as Record<string, unknown>;
  const substantive = ["bookId", "title", "author", "edition", "thesis", "teachingArc", "authorVoice", "sections", "flatChapters"]
    .filter((key) => {
      const value = record[key];
      if (value === undefined || value === null) return false;
      if (typeof value === "string") return value.trim().length > 0;
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === "object") return Object.keys(value as object).length > 0;
      return true;
    });
  return substantive.length === 0;
}

function retryDirective(problems: readonly string[], degenerate: boolean): string {
  const lines: string[] = ["", "---", ""];
  // Task 11ad: lead with the TASK, not the accusation — an accusatory frame
  // measurably raises the degenerate-empty rate on retries.
  lines.push("Continue the SAME task: return the canonical BibliographyResult JSON for this book.");
  if (degenerate) {
    lines.push("Your previous response was empty or missing every required field. Return a COMPLETE object with every required field populated — do not return a partial or empty object.");
  } else {
    lines.push("Your previous draft was rejected by the validator. Keep what is correct and change ONLY the listed items:");
    for (const problem of problems) lines.push(`- ${problem}`);
  }
  return lines.join("\n");
}

export async function runResearcherBibliography(
  input: BibliographyInput,
  execution?: ModelCallerExecution,
  options?: BibliographyRetryOptions,
): Promise<BibliographyResult> {
  let lastProblems: string[] = [];
  let lastDegenerate = false;
  const systemPrompt = readFileSync(resolve(PROMPTS_DIR, "researcher-bibliography.system.md"), "utf8");
  const basePrompt = buildUserPrompt(input);
  const sleep = options?.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const failures: string[] = [];

  for (let attempt = 1; attempt <= MAX_BIBLIOGRAPHY_ATTEMPTS; attempt += 1) {
    const userPrompt = attempt === 1 ? basePrompt : basePrompt + retryDirective(lastProblems, lastDegenerate);
    let output: BibliographyResult;
    try {
      output = await runJsonModelTask<BibliographyResult>(execution, "researcher-bibliography", systemPrompt, userPrompt);
    } catch (error) {
      const message = (error as Error).message;
      if (isTransientBibliographyFailure(message)) {
        // Task 11af: a durable quota cap cannot clear inside this window.
        if (isUnretryableProviderMessage(message)) throw error;
        failures.push(`attempt ${attempt}: ${message}`);
        if (attempt < MAX_BIBLIOGRAPHY_ATTEMPTS) await sleep(backoffMsForAttempt(attempt));
        continue;
      }
      throw error;
    }
    lastDegenerate = isDegenerateBibliographyOutput(output);
    if (lastDegenerate) {
      lastProblems = ["the previous response was empty or missing every required field"];
      failures.push(`attempt ${attempt}: bibliography invalid: empty or all-missing record`);
      continue;
    }
    try {
      return validateBibliography(output, input);
    } catch (error) {
      const message = (error as Error).message;
      lastProblems = message.replace(/^bibliography invalid:\s*/, "").split("; ").filter(Boolean);
      failures.push(`attempt ${attempt}: ${message}`);
    }
  }
  throw new Error(`bibliography invalid after ${MAX_BIBLIOGRAPHY_ATTEMPTS} attempts: ${failures.join(" | ")}`);
}

/** Transient model-process / timeout classes — the same set chapter research
 *  retries. CANCELLED (operator intent) and UNKNOWN (uncertain teardown) are
 *  deliberately absent and stay fail-closed. */
function isTransientBibliographyFailure(message: string): boolean {
  return /^MODEL_TASK_FAILED:MODEL_PROCESS_FAILED(:|$)/.test(message)
    || /^MODEL_TASK_FAILED:MODEL_OUTPUT_INVALID(:|$)/.test(message)
    || /^MODEL_TASK_TIMED_OUT(:|$)/.test(message);
}

function buildUserPrompt(input: BibliographyInput): string {
  const parts: string[] = [];
  parts.push(`# Book to research`);
  parts.push(`Title: ${input.title}`);
  parts.push(`Author: ${input.author}`);
  if (input.bookIdHint) {
    parts.push(`Use this bookId slug: ${input.bookIdHint}`);
  }
  parts.push("");
  parts.push(`Return the canonical bibliographic record and full chapter list. If you do not recognize this title and author with high confidence, set confidence to "low" and explain in notes — do not invent a chapter list.`);
  return parts.join("\n");
}

function validateBibliography(r: BibliographyResult, input: BibliographyInput): BibliographyResult {
  const problems: string[] = [];
  if (!r || typeof r !== "object") throw new Error("bibliography researcher returned non-object");

  if (typeof r.bookId !== "string" || !/^[a-z0-9-]+$/.test(r.bookId)) {
    problems.push(`bookId "${r.bookId}" must be a lowercase-dash slug`);
  }
  if (typeof r.title !== "string" || !r.title) problems.push("title missing");
  if (typeof r.author !== "string" || !r.author) problems.push("author missing");

  // Edition
  if (!r.edition || typeof r.edition !== "object") {
    problems.push("edition missing");
  } else {
    if (typeof r.edition.chapterCount !== "number" || r.edition.chapterCount < 1 || r.edition.chapterCount > 200) {
      problems.push(`edition.chapterCount ${r.edition.chapterCount} out of plausible range`);
    }
  }

  // Sections OR flatChapters (not both, not neither)
  const hasSections = Array.isArray(r.sections) && r.sections.length > 0;
  const hasFlat = Array.isArray(r.flatChapters) && r.flatChapters.length > 0;
  if (hasSections && hasFlat) {
    problems.push("provide either sections or flatChapters, not both");
  }
  if (!hasSections && !hasFlat) {
    problems.push("must provide sections or flatChapters");
  }

  // Chapter list integrity
  const chapters: Array<{ number: number; title: string }> = [];
  if (hasSections) {
    for (const sec of r.sections!) {
      if (!Array.isArray(sec.chapters)) {
        problems.push(`section ${sec.number} has no chapters array`);
        continue;
      }
      for (const ch of sec.chapters) chapters.push(ch);
    }
  } else if (hasFlat) {
    chapters.push(...r.flatChapters!);
  }

  if (r.edition && chapters.length !== r.edition.chapterCount) {
    problems.push(`chapter list has ${chapters.length} entries but edition.chapterCount is ${r.edition.chapterCount}`);
  }

  // Chapter numbers must be sequential starting at 1
  const numbers = chapters.map((c) => c.number).sort((a, b) => a - b);
  for (let i = 0; i < numbers.length; i++) {
    if (numbers[i] !== i + 1) {
      problems.push(`chapter numbers not sequential: expected ${i + 1} at position ${i}, got ${numbers[i]}`);
      break;
    }
  }

  // Chapter titles required and non-empty
  for (const ch of chapters) {
    if (typeof ch.title !== "string" || !ch.title.trim()) {
      problems.push(`chapter ${ch.number} has empty title`);
      break;
    }
    if (ch.title.length > 200) {
      problems.push(`chapter ${ch.number} title suspiciously long (${ch.title.length} chars)`);
      break;
    }
  }

  // Thesis / teaching arc presence
  if (typeof r.thesis !== "string" || r.thesis.length < 30) {
    problems.push(`thesis too short (${r.thesis?.length ?? 0} chars) — write 1-2 specific sentences`);
  }
  if (typeof r.teachingArc !== "string" || r.teachingArc.length < 50) {
    problems.push(`teachingArc too short (${r.teachingArc?.length ?? 0} chars) — write 2-3 specific sentences`);
  }

  // Author voice
  if (!r.authorVoice || typeof r.authorVoice !== "object") {
    problems.push("authorVoice missing");
  } else {
    if (!REGISTER_VALUES.has(r.authorVoice.register)) {
      problems.push(`authorVoice.register "${r.authorVoice.register}" not one of ${[...REGISTER_VALUES].join("/")}`);
    }
    if (!Array.isArray(r.authorVoice.signatureMoves) || r.authorVoice.signatureMoves.length < 3) {
      problems.push(`authorVoice.signatureMoves needs 3-5 items`);
    }
  }

  // Confidence
  if (!CONFIDENCE_VALUES.has(r.confidence)) {
    problems.push(`confidence "${r.confidence}" not one of high/medium/low`);
  }
  if (r.confidence === "low") {
    // Don't reject low-confidence outputs — that's the writer's honest signal.
    // The orchestrator decides whether to proceed; we just surface it.
  }

  if (problems.length > 0) {
    throw new Error(`bibliography invalid: ${problems.join("; ")}`);
  }
  return r;
}

/** Convert a BibliographyResult to a flat chapter list regardless of whether
 *  the source uses sections or flatChapters. Used by the orchestrator to write
 *  the chapter index and source-loader bundle. */
export function flattenChapters(b: BibliographyResult): Array<{ number: number; title: string }> {
  if (b.sections && b.sections.length > 0) {
    const out: Array<{ number: number; title: string }> = [];
    for (const sec of b.sections) for (const ch of sec.chapters) out.push(ch);
    return out.sort((a, b) => a.number - b.number);
  }
  return (b.flatChapters ?? []).slice().sort((a, b) => a.number - b.number);
}
