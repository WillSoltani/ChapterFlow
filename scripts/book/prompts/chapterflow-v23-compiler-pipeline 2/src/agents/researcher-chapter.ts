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

import { callClaude } from "../claudeClient.js";
import { BibliographyResult } from "./researcher-bibliography.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = resolve(__dirname, "../../prompts");

export type ChapterResearchResult = {
  chapterNumber: number;
  chapterTitle: string;
  focus: string;
  coreClaim: string;
  centralConcept: {
    name: string;
    plainDefinition: string;
    whyItMatters: string;
  };
  keyClaims: string[];
  namedExamples: Array<{
    label: string;
    summary: string;
    teachesWhat: string;
  }>;
  hardEdge: string;
  voiceCues: string[];
  forbiddenLeakage?: string[];
  paraphraseNotes: string;
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

export async function runResearcherChapter(input: ChapterResearchInput): Promise<ChapterResearchResult> {
  const systemPrompt = readFileSync(resolve(PROMPTS_DIR, "researcher-chapter.system.md"), "utf8");
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
              lastErr ? lastErr.message.replace(/^chapter research invalid:\s*/, "- ").replace(/;\s*/g, "\n- ") : "",
              "",
              `Rewrite the ChapterResearchResult JSON for chapter ${input.chapter.number} "${input.chapter.title}". Address every reason. Be specific and paraphrase only. No "this chapter says…" or "the author argues…" anywhere.`,
            ].join("\n");
      const result = await callClaude<ChapterResearchResult>({
        tier: "researcher",
        stage: "researcher-chapter",
        bookId: input.bibliography.bookId,
        chapterId: `${input.bibliography.bookId}-ch${String(input.chapter.number).padStart(2, "0")}`,
        system: systemPrompt,
        user: retryUser,
        maxTokens: 4000,
        temperature: 0.5,
        jsonMode: true,
        timeoutMs: 240_000,
      });
      return validateChapterResearch(result.content, input);
    } catch (err) {
      lastErr = err as Error;
    }
  }
  throw lastErr ?? new Error(`chapter ${input.chapter.number} researcher failed after retries`);
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

function validateChapterResearch(r: ChapterResearchResult, input: ChapterResearchInput): ChapterResearchResult {
  const problems: string[] = [];
  if (!r || typeof r !== "object") throw new Error("chapter researcher returned non-object");

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

  if (problems.length > 0) {
    throw new Error(`chapter research invalid: ${problems.join("; ")}`);
  }
  return r;
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
