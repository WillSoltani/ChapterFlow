/**
 * Line editor — final surgical polish on breakdown text.
 *
 * Runs AFTER voice-pass. Identifies 3–10 sentence-level improvements per tier
 * (closers, openers, dragging sentences, mechanical transitions, abstract
 * nouns where concrete are available). Preserves structure, scenes, voice.
 *
 * One Opus/Sonnet call per chapter. Adds ~30–60s.
 */

import { readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { callClaude } from "../claudeClient.js";
import { BookBrief, ChapterDesignDoc } from "../types.js";
import { BreakdownOutput } from "./writer-breakdown.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = resolve(__dirname, "../../prompts");

export type LineEditInput = {
  brief: BookBrief;
  plan: ChapterDesignDoc;
  draft: BreakdownOutput;
};

export async function runLineEditor(input: LineEditInput): Promise<BreakdownOutput> {
  const systemPrompt = readFileSync(resolve(PROMPTS_DIR, "line-editor.system.md"), "utf8");

  const parts: string[] = [];
  parts.push(`# Book brief (voice charter and specimens)`);
  parts.push("```json");
  parts.push(JSON.stringify({
    voiceCharter: input.brief.voiceCharter,
    voiceSpecimens: input.brief.voiceSpecimens ?? [],
  }, null, 2));
  parts.push("```");
  parts.push("");
  parts.push(`# Chapter design doc (context only)`);
  parts.push("```json");
  parts.push(JSON.stringify({ coreMove: input.plan.coreMove, title: input.plan.title }, null, 2));
  parts.push("```");
  parts.push("");
  parts.push(`# Voice-passed breakdown to polish`);
  parts.push("```json");
  parts.push(JSON.stringify(input.draft, null, 2));
  parts.push("```");
  parts.push("");
  parts.push(`Polish at the sentence level. Return the LineEditOutput JSON now.`);

  const result = await callClaude<BreakdownOutput>({
    tier: "writer",
    system: systemPrompt,
    user: parts.join("\n"),
    maxTokens: 6000,
    temperature: 0.5,
    jsonMode: true,
    timeoutMs: 240_000,
  });

  return validate(result.content, input.draft);
}

function validate(out: BreakdownOutput, draft: BreakdownOutput): BreakdownOutput {
  const problems: string[] = [];
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
    if (text.includes("—")) problems.push(`${tier} contains em dash`);

    // Length tolerance ±15% from voice-passed input
    const draftLen = draft[tier]?.length ?? 0;
    if (draftLen > 0) {
      const ratio = text.length / draftLen;
      if (ratio < 0.7 || ratio > 1.3) {
        problems.push(`${tier} length ratio ${ratio.toFixed(2)} outside ±30% (was ${draftLen}c, now ${text.length}c)`);
      }
    }
  }
  if (problems.length > 0) throw new Error(`line edit invalid: ${problems.join("; ")}`);
  return out;
}
