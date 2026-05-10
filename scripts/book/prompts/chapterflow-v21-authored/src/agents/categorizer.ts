/**
 * Categorizer. Assigns each book to 2–4 categories from a fixed canonical
 * taxonomy + 4–8 free-form tags. Runs once per book, cheap (Haiku-tier),
 * after the book is fully generated and before promotion.
 *
 * Caches its output to state/books/<bookId>.categories.json so re-runs of
 * generateBook on a finished book don't re-spend the call.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { callClaude } from "../claudeClient.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = resolve(__dirname, "../../prompts");
const CONFIG_PATH = resolve(__dirname, "../../config/categories.json");
const STATE_BOOKS_DIR = resolve(__dirname, "../../state/books");

type CategoriesConfig = {
  canonical: string[];
  aliases: Record<string, string>;
};

export type CategorizerOutput = {
  categories: string[];
  tags: string[];
};

export type CategorizerInput = {
  bookId: string;
  title: string;
  author: string;
  /** Chapter titles in order, used to give the model enough context to choose
   *  categories. Just titles is enough — full chapter content is overkill. */
  chapterTitles: string[];
};

function loadConfig(): CategoriesConfig {
  return JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
}

function cachePath(bookId: string): string {
  return resolve(STATE_BOOKS_DIR, `${bookId}.categories.json`);
}

/**
 * Normalize whatever the model returned through the alias map and clamp to
 * the canonical list. Anything unrecognized is dropped (with a warning) so
 * the agent can never inject off-list categories.
 */
function normalizeCategories(raw: string[], config: CategoriesConfig): string[] {
  const lookup = new Map<string, string>();
  for (const [k, v] of Object.entries(config.aliases)) lookup.set(k.toLowerCase(), v);
  for (const c of config.canonical) lookup.set(c.toLowerCase(), c);

  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (!trimmed) continue;
    const matched = lookup.get(trimmed.toLowerCase());
    if (matched && config.canonical.includes(matched)) {
      if (!out.includes(matched)) out.push(matched);
    } else {
      console.warn(`categorizer: dropped non-canonical category "${trimmed}" (no alias mapping)`);
    }
  }
  return out;
}

function normalizeTags(raw: string[]): string[] {
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const cleaned = item.trim().toLowerCase().replace(/\s+/g, "-");
    if (!cleaned) continue;
    if (cleaned.length > 40) continue;
    if (!out.includes(cleaned)) out.push(cleaned);
  }
  return out.slice(0, 8);
}

export async function runCategorizer(
  input: CategorizerInput,
  options: { useCache?: boolean } = {},
): Promise<CategorizerOutput> {
  const useCache = options.useCache !== false;
  const cache = cachePath(input.bookId);
  if (useCache && existsSync(cache)) {
    return JSON.parse(readFileSync(cache, "utf8")) as CategorizerOutput;
  }

  const config = loadConfig();
  const systemPrompt = readFileSync(resolve(PROMPTS_DIR, "categorizer.system.md"), "utf8");
  const userPrompt = [
    `# Book`,
    ``,
    `Title: ${input.title}`,
    `Author: ${input.author}`,
    ``,
    `## Chapters`,
    ``,
    ...input.chapterTitles.map((t, i) => `${i + 1}. ${t}`),
    ``,
    `Pick 2–4 categories from the canonical list and 4–8 tags. Return strict JSON.`,
  ].join("\n");

  const result = await callClaude<CategorizerOutput>({
    tier: "critic",
    system: systemPrompt,
    user: userPrompt,
    maxTokens: 600,
    temperature: 0.3,
    jsonMode: true,
    timeoutMs: 60_000,
  });

  const out = result.content;
  const categories = normalizeCategories(Array.isArray(out.categories) ? out.categories : [], config);
  const tags = normalizeTags(Array.isArray(out.tags) ? out.tags : []);

  if (categories.length < 2) {
    throw new Error(
      `categorizer: only ${categories.length} canonical categories returned for "${input.bookId}". Raw: ${JSON.stringify(out.categories)}`,
    );
  }
  if (categories.length > 4) categories.length = 4;
  if (tags.length < 4) {
    console.warn(`categorizer: only ${tags.length} tags returned for "${input.bookId}" (wanted 4–8)`);
  }

  const final: CategorizerOutput = { categories, tags };

  mkdirSync(STATE_BOOKS_DIR, { recursive: true });
  writeFileSync(cache, JSON.stringify(final, null, 2), "utf8");

  return final;
}
