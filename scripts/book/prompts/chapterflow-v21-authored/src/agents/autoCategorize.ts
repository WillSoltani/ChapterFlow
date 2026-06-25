/**
 * No-API auto-categorizer.
 *
 * The model-backed categorizer (categorizer.ts -> callClaude) needs the API, so
 * the inline-operator / no-API flow couldn't use it and had to pass
 * --categories/--tags by hand (or ship empty, which the strict package validator
 * rejects). This derives categories + tags DETERMINISTICALLY from the book's own
 * content — no API:
 *
 *   1. If the research bibliography (toc.json) already carries categories/tags
 *      (a researcher can fill them while reading the book), use those.
 *   2. Otherwise score the 17 canonical categories (config/categories.json) by
 *      keyword-stem hits across the book's titles + chapter source notes
 *      (focus / coreClaim / centralConcept names), and derive tags from the
 *      chapter concept names. Always returns at least one category so promote
 *      never ships empty.
 */

import { existsSync, readFileSync, readdirSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { findRunArtifact } from "../lib/runDirs.js";
import { flattenTocChapters, parseToc } from "../lib/tocContract.js";

const __dirname = dirname(fileURLToPath(import.meta.url)); // src/agents
const REPO = resolve(__dirname, "../../../../../..");
const RUNS_DIR = resolve(REPO, ".chapterflow/runs");
const CONFIG_PATH = resolve(__dirname, "../../config/categories.json");
const CHAPTERS_DIR = resolve(__dirname, "../../state/chapters");

type CategoriesConfig = { canonical: string[]; aliases: Record<string, string> };

/** Keyword STEMS per canonical category (substring match, lowercase). Broad
 *  stems ("productiv", "leader") catch inflections. */
const KEYWORDS: Record<string, string[]> = {
  Psychology: ["psycholog", "mindset", "behavior", "behaviour", "emotion", "cognit", "bias", "mental", "brain", "motivat", "fear", "belief", "subconscious", "perception", "willpower", "vulnerab", "shame", "anxiety", "resilien", "trauma", "self-worth", "identity"],
  "Self-Help": ["self-help", "self-improv", "personal growth", "discipline", "confidence", "purpose", "fulfil", "happiness", "transform your", "better version", "your best", "potential", "courage", "authentic", "worthiness", "wholehearted", "self-acceptance"],
  Business: ["business", "company", "customer", "market", "revenue", "product", "profit", "sales", "brand", "enterprise", "commerce", "pricing"],
  Productivity: ["productiv", "focus", "time management", "efficien", "task", "attention", "distraction", "procrastinat", "workflow", "deep work", "prioriti", "getting things done"],
  Leadership: ["leader", "team", "influence", "vision", "trust", "accountab", "culture", "delegat", "mentor", "inspire", "command"],
  Communication: ["communicat", "conversation", "listen", "persuad", "speak", "storytell", "audience", "rapport", "body language", "public speaking", "message", "charisma"],
  Strategy: ["strateg", "competiti", "advantage", "positioning", "long-term", "tactic", "game theory", "warfare", "maneuver", "the enemy"],
  "Decision Making": ["decision", "judgment", "judgement", "uncertaint", "probabil", "tradeoff", "trade-off", "risk", "choose", "rational", "forecast"],
  Philosophy: ["philosoph", "meaning of life", "ethic", "virtue", "stoic", "wisdom", "existential", "moral", "mortality", "the good life"],
  Learning: ["learn", "skill", "practice", "memory", "knowledge", "master", "deliberate practice", "expert", "study", "education", "teach"],
  Investing: ["invest", "stock", "portfolio", "wealth", "asset", "compound", "dividend", "valuation", "finance", "money", "retirement", "frugal"],
  Negotiation: ["negotiat", "bargain", "leverage", "concession", "counterpart", "deal-making", "win-win", "tactical empathy"],
  Relationships: ["relationship", "partner", "love", "intimacy", "family", "friend", "marriage", "connection", "attachment", "dating", "conflict"],
  "Behavioral Economics": ["behavioral econ", "behavioural econ", "nudge", "incentive", "irrational", "heuristic", "loss aversion", "sunk cost", "anchoring", "prospect theory"],
  Management: ["management", "operation", "employee", "performance", "organization", "organisation", "hiring", "process", "scaling", "manager"],
  Innovation: ["innovat", "creativ", "invention", "disrupt", "design thinking", "breakthrough", "ideation", "prototype"],
  Entrepreneurship: ["entrepreneur", "startup", "start-up", "founder", "venture", "bootstrap", "launch", "scale", "hustle", "side business"],
};

function loadConfig(): CategoriesConfig {
  const raw = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
  return { canonical: raw.canonical ?? [], aliases: raw.aliases ?? {} };
}

function normalizeCategories(raw: string[], config: CategoriesConfig): string[] {
  const lookup = new Map<string, string>();
  for (const [k, v] of Object.entries(config.aliases)) lookup.set(k.toLowerCase(), v);
  for (const c of config.canonical) lookup.set(c.toLowerCase(), c);
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const matched = lookup.get(item.trim().toLowerCase());
    if (matched && config.canonical.includes(matched) && !out.includes(matched)) out.push(matched);
  }
  return out;
}

