/**
 * Writer — hook (+ optional counterintuition).
 *
 * The hook is a single arresting sentence at the top of a chapter. The
 * counterintuition is an optional 1–2 sentence surfacing of what makes the
 * chapter's idea non-obvious. One small Opus call per chapter.
 */

import { readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { callClaude } from "../claudeClient.js";
import { renderUntrustedSourceBlock } from "../providers/types.js";
import { BookBrief, ChapterDesignDoc, PriorChapterShapes, SourceAnchorForPrompt } from "../types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = resolve(__dirname, "../../prompts");

export type HookOutput = {
  hook: string;
  counterintuition?: string;
  sourceAnchorIds?: string[];
  counterintuitionSourceAnchorIds?: string[];
};

export type HookInput = {
  brief: BookBrief;
  plan: ChapterDesignDoc;
  /** Shapes of every prior chapter in this book. The writer uses this to
   *  diversify away from over-used first words and counter shapes. */
  priorChapterShapes?: PriorChapterShapes;
  sourceAnchors?: SourceAnchorForPrompt[];
};

export async function runWriterHook(input: HookInput): Promise<HookOutput> {
  const systemPrompt = readFileSync(resolve(PROMPTS_DIR, "writer-hook.system.md"), "utf8");
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
  if (input.priorChapterShapes && (input.priorChapterShapes.priorHookFirstWords.length > 0 || input.priorChapterShapes.priorCounterShapes.length > 0)) {
    parts.push(`# Prior chapter context`);
    parts.push("Use this list to AVOID over-using any single first word. If a first word has already been used in 50%+ of prior chapters, do NOT use it for this hook. Pick a different opener structure.");
    parts.push("");
    parts.push("```json");
    parts.push(JSON.stringify(input.priorChapterShapes, null, 2));
    parts.push("```");
    parts.push("");
  }
  if (input.sourceAnchors && input.sourceAnchors.length > 0) {
    parts.push(renderUntrustedSourceBlock("Allowed source anchors", JSON.stringify(input.sourceAnchors, null, 2), "json"));
    parts.push("Use only these ids. Emit sourceAnchorIds for hook and counterintuitionSourceAnchorIds when counterintuition is present.");
    parts.push("");
  }
  parts.push(`Write the HookOutput JSON now.`);
  const userPrompt = parts.join("\n");

  const result = await callClaude<HookOutput>({
    tier: "writer",
    stage: "writer-hook",
    bookId: input.brief.bookId,
    chapterId: input.plan.chapterId,
    system: systemPrompt,
    user: userPrompt,
    maxTokens: 800,
    temperature: 0.75,
    jsonMode: true,
    timeoutMs: 90_000,
  });
  return validate(result.content, input);
}

function validate(h: HookOutput, input: HookInput): HookOutput {
  const problems: string[] = [];
  if (!h.hook || typeof h.hook !== "string") {
    problems.push("hook missing");
  } else {
    if (h.hook.length < 40) problems.push(`hook too short (${h.hook.length})`);
    if (h.hook.length > 160) problems.push(`hook too long (${h.hook.length})`);
    // Reject meta openers
    if (/^\s*(in this (chapter|book)|this chapter|the chapter|the author)/i.test(h.hook)) {
      problems.push(`hook opens with meta-reference: "${h.hook.slice(0, 50)}"`);
    }
  }
  if (h.counterintuition !== undefined) {
    if (h.counterintuition.length < 80) problems.push("counterintuition too short — omit it instead");
    if (h.counterintuition.length > 500) problems.push("counterintuition too long");
  }
  if (input.sourceAnchors && input.sourceAnchors.length > 0) {
    const allowed = new Set(input.sourceAnchors.map((anchor) => anchor.id));
    const check = (label: string, ids: unknown) => {
      if (!Array.isArray(ids) || ids.length === 0) {
        problems.push(`${label} must cite at least one allowed source anchor`);
        return;
      }
      for (const id of ids) {
        if (typeof id !== "string" || !allowed.has(id)) problems.push(`${label} cites unsupported source anchor ${JSON.stringify(id)}`);
      }
    };
    check("sourceAnchorIds", h.sourceAnchorIds);
    if (h.counterintuition !== undefined) check("counterintuitionSourceAnchorIds", h.counterintuitionSourceAnchorIds);
  }
  if (problems.length > 0) throw new Error(`hook invalid: ${problems.join("; ")}`);
  return h;
}
