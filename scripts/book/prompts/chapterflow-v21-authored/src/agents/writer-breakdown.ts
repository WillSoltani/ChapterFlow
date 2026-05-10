/**
 * Writer — chapter breakdown.
 *
 * Produces easy/medium/hard prose for one chapter. Single canonical voice
 * (not the v13 tone matrix). Output is plain strings per tier.
 */

import { readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { callClaude } from "../claudeClient.js";
import { BookBrief, ChapterDesignDoc } from "../types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = resolve(__dirname, "../../prompts");

export type BreakdownOutput = {
  fastRead: string;
  deepRead: string;
  fullRead: string;
};

export type BreakdownInput = {
  brief: BookBrief;
  plan: ChapterDesignDoc;
  chapterSource?: string;
};

const MAX_BREAKDOWN_RETRIES = 2;

export async function runWriterBreakdown(input: BreakdownInput): Promise<BreakdownOutput> {
  const systemPrompt = readFileSync(
    resolve(PROMPTS_DIR, "writer-breakdown.system.md"),
    "utf8",
  );
  const baseUserPrompt = buildUserPrompt(input);

  let userPrompt = baseUserPrompt;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_BREAKDOWN_RETRIES; attempt += 1) {
    const result = await callClaude<BreakdownOutput>({
      tier: "writer",
      system: systemPrompt,
      user: userPrompt,
      maxTokens: 5000,
      temperature: 0.7,
      jsonMode: true,
      timeoutMs: 300_000,
    });

    try {
      return validateBreakdown(result.content);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt === MAX_BREAKDOWN_RETRIES) break;
      // Re-prompt the writer with structural guidance, NOT by repeating the
      // forbidden phrases (which would make the model more likely to output
      // them via negative-prompting / reverse-priming).
      const reasons = lastError.message
        .replace(/^breakdown invalid:\s*/, "- ")
        .replace(/;\s*/g, "\n- ");
      userPrompt = [
        baseUserPrompt,
        "",
        "# Your previous draft was rejected by the validator.",
        "Reasons:",
        reasons,
        "",
        "Rewrite all three tiers from scratch. Address the reader directly: open each tier with a scene, a question, a specific person, or a concrete image. Speak to the reader, not about the source artifact. The reader has never heard of the source you read; they only see your prose.",
      ].join("\n");
    }
  }

  throw lastError ?? new Error("breakdown: writer exhausted retries with no result");
}

function buildUserPrompt(input: BreakdownInput): string {
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
  if (input.chapterSource) {
    parts.push("");
    parts.push(`# Chapter source excerpt (reference only — do not quote without attribution, do not narrate the source)`);
    parts.push(input.chapterSource);
  }
  parts.push("");
  parts.push(`Write the BreakdownOutput JSON now (easy, medium, hard).`);
  return parts.join("\n");
}

const META_REGEXES = [
  /\bthis chapter\b/i,
  /\bthe chapter\b/i,
  /\bthe author\b/i,
  /\bthe book\b/i,
  /\bin this (chapter|section|book|law)\b/i,
  /\bchapter\s+\d+\b/,
];

function findMetaReference(text: string): string | null {
  for (const re of META_REGEXES) {
    const m = text.match(re);
    if (m) return m[0];
  }
  return null;
}

function validateBreakdown(b: BreakdownOutput): BreakdownOutput {
  const problems: string[] = [];
  const tiers = ["fastRead", "deepRead", "fullRead"] as const;
  for (const tier of tiers) {
    const text = b[tier];
    if (!text || typeof text !== "string") {
      problems.push(`${tier} tier missing or not a string`);
      continue;
    }
    const bounds: Record<typeof tier, [number, number]> = {
      fastRead: [350, 900],
      deepRead: [1000, 2200],
      fullRead: [2000, 4200],
    };
    const [min, max] = bounds[tier];
    if (text.length < min) problems.push(`${tier} too short (${text.length} < ${min})`);
    if (text.length > max) problems.push(`${tier} too long (${text.length} > ${max})`);
    // Defense in depth: the ship gate catches this too, but failing here forces
    // the writer to retry instead of wasting a voice-pass + line-edit on bad input.
    if (text.includes("—")) problems.push(`${tier} contains em dash`);
    const meta = findMetaReference(text);
    if (meta) problems.push(`${tier} contains meta-reference "${meta}" — teach the idea, don't narrate the chapter`);
  }

  // Progressiveness: the three tiers must not open with the same sentence.
  if (b.fastRead && b.deepRead) {
    const f = firstSentence(b.fastRead);
    const d = firstSentence(b.deepRead);
    if (f && d && f === d) {
      problems.push(`fastRead and deepRead open with identical first sentence — tiers must be progressive, not redundant`);
    }
  }
  if (b.deepRead && b.fullRead) {
    const d = firstSentence(b.deepRead);
    const h = firstSentence(b.fullRead);
    if (d && h && d === h) {
      problems.push(`deepRead and fullRead open with identical first sentence`);
    }
  }
  if (b.fastRead && b.fullRead) {
    const f = firstSentence(b.fastRead);
    const h = firstSentence(b.fullRead);
    if (f && h && f === h) {
      problems.push(`fastRead and fullRead open with identical first sentence`);
    }
  }

  if (problems.length > 0) {
    throw new Error(`breakdown invalid: ${problems.join("; ")}`);
  }
  return b;
}

function firstSentence(text: string): string {
  const match = text.match(/^[^.!?]+[.!?]/);
  return match ? match[0].trim() : text.slice(0, 100).trim();
}
