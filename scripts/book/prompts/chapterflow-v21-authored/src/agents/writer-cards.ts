/**
 * Writer — review cards.
 *
 * Produces the retrieval-practice cards for one chapter. Respects
 * ChapterDesignDoc.cardFocus.count exactly.
 */

import { readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { callClaude } from "../claudeClient.js";
import { BookBrief, ChapterDesignDoc } from "../types.js";
import { BreakdownOutput } from "./writer-breakdown.js";
import { sanitizeUserPromptForWriter } from "../lib/brief-sanitizer.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = resolve(__dirname, "../../prompts");

export type CardsOutput = {
  cards: Array<{
    cardId: string;
    front: string;
    back: string;
    difficulty: "easy" | "medium" | "hard";
  }>;
};

export type CardsInput = {
  brief: BookBrief;
  plan: ChapterDesignDoc;
  breakdown: BreakdownOutput;
};

const MAX_CARDS_RETRIES = 1;

export async function runWriterCards(input: CardsInput): Promise<CardsOutput> {
  const systemPrompt = readFileSync(
    resolve(PROMPTS_DIR, "writer-cards.system.md"),
    "utf8",
  );
  // Defense-in-depth against B9 reverse-priming: the system prompt is
  // structural-only (no named prohibitions), the brief is sanitized upstream,
  // and we additionally drop any line in the rendered user prompt that
  // contains a meta-tell (could leak from the plan or breakdown).
  const userPrompt = sanitizeUserPromptForWriter(buildUserPrompt(input));

  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= MAX_CARDS_RETRIES; attempt += 1) {
    try {
      const result = await callClaude<CardsOutput>({
        tier: "writer",
        system: systemPrompt,
        user: userPrompt,
        maxTokens: 6000,
        temperature: 0.65,
        jsonMode: true,
        timeoutMs: 240_000,
      });
      return validateCards(result.content, input);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt === MAX_CARDS_RETRIES) break;
    }
  }
  throw lastError ?? new Error("cards: writer exhausted retries with no result");
}

function buildUserPrompt(input: CardsInput): string {
  const parts: string[] = [];
  parts.push(`# Book brief`);
  parts.push("```json");
  parts.push(JSON.stringify(input.brief, null, 2));
  parts.push("```");
  parts.push("");
  parts.push(`# Chapter design doc`);
  parts.push("```json");
  parts.push(JSON.stringify(input.plan, null, 2));
  parts.push("```");
  parts.push("");
  parts.push(`# Chapter breakdown (for grounding — DO NOT quote)`);
  parts.push("## deepRead");
  parts.push(input.breakdown.deepRead);
  parts.push("");
  parts.push(`Write the CardsOutput JSON now. Emit exactly ${input.plan.cardFocus.count} cards.`);
  return parts.join("\n");
}

function validateCards(c: CardsOutput, input: CardsInput): CardsOutput {
  const problems: string[] = [];
  if (!Array.isArray(c.cards)) throw new Error("cards missing");
  if (c.cards.length !== input.plan.cardFocus.count) {
    problems.push(`card count ${c.cards.length} != expected ${input.plan.cardFocus.count}`);
  }
  const badFrontPattern = /^\s*(what does (the )?(chapter|book|author)|according to|how does (the )?(chapter|book))/i;
  // Defense in depth: ship gate also catches these, but failing here forces the
  // writer's retry loop to fire instead of quarantining the chapter post-assembly.
  const metaRegexes = [
    /\bthis chapter\b/i,
    /\bthe chapter\b/i,
    /\bthe author\b/i,
    /\bthe book\b/i,
    /\bin this (chapter|section|book|law)\b/i,
    /\bchapter\s+\d+\b/,
  ];
  for (const [i, card] of c.cards.entries()) {
    if (!card.front || card.front.length < 30) problems.push(`rc${i} front too short`);
    if (!card.back || card.back.length < 60) problems.push(`rc${i} back too short`);
    if (badFrontPattern.test(card.front)) {
      problems.push(`rc${i} front starts with recall-about-text phrasing: "${card.front.slice(0, 60)}"`);
    }
    if (!["easy","medium","hard"].includes(card.difficulty)) {
      problems.push(`rc${i} non-canonical difficulty "${card.difficulty}"`);
    }
    const cardText = `${card.front} ${card.back}`;
    for (const re of metaRegexes) {
      const m = cardText.match(re);
      if (m) {
        problems.push(`rc${i} contains meta-reference "${m[0]}"`);
        break;
      }
    }
    card.cardId = `rc${String(i + 1).padStart(2, "0")}`;
  }
  if (problems.length > 0) throw new Error(`cards invalid: ${problems.join("; ")}`);
  return c;
}
