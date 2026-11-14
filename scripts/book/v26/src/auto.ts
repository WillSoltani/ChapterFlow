/** One book from its config to a published book, in one resumable run, and a queue of books run one after another.
 *
 *  The stages, in order: keys (drafted, then checked against the book by two checkers with web search), the chapters,
 *  two fix passes (open flags and names an earlier chapter used first), one round of repairs code can see (two hooks on
 *  the same object, a quiz whose key stands out by its length), the reading pack, the score, one round on what the judge
 *  failed when the band is manual, and the publish the band allows. Every stage reads what is on disk, so a run that
 *  stopped (a usage limit, the budget, a crash) picks up where it left off. The one-off rounds, and the chapters each
 *  has already handled, are remembered in `<runDir>/auto.json`, so a rerun never gives a chapter more rounds than one
 *  run would.
 *
 *  What stays the owner's, and how each is kept that way:
 *  - A book in the manual band, or one whose chapters were written from keys nobody checked, waits. `--approve` is the
 *    owner's yes to the pack they read: it is taken only for a book that was waiting and whose chapters have not
 *    changed since that pack was written, and a run that carries it edits nothing before it publishes.
 *  - Keys the checkers could not check stop the book before a chapter is written; `--keys-ok` is the owner's word for
 *    the notes as they stand: it does not cover notes drafted in the same run, or notes that change afterwards.
 *  - A failed book is rewritten only with `--redo`, once per score, and only the chapters on that score's list.
 *  - In a queue none of these flags is taken: a yes is one book's.
 *  - The deploy that puts a new book on the public grid. */
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { BudgetError, UsageLimitError } from "./call";
import { fixLanded, hookCollisions, loadExemplar, renderPack, runBookChapters } from "./book";
import { ConfigError, loadBookConfig } from "./config";
import { draftKeys } from "./keys";
import { checkKeys, keysChecked, NO_LESSON, noteProblems } from "./keysCheck";
import { ledgerTotal } from "./ledger";
import { guarded, makeCtx, reviewField, type ChapterStatus, type EvalResult, type PipelineCtx } from "./pipeline";
import { publishBook, type Publisher } from "./publish";
import { scoreBook, type BookScore } from "./score";
import type { Chapter } from "./types";

export type AutoOutcome = "published" | "dry-run" | "ready" | "needs-owner" | "failed";
type OneOff = "fix1" | "fix2" | "repairs" | "judgeFix";

export interface AutoState {
  bookId: string;
  startedAt: string;
  updatedAt: string;
  /** The rounds a book gets once, with the time each finished. */
  done: Partial<Record<OneOff, string>>;
  /** The chapters a round that has not finished has already handled. */
  progress: Partial<Record<OneOff, number[]>>;
  /** Where the book's keys stand: checked against the book, taken on the owner's word, or never checked while chapters
   *  were already written from them (that last one holds the book for the owner, whatever is checked later). */
  keys?: "checked" | "owner" | "unchecked";
  /** With keys "owner": a digest of the notes the owner vouched for; notes that change afterwards are not covered.
   *  With keys "unchecked": a digest of the notes as they stood when the hold began, the nearest record there is of
   *  what the written chapters were built from. */
  keysDigest?: string;
  /** A chapter whose round of findings left a flag and whose one plain mending round has not finished: "<round>:<chapter>". */
  mend?: string;
  /** The score (its time) whose redo list was already used, and what is left of that list to clear and rewrite. */
  redoOf?: string;
  redoLeft?: number[];
  /** After a redo, the chapters that were rewritten: the rounds that follow touch only these. */
  redone?: number[];
  outcome?: AutoOutcome;
  reasons: string[];
  score?: number;
  band?: BookScore["band"];
  /** Each chapter's score (0 to 100) from the last scoring: with the average, the whole of what the owner asked to be shown. */
  chapterScores?: Array<{ chapter: number; score: number }>;
  /** Set while the book waits for the owner's read: a digest of every chapter as the pack showed it. A run that goes
   *  on to edit clears it; a rehearsal (--dry-run) or a publish that fails leaves it, so the yes can be given again. */
  readDigest?: string;
  packageId?: string;
  /** Everything this book's ledger holds, in dollars. */
  spend?: number;
  pack?: string;
}

