/**
 * Readability hot-spot scanner. For each chapter of each v21 book,
 * surface the sentences that violate the polish-pass spec:
 *
 *   - sentences > 28 words (deep/full) or > 25 (fast)
 *   - sentences containing Latinate substitution targets
 *   - sentences containing hedge phrases marked for deletion
 *   - sentences containing "the [-tion/-ment/-ence/-ance] of X" nominalizations
 *
 * Usage:
 *   npx tsx scripts/book/prompts/chapterflow-v21-authored/src/scratch/readability-scan.ts <pkg.json> [...]
 *   npx tsx scripts/book/prompts/chapterflow-v21-authored/src/scratch/readability-scan.ts --all
 */
import { readFileSync, readdirSync } from "fs";
import { resolve, basename } from "path";

const LATINATE_TARGETS = [
  "utilize", "facilitate", "commence", "obtain", "demonstrate", "ascertain",
  "necessitate", "constitute", "encompass", "manifest", "comprise", "elucidate",
  "endeavor", "establish", "leverage", "optimize", "implement", "identify",
  "determine", "acknowledge", "correspond", "deviate", "accommodate", "transcend",
  "proliferate", "perpetuate", "methodology", "paradigm", "framework", "schema",
  "cognition", "cognitive", "behavioral", "fundamental", "pivotal", "paramount",
  "optimal", "intrinsic", "extrinsic", "aforementioned", "subsequent",
  "contemporary", "predominantly", "substantively", "approximately",
  "sufficient", "plausible", "pertinent", "requisite", "comprehensive",
  "inherent", "aggregate", "discrete", "notwithstanding", "concomitant",
];

const HEDGES = [
  "arguably", "essentially", "fundamentally", "in a sense",
  "in some respects", "in many ways", "relatively", "comparatively",
  "somewhat", "generally speaking", "on the whole", "by and large",
  "more or less", "it could be argued that", "one might say that",
  "it should be noted that", "it is worth noting that",
  "it should be remembered that", "needless to say",
  "it goes without saying", "at the end of the day",
  "when all is said and done", "in point of fact",
  "as a matter of fact", "for what it's worth",
];

const CONNECTOR_TARGETS = [
  "in order to", "by means of", "in the event that", "due to the fact that",
  "for the purpose of", "with regard to", "in spite of", "as a result of",
  "on the basis of", "in the absence of", "prior to", "subsequent to",
  "in conjunction with", "in lieu of",
];

function splitSentences(text: string): string[] {
  return text
    .replace(/\n+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z"'“‘])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function wordCount(s: string): number {
  return s.split(/\s+/).filter(Boolean).length;
}

function findHits(text: string, patterns: string[]): string[] {
  const lower = text.toLowerCase();
  const hits: string[] = [];
  for (const p of patterns) {
    const re = new RegExp(`\\b${p.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&")}\\b`, "i");
    if (re.test(lower)) hits.push(p);
  }
  return hits;
}

function findNominalizations(text: string): string[] {
  // "the [-tion / -ment / -ence / -ance] of X"
  const re = /\bthe\s+(\w+(?:tion|ment|ence|ance|ity))\s+of\s+(\w+)/gi;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push(`${m[0]}`);
  }
  return out;
}

type TierStat = {
  name: string;
  sentenceCount: number;
  avgWords: number;
  longSentences: { len: number; text: string }[];
  latinateHits: string[];
  hedgeHits: string[];
  connectorHits: string[];
  nominalizations: string[];
};

function scanTier(name: string, text: string, capWords: number): TierStat {
  const sentences = splitSentences(text);
  const lengths = sentences.map(wordCount);
  const totalWords = lengths.reduce((a, b) => a + b, 0);
  const avg = sentences.length ? totalWords / sentences.length : 0;
  const longs = sentences
    .map((s, i) => ({ len: lengths[i], text: s }))
    .filter((x) => x.len > capWords)
    .sort((a, b) => b.len - a.len);

  return {
    name,
    sentenceCount: sentences.length,
    avgWords: Math.round(avg * 10) / 10,
    longSentences: longs,
    latinateHits: findHits(text, LATINATE_TARGETS),
    hedgeHits: findHits(text, HEDGES),
    connectorHits: findHits(text, CONNECTOR_TARGETS),
    nominalizations: findNominalizations(text),
  };
}

