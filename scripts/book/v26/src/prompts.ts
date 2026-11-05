import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import type { Chapter, QuizQuestion } from "./types";

/** Absolute path of scripts/book/v26/prompts. */
export const PROMPT_DIR: string = fileURLToPath(new URL("../prompts", import.meta.url));

/** Reads <name>.md from the prompt folder. Tests point V26_PROMPT_DIR at a tiny folder of their own. */
export function loadPrompt(name: string): string {
  const dir = process.env.V26_PROMPT_DIR || PROMPT_DIR;
  return fs.readFileSync(path.join(dir, `${name}.md`), "utf8");
}

const PLACEHOLDER = /@@([A-Z0-9_]+)@@/g;

/** Fills every @@KEY@@ in one pass. A placeholder with no value, or one that a value brings in, is an error. */
export function renderTemplate(tpl: string, vars: Record<string, string>): string {
  const out = tpl.replace(PLACEHOLDER, (whole, key: string) => (Object.hasOwn(vars, key) ? vars[key] : whole));
  const left = new RegExp(PLACEHOLDER.source).exec(out);
  if (left) throw new Error(`TEMPLATE_UNFILLED: ${left[1]}`);
  return out;
}

function choiceLines(q: QuizQuestion): string {
  return q.choices.map((x, i) => `  ${i}. ${x}`).join("\n");
}

/** The whole chapter with a label on every field, for the checker and fix prompts. Same layout as the W1 prototype. */
export function readerText(c: Chapter): string {
  const out: string[] = [];
  for (const k of ["title", "hook", "counterintuition", "keyTakeaway", "tryThisNow"] as const) {
    if (c[k]) out.push(`[${k}] ${c[k]}`);
  }
  for (const k of ["fastRead", "deepRead", "fullRead"] as const) {
    out.push(`[breakdown.${k}]\n${c.breakdown?.[k] ?? ""}`);
  }
  for (const e of c.examples ?? []) {
    out.push(
      `[examples.${e.exampleId}] ${e.title ?? ""}\nScenario: ${e.scenario ?? ""}\n` +
        `What to do: ${e.whatToDo ?? ""}\nWhy it matters: ${e.whyItMatters ?? ""}`,
    );
  }
  for (const q of c.quiz?.questions ?? []) {
    out.push(`[quiz.${q.questionId}] ${q.prompt}\n${choiceLines(q)}\n  KEY: ${q.correctIndex}\n  Explanation: ${q.explanation ?? ""}`);
  }
  for (const r of c.reviewCards ?? []) {
    out.push(`[reviewCards.${r.cardId}] Front: ${r.front} | Back: ${r.back}`);
  }
  const ip = c.implementationPlan;
  if (ip && Object.keys(ip).length > 0) {
    const lines = [`[implementationPlan.coreSkill] ${ip.coreSkill ?? ""}`];
    (ip.ifThenPlans ?? []).forEach((p, i) => {
      lines.push(`[implementationPlan.ifThenPlans.${i}] If: ${p.context ?? ""} | Then: ${p.plan ?? ""}`);
    });
    lines.push(`[implementationPlan.twentyFourHourChallenge] ${ip.twentyFourHourChallenge ?? ""}`);
    lines.push(`[implementationPlan.weeklyPractice] ${ip.weeklyPractice ?? ""}`);
    out.push(lines.join("\n"));
  }
  (c.memorableLines ?? []).forEach((m, i) => out.push(`[memorableLines.${i}] ${m.text}`));
  return out.join("\n\n");
}

/** What a new reader saw before the quiz: hook, counterintuition, summary, lines, try-this, first example. */
export function newReaderText(c: Chapter): string {
  const out = [`Hook: ${c.hook ?? ""}`, `Counterintuition: ${c.counterintuition ?? ""}`, `Summary:\n${c.breakdown?.fastRead ?? ""}`];
  if (c.memorableLines?.length) {
    out.push("Lines worth keeping:\n" + c.memorableLines.map((m) => `- "${m.text}"`).join("\n"));
  }
  out.push(`Try this now: ${c.tryThisNow ?? ""}`);
  const e = c.examples?.[0];
  if (e) {
    out.push(`Example: ${e.title ?? ""}\n${e.scenario ?? ""}\nWhat to do: ${e.whatToDo ?? ""}\nWhy it matters: ${e.whyItMatters ?? ""}`);
  }
  return out.join("\n\n");
}

/** The new-reader text plus the two longer tellings. */
export function allTiersText(c: Chapter): string {
  return `${newReaderText(c)}\n\nMiddle-depth telling:\n${c.breakdown?.deepRead ?? ""}\n\nFull telling:\n${c.breakdown?.fullRead ?? ""}`;
}

/** Questions as a solver sees them: id, prompt, numbered choices, no key. */
export function questionsBlock(qs: QuizQuestion[]): string {
  return qs.map((q) => `[${q.questionId}] ${q.prompt}\n${choiceLines(q)}`).join("\n\n");
}

/** The first lines of the writer prompt: which chapter, its neighbours, and the lessons already taken. */
export function chapterHeader(n: number, titles: Record<number, string>, earlierLessons: string[]): string {
  if (!Object.hasOwn(titles, n)) throw new Error(`NO_SUCH_CHAPTER: ${n}`);
  const total = Math.max(...Object.keys(titles).map(Number));
  const prev = Object.hasOwn(titles, n - 1) ? `The previous chapter is "${titles[n - 1]}".` : "This is the first chapter of the book.";
  const next = Object.hasOwn(titles, n + 1) ? `The next chapter is "${titles[n + 1]}".` : "This is the last chapter of the book.";
  let head = `CHAPTER ${n} of ${total}: "${titles[n]}". ${prev} ${next} Write only this chapter.`;
  if (earlierLessons.length > 0) {
    head += `\nLessons already taught in earlier chapters (teach none of these again):\n${earlierLessons.map((l) => `- ${l}`).join("\n")}`;
  }
  return head;
}

const TRAPS_HEADING =
  "FACTS THIS BOOK HAS BEEN WRONG ABOUT BEFORE. An earlier edition of this book got the facts below wrong. " +
  "They are hints about where errors hide, not rules: the source still decides. Check the chapter against each one that applies.";

/** The known-traps block for the fact-check prompt; empty when this chapter has none. */
export function knownTrapsSection(entries: string[]): string {
  if (entries.length === 0) return "";
  return `${TRAPS_HEADING}\n${entries.map((e) => `- ${e}`).join("\n")}`;
}
