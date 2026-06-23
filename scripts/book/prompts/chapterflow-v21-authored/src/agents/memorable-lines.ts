/**
 * Memorable-lines marker. Reads a finished chapter and picks the 3 most
 * memorable sentences. Downstream UI uses these for highlights, share cards,
 * end-of-chapter recap.
 *
 * Runs AFTER line-editor (and after assembly). Cheap — Haiku-class. ~10s.
 */

import { readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { callClaude } from "../claudeClient.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = resolve(__dirname, "../../prompts");

export type MemorableLine = {
  text: string;
  location: string;
  why: string;
  sourceAnchorIds?: string[];
};

export type MemorableLinesOutput = {
  memorableLines: MemorableLine[];
};

export async function runMemorableLines(chapter: any): Promise<MemorableLinesOutput> {
  const systemPrompt = readFileSync(resolve(PROMPTS_DIR, "memorable-lines.system.md"), "utf8");

  const result = await callClaude<MemorableLinesOutput>({
    tier: "critic",
    system: systemPrompt,
    user: `# Chapter\n\n\`\`\`json\n${JSON.stringify(chapter, null, 2)}\n\`\`\`\n\nPick the three most memorable lines. Return the JSON now.`,
    maxTokens: 1500,
    temperature: 0.4,
    jsonMode: true,
    timeoutMs: 90_000,
  });

  const out = result.content;
  if (!Array.isArray(out.memorableLines)) {
    throw new Error("memorable-lines: missing memorableLines array");
  }
  if (out.memorableLines.length !== 3) {
    // Trim or warn — the marker prompt asks for exactly 3, but be lenient.
    out.memorableLines = out.memorableLines.slice(0, 3);
    if (out.memorableLines.length === 0) {
      throw new Error("memorable-lines returned 0 lines");
    }
  }
  for (const line of out.memorableLines) {
    if (!line.text || line.text.length < 20) {
      throw new Error(`memorable-line text too short: "${line.text}"`);
    }
    if (line.text.includes("—")) {
      throw new Error(`memorable-line contains em dash: "${line.text}"`);
    }
  }
  return out;
}
