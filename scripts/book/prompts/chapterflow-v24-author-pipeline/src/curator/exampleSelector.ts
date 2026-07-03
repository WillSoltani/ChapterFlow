/**
 * Example curator. Given N candidate examples for a single ExampleSpec, picks
 * the strongest one using a small model (Haiku by default).
 *
 * This is the cheapest high-leverage quality lever in the pipeline. The
 * writer produces candidates quickly; the curator filters out the competent-
 * but-safe ones so the chapter ships with memorable scenes.
 */

import { readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { callClaude } from "../claudeClient.js";
import { BookBrief, ChapterDesignDoc } from "../types.js";
import { ExampleOutput } from "../agents/writer-example.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = resolve(__dirname, "../../prompts");

export type CurateResult = {
  winnerIndex: number;
  reason: string;
  scoreSheet: Array<{
    index: number;
    namedProtagonist: boolean;
    specificScene: boolean;
    hitsRequiredBeat: boolean;
    voiceMatch: boolean;
    standoutDetail: boolean;
    score: number;
    note?: string;
  }>;
  needsRegeneration?: boolean;
};

export type CurateInput = {
  brief: BookBrief;
  plan: ChapterDesignDoc;
  spec: ChapterDesignDoc["exampleSpecs"][number];
  candidates: ExampleOutput[];
};

export async function runExampleCurator(input: CurateInput): Promise<CurateResult> {
  const systemPrompt = readFileSync(resolve(PROMPTS_DIR, "example-curator.system.md"), "utf8");
  const parts: string[] = [];
  parts.push(`# Book brief (voice specimens and anti-specimens)`);
  parts.push("```json");
  parts.push(JSON.stringify({
    voiceCharter: input.brief.voiceCharter,
    voiceSpecimens: input.brief.voiceSpecimens ?? [],
    voiceAntiSpecimens: input.brief.voiceAntiSpecimens ?? [],
  }, null, 2));
  parts.push("```");
  parts.push("");
  parts.push(`# ExampleSpec the candidates were written for`);
  parts.push("```json");
  parts.push(JSON.stringify(input.spec, null, 2));
  parts.push("```");
  parts.push("");
  parts.push(`# Candidates`);
  input.candidates.forEach((c, i) => {
    parts.push(`## Candidate [${i}]`);
    parts.push(`title: ${c.title}`);
    parts.push(`scenario: ${c.scenario}`);
    parts.push(`whatToDo: ${c.whatToDo}`);
    parts.push(`whyItMatters: ${c.whyItMatters}`);
    parts.push("");
  });
  parts.push(`Score each candidate and output the JSON.`);

  const result = await callClaude<CurateResult>({
    tier: "critic",
    stage: "example-curator",
    bookId: input.brief.bookId,
    chapterId: input.plan.chapterId, // Haiku — cheap enough to run 6×/chapter
    system: systemPrompt,
    user: parts.join("\n"),
    maxTokens: 2000,
    temperature: 0.2,
    jsonMode: true,
    timeoutMs: 240_000,
  });

  // Fallback defense if the model forgot fields
  const r = result.content;
  if (typeof r.winnerIndex !== "number" || r.winnerIndex < 0 || r.winnerIndex >= input.candidates.length) {
    // Pick the longest scenario as a crude fallback (correlates weakly with quality).
    const idx = input.candidates.reduce((best, c, i) => c.scenario.length > input.candidates[best].scenario.length ? i : best, 0);
    return { winnerIndex: idx, reason: "curator fallback: longest scenario", scoreSheet: [] };
  }
  return r;
}