function scanChapter(ch: any) {
  return [
    scanTier("fast", ch.breakdown?.fastRead ?? "", 25),
    scanTier("deep", ch.breakdown?.deepRead ?? "", 28),
    scanTier("full", ch.breakdown?.fullRead ?? "", 30),
  ];
}

function summarizeChapter(ch: any) {
  const tiers = scanChapter(ch);
  let issues = 0;
  for (const t of tiers) {
    issues += t.longSentences.length;
    issues += t.latinateHits.length;
    issues += t.hedgeHits.length;
    issues += t.connectorHits.length;
    issues += t.nominalizations.length;
  }
  return { number: ch.number, title: ch.title, tiers, issues };
}

function fmtTier(t: TierStat): string {
  const lines: string[] = [];
  lines.push(`    ${t.name}: ${t.sentenceCount} sent · avg ${t.avgWords}w`);
  if (t.longSentences.length) {
    lines.push(`      LONG (${t.longSentences.length}):`);
    for (const s of t.longSentences.slice(0, 3)) {
      lines.push(`        [${s.len}w] ${s.text.slice(0, 140)}${s.text.length > 140 ? "…" : ""}`);
    }
    if (t.longSentences.length > 3) lines.push(`        … +${t.longSentences.length - 3} more`);
  }
  if (t.latinateHits.length) lines.push(`      LATINATE: ${t.latinateHits.join(", ")}`);
  if (t.hedgeHits.length) lines.push(`      HEDGE: ${t.hedgeHits.join(", ")}`);
  if (t.connectorHits.length) lines.push(`      CONNECTOR: ${t.connectorHits.join(", ")}`);
  if (t.nominalizations.length) lines.push(`      NOMINAL: ${t.nominalizations.slice(0, 4).join(" | ")}${t.nominalizations.length > 4 ? " | …" : ""}`);
  return lines.join("\n");
}

function scanBook(path: string, opts: { quiet?: boolean } = {}) {
  const pkg = JSON.parse(readFileSync(path, "utf8"));
  const title = pkg.book?.title ?? basename(path);
  const chapters = pkg.chapters ?? [];

  const summaries = chapters.map(summarizeChapter);
  const totalIssues = summaries.reduce((acc: number, s: any) => acc + s.issues, 0);
  const avgIssues = summaries.length ? Math.round((totalIssues / summaries.length) * 10) / 10 : 0;

  console.log(`\n## ${title} (${chapters.length} ch · ${totalIssues} total flags · avg ${avgIssues}/ch)`);

  if (opts.quiet) return { title, totalIssues, summaries };

  // Top 5 worst chapters
  const worst = [...summaries].sort((a: any, b: any) => b.issues - a.issues).slice(0, 5);
  for (const c of worst) {
    if (c.issues === 0) continue;
    console.log(`\n  Ch${c.number} "${c.title}" (${c.issues} flags)`);
    for (const t of c.tiers) {
      const tierIssues =
        t.longSentences.length +
        t.latinateHits.length +
        t.hedgeHits.length +
        t.connectorHits.length +
        t.nominalizations.length;
      if (tierIssues === 0) continue;
      console.log(fmtTier(t));
    }
  }

  return { title, totalIssues, summaries };
}

const args = process.argv.slice(2);
let paths: string[] = [];
const quiet = args.includes("--quiet");
const filtered = args.filter((a) => !a.startsWith("--"));

if (args.includes("--all")) {
  paths = readdirSync("book-packages")
    .filter((f) => f.endsWith(".v21.json"))
    .map((f) => `book-packages/${f}`);
} else if (filtered.length === 0) {
  console.error("usage: readability-scan.ts <pkg.json> [...]  |  --all  |  --quiet");
  process.exit(1);
} else {
  paths = filtered;
}

const results: { title: string; totalIssues: number }[] = [];
for (const p of paths) {
  const r = scanBook(p, { quiet });
  results.push({ title: r.title, totalIssues: r.totalIssues });
}

if (paths.length > 1) {
  console.log("\n## Library-wide totals");
  results.sort((a, b) => b.totalIssues - a.totalIssues);
  for (const r of results) {
    console.log(`  ${String(r.totalIssues).padStart(4, " ")}  ${r.title}`);
  }
}
