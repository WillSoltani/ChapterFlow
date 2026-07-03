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
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { callClaude } from "../claudeClient.js";

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

/** Run bibliography research with retry. Up to 3 attempts; if all attempts fail
 *  validation, the last error propagates. */
export async function runResearcherBibliography(input: BibliographyInput): Promise<BibliographyResult> {
  const systemPrompt = readFileSync(resolve(PROMPTS_DIR, "researcher-bibliography.system.md"), "utf8");
  const userPrompt = buildUserPrompt(input);

  let attempt = 0;
  let lastErr: Error | null = null;
  while (attempt < 3) {
    attempt += 1;
    try {
      const retryUser =
        attempt === 1
          ? userPrompt
          : [
              userPrompt,
              "",
              "# Your previous draft was rejected.",
              "Reasons:",
              lastErr ? lastErr.message.replace(/^bibliography invalid:\s*/, "- ").replace(/;\s*/g, "\n- ") : "",
              "",
              "Rewrite the BibliographyResult JSON, addressing every reason. Take more care on chapter list accuracy; if you're not sure of the chapter count, set confidence to low and explain.",
            ].join("\n");
      const result = await callClaude<BibliographyResult>({
        tier: "researcher",
        stage: "researcher-bibliography",
        bookId: input.bookIdHint,
        system: systemPrompt,
        user: retryUser,
        maxTokens: 8000,
        temperature: 0.3, // low temperature for factual recall
        jsonMode: true,
        timeoutMs: 360_000,
      });
      return validateBibliography(result.content, input);
    } catch (err) {
      lastErr = err as Error;
    }
  }
  throw lastErr ?? new Error("bibliography researcher failed after retries");
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