export interface AutoOptions {
  /** Build and validate the package, but no git, no S3, no catalog. */
  dryRun?: boolean;
  /** Stop after the score: the book is ready, nothing is published. */
  noPublish?: boolean;
  /** The owner has read the pack and said yes. Taken only for a waiting book whose chapters are unchanged since. */
  approve?: boolean;
  /** The owner has read the keys in the config and vouches for them: no web check. */
  keysOk?: boolean;
  /** The owner allows the chapters on a failed book's redo list to be written again. */
  redo?: boolean;
  /** Run again a book this command already published. */
  force?: boolean;
  publisher?: Publisher;
  packagesDir?: string;
  noGit?: boolean;
  now?: () => Date;
}

interface Finding {
  field: string;
  text: string;
}

const chapterName = (n: number): string => `ch${String(n).padStart(2, "0")}`;
const isStop = (e: unknown): boolean => e instanceof UsageLimitError || e instanceof BudgetError || e instanceof ConfigError;

function readJson<T>(file: string): T | null {
  return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as T) : null;
}

/** The judge's items that one small edit can answer. A summary's arc, its ending, its plainness, the spine and the
 *  variety of the examples and of the quiz (VARY-examples, VARY-quiz) are not here: mending those means rewriting the
 *  chapter, which is the redo the owner allows. */
const SMALL_EDIT = /^(OPENER-hook|COUNTER|TRY|LINES-1|PRACTICE|TEMPT-|KEY-|TELL-|QUIZ-|CARD-|EX-|EXFIT-)/;

function judgeFinding(id: string, evidence: string): string {
  const how = id.startsWith("TEMPT-")
    ? " Rewrite a wrong choice (or the stem, if the stem itself rules a choice out) so that at least one wrong choice is something a sensible person who has not read the chapter might really pick: sound advice that fits a different case, or this chapter's own move at the wrong moment, in the wrong order or overdone. Keep the right choice right, and keep the three choices one length."
    : id.startsWith("KEY-")
      ? " Make the keyed choice the only sound answer: give the question the fact that rules the other choice out (a plain fact that looks ordinary to someone who has not read the chapter and never makes that choice impossible on its face), or replace that wrong choice with one the chapter gives a clear reason against. If the question asks what most likely happens, say in the question how it turned out and ask why instead. Keep the right choice right and in its place, keep the three choices one length, and make the explanation match."
      : id.startsWith("TELL-")
        ? " Say the right choice in fresh everyday words instead of the chapter's own phrase, or give the wrong choices the same kind of wording and detail, so that the right choice does not stand out by its words or its length. Keep the meaning, the key and its place."
        : id === "TRY"
          ? " Leave one action a reader can do today, with when or where, and nothing else: no reason, no moral."
          : "";
  return `A reader's judge failed this part (${id}): ${evidence}${how} Make the smallest edit that answers it and change nothing else.`;
}

/** A quiz whose right choice is the longest of its three (or the shortest) in more than half the questions. */
export function keyLengthTell(c: Chapter): { field: string; text: string } | null {
  const qs = c.quiz.questions;
  const stands = (longer: boolean): string[] =>
    qs.filter((q) => {
      const key = q.choices[q.correctIndex]?.trim().length ?? 0;
      return q.choices.length > 1 && q.choices.every((x, i) => i === q.correctIndex || (longer ? x.trim().length < key : x.trim().length > key));
    }).map((q) => q.questionId);
  for (const [longer, word] of [[true, "longest"], [false, "shortest"]] as const) {
    const ids = stands(longer);
    if (ids.length * 2 > qs.length) {
      return { field: "quiz", text: `In ${ids.join(", ")} the right choice is the ${word} of the three, so its length gives it away. In those questions ${longer ? "trim the right choice or lengthen one wrong choice" : "lengthen the right choice or trim one wrong choice"} by a few words, so that the right choice is neither the longest nor the shortest. Change no meaning and no key.` };
    }
  }
  return null;
}

