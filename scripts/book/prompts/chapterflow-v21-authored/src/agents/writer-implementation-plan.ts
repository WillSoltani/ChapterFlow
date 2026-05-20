/**
 * Writer — implementation plan.
 */

import { readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { callClaude } from "../claudeClient.js";
import { BookBrief, ChapterDesignDoc } from "../types.js";
import { BreakdownOutput } from "./writer-breakdown.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = resolve(__dirname, "../../prompts");

export type ImplementationPlanOutput = {
  title: string;
  coreSkill: string;
  ifThenPlans: Array<{ context: string; plan: string }>;
  twentyFourHourChallenge: string;
  weeklyPractice: string;
};

export type PlanInput = {
  brief: BookBrief;
  plan: ChapterDesignDoc;
  breakdown: BreakdownOutput;
};

const MAX_PLAN_RETRIES = 2;

export async function runWriterImplementationPlan(input: PlanInput): Promise<ImplementationPlanOutput> {
  const systemPrompt = readFileSync(
    resolve(PROMPTS_DIR, "writer-implementation-plan.system.md"),
    "utf8",
  );
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
  parts.push(`# Chapter breakdown (grounding)`);
  parts.push(input.breakdown.deepRead);
  parts.push("");
  parts.push(`Write the ImplementationPlanOutput JSON now. Include a "title" field: 4–7 words naming the specific skill this plan teaches, derived from the chapter's coreSkill. The title must be specific enough that it could not be swapped with another chapter's plan title.`);
  const baseUserPrompt = parts.join("\n");

  let userPrompt = baseUserPrompt;
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= MAX_PLAN_RETRIES; attempt += 1) {
    try {
      const result = await callClaude<ImplementationPlanOutput>({
        tier: "writer",
        system: systemPrompt,
        user: userPrompt,
        maxTokens: 2000,
        temperature: 0.6,
        jsonMode: true,
        timeoutMs: 180_000,
      });
      return validate(result.content);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt === MAX_PLAN_RETRIES) break;
      const reasons = lastError.message
        .replace(/^implementation plan invalid:\s*/, "- ")
        .replace(/;\s*/g, "\n- ");
      userPrompt = [
        baseUserPrompt,
        "",
        "# Your previous draft was rejected by the validator.",
        "Reasons:",
        reasons,
        "",
        "Rewrite the ImplementationPlanOutput JSON. Address the reader directly with concrete if-then triggers; the reader has not seen the source you read. Never use the words 'the book', 'the chapter', 'the author', or any reference to written material.",
      ].join("\n");
    }
  }
  throw lastError ?? new Error("implementation plan: writer exhausted retries with no result");
}

function validate(p: ImplementationPlanOutput): ImplementationPlanOutput {
  const problems: string[] = [];
  const titleWords = (p.title ?? "").trim().split(/\s+/).filter(Boolean).length;
  if (!p.title || titleWords < 4 || titleWords > 7) {
    problems.push(`title must be 4–7 words (got ${titleWords})`);
  }
  if (!p.coreSkill || p.coreSkill.length < 80) problems.push("coreSkill too short");
  if (!Array.isArray(p.ifThenPlans) || p.ifThenPlans.length < 3 || p.ifThenPlans.length > 4) {
    problems.push(`ifThenPlans length ${p.ifThenPlans?.length} out of range 3–4`);
  }
  if (!p.twentyFourHourChallenge || p.twentyFourHourChallenge.length < 40) {
    problems.push("twentyFourHourChallenge too short");
  }
  if (!p.weeklyPractice || p.weeklyPractice.length < 40) problems.push("weeklyPractice too short");
  for (const [i, it] of (p.ifThenPlans ?? []).entries()) {
    if (!it.plan || !/^\s*if\b/i.test(it.plan)) problems.push(`ifThenPlans[${i}] missing "If …, then …" structure`);
  }
  // Defense in depth: ship gate also catches these.
  const metaRegexes = [
    /\bthis chapter\b/i,
    /\bthe chapter\b/i,
    /\bthe author\b/i,
    /\bthe book\b/i,
    /\bin this (chapter|section|book|law)\b/i,
    /\bchapter\s+\d+\b/i,
  ];
  const fullText = [
    p.coreSkill,
    p.twentyFourHourChallenge,
    p.weeklyPractice,
    ...(p.ifThenPlans ?? []).map((it) => `${it.context} ${it.plan}`),
  ].filter(Boolean).join(" ");
  for (const re of metaRegexes) {
    const m = fullText.match(re);
    if (m) {
      problems.push(`contains meta-reference "${m[0]}"`);
      break;
    }
  }
  if (problems.length > 0) throw new Error(`implementation plan invalid: ${problems.join("; ")}`);
  return p;
}
