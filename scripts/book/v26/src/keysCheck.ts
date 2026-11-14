/** The keys check, for a book without source text: before a chapter is written, two checkers with web search compare
 *  every chapter's keys with the book, working apart, and an editor rewrites each note with what they leave standing.
 *  Every chapter is built on its key, so a wrong sentence here is a wrong chapter later. On Tiny Habits (2026-11-11)
 *  the same check, run by hand, corrected five sentences and replaced "none recalled" with a real story in all eight
 *  chapters. The checkers are the only calls of this tool that may use tools at all, and only web search and fetch;
 *  what they bring back is treated as data: only whitelisted fields reach the editor, and one checker alone can take
 *  words out of a note but never put new ones in (prompts/keys-merge.md). */
import * as fs from "node:fs";
import * as path from "node:path";
import { CallFailedError } from "./call";
import { settle, type PipelineCtx } from "./pipeline";
import { loadPrompt, renderTemplate } from "./prompts";
import { callShaped } from "./variants";

/** Chapters per checker call: few enough that a checker can look each one up. */
const CHUNK = 6;
/** A checker reads the web, so it gets longer than a writing call. */
const WEB_TIMEOUT_MS = 30 * 60 * 1000;

const LENSES = [
  "Check every sentence as a careful editor: terms, counts, the order of steps, and which chapter an idea belongs to. Then find the stories each chapter tells.",
  "Work hardest on the stories: for each chapter, find the stories, cases and worked examples the book tells there, and check whether the note gives anything to the wrong chapter or supplies a reason the book does not give.",
];
const SURE = ["sure", "fairly sure", "unsure"];
/** Stories a checker may list for one chapter: a chapter tells several, and two checkers who each name one often name different ones. */
const MAX_STORIES = 3;

export interface KeysCheck {
  /** False when a checker or the editor did not answer for some chapters: those keys stand as drafted, unchecked. */
  checked: boolean;
  at: string;
  chapters: number;
  /** Chapters whose note the editor changed (compared with the note as it was, not taken on the editor's word). */
  changed: number;
  /** Chapters whose note now names a story the book tells. */
  stories: number;
  notes: string[];
  /** What stops the chapters being written from these notes: a chapter list the checkers say is wrong, and notes left
   *  with no lesson (noteProblems). Empty in a record made before this field existed (keysChecked fills it in). */
  problems: string[];
}

/** One finished group of chapters, kept on disk so that a stopped check carries on at the next group. A group finished
 *  before `problems` and `notes` were kept has neither. */
interface Progress {
  groups: Record<string, { at: string; chapters: number[]; changed: number[]; changes: Record<string, string[]>; before: Record<string, string>; problems?: string[]; notes?: string[] }>;
  /** Two checkers' reports (as the editor may see them) for a group the editor has not finished, with the notes they were made on. */
  pending?: { tag: string; before: Record<string, string>; titles?: Record<string, string>; a: Obj; b: Obj };
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const keysDir = (ctx: PipelineCtx): string => path.join(ctx.config.runDir, "keys");
const checkedFile = (ctx: PipelineCtx): string => path.join(keysDir(ctx), "checked.json");
const progressFile = (ctx: PipelineCtx): string => path.join(keysDir(ctx), "check-progress.json");
/** A note in the shape every later prompt expects. One that carries a template token would break the prompt it is put into. */
const validNote = (keys: unknown): keys is string =>
  typeof keys === "string" && keys.trim() !== "" && /Reversal:/.test(keys) && /Story the author tells:/.test(keys) && !/@@[A-Z0-9_]+@@/.test(keys);

function readJson<T>(file: string): T | null {
  return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as T) : null;
}
function writeAtomic(file: string, text: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(`${file}.tmp`, text);
  fs.renameSync(`${file}.tmp`, file);
}

/** The record of a finished keys check, or null when the book's keys were never checked (or the check is incomplete).
 *  A record made before `problems` existed says nothing about the chapter list: it reads as no problem. */
export function keysChecked(ctx: PipelineCtx): KeysCheck | null {
  const rec = readJson<KeysCheck>(checkedFile(ctx));
  return rec ? { ...rec, problems: Array.isArray(rec.problems) ? rec.problems : [] } : null;
}