export async function autoBook(ctx: PipelineCtx, configPath: string, opts: AutoOptions = {}, say: (line: string) => void = () => {}): Promise<AutoState> {
  const { runDir, bookId, title } = ctx.config;
  const now = (): string => (opts.now?.() ?? new Date()).toISOString();
  const file = path.join(runDir, "auto.json");
  const chapters = ctx.source.spans.map((s) => s.chapterNumber).sort((a, b) => a - b);
  let saved: AutoState | null;
  try {
    saved = readJson<AutoState>(file);
  } catch (e) {
    throw new Error(`AUTO_STATE_UNREADABLE: ${file} is not valid JSON (${(e as Error).message}). Restore it, or delete it: the book then gets its one-off rounds again.`);
  }
  if (saved && saved.bookId !== bookId) throw new ConfigError(`RUN_DIR_MISMATCH: ${file} belongs to "${saved.bookId}", not "${bookId}"; two books cannot share a run dir`);
  const state: AutoState = saved ?? { bookId, startedAt: now(), updatedAt: now(), done: {}, progress: {}, reasons: [] };
  state.done ??= {};
  state.progress ??= {};
  const save = (): void => {
    state.updatedAt = now();
    state.spend = Math.round(ledgerTotal(ctx.ledgerPath) * 100) / 100;
    fs.mkdirSync(runDir, { recursive: true });
    fs.writeFileSync(`${file}.tmp`, JSON.stringify(state, null, 2) + "\n");
    fs.renameSync(`${file}.tmp`, file);
  };
  const finalFile = (n: number): string => path.join(runDir, chapterName(n), "final.json");
  const landed = (n: number): boolean => fs.existsSync(finalFile(n));
  /** Every chapter's text as it stands: what a pack written now would show. */
  const digest = (): string => {
    const h = createHash("sha256");
    for (const n of chapters) h.update(`${n}\0${landed(n) ? fs.readFileSync(finalFile(n), "utf8") : ""}\0`);
    return h.digest("hex");
  };
  const finish = (outcome: AutoOutcome, reasons: string[]): AutoState => {
    state.outcome = outcome;
    state.reasons = reasons;
    if (outcome === "published") delete state.readDigest;
    save();
    if (state.chapterScores?.length) say(`${bookId}: chapter scores: ${state.chapterScores.map((c) => `${chapterName(c.chapter)} ${c.score}`).join(", ")}; average ${state.score}`);
    say(`${bookId}: ${outcome.toUpperCase()}${state.score !== undefined ? `, score ${state.score} band ${state.band}` : ""}, $${(state.spend ?? 0).toFixed(2)}${reasons.length > 0 ? `: ${reasons.join("; ")}` : ""}`);
    return state;
  };
  if (state.outcome === "published" && !opts.force) {
    say(`${bookId}: already published (${state.packageId ?? "no package id on record"}); --force runs it again`);
    return state;
  }
  /** The book waits for the owner with its pack written: the one state `--approve` answers. */
  const hold = (reasons: string[]): AutoState => {
    state.readDigest = digest();
    return finish("needs-owner", reasons);
  };
  const waiting = state.readDigest !== undefined;

  const publish = async (approve: boolean): Promise<AutoState> => {
    if (opts.noPublish) return finish("ready", []);
    // The cover is the session's step (the `cover` verb), not this command's. A run that reaches its publish without
    // one says so where the session and the queue report read: on the outcome line.
    const noCover = fs.existsSync(path.join(ctx.config.runDir, "cover", `${bookId}.webp`)) ? [] : ["no cover made in this run (cover --concept, then cover --image)"];
    const report = await publishBook(ctx, { dryRun: opts.dryRun, approve, publisher: opts.publisher, packagesDir: opts.packagesDir, noGit: opts.noGit, now: opts.now ? () => opts.now!() : undefined });
    state.packageId = report.packageId;
    for (const s of report.steps) say(`${bookId}:   ${s}`);
    if (report.outcome === "published") return finish("published", [...report.remaining.map((r) => `still to do: ${r}`), ...noCover]);
    if (report.outcome === "dry-run") return finish("dry-run", [...report.remaining.map((r) => `still to do: ${r}`), ...noCover]);
    return report.outcome === "needs-approval" ? hold(report.reasons) : finish("failed", report.reasons);
  };

  const run = async (): Promise<AutoState> => {
    // 0. The owner's yes. It holds for the pack the owner read: a book that was waiting, with every chapter as it was
    // when that pack was written. Such a run edits nothing; it publishes what was read.
    if (opts.approve) {
      if (waiting && state.readDigest === digest()) {
        say(`${bookId}: approved by the owner; publishing the chapters as they were read`);
        return publish(true);
      }
      say(`${bookId}: --approve is not taken: ${waiting ? "the chapters changed since the pack the owner read" : "this book was not waiting for the owner's read"}. The run goes on as usual and will wait again if the owner is needed.`);
    }
    delete state.outcome;
    delete state.readDigest;

    const ex = loadExemplar(ctx);
    const own = (n: number): boolean => ex.own && n === ex.chapter;
    const status = (n: number): ChapterStatus | null => readJson<ChapterStatus>(path.join(runDir, chapterName(n), "status.json"));
    const open = (n: number): boolean => {
      const s = status(n);
      return !s || s.stage !== "clean" || s.open.some((i) => /rename landed on/.test(i.text));
    };

    // 1. Keys, for a book without source text. They are checked before a chapter is written from them; chapters that
    // already exist were written from whatever the notes said then, and a check made afterwards cannot vouch for them.
    if (ctx.config.chapters) {
      // A chapter counts as written once it has begun: a draft under book/ was made from the notes as they were then,
      // and the writer picks it up again instead of writing from the checked notes.
      const begun = (n: number): boolean => landed(n) || fs.existsSync(path.join(runDir, chapterName(n), "book"));
      const anyWritten = chapters.some((n) => !own(n) && begun(n));
      const drafted = await draftKeys(ctx, configPath);
      if (drafted > 0) say(`${bookId}: keys drafted for ${drafted} chapters`);
      const notes = createHash("sha256").update(ctx.config.chapters.map((c) => `${c.number}\0${c.keys ?? ""}\0`).join("")).digest("hex");
      // The owner's word covers the notes the owner read: not notes drafted in this run, and not notes that changed since.
      if (state.keys === "owner" && (drafted > 0 || state.keysDigest !== notes)) {
        delete state.keys;
        delete state.keysDigest;
        say(`${bookId}: the keys changed since the owner vouched for them; that word no longer covers them`);
      }
      // Chapters held as written from unchecked notes follow the notes as they were then. Once a note is edited, the
      // owner's word for the notes says nothing about those chapters: the pack has to be read.
      const editedSinceHold = state.keys === "unchecked" && anyWritten && state.keysDigest !== undefined && state.keysDigest !== notes;
      if (opts.keysOk && drafted > 0) say(`${bookId}: --keys-ok is not taken: keys were drafted in this run and nobody has read them yet`);
      else if (opts.keysOk && editedSinceHold) say(`${bookId}: --keys-ok is not taken: the notes changed after the chapters were written, so those chapters do not follow the notes as they now stand. The owner reads the pack and says yes (--approve), or the folders of the chapters whose notes changed are removed so that they are written again`);
      if (state.keys === "owner" || (opts.keysOk && drafted === 0 && !editedSinceHold)) {
        if (state.keys !== "owner") say(`${bookId}: keys taken on the owner's word (--keys-ok); no web check`);
        state.keys = "owner";
        state.keysDigest = notes;
      } else if (state.keys === "unchecked" && anyWritten) {
        // Stays: a check made now cannot vouch for chapters already written. The owner's word (--keys-ok) or yes (--approve) lifts it.
      } else if (keysChecked(ctx)?.checked) {
        state.keys = "checked";
        delete state.keysDigest;
      } else if (anyWritten) {
        state.keys = "unchecked";
        state.keysDigest = notes;
        say(`${bookId}: chapters were written before the keys were checked against the book; the book will wait for the owner`);
      } else {
        const check = await checkKeys(ctx, configPath, { now: opts.now });
        say(`${bookId}: keys ${check.checked ? "checked" : "NOT fully checked"}: ${check.changed} of ${check.chapters} notes edited, ${check.stories} with a story from the book${check.notes.length > 0 ? `; ${check.notes.join("; ")}` : ""}`);
        if (!check.checked) {
          save();
          // The chapter-list problems the finished groups found are named here: --keys-ok skips them later, so the owner
          // must see them before vouching for the notes.
          const found = check.problems.filter((p) => !p.endsWith(NO_LESSON));
          return finish("needs-owner", [
            ...found,
            `the keys could not be checked against the book (${check.notes.join("; ")}); no chapter was written. Run the same command again to try the check once more, or read the notes in the config${found.length > 0 ? " and the chapter-list problems above" : ""} and pass --keys-ok`,
          ]);
        }
        state.keys = "checked";
        delete state.keysDigest;
      }
    } else {
      state.keys = "checked";
    }
    save();

    // 1b. Notes no chapter can be written from. A note left with no lesson is a hard stop whatever anyone vouches for:
    // nobody can vouch for advice that is not there. A chapter list the check found wrong stops the book until the owner
    // corrects the list and the check is made again, or vouches for the list as it stands (--keys-ok). An old record
    // carries no such problems, so a book written before this check existed is not held by it.
    if (ctx.config.chapters) {
      const empty = noteProblems(ctx.config.chapters);
      if (empty.length > 0) {
        return finish("needs-owner", [...empty, `no chapter was written. Write the chapter's advice into its note ("keys") in ${configPath}, or delete that note so the next run drafts and checks it again`]);
      }
      const listProblems = state.keys === "owner" ? [] : (keysChecked(ctx)?.problems ?? []).filter((p) => !p.endsWith(NO_LESSON));
      if (listProblems.length > 0) {
        const keysDir = path.join(runDir, "keys");
        return finish("needs-owner", [
          ...listProblems,
          `no chapter was written. Either correct the chapter list in ${configPath} (numbers, titles and the notes under them), delete ${path.join(keysDir, "checked.json")} and ${path.join(keysDir, "check-progress.json")}, and run the same command again to check the notes once more; or, if the list is right as it stands, run the same command with --keys-ok`,
        ]);
      }
    }

    // 2. A redo the owner allowed: once per score, and only for a failed book. The list is remembered before anything
    // is removed, so a stopped redo carries on instead of starting over.
    if (opts.redo) {
      const last = readJson<BookScore>(path.join(runDir, "score.json"));
      if (!last || last.band !== "fail") {
        say(`${bookId}: --redo is for a failed book; ${last ? `the last band was ${last.band}` : "this book has no score yet"}. Nothing is rewritten.`);
      } else if (state.redoOf === last.at) {
        say(`${bookId}: the redo list of this score was already used`);
      } else {
        const list = last.redo.filter((n) => !own(n));
        state.redoOf = last.at;
        // Nothing to rewrite (only the book's own exemplar failed): the rounds and their scope stay as they are.
        if (list.length > 0) {
          state.redoLeft = list;
          state.redone = list;
          state.done = {};
          state.progress = {};
          delete state.mend;
        }
        save();
        say(`${bookId}: rewriting ${list.map(chapterName).join(", ") || "nothing (only the book's own exemplar was on the list)"}`);
      }
    }
    for (const n of [...(state.redoLeft ?? [])]) {
      const dir = path.join(runDir, chapterName(n));
      fs.rmSync(path.join(dir, "book"), { recursive: true, force: true });
      for (const f of ["final.json", "status.json", "lesson.json"]) fs.rmSync(path.join(dir, f), { force: true });
      state.redoLeft = (state.redoLeft ?? []).filter((x) => x !== n);
      save();
    }

    // 3. The chapters that are not there yet (twice, for a chapter whose call failed).
    for (let attempt = 0; attempt < 2; attempt++) {
      const todo = chapters.filter((n) => !own(n) && !landed(n));
      if (todo.length === 0) break;
      const written = await runBookChapters(ctx, todo, { exemplar: ex.chapter });
      say(`${bookId}: ${written.filter((s) => s.stage !== "failed").length} of ${todo.length} chapters written${attempt > 0 ? " (second try)" : ""}`);
    }
    const missing = chapters.filter((n) => !landed(n));
    if (missing.length > 0) return finish("failed", [`chapters that never landed: ${missing.map(chapterName).join(", ")}`]);

    // 4. One-off rounds. `round` runs the fix call on the chapters that have something to fix, one chapter at a time,
    // and records each chapter as it goes. After a redo only the rewritten chapters are in scope (the first pass stays
    // book-wide: it is where a name another chapter used first is renamed, and it is free for a clean chapter).
    const scope = state.redone?.length ? new Set(state.redone) : null;
    const round = async (name: OneOff, pick: (n: number) => boolean, findings: (n: number) => Finding[] = () => [], wholeBook = false): Promise<void> => {
      if (state.done[name]) return;
      // The round is on record as begun before its first call, so a stop inside it is carried on, whatever the book looks like then.
      state.progress[name] ??= [];
      save();
      let touched = 0;
      for (const n of chapters) {
        if ((state.progress[name] ?? []).includes(n)) continue;
        if (scope && !wholeBook && !scope.has(n)) continue;
        const mending = state.mend === `${name}:${n}`;
        const mine = mending ? [] : findings(n);
        if (mending || pick(n) || mine.length > 0) {
          try {
            const before = status(n)?.round ?? 0;
            // A chapter that stopped between its findings and its mending round gets only the mending round now.
            let st = mending ? status(n) : await fixLanded(ctx, n, mine);
            // A round that carried findings can leave a flag of its own (a new hook with a quotation in it): one plain round mends it.
            if ((mending || mine.length > 0) && st && st.stage !== "clean") {
              state.mend = `${name}:${n}`;
              save();
              st = await fixLanded(ctx, n);
            }
            if ((st?.round ?? 0) > before) touched++;
          } catch (e) {
            if (isStop(e)) throw e;
            say(`${bookId}: ${name}: ${chapterName(n)} could not be fixed (${e instanceof Error ? e.message : String(e)}); what was open stays open`);
          }
        }
        delete state.mend;
        state.progress[name] = [...(state.progress[name] ?? []), n];
        save();
      }
      state.done[name] = now();
      delete state.progress[name];
      save();
      say(`${bookId}: ${name}: ${touched} chapters edited`);
    };
    await round("fix1", () => true, () => [], true);
    await round("fix2", open);
    const repairs = new Map<number, Finding[]>();
    if (!state.done.repairs) {
      const add = (n: number, f: Finding): void => void repairs.set(n, [...(repairs.get(n) ?? []), f]);
      for (const c of hookCollisions(ctx, chapters)) {
        const nums = c.chapters.map((x) => Number(x.slice(2)));
        // One chapter keeps its hook (the first; after a redo, the first that was not rewritten) and every other chapter
        // of the group gets a new one; after a redo, only the rewritten ones.
        const keep = (scope ? nums.find((x) => !scope.has(x)) : undefined) ?? nums[0]!;
        for (const n of nums) {
          if (n === keep || (scope && !scope.has(n))) continue;
          add(n, { field: "hook", text: `The hook shares "${c.words}" with the hook of ${chapterName(keep)}, another chapter of this book. Rewrite the hook, at about the same length (25 words at most), around a different object or moment taken from this chapter's own summary. A hook holds no quotation marks.` });
        }
      }
      for (const n of chapters) {
        const tell = keyLengthTell(readJson<Chapter>(finalFile(n))!);
        if (tell) add(n, tell);
      }
    }
    await round("repairs", () => false, (n) => repairs.get(n) ?? []);

    // 5. The reading pack and the score.
    const pack = path.join(runDir, "reading", "all.html");
    const writePack = (): void => {
      fs.mkdirSync(path.dirname(pack), { recursive: true });
      fs.writeFileSync(pack, renderPack(ctx, chapters, `${title}: chapters ${chapters[0]} to ${chapters[chapters.length - 1]}`));
      state.pack = pack;
    };
    writePack();
    let score = await scoreBook(ctx, chapters);
    say(`${bookId}: score ${score.score} (lowest ${score.min}), band ${score.band}${score.reasons.length > 0 ? `: ${score.reasons.join("; ")}` : ""}`);

    // 6. A manual band with nothing open gets one round on what the judge failed, where a small edit can answer it.
    // A round that had begun is finished, even if its first edits changed the band or left a flag.
    if (!state.done.judgeFix && (state.progress.judgeFix !== undefined || (score.band === "manual" && score.chapters.every((c) => c.blocking === 0)))) {
      const evalDir = path.join(runDir, "eval");
      await round("judgeFix", () => false, (n) =>
        (readJson<EvalResult>(path.join(evalDir, `${chapterName(n)}.eval.json`))?.items ?? [])
          .filter((i) => !i.pass && SMALL_EDIT.test(i.id))
          .map((i) => ({ field: reviewField(i.id) ?? "(chapter)", text: judgeFinding(i.id, i.evidence) })),
      );
      writePack();
      score = await scoreBook(ctx, chapters);
      say(`${bookId}: after the judge's round: score ${score.score} (lowest ${score.min}), band ${score.band}${score.reasons.length > 0 ? `: ${score.reasons.join("; ")}` : ""}`);
    }
    state.score = score.score;
    state.band = score.band;
    state.chapterScores = score.chapters.map((c) => ({ chapter: c.chapter, score: c.score }));
    save();

    // 7. What the band allows.
    if (score.band === "fail") {
      const list = score.redo.filter((n) => !own(n));
      const mine = score.redo.filter(own);
      return finish("failed", [
        ...score.reasons,
        ...(list.length > 0 ? [`with the owner's yes, --redo rewrites ${list.map(chapterName).join(", ")}`] : []),
        ...(mine.length > 0 ? [`${mine.map(chapterName).join(", ")} is this book's own exemplar and is never rewritten; the owner mends it`] : []),
      ]);
    }
    if (score.band === "manual") return hold([...score.reasons, "the owner reads the pack; then --approve publishes it"]);
    if (state.keys === "unchecked") return hold(["the chapters were written from keys that were never checked against the book; the owner reads the pack and the notes, then --approve publishes it (or --keys-ok vouches for the notes)"]);
    return publish(false);
  };

  try {
    return await run();
  } catch (e) {
    if (isStop(e)) throw e;
    // Anything else ends this book with a record of why, so the next run (or the queue's report) can say what happened.
    return finish("failed", [`stopped by an error: ${e instanceof Error ? e.message : String(e)}`]);
  }
}