function normalizeTags(raw: string[]): string[] {
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const cleaned = item.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    if (!cleaned || cleaned.length > 40) continue;
    if (!out.includes(cleaned)) out.push(cleaned);
  }
  return out.slice(0, 8);
}

function countStem(text: string, stem: string): number {
  let n = 0;
  let i = text.indexOf(stem);
  while (i !== -1) {
    n++;
    i = text.indexOf(stem, i + stem.length);
  }
  return n;
}

export type AutoCat = { categories: string[]; tags: string[]; source: "research" | "derived" };

export function deriveCategoriesAndTags(
  bookId: string,
  opts: { title?: string; chapterTitles?: string[] } = {},
): AutoCat {
  const config = loadConfig();
  const textParts: string[] = [];
  if (opts.title) textParts.push(opts.title);
  for (const t of opts.chapterTitles ?? []) textParts.push(t);
  const conceptTags: string[] = [];
  let tocCats: string[] = [];
  let tocTags: string[] = [];

  const tocPath = findRunArtifact(RUNS_DIR, bookId, "source-freeze/toc.json");
  if (tocPath) {
    const runDir = resolve(tocPath, "../..");
    try {
      const toc = JSON.parse(readFileSync(tocPath, "utf8"));
      const parsed = parseToc(toc, { bookId, path: tocPath });
      if (parsed.ok) {
        if (Array.isArray(toc.categories)) tocCats = toc.categories;
        if (Array.isArray(toc.tags)) tocTags = toc.tags;
        for (const ch of flattenTocChapters(toc, { bookId, path: tocPath })) if (ch.title) textParts.push(ch.title);
      }
    } catch {/* ignore */}
    const srcDir = resolve(runDir, "sidecars", "source");
    if (existsSync(srcDir)) {
      for (const f of readdirSync(srcDir).filter((x) => x.endsWith(".source.json"))) {
        try {
          const s = JSON.parse(readFileSync(resolve(srcDir, f), "utf8"));
          textParts.push(String(s.focus ?? ""), String(s.coreClaim ?? ""), String(s.centralConcept?.name ?? ""));
          if (s.centralConcept?.name) conceptTags.push(String(s.centralConcept.name));
        } catch {/* ignore */}
      }
    }
  }
  // also fold in authored chapter takeaways for stronger signal + concept tags
  try {
    for (const f of readdirSync(CHAPTERS_DIR).filter((x) => x.startsWith(`${bookId}-ch`) && x.endsWith(".chapter.json"))) {
      try {
        const ch = JSON.parse(readFileSync(resolve(CHAPTERS_DIR, f), "utf8"));
        textParts.push(String(ch.keyTakeaway ?? ""), String(ch.hook ?? ""));
      } catch {/* ignore */}
    }
  } catch {/* no chapters yet */}

  // 1. Research-provided categories win if they normalize to canonical.
  const fromResearch = normalizeCategories(tocCats, config);
  if (fromResearch.length > 0) {
    const tags = normalizeTags(tocTags.length ? tocTags : conceptTags);
    return { categories: fromResearch.slice(0, 3), tags, source: "research" };
  }

  // 2. Deterministic scoring.
  const text = textParts.join(" \n ").toLowerCase();
  const scored = config.canonical
    .map((c) => ({ c, score: (KEYWORDS[c] ?? []).reduce((n, kw) => n + countStem(text, kw), 0) }))
    .sort((a, b) => b.score - a.score);
  const top = scored[0]?.score ?? 0;
  let categories = scored.filter((s) => s.score > 0 && s.score >= Math.max(2, top * 0.4)).slice(0, 3).map((s) => s.c);
  if (categories.length === 0) categories = scored[0]?.score ? [scored[0].c] : ["Self-Help"];

  const tags = normalizeTags(conceptTags.length ? conceptTags : categories.map((c) => c));
  return { categories, tags, source: "derived" };
}
