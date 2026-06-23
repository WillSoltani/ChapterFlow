/**
 * Curriculum planner agent.
 *
 * Given a BookBrief and a target chapter (number + title), produces a
 * ChapterDesignDoc that decides the chapter's shape — example count, domains,
 * formats, quiz focus, card focus. One Opus call per chapter.
 *
 * This is the layer that breaks v13's template feel. The planner is allowed
 * to use 3 examples for some chapters and 9 for others; to pick domains that
 * suit the chapter's specific idea; and to vary Bloom's mix per chapter.
 */

import { readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { callClaude } from "../claudeClient.js";
import { BookBrief, ChapterDesignDoc, SourceAnchorForPrompt } from "../types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = resolve(__dirname, "../../prompts");

export type PlannerInput = {
  brief: BookBrief;
  chapterId: string;
  chapterNumber: number;
  chapterTitle: string;
  /** Optional source-text excerpt for THIS chapter. Improves planning fidelity. */
  chapterSource?: string;
  /** Validated source-v2 anchors the planner may use for design decisions. */
  sourceAnchors?: SourceAnchorForPrompt[];
};

export async function runCurriculumPlanner(input: PlannerInput): Promise<ChapterDesignDoc> {
  const systemPrompt = readFileSync(
    resolve(PROMPTS_DIR, "curriculum-planner.system.md"),
    "utf8",
  );

  const userPrompt = buildUserPrompt(input);
  const result = await callClaude<ChapterDesignDoc>({
    tier: "writer",
    system: systemPrompt,
    user: userPrompt,
    maxTokens: 3000,
    temperature: 0.6,
    jsonMode: true,
    timeoutMs: 240_000,
  });

  return validateDoc(result.content, input);
}

function buildUserPrompt(input: PlannerInput): string {
  const parts: string[] = [];
  parts.push(`# Book brief`);
  parts.push("```json");
  parts.push(JSON.stringify(input.brief, null, 2));
  parts.push("```");
  parts.push("");
  parts.push(`# Target chapter`);
  parts.push(`chapterId: ${input.chapterId}`);
  parts.push(`number: ${input.chapterNumber}`);
  parts.push(`title: ${input.chapterTitle}`);
  if (input.chapterSource) {
    parts.push("");
    parts.push(`# Chapter source evidence`);
    parts.push(input.chapterSource);
  }
  if (input.sourceAnchors && input.sourceAnchors.length > 0) {
    parts.push("");
    parts.push(`# Allowed source anchors`);
    parts.push("Use ONLY these ids in coreMoveSourceAnchorIds, exampleSpecs[].sourceAnchorIds, quizFocus.sourceAnchorIds, and cardFocus.sourceAnchorIds.");
    parts.push("```json");
    parts.push(JSON.stringify(input.sourceAnchors, null, 2));
    parts.push("```");
  }
  parts.push("");
  parts.push(`Write the ChapterDesignDoc JSON now.`);
  return parts.join("\n");
}

function validateDoc(doc: ChapterDesignDoc, input: PlannerInput): ChapterDesignDoc {
  const problems: string[] = [];
  if (!doc || typeof doc !== "object") {
    throw new Error("curriculum planner returned non-object");
  }
  // Enforce inputs match
  doc.chapterId = input.chapterId;
  doc.number = input.chapterNumber;
  doc.title = input.chapterTitle;

  if (!doc.coreMove || doc.coreMove.length < 10) {
    problems.push("coreMove missing or too short");
  }
  if (typeof doc.exampleCount !== "number" || doc.exampleCount < 3 || doc.exampleCount > 9) {
    problems.push(`exampleCount ${doc.exampleCount} out of range 3–9`);
  }
  if (!Array.isArray(doc.exampleSpecs) || doc.exampleSpecs.length !== doc.exampleCount) {
    problems.push(`exampleSpecs length ${doc.exampleSpecs?.length} must equal exampleCount ${doc.exampleCount}`);
  } else {
    const domains = doc.exampleSpecs.map((s) => s.domain.toLowerCase().trim());
    const unique = new Set(domains);
    if (unique.size !== domains.length) {
      problems.push(`exampleSpecs contain duplicate domains: ${domains.join(" | ")}`);
    }
    for (const [i, s] of doc.exampleSpecs.entries()) {
      if (!s.domain || s.domain.length < 15) problems.push(`exampleSpecs[${i}].domain too generic`);
      if (!s.requiredBeat || s.requiredBeat.length < 20) problems.push(`exampleSpecs[${i}].requiredBeat too vague`);
    }
  }
  if (!doc.quizFocus) problems.push("quizFocus missing");
  else {
    if (!doc.quizFocus.count || doc.quizFocus.count < 6) problems.push("quizFocus.count < 6");
    if (doc.quizFocus.transferEmphasis !== undefined && doc.quizFocus.transferEmphasis < 0.5) {
      problems.push("quizFocus.transferEmphasis < 0.5 — too much recall-style");
    }
  }
  if (!doc.cardFocus) problems.push("cardFocus missing");
  if (input.sourceAnchors && input.sourceAnchors.length > 0) {
    const allowed = new Set(input.sourceAnchors.map((anchor) => anchor.id));
    const checkIds = (label: string, ids: unknown) => {
      if (!Array.isArray(ids) || ids.length === 0) {
        problems.push(`${label} must carry sourceAnchorIds from the validated source-v2 sidecar`);
        return;
      }
      for (const id of ids) {
        if (typeof id !== "string" || !allowed.has(id)) {
          problems.push(`${label} cites unsupported source anchor ${JSON.stringify(id)}`);
        }
      }
    };
    checkIds("coreMoveSourceAnchorIds", doc.coreMoveSourceAnchorIds);
    doc.exampleSpecs?.forEach((spec, i) => checkIds(`exampleSpecs[${i}].sourceAnchorIds`, spec.sourceAnchorIds));
    checkIds("quizFocus.sourceAnchorIds", doc.quizFocus?.sourceAnchorIds);
    checkIds("cardFocus.sourceAnchorIds", doc.cardFocus?.sourceAnchorIds);
  }
  if (problems.length > 0) {
    throw new Error(`curriculum plan invalid: ${problems.join("; ")}`);
  }
  return doc;
}
