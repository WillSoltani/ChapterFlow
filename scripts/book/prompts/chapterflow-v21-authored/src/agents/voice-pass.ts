/**
 * Voice-pass reviser.
 *
 * Takes draft breakdown prose and rewrites each tier toward the book's voice
 * specimens. Preserves scenes, length, reading level, and progressive-tier
 * structure. Kills generic closings, reduces metaphor density, surfaces the
 * author's signature move, and breaks cross-tier repetition.
 *
 * One Opus call per chapter. Adds ~30–60s to the pipeline.
 */

import { readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { callClaude } from "../claudeClient.js";
import { BookBrief, ChapterDesignDoc } from "../types.js";
import { BreakdownOutput } from "./writer-breakdown.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = resolve(__dirname, "../../prompts");

export type VoicePassInput = {
  brief: BookBrief;
  plan: ChapterDesignDoc;
  draft: BreakdownOutput;
  /** Optional targeted guidance from a prior critic run. Used by iterative
   *  voice-pass: "these specific findings came up in the last pass, fix them." */
  priorFindings?: string[];
};

export async function runVoicePass(input: VoicePassInput): Promise<BreakdownOutput> {
  const systemPrompt = readFileSync(
    resolve(PROMPTS_DIR, "voice-pass.system.md"),
    "utf8",
  );

  const parts: string[] = [];
  parts.push(`# Book brief (voice charter and specimens)`);
  parts.push("```json");
  parts.push(JSON.stringify({
    voiceCharter: input.brief.voiceCharter,
    voiceSpecimens: input.brief.voiceSpecimens ?? [],
    voiceAntiSpecimens: input.brief.voiceAntiSpecimens ?? [],
    forbiddenMoves: input.brief.forbiddenMoves,
  }, null, 2));
  parts.push("```");
  parts.push("");
  parts.push(`# Chapter design doc (for context only — do not add scenes not in the draft)`);
  parts.push("```json");
  parts.push(JSON.stringify({ coreMove: input.plan.coreMove, title: input.plan.title }, null, 2));
  parts.push("```");
  parts.push("");
  parts.push(`# Draft breakdown to revise`);
  parts.push("```json");
  parts.push(JSON.stringify(input.draft, null, 2));
  parts.push("```");
  parts.push("");
  if (input.priorFindings && input.priorFindings.length > 0) {
    parts.push(`# Specific issues from the last pass — fix these directly`);
    for (const f of input.priorFindings) parts.push(`- ${f}`);
    parts.push("");
  }
  parts.push(`Rewrite the three tiers toward the voice specimens. Return the VoicePassOutput JSON now.`);

  const result = await callClaude<BreakdownOutput>({
    tier: "writer",
    system: systemPrompt,
    user: parts.join("\n"),
    maxTokens: 6000,
    temperature: 0.6,
    jsonMode: true,
    // 600s ceiling: voice-pass rewrites all three breakdown tiers
    // (~5000 chars total), same wall-clock risk profile as writer-breakdown.
    timeoutMs: 600_000,
  });

  return validate(result.content, input.draft);
}

function validate(out: BreakdownOutput, draft: BreakdownOutput): BreakdownOutput {
  const problems: string[] = [];
  // Target length ranges per tier (match writer-breakdown's validator bounds).
  // The voice pass is allowed to move the draft to anywhere inside these
  // bounds — it's fine to expand a too-short fastRead up to 900c or trim a
  // bloated fullRead down to 2000c.
  const bounds: Record<"fastRead" | "deepRead" | "fullRead", [number, number]> = {
    fastRead: [350, 900],
    deepRead: [1000, 2200],
    fullRead: [2000, 4200],
  };
  for (const tier of ["fastRead", "deepRead", "fullRead"] as const) {
    const text = out[tier];
    if (!text || typeof text !== "string") {
      problems.push(`${tier} missing or not a string`);
      continue;
    }
    const [min, max] = bounds[tier];
    if (text.length < min) problems.push(`${tier} too short (${text.length} < ${min})`);
    if (text.length > max) problems.push(`${tier} too long (${text.length} > ${max})`);
    if (text.includes("\u2014")) problems.push(`${tier} contains em dash`);
    // Defense in depth: meta-reference check
    const metaRegexes = [
      /\bthis chapter\b/i, /\bthe chapter\b/i, /\bthe author\b/i, /\bthe book\b/i,
      /\bin this (chapter|section|book|law)\b/i, /\bchapter\s+\d+\b/,
    ];
    for (const re of metaRegexes) {
      const m = text.match(re);
      if (m) { problems.push(`${tier} contains meta-reference "${m[0]}"`); break; }
    }
  }
  if (problems.length > 0) throw new Error(`voice pass invalid: ${problems.join("; ")}`);
  return out;
}