// ---------------------------------------------------------------- the queue

export interface QueueRow {
  at: string;
  config: string;
  bookId?: string;
  outcome: AutoOutcome | "budget" | "error";
  score?: number;
  band?: string;
  spend?: number;
  reasons: string[];
  pack?: string;
}

/** The config paths in a queue file: a JSON array of strings, or one path per line (blank lines and # comments are
 *  skipped). A relative path is taken from the queue file's folder. */
export function readQueue(queueFile: string): string[] {
  const text = fs.readFileSync(queueFile, "utf8");
  let items: string[];
  if (text.trim().startsWith("[")) {
    const raw: unknown = JSON.parse(text);
    if (!Array.isArray(raw) || !raw.every((x) => typeof x === "string")) throw new Error(`QUEUE_INVALID: ${queueFile} must be a JSON array of config paths`);
    items = (raw as string[]).map((l) => l.trim()).filter((l) => l !== "");
  } else {
    items = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l !== "" && !l.startsWith("#"));
  }
  if (items.length === 0) throw new Error(`QUEUE_EMPTY: ${queueFile} names no book`);
  const base = path.dirname(path.resolve(queueFile));
  return items.map((p) => (p.startsWith("~") || path.isAbsolute(p) ? p.replace(/^~(?=\/|$)/, process.env.HOME ?? "~") : path.resolve(base, p)));
}

