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

import { renderUntrustedSourceBlock, runJsonModelTask, type ModelCallerExecution } from "../app/modelTaskRunner.js";
import { chapterMapContractLines, chapterMapMissingProblem, resolveChapterMap } from "../source/chapterMap.js";
import { buildBibliographyTextView } from "../source/sourceOutline.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = resolve(__dirname, "../../prompts");

/**
 * R-053 — the book's genre, as the bibliography researcher observes it.
 *
 * The one distinction the research rules turn on is whether the AUTHOR is the
 * SUBJECT of the book. In a memoir or autobiography he is, so naming him as the
 * actor of what he did is correct and an agentless passive is the defect; in
 * every other genre naming him as an actor is a meta-reference to the text.
 * Recorded as an explicit field rather than inferred from a hardcoded title list
 * (which is the failure mode R-023 removed from the author-verb guard).
 *
 * "memoir" covers autobiography; the distinction does not change any rule.
 * OPTIONAL: absent means "not classified", and every rule behaves exactly as it
 * did before this field existed.
 */
export const BIBLIOGRAPHY_GENRES = [
  "memoir",
  "narrative-nonfiction",
  "practical",
  "argument",
  "reference",
] as const;
export type BibliographyGenre = (typeof BIBLIOGRAPHY_GENRES)[number];

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
  /** R-053 — see {@link BIBLIOGRAPHY_GENRES}. Optional and additive. */
  genre?: BibliographyGenre;
  /**
   * R-046 — one span of the frozen source text per chapter, present only when
   * the run was given the book's text. Validated by
   * src/source/chapterMap.ts#resolveChapterMap before it is used.
   *
   * TWO SHAPES, one per mode (chapterMapMode): a book passed WHOLE returns
   * anchors it copied out of the text; a book too long to pass whole returns
   * OFFSETS it copied out of the outline view's printed list, because it never
   * saw the chapter ends an anchor would need. The validator accepts exactly the
   * one the mode asks for and rejects the other, so a map cannot be built under
   * a contract the model was not given.
   */
  chapterMap?: Array<
    | { chapterNumber: number; startAnchor: string; endAnchor: string }
    | { chapterNumber: number; startOffset: number; endOffset: number }
  >;
};

export type BibliographyInput = {
  title: string;
  author: string;
  /** If provided, the model is asked to use this slug instead of generating one.
   *  Useful for resuming a research run on an existing bookId. */
  bookIdHint?: string;
  /**
   * R-046 — the FROZEN, normalized source text of the book. When present the
   * model reads the real edition instead of recalling one, and must additionally
   * return `chapterMap`: one span per chapter, resolved and validated here so a
   * bad map comes back as retry feedback rather than as a wrong span handed to a
   * chapter researcher.
   */
  sourceText?: string;
};

const REGISTER_VALUES = new Set(["warm", "analytical", "plainspoken", "literary", "clinical"]);
const CONFIDENCE_VALUES = new Set(["high", "medium", "low"]);
const GENRE_VALUES = new Set<string>(BIBLIOGRAPHY_GENRES);

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
  if (typeof input.sourceText === "string" && input.sourceText.length > 0) {
    const view = buildBibliographyTextView(input.sourceText);
    parts.push(`# THE BOOK ITSELF`);
    parts.push(
      view.mode === "whole"
        ? `Below is the complete text of this book (${view.sourceTextLength} characters). Read its own contents page and its own chapter divisions — do not recall a chapter list from memory.`
        : `This book is ${view.sourceTextLength} characters long, too long to include whole. Below are its front matter verbatim (which contains the printed contents page), the OFFSET LIST — every place in the book a chapter span may start or end, with its character offset — and excerpts spaced evenly through the body. Build the chapter list from THESE, not from memory.`,
    );
    parts.push("");
    parts.push(renderUntrustedSourceBlock(`Source text — ${input.title}`, view.text));
    parts.push("");
    parts.push(`# Also return: chapterMap`);
    // ONE statement of the contract, rendered from the module that enforces it
    // (R-046, review round 2). A long book cannot satisfy the anchor contract —
    // it is shown neither its chapters' last sentences nor a unique title — so
    // the outline view publishes offsets and this asks the model to copy them.
    for (const line of chapterMapContractLines(input.sourceText)) parts.push(line);
    parts.push("");
    parts.push(`Set \`genre\` too: "memoir" for an autobiography or memoir (the author is the SUBJECT of the book), otherwise "narrative-nonfiction", "practical", "argument" or "reference".`);
    parts.push("");
  }
  parts.push(
    typeof input.sourceText === "string" && input.sourceText.length > 0
      ? `Return the canonical bibliographic record and the full chapter list AS THIS EDITION PRINTS IT, plus the chapterMap.`
      : `Return the canonical bibliographic record and full chapter list. If you do not recognize this title and author with high confidence, set confidence to "low" and explain in notes — do not invent a chapter list.`,
  );
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

  // R-053: an unknown genre string is rejected so a typo cannot silently
  // neutralise the memoir carve-out. Absent is fine — it means "not classified".
  if (r.genre !== undefined && !GENRE_VALUES.has(r.genre)) {
    problems.push(`genre ${JSON.stringify(r.genre)} not one of ${[...GENRE_VALUES].join("/")} (or omit it)`);
  }

  // Confidence
  if (!CONFIDENCE_VALUES.has(r.confidence)) {
    problems.push(`confidence "${r.confidence}" not one of high/medium/low`);
  }
  // A low-confidence bibliography is NOT rejected here: it is the model's honest
  // signal about its own knowledge, and rejecting it would only reward a model
  // that overstates confidence. R-035: it used to be surfaced into an empty `if`
  // block and a stdout line, so nothing durable recorded it. createResearchRun
  // (src/researcher.ts) now writes a `bibliography.low_confidence` event into the
  // research run manifest, which is the artifact a later reviewer actually reads.

  // R-046 — the chapter map. Validated HERE, inside the retry loop, so a bad map
  // comes back to the model as feedback naming the exact anchor instead of
  // reaching a chapter researcher as a wrong span. Only demanded when the run
  // actually has text; without it the field must be absent.
  if (typeof input.sourceText === "string" && input.sourceText.length > 0) {
    if (chapters.length === 0) {
      problems.push("chapterMap cannot be checked because the chapter list is empty");
    } else if (r.chapterMap === undefined) {
      problems.push(chapterMapMissingProblem(input.sourceText));
    } else {
      const resolved = resolveChapterMap({
        bookId: typeof r.bookId === "string" ? r.bookId : "",
        sourceText: input.sourceText,
        sourceTextSha256: "",
        chapters: chapters.map((chapter) => ({ number: chapter.number, title: chapter.title })),
        spans: r.chapterMap,
      });
      problems.push(...resolved.problems);
    }
  } else if (r.chapterMap !== undefined) {
    problems.push("chapterMap was returned but this run has no source text to anchor it in — omit the field");
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
