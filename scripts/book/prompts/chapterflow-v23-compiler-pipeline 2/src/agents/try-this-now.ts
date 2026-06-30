/**
 * `tryThisNow` agent. Replaces the old reflection-prompts pair.
 *
 * Generates ONE specific, bounded, self-revealing directive the reader can do
 * in 30–90 seconds. Renders as a mid-chapter callout, no input required, no
 * textarea, no "reflect on..." framing. Pure action.
 *
 * Cheap — Haiku-class. ~10s.
 */

import { readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { callClaude } from "../claudeClient.js";
import { BookBrief, ChapterDesignDoc } from "../types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = resolve(__dirname, "../../prompts");

export type TryThisNowOutput = {
  tryThisNow: string;
};

export type TryThisNowInput = {
  brief: BookBrief;
  plan: ChapterDesignDoc;
};

export async function runTryThisNow(input: TryThisNowInput): Promise<TryThisNowOutput> {
  const systemPrompt = readFileSync(resolve(PROMPTS_DIR, "try-this-now.system.md"), "utf8");
  const userPrompt = `# Book brief\n\`\`\`json\n${JSON.stringify({ voiceCharter: input.brief.voiceCharter, voiceSpecimens: (input.brief.voiceSpecimens ?? []).slice(0, 3) }, null, 2)}\n\`\`\`\n\n# Chapter design doc\n\`\`\`json\n${JSON.stringify({ title: input.plan.title, coreMove: input.plan.coreMove }, null, 2)}\n\`\`\`\n\nWrite the TryThisNowOutput JSON now.`;

  const result = await callClaude<TryThisNowOutput>({
    tier: "critic",
    stage: "try-this-now",
    bookId: input.brief.bookId,
    chapterId: input.plan.chapterId,
    system: systemPrompt,
    user: userPrompt,
    maxTokens: 400,
    temperature: 0.7,
    jsonMode: true,
    timeoutMs: 60_000,
  });

  return validate(result.content);
}

const FORBIDDEN_OPENERS = [
  /^\s*(reflect on|consider|think about|notice your)/i,
  /^\s*(what does|how do|why do|when do)\s/i,
];

function validate(out: TryThisNowOutput): TryThisNowOutput {
  const problems: string[] = [];
  const text = out.tryThisNow;
  if (!text || typeof text !== "string") {
    problems.push("tryThisNow missing");
  } else {
    if (text.length < 60) problems.push(`tryThisNow too short (${text.length} < 60)`);
    if (text.length > 280) problems.push(`tryThisNow too long (${text.length} > 280)`);
    if (text.includes("—")) problems.push("tryThisNow contains em dash");
    if (/\b(this chapter|the chapter|the author|the book)\b/i.test(text)) {
      problems.push("tryThisNow contains meta-reference");
    }
    for (const re of FORBIDDEN_OPENERS) {
      if (re.test(text)) {
        problems.push(`tryThisNow opens with reflection/question framing — must be a directive, not a question`);
        break;
      }
    }
  }
  if (problems.length > 0) throw new Error(`tryThisNow invalid: ${problems.join("; ")}`);
  return out;
}