/** Runs every book of the queue in turn. One book's failure does not stop the next; a usage limit stops the queue, and
 *  running the same command again carries on (a published book is skipped, a stopped one resumes). Each book's result
 *  is one line in `<queue file>.report.jsonl`. The owner's rulings (approve, keys-ok, redo, force) are one book's and
 *  are never taken from a queue's options. */
export async function autoQueue(queueFile: string, opts: AutoOptions = {}, say: (line: string) => void = () => {}): Promise<{ rows: QueueRow[]; stopped: string | null }> {
  const { approve: _approve, keysOk: _keysOk, redo: _redo, force: _force, ...shared } = opts;
  void _approve, void _keysOk, void _redo, void _force;
  const configs = readQueue(queueFile);
  const reportFile = `${queueFile}.report.jsonl`;
  const rows: QueueRow[] = [];
  let stopped: string | null = null;
  for (const [k, config] of configs.entries()) {
    const at = (opts.now?.() ?? new Date()).toISOString();
    let row: QueueRow;
    try {
      const ctx = makeCtx(loadBookConfig(config));
      say(`[${k + 1}/${configs.length}] ${ctx.config.bookId} (${config})`);
      const st = await guarded(ctx, () => autoBook(ctx, config, shared, say));
      row = { at, config, bookId: st.bookId, outcome: st.outcome ?? "failed", score: st.score, band: st.band, spend: st.spend, reasons: st.reasons, pack: st.pack };
    } catch (e) {
      if (e instanceof UsageLimitError) {
        stopped = e.message;
        say(`queue stopped at ${config}: ${e.message}`);
        break;
      }
      const message = e instanceof Error ? e.message : String(e);
      row = { at, config, outcome: e instanceof BudgetError ? "budget" : "error", reasons: [message] };
      say(`[${k + 1}/${configs.length}] ${config}: ${row.outcome.toUpperCase()}: ${message}`);
    }
    rows.push(row);
    fs.appendFileSync(reportFile, JSON.stringify(row) + "\n");
  }
  const count = (o: QueueRow["outcome"]): number => rows.filter((r) => r.outcome === o).length;
  say(`queue: ${rows.length} of ${configs.length} books run; ${count("published")} published, ${count("dry-run") + count("ready")} ready, ${count("needs-owner")} waiting for the owner, ${count("failed") + count("error")} failed, ${count("budget")} stopped on their budget${stopped ? "; stopped on a usage limit, run the same command again later" : ""}`);
  return { rows, stopped };
}
