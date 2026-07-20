/**
 * Writer — example.
 *
 * Produces ONE micro-case example from one ExampleSpec. The orchestrator calls
 * this N times per chapter (N = plan.exampleCount), in parallel. Each call is
 * passed the list of names already used in prior examples of this chapter so
 * we don't collide within a chapter.
 */

import { readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import {
  renderUntrustedSourceBlock,
  runJsonModelTask,
  type ModelCallerExecution,
} from "../app/modelTaskRunner.js";
import { BookBrief, ChapterDesignDoc, ExampleSpec, SourceAnchorForPrompt } from "../types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = resolve(__dirname, "../../prompts");

export type ExampleOutput = {
  exampleId: string;
  sourceAnchorId?: string;
  sourceAnchorIds?: string[];
  title: string;
  scenario: string;
  whatToDo: string;
  whyItMatters: string;
};

export type ExampleInput = {
  brief: BookBrief;
  plan: ChapterDesignDoc;
  spec: ExampleSpec;
  specIndex: number;
  /** Names already used in this chapter's prior examples. Writer must not reuse. */
  usedNames: string[];
  sourceAnchors?: SourceAnchorForPrompt[];
};

export async function runWriterExample(
  input: ExampleInput,
  execution?: ModelCallerExecution,
): Promise<ExampleOutput> {
  const systemPrompt = readFileSync(
    resolve(PROMPTS_DIR, "writer-example.system.md"),
    "utf8",
  );
  const userPrompt = buildUserPrompt(input);
  const output = await runJsonModelTask<ExampleOutput>(execution, "writer-example", systemPrompt, userPrompt);
  return validateExample(output, input);
}

function buildUserPrompt(input: ExampleInput): string {
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
  parts.push(`# Your ExampleSpec (index ${input.specIndex})`);
  parts.push("```json");
  parts.push(JSON.stringify(input.spec, null, 2));
  parts.push("```");
  parts.push("");
  if (input.usedNames.length > 0) {
    parts.push(`# Names already used in prior examples of this chapter — must NOT reuse`);
    parts.push(input.usedNames.join(", "));
    parts.push("");
  }
  if (input.sourceAnchors && input.sourceAnchors.length > 0) {
    parts.push(renderUntrustedSourceBlock("Allowed source anchors for this example", JSON.stringify(input.sourceAnchors, null, 2), "json"));
    parts.push("Use only these ids. Emit sourceAnchorIds with the namedExample/testableFact anchors the scene dramatizes.");
    parts.push("");
  }
  parts.push(`Slug hint for exampleId: "ch${String(input.plan.number).padStart(2, "0")}-ex${String(input.specIndex + 1).padStart(2, "0")}-<protagonist-slug>"`);
  parts.push("");
  parts.push(`Write the ExampleOutput JSON now.`);
  return parts.join("\n");
}

function validateExample(ex: ExampleOutput, input: ExampleInput): ExampleOutput {
  const problems: string[] = [];
  if (!ex.title || ex.title.length < 10) problems.push("title missing or too short");
  if (!ex.scenario) {
    problems.push("scenario missing");
  } else {
    if (ex.scenario.length < 200) problems.push(`scenario too short (${ex.scenario.length} < 200)`);
    if (ex.scenario.length > 700) problems.push(`scenario too long (${ex.scenario.length} > 700)`);
  }
  if (!ex.whatToDo || ex.whatToDo.length < 60) problems.push("whatToDo missing or too short");
  if (!ex.whyItMatters || ex.whyItMatters.length < 60) problems.push("whyItMatters missing or too short");

  // Banned names
  const bannedNames = new Set(
    ["Priya","Omar","Maya","Marcus","Elena","Lena","Victor","Theo","Jonah","Mateo","Tessa","Owen","Mira","Malik","Nadia","Felix","Caleb","Talia","Elise","Naomi"],
  );
  for (const name of bannedNames) {
    const re = new RegExp(`\\b${name}\\b`);
    if (re.test(ex.scenario) || re.test(ex.title)) {
      problems.push(`used banned-pool name "${name}"`);
    }
  }
  // Defense in depth: ignore any "name" in usedNames that is actually a
  // pronoun, common function word, or short generic token. These occasionally
  // leak into the library ledger (e.g. "You", "Not", "What") and would
  // otherwise cause cascading false-positive rejections.
  const usedNameNoise = new Set([
    "You","Your","Yours","We","Us","Our","Ours","My","Mine","Their","Theirs",
    "I","Me","Him","Them","Who","Whom","Whose","Which","What","Why","How",
    "He","She","They","It","This","That","These","Those","Here","There",
    "Not","Nobody","Anybody","Somebody","Everyone","Someone","Anyone","None",
    "Yes","No","Maybe","Once","Only","Even","Also","Still","Again","Just",
    "When","Where","While","Before","After","During","Until","Since",
    "And","But","Or","So","If","Because","Then","Now","Today","Tomorrow",
    "The","A","An","First","Second","Third","Fourth","Fifth","Last","Next",
  ]);
  for (const used of input.usedNames) {
    if (usedNameNoise.has(used)) continue;
    if (used.length < 3) continue;
    const re = new RegExp(`\\b${used}\\b`);
    if (re.test(ex.scenario) || re.test(ex.title)) {
      problems.push(`reused name "${used}" already present in prior example of this chapter`);
    }
  }
  // Ensure there's at least one proper-noun-looking name in scenario
  const properNouns = Array.from(ex.scenario.matchAll(/\b[A-Z][a-z]{2,}\b/g)).map((m) => m[0]);
  const stop = new Set(["The","A","An","If","When","That","But","Chapter","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday","She","He","They","It","This","And","Or","So","Her","His","Then","Because","Before","After","While","Once","During","Without","Within","Even","Only","Often","Now","Whenever","Here","There"]);
  const realNames = properNouns.filter((p) => !stop.has(p));
  if (realNames.length === 0) {
    problems.push("scenario has no proper-noun protagonist name");
  }

  // Defense in depth: meta-reference + em-dash checks. Ship gate catches these
  // too, but failing here means the curator picks from clean candidates only.
  const exFullText = `${ex.scenario} ${ex.whatToDo} ${ex.whyItMatters} ${ex.title}`;
  if (exFullText.includes("—")) problems.push("contains em dash");
  const metaRegexes = [
    /\bthis chapter\b/i,
    /\bthe chapter\b/i,
    /\bthe author\b/i,
    /\bthe book\b/i,
    /\bin this (chapter|section|book|law)\b/i,
    /\bchapter\s+\d+\b/,
  ];
  for (const re of metaRegexes) {
    const m = exFullText.match(re);
    if (m) {
      problems.push(`contains meta-reference "${m[0]}" — teach the idea, don't narrate the chapter`);
      break;
    }
  }

  // whatToDo must not restate the scenario (>80% content-word overlap is a restatement)
  if (ex.scenario && ex.whatToDo) {
    const STOP = new Set([
      "a","an","and","are","as","at","be","but","by","do","for","from",
      "had","has","have","he","her","his","if","in","into","is","it","its",
      "no","not","of","on","or","she","so","that","the","their","them",
      "then","they","this","those","to","too","up","was","we","were","what",
      "when","which","who","will","with","you","your",
    ]);
    const cw = (t: string) => new Set(
      t.toLowerCase().split(/\s+/).map((w) => w.replace(/[^a-z]/g, ""))
        .filter((w) => w.length >= 5 && !STOP.has(w)),
    );
    const scenWords = cw(ex.scenario);
    const wtdWords = Array.from(cw(ex.whatToDo));
    if (wtdWords.length > 0) {
      const overlap = wtdWords.filter((w) => scenWords.has(w)).length / wtdWords.length;
      if (overlap > 0.8) {
        problems.push(`whatToDo repeats the scenario (${Math.round(overlap * 100)}% content-word overlap) — rewrite to add new instruction not already in the scenario`);
      }
    }
  }
  if (input.sourceAnchors && input.sourceAnchors.length > 0) {
    const allowed = new Set(input.sourceAnchors.map((anchor) => anchor.id));
    const ids = ex.sourceAnchorIds ?? (ex.sourceAnchorId ? [ex.sourceAnchorId] : []);
    if (ids.length === 0) {
      problems.push("sourceAnchorIds must cite at least one allowed source anchor");
    }
    for (const id of ids) {
      if (typeof id !== "string" || !allowed.has(id)) problems.push(`sourceAnchorIds cites unsupported source anchor ${JSON.stringify(id)}`);
    }
    if (!ex.sourceAnchorId && ids[0]) ex.sourceAnchorId = ids[0];
  }

  // Protagonist name drift: the name token in the exampleId slug must appear
  // somewhere in the display fields. If it doesn't, the slug was written with
  // a draft name that was later changed.
  const slugParts = (ex.exampleId ?? "").split("-");
  if (slugParts.length >= 3) {
    const slugName = slugParts[2];
    if (slugName && slugName.length >= 3 && !/^\d/.test(slugName)) {
      const nameCapitalized = slugName.charAt(0).toUpperCase() + slugName.slice(1).toLowerCase();
      const allDisplay = `${ex.scenario} ${ex.whatToDo} ${ex.whyItMatters} ${ex.title}`;
      if (!new RegExp(`\\b${nameCapitalized}\\b`, "i").test(allDisplay)) {
        problems.push(`exampleId slug name "${slugName}" does not appear in any display field — protagonist name drift; use the display name in the slug or update the display fields`);
      }
    }
  }

  if (problems.length > 0) {
    throw new Error(`example invalid: ${problems.join("; ")}`);
  }
  return ex;
}
