/**
 * Writer — chapter breakdown.
 *
 * Produces easy/medium/hard prose for one chapter. Single canonical voice
 * (not the v13 tone matrix). Output is plain strings per tier.
 */

import { readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import {
  renderUntrustedSourceBlock,
  runJsonModelTask,
  type ModelCallerExecution,
} from "../app/modelTaskRunner.js";
import { BookBrief, ChapterDesignDoc, PriorChapterShapes, SourceAnchorForPrompt } from "../types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = resolve(__dirname, "../../prompts");

export type BreakdownOutput = {
  fastRead: string;
  deepRead: string;
  fullRead: string;
  sourceAnchorIds?: {
    fastRead?: string[];
    deepRead?: string[];
    fullRead?: string[];
  };
};

export type BreakdownInput = {
  brief: BookBrief;
  plan: ChapterDesignDoc;
  chapterSource?: string;
  /** Shapes of every prior chapter in this book. The writer uses this to
   *  diversify the counterintuition shape away from over-used patterns. */
  priorChapterShapes?: PriorChapterShapes;
  sourceAnchors?: SourceAnchorForPrompt[];
};

export async function runWriterBreakdown(
  input: BreakdownInput,
  execution?: ModelCallerExecution,
): Promise<BreakdownOutput> {
  const systemPrompt = readFileSync(
    resolve(PROMPTS_DIR, "writer-breakdown.system.md"),
    "utf8",
  );
  const userPrompt = buildUserPrompt(input);
  const output = await runJsonModelTask<BreakdownOutput>(execution, "writer-breakdown", systemPrompt, userPrompt);
  return validateBreakdown(output, input);
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
    parts.push(renderUntrustedSourceBlock("Chapter source excerpt", input.chapterSource));
    parts.push("Reference only. Do not quote without attribution, and do not narrate the source.");
  }
  if (input.priorChapterShapes && input.priorChapterShapes.priorCounterShapes.length > 0) {
    parts.push("");
    parts.push(`# Prior chapter context`);
    parts.push("If any single counterintuition shape has been used in 40%+ of prior chapters, do NOT use that shape for this counterintuition. Pick a different paradox-signal shape.");
    parts.push("");
    parts.push("```json");
    parts.push(JSON.stringify(input.priorChapterShapes, null, 2));
    parts.push("```");
  }
  if (input.sourceAnchors && input.sourceAnchors.length > 0) {
    parts.push("");
    parts.push(renderUntrustedSourceBlock("Allowed source anchors", JSON.stringify(input.sourceAnchors, null, 2), "json"));
    parts.push("Use only these ids. Emit sourceAnchorIds.fastRead, sourceAnchorIds.deepRead, and sourceAnchorIds.fullRead with the anchors supporting each tier's claims.");
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
  /\bchapter\s+\d+\b/i,
];

function findMetaReference(text: string): string | null {
  for (const re of META_REGEXES) {
    const m = text.match(re);
    if (m) return m[0];
  }
  return null;
}

function validateBreakdown(b: BreakdownOutput, input: BreakdownInput): BreakdownOutput {
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
  if (input.sourceAnchors && input.sourceAnchors.length > 0) {
    const allowed = new Set(input.sourceAnchors.map((anchor) => anchor.id));
    for (const tier of tiers) {
      const ids = b.sourceAnchorIds?.[tier];
      if (!Array.isArray(ids) || ids.length === 0) {
        problems.push(`sourceAnchorIds.${tier} must cite at least one allowed source anchor`);
        continue;
      }
      for (const id of ids) {
        if (typeof id !== "string" || !allowed.has(id)) problems.push(`sourceAnchorIds.${tier} cites unsupported source anchor ${JSON.stringify(id)}`);
      }
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
