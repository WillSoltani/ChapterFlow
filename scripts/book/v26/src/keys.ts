/** One-time draft of every chapter's `keys` (the author's advice in blunt words) for a knowledge-mode book, written back into
 *  the book config for the owner to edit. An input to the writer and the checker, like a source text; never a judge. */
import * as fs from "node:fs";
import type { PipelineCtx } from "./pipeline";
import { loadPrompt, renderTemplate } from "./prompts";
import { callShaped } from "./variants";
export { keysBlock, keysFor } from "./keysText";

/** Drafts keys for every chapter that has none (or all, with force) and writes them into the config file. Returns the count drafted. */
export async function draftKeys(ctx: PipelineCtx, configPath: string, opts: { force?: boolean } = {}): Promise<number> {
  const chapters = ctx.config.chapters;
  if (!chapters) throw new Error("KEYS_TEXT_MODE: keys are for a book without source text; a text-mode book has its source");
  const todo = chapters.filter((c) => opts.force || !c.keys);
  if (todo.length === 0) return 0;
  const prompt = renderTemplate(loadPrompt("keys-knowledge"), {
    BOOK_SECTION: ctx.bookSection,
    CHAPTERS: todo.map((c) => `${c.number}. ${c.title}`).join("\n"),
  });
  // The keys are the fact backbone every later call reads, so the strongest model drafts them: the fixer when one is set.
  const raw = (await callShaped(ctx, 0, {
    role: ctx.config.fixer ?? ctx.config.checker,
    prompt,
    step: "keys",
    kind: "write",
    errors: (v) => {
      const o = v as { chapters?: unknown } | null;
      const list: unknown[] | null = o && Array.isArray(o.chapters) ? (o.chapters as unknown[]) : null;
      if (!list) return ["answer must be an object with a chapters array"];
      const hasKeys = (x: unknown, n: number): boolean =>
        typeof x === "object" && x !== null && (x as { number?: unknown }).number === n && typeof (x as { keys?: unknown }).keys === "string" && (x as { keys: string }).keys.trim() !== "";
      const bad = todo.filter((c) => list.filter((x) => (x as { number?: unknown } | null)?.number === c.number).length !== 1 || !list.some((x) => hasKeys(x, c.number)));
      return bad.length ? [`missing, repeated or empty keys for chapters ${bad.map((c) => c.number).join(", ")}`] : [];
    },
    outPrefix: `${ctx.config.runDir}/keys/keys`,
    ledgerStep: "book-keys",
  })) as { chapters: Array<{ number: number; keys: string }> };
  const file = JSON.parse(fs.readFileSync(configPath, "utf8")) as { chapters: Array<{ number: number; title: string; keys?: string }> };
  for (const c of raw.chapters) {
    const entry = file.chapters.find((x) => x.number === c.number);
    if (entry && todo.some((t) => t.number === c.number)) entry.keys = c.keys.trim();
  }
  // Notes drafted now were never checked: an earlier check's record no longer speaks for this book's keys. The record
  // goes first and the config is swapped in whole, so a stop between the two never leaves new notes under an old record.
  for (const stale of ["checked.json", "check-progress.json"]) fs.rmSync(`${ctx.config.runDir}/keys/${stale}`, { force: true });
  fs.writeFileSync(`${configPath}.tmp`, JSON.stringify(file, null, 2) + "\n");
  fs.renameSync(`${configPath}.tmp`, configPath);
  for (const c of todo) {
    const got = raw.chapters.find((x) => x.number === c.number);
    if (got) c.keys = got.keys.trim();
  }
  return todo.length;
}
