/**
 * One-shot v13 corpus cleanup. Walks every book-packages/*.modern.json file,
 * normalizes `book.categories[]` against the canonical taxonomy, and writes
 * the result back. Tags are not touched.
 *
 * What it fixes:
 *   - Case drift: "business" → "Business", "leadership" → "Leadership", etc.
 *   - Aliases:    "Self-Improvement" / "Self-Development" / "Personal Development" → "Self-Help"
 *                 "Focus" → "Productivity"
 *                 "Cognitive Science" → "Psychology"
 *   - Dedup:      remove duplicates introduced by the alias collapse
 *
 * Anything that isn't in the canonical list AND has no alias mapping is left
 * alone (so genuinely orphan categories like "Education" survive untouched
 * instead of getting silently dropped). This is conservative on purpose —
 * the script is meant to clean up obvious noise, not impose the v21
 * taxonomy on the v13 corpus.
 *
 *   npx tsx scripts/book/prompts/chapterflow-v21-authored/src/scratch/normalize-v13-categories.ts
 */

import { readFileSync, writeFileSync, readdirSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../../../../../..");
const BOOK_PACKAGES_DIR = resolve(REPO_ROOT, "book-packages");
const CONFIG_PATH = resolve(__dirname, "../../config/categories.json");

type Config = {
  canonical: string[];
  aliases: Record<string, string>;
};

/** Title-case "self-development" -> "Self-Development", "decision making" -> "Decision Making". */
function titleCase(s: string): string {
  return s
    .split(/(\s+|-)/)
    .map((part) => (/^\s+$|^-$/.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()))
    .join("");
}

function normalize(category: string, config: Config): string {
  const trimmed = category.trim();
  if (!trimmed) return "";
  // Build a case-insensitive alias lookup.
  const aliasLookup = new Map<string, string>();
  for (const [k, v] of Object.entries(config.aliases)) aliasLookup.set(k.toLowerCase(), v);
  for (const c of config.canonical) aliasLookup.set(c.toLowerCase(), c);

  const direct = aliasLookup.get(trimmed.toLowerCase());
  if (direct) return direct;

  const titled = titleCase(trimmed);
  const aliased = aliasLookup.get(titled.toLowerCase());
  if (aliased) return aliased;

  return titled; // leave non-canonical words at title case rather than dropping them
}

function main() {
  const config = JSON.parse(readFileSync(CONFIG_PATH, "utf8")) as Config;
  const files = readdirSync(BOOK_PACKAGES_DIR).filter((f) => f.endsWith(".modern.json"));

  let touched = 0;
  let scanned = 0;
  const allFinalCategories = new Map<string, number>();

  for (const file of files) {
    scanned += 1;
    const path = resolve(BOOK_PACKAGES_DIR, file);
    const pkg = JSON.parse(readFileSync(path, "utf8"));
    const original: string[] = Array.isArray(pkg.book?.categories) ? [...pkg.book.categories] : [];
    if (original.length === 0) continue;

    const normalized: string[] = [];
    for (const cat of original) {
      const n = normalize(cat, config);
      if (n && !normalized.includes(n)) normalized.push(n);
    }

    for (const c of normalized) allFinalCategories.set(c, (allFinalCategories.get(c) ?? 0) + 1);

    const changed = JSON.stringify(original) !== JSON.stringify(normalized);
    if (changed) {
      pkg.book.categories = normalized;
      writeFileSync(path, JSON.stringify(pkg, null, 2), "utf8");
      touched += 1;
      console.log(`  ${file}: ${JSON.stringify(original)} -> ${JSON.stringify(normalized)}`);
    }
  }

  console.log(`\nScanned ${scanned} files. Updated ${touched}.`);
  console.log(`\nFinal category distribution:`);
  const sorted = [...allFinalCategories.entries()].sort((a, b) => b[1] - a[1]);
  for (const [cat, count] of sorted) {
    const onCanon = config.canonical.includes(cat) ? "" : "  (off-canon)";
    console.log(`  ${count.toString().padStart(3, " ")}  ${cat}${onCanon}`);
  }
}

main();