const chName = (n: number): string => `ch${String(n).padStart(2, "0")}`;
/** Two titles name the same chapter when they differ only in case, punctuation and spacing. */
const sameTitle = (a: string, b: string): boolean => {
  const norm = (s: string): string => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  return norm(a) === norm(b);
};

/** A note as the check prompts show it carries a first line "[number] title": that framing is the prompt's own, never
 *  part of a stored note. An editor that echoes it back would otherwise file it into the config, and on The Charisma
 *  Myth the echoed heading named a different chapter from the one the note was filed under. Given the chapter and the
 *  config's titles, a leading "[n]" is a heading only when n is this chapter's number or the line is a title of the list
 *  (a note that starts "[1] Ask for one tiny step." keeps its advice), markdown around it is dropped, and this chapter's
 *  own number and title followed by the note on the same line are split off too. */
export function splitHeading(
  keys: string,
  chapter?: { number: number; title: string },
  titles: string[] = [],
): { heading?: { number: number; title: string }; body: string } {
  const m = /^\s*[*_#]*[ \t]*\[(\d+)\][ \t]*([^\n]*?)[ \t*_]*(\n|$)/.exec(keys);
  if (!m) return { body: keys };
  const number = Number(m[1]);
  const line = m[2]!.trim();
  const ownLine = m[3] === "\n";
  if (!chapter) return ownLine ? { heading: { number, title: line }, body: keys.slice(m[0].length) } : { body: keys };
  // This chapter's number and its own title, then the note, on one line.
  const words = chapter.title.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const same = number === chapter.number && words.length > 0 && !sameTitle(line, chapter.title)
    ? new RegExp(`^\\s*[*_#]*[ \\t]*\\[${number}\\][ \\t]*${words.join("[^\\p{L}\\p{N}\\n]+")}(?![\\p{L}\\p{N}])[ \\t*_:.]*`, "iu").exec(keys)
    : null;
  if (same) return { heading: { number, title: chapter.title }, body: keys.slice(same[0].length) };
  if (ownLine && (number === chapter.number || titles.some((t) => sameTitle(t, line)))) return { heading: { number, title: line }, body: keys.slice(m[0].length) };
  return { body: keys };
}

/** Words an advice sentence needs to count: "Never outshine the master." is a lesson, "Be warm." is not. */
const MIN_WORDS = 3;
/** An advice sentence that says there is no advice. */
const HOLLOW = /\bno advice\b|\bnot recalled\b|\brecalled with confidence\b|^(none|nothing)\b/i;
/** True when the note still gives advice once its heading, its "Reversal: ..." part and its "Story the author tells: ..."
 *  part are taken away: one sentence of a few words that is not a "none recalled" phrase. An editor who cuts every
 *  doubted sentence can leave only those two lines, and a chapter written from that is written from nothing (The
 *  Charisma Myth, chapter 12). Counted in sentences, not characters: a short lesson is still a lesson. */
export function noteHasLesson(keys: string, chapter?: { number: number; title: string }, titles: string[] = []): boolean {
  const advice = splitHeading(keys, chapter, titles)
    .body.replace(/Reversal:[\s\S]*?(?=Story the author tells:|$)/g, " ")
    .replace(/Story the author tells:[\s\S]*?(?=Reversal:|$)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return advice.split(/(?<=[.!?])\s+/).some((x) => x.split(" ").filter((w) => /[\p{L}\p{N}]/u.test(w)).length >= MIN_WORDS && !HOLLOW.test(x));
}

/** How an empty note is named, so a reader of the problems can tell it from a chapter-list problem. */
export const NO_LESSON = "the note has no lesson to write a chapter from";
/** The chapters whose note has no lesson, as plain sentences for the owner. */
export function noteProblems(chapters: Array<{ number: number; title: string; keys?: string }>): string[] {
  const titles = chapters.map((c) => c.title);
  return chapters.filter((c) => !noteHasLesson(c.keys ?? "", c, titles)).map((c) => `${chName(c.number)}: ${NO_LESSON}`);
}

/** Refuses a knowledge-mode chapter whose note is there but has no lesson: a chapter written from it is written from
 *  nothing. Every verb that writes a knowledge-mode chapter from its note calls it (book, variants, assemble). */
export function requireLesson(ctx: PipelineCtx, n: number): void {
  const chapters = ctx.config.chapters ?? [];
  const c = chapters.find((x) => x.number === n);
  const note = c?.keys ?? "";
  if (ctx.source.mode === "knowledge" && note.trim() !== "" && !noteHasLesson(note, c, chapters.map((x) => x.title))) {
    throw new Error(`KEYS_EMPTY: ${chName(n)}'s note in the config has no lesson to write a chapter from; write the chapter's advice into its note, or delete the note and draft the keys again`);
  }
}

/** What the editor may see of a checker's answer: the fields this tool asked for, as plain strings, and nothing else.
 *  The answer is the one text here that the open web can shape. */
function sanitized(report: unknown, numbers: number[]): Obj {
  const list = isObj(report) && Array.isArray(report.chapters) ? report.chapters.filter(isObj) : [];
  const clean = (s: unknown): string => str(s).replace(/@@/g, "@ @");
  return {
    chapters: numbers.flatMap((n) => {
      const c = list.find((x) => x.number === n);
      if (!c) return [];
      // A doubt is kept whenever it names its sentence, even when the checker gave no fix: the editor can still cut it.
      const wrong = (Array.isArray(c.wrong) ? c.wrong.filter(isObj) : [])
        .filter((w) => typeof w.sentence === "string" && w.sentence.trim() !== "")
        .map((w) => ({ sentence: clean(w.sentence), problem: clean(w.problem), fix: clean(w.fix), sure: SURE.includes(str(w.sure)) ? str(w.sure) : "unsure" }));
      const stories = (Array.isArray(c.stories) ? c.stories.filter(isObj) : [])
        .filter((s) => typeof s.story === "string" && s.story.trim() !== "")
        .slice(0, MAX_STORIES)
        .map((s) => ({ story: clean(s.story), sure: SURE.includes(str(s.sure)) ? str(s.sure) : "unsure" }));
      // The title the book gives is shown to the owner in a reason line: one short plain line, whatever the page said.
      const title = isObj(c.title)
        ? { title: { ok: c.title.ok !== false, book: clean(c.title.book).replace(/\s+/g, " ").trim().slice(0, 120), sure: SURE.includes(str(c.title.sure)) ? str(c.title.sure) : "unsure" } }
        : {};
      return [{ number: n, wrong, stories, source: clean(c.source), ...title }];
    }),
  };
}

/** What two sanitized reports say about one chapter's title: a problem when both doubt it, a note when one does. A
 *  report without the field (saved before it was asked for) raises no doubt, and an "unsure" doubt is no doubt. */
function titleDoubt(n: number, title: string, a: Obj, b: Obj): { problem?: string; note?: string } {
  const doubt = (r: Obj): string | null => {
    const c = (Array.isArray(r.chapters) ? r.chapters.filter(isObj) : []).find((x) => x.number === n);
    const t = c && isObj(c.title) ? c.title : null;
    return t && t.ok === false && t.sure !== "unsure" ? str(t.book) : null;
  };
  const doubts = [doubt(a), doubt(b)].filter((d): d is string => d !== null);
  if (doubts.length === 0) return {};
  const given = [...new Set(doubts.filter((d) => d !== ""))].map((d) => `"${d}"`);
  if (doubts.length === 2) return { problem: `${chName(n)}: both checkers say "${title}" is not the book's chapter at place ${n} of the list${given.length > 0 ? ` (they give ${given.join(" and ")})` : ""}` };
  return { note: `${chName(n)}: one checker says "${title}" is not the book's chapter at place ${n} of the list${given.length > 0 ? ` (it gives ${given[0]})` : ""}; the other does not` };
}

/** Checks every chapter's keys, group by group, and writes each group's edited notes into the config file as it
 *  finishes. A finished check is not run again (the owner may have edited the keys since), unless `force`. A check that
 *  stops (a checker or the editor does not answer, a usage limit, the budget) keeps its finished groups; the next run
 *  carries on with the group that failed. */
export async function checkKeys(ctx: PipelineCtx, configPath: string, opts: { force?: boolean; now?: () => Date } = {}): Promise<KeysCheck> {
  const chapters = ctx.config.chapters;
  if (!chapters) throw new Error("KEYS_TEXT_MODE: keys are for a book without source text; a text-mode book has its source");
  const prior = keysChecked(ctx);
  if (prior && !opts.force) return prior;
  const missing = chapters.filter((c) => !c.keys);
  if (missing.length > 0) throw new Error(`KEYS_MISSING: draft the keys first; chapters without keys: ${missing.map((c) => c.number).join(", ")}`);
  const now = (): string => (opts.now?.() ?? new Date()).toISOString();
  const dir = keysDir(ctx);
  if (opts.force) fs.rmSync(progressFile(ctx), { force: true });
  const progress: Progress = readJson<Progress>(progressFile(ctx)) ?? { groups: {} };
  const notes: string[] = [];
  let complete = true;

  for (let start = 0; start < chapters.length; start += CHUNK) {
    const group = chapters.slice(start, start + CHUNK);
    const numbers = group.map((c) => c.number);
    const tag = `${numbers[0]}-${numbers[numbers.length - 1]}`;
    const label = `chapters ${numbers[0]} to ${numbers[numbers.length - 1]}`;
    if (progress.groups[tag]) continue;
    const before = Object.fromEntries(group.map((c) => [String(c.number), (c.keys ?? "").trim()]));
    const notesText = group.map((c) => `[${c.number}] ${c.title}\n${c.keys}`).join("\n\n");
    const covers = (list: unknown, need: (x: Obj) => boolean): string[] => {
      if (!Array.isArray(list)) return ["answer must be an object with a chapters array"];
      const bad = numbers.filter((n) => list.filter((x) => isObj(x) && x.number === n).length !== 1 || !list.some((x) => isObj(x) && x.number === n && need(x)));
      return bad.length > 0 ? [`missing, repeated or incomplete entries for chapters ${bad.join(", ")}`] : [];
    };
    // A call that does not answer leaves these chapters unchecked; a usage limit or the budget stops the run as usual.
    const soft = async (p: Promise<unknown>): Promise<unknown | null> => {
      try {
        return await p;
      } catch (e) {
        if (e instanceof CallFailedError) return null;
        throw e;
      }
    };
    // The web reports are the dear part of a check. A pair made on these same notes and titles, whose editor did not finish,
    // is used again: their title verdicts were given about the titles they saw. A pair saved before titles were kept
    // carries no title verdict, so only its notes need to match.
    const titles = Object.fromEntries(group.map((c) => [String(c.number), c.title]));
    const p = progress.pending;
    const kept = p && p.tag === tag && JSON.stringify(p.before) === JSON.stringify(before) && (p.titles === undefined || JSON.stringify(p.titles) === JSON.stringify(titles)) ? p : null;
    // Both checkers are waited for, so a stop in one never leaves the other running after the run has said it stopped.
    const reports = kept ? [kept.a, kept.b] : await settle(
      LENSES.map((lens, k) =>
        soft(
          callShaped(ctx, 0, {
            role: ctx.config.checker,
            prompt: renderTemplate(loadPrompt("keys-check"), { LENS: lens, BOOK_SECTION: ctx.bookSection, CHAPTERS: chapters.map((c) => `${c.number}. ${c.title}`).join("\n"), NOTES: notesText }),
            step: `keys-check-${tag}-${k === 0 ? "a" : "b"}`,
            kind: "other",
            errors: (v) =>
              covers(
                isObj(v) ? v.chapters : null,
                (x) => Array.isArray(x.wrong) && Array.isArray(x.stories) && typeof x.source === "string" && isObj(x.title) && typeof x.title.ok === "boolean" && typeof x.title.book === "string",
              ),
            outPrefix: path.join(dir, `check-${tag}-${k === 0 ? "a" : "b"}`),
            ledgerStep: "book-keys-check",
            web: true,
            timeoutMs: WEB_TIMEOUT_MS,
          }),
        ),
      ),
    );
    const answered = !reports.some((r) => r === null);
    if (answered && !kept) {
      progress.pending = { tag, before, titles, a: sanitized(reports[0], numbers), b: sanitized(reports[1], numbers) };
      writeAtomic(progressFile(ctx), JSON.stringify(progress, null, 2) + "\n");
    }
    const merged =
      !answered
        ? null
        : await soft(
            callShaped(ctx, 0, {
              role: ctx.config.fixer ?? ctx.config.checker,
              prompt: renderTemplate(loadPrompt("keys-merge"), {
                BOOK_SECTION: ctx.bookSection,
                NOTES: notesText,
                REPORT_A: JSON.stringify(sanitized(reports[0], numbers), null, 1),
                REPORT_B: JSON.stringify(sanitized(reports[1], numbers), null, 1),
              }),
              step: `keys-merge-${tag}`,
              kind: "write",
              errors: (v) => covers(isObj(v) ? v.chapters : null, (x) => validNote(x.keys)),
              outPrefix: path.join(dir, `merge-${tag}`),
              ledgerStep: "book-keys-merge",
            }),
          );
    if (merged === null) {
      // One group that cannot be checked ends the check for now: the groups after it would spend the same web time for
      // the same outcome, and the next run starts here.
      complete = false;
      notes.push(`${label}: ${answered ? "the editor" : "a checker"} did not answer; these keys and the ones after them stand unchecked`);
      break;
    }
    // This group's notes go into the config file (the owner reads and edits them there) and into this run's memory now,
    // so a later stop loses nothing that was paid for.
    const edited = new Map<number, { keys: string; changes: string[] }>();
    const problems: string[] = [];
    const groupNotes: string[] = [];
    for (const c of (merged as { chapters: unknown[] }).chapters.filter(isObj)) {
      const n = c.number;
      if (typeof n !== "number" || !numbers.includes(n) || edited.has(n) || !validNote(c.keys)) continue;
      // The heading is the prompt's framing and never stored. One that names another chapter means the note may now be
      // about that chapter: the owner is told, since only the owner can say which list is right.
      const title = group.find((g) => g.number === n)!.title;
      const { heading, body } = splitHeading(c.keys, { number: n, title }, chapters.map((x) => x.title));
      if (heading && (heading.number !== n || !sameTitle(heading.title, title))) {
        problems.push(`${chName(n)}: the checked note came back headed "${heading.title}", but the config calls chapter ${n} "${title}"; the chapter list may be wrong`);
      }
      edited.set(n, { keys: body.trim(), changes: Array.isArray(c.changes) ? c.changes.filter((x): x is string => typeof x === "string") : [] });
    }
    // What the checkers say of the chapter list itself.
    for (const g of group) {
      const d = titleDoubt(g.number, g.title, sanitized(reports[0], numbers), sanitized(reports[1], numbers));
      if (d.problem) problems.push(d.problem);
      if (d.note) groupNotes.push(d.note);
    }
    const file = JSON.parse(fs.readFileSync(configPath, "utf8")) as { chapters: Array<{ number: number; keys?: string }> };
    for (const [n, e] of edited) {
      const entry = file.chapters.find((x) => x.number === n);
      if (entry) entry.keys = e.keys;
      const mine = chapters.find((x) => x.number === n);
      if (mine) mine.keys = e.keys;
    }
    writeAtomic(configPath, JSON.stringify(file, null, 2) + "\n");
    delete progress.pending;
    progress.groups[tag] = {
      at: now(),
      chapters: numbers,
      changed: [...edited].filter(([n, e]) => e.keys !== before[String(n)]).map(([n]) => n),
      changes: Object.fromEntries([...edited].map(([n, e]) => [String(n), e.changes])),
      before,
      problems,
      notes: groupNotes,
    };
    writeAtomic(progressFile(ctx), JSON.stringify(progress, null, 2) + "\n");
  }

  const done = Object.values(progress.groups);
  const result: KeysCheck = {
    checked: complete,
    at: now(),
    chapters: chapters.length,
    changed: done.reduce((s, g) => s + g.changed.length, 0),
    stories: chapters.filter((c) => /Story the author tells:/.test(c.keys ?? "") && !/Story the author tells:\s*none/i.test(c.keys ?? "")).length,
    notes: [...done.flatMap((g) => g.notes ?? []), ...notes],
    // The chapter-list problems each group found, then every note the check left without a lesson.
    problems: [...done.flatMap((g) => g.problems ?? []), ...noteProblems(chapters)],
  };
  // Only a complete check is the record that stops the next run from checking again.
  writeAtomic(complete ? checkedFile(ctx) : path.join(dir, "check-incomplete.json"), JSON.stringify({ ...result, bookId: ctx.config.bookId, groups: progress.groups }, null, 2) + "\n");
  if (complete) fs.rmSync(path.join(dir, "check-incomplete.json"), { force: true });
  return result;
}
