import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { CATALOG_BOOK_COUNT, CATALOG_BOOK_COUNT_DISPLAY } from "@/lib/catalog-stats";
import { chapterMinutes } from "@/app/_lib/chapter-minutes";
import bookChapterMeta from "@/app/book/data/book-chapter-meta.json";
import { BOOKS_CATALOG_METADATA } from "@/lib/books-catalog";
import { FREE_OFFER_LABEL, PRICING, PRO_FEATURES } from "@/lib/pricing";
import { RECALL_FAQ } from "@/components/landing/recall/recall-faq-data";
import { isProtectedSurfacePath } from "@/lib/protected-surface";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";

/**
 * Claims a visitor can check against the product (plan Phase 9). Every
 * surface a public page renders is found by walking the import graph from the
 * public pages, so a newly mounted component is covered without a list to
 * update. Source checks run on code with comments stripped.
 */

const ROOT = process.cwd();

const PUBLIC_PAGES = [
  "app/page.tsx",
  "app/pricing/page.tsx",
  "app/books/page.tsx",
  "app/contact/page.tsx",
  "app/signup/page.tsx",
  ...readdirSync(path.join(ROOT, "app/legal"))
    .map((d) => (d === "page.tsx" ? "app/legal/page.tsx" : `app/legal/${d}/page.tsx`))
    .filter((f) => existsSync(path.join(ROOT, f))),
];

const EXTS = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"];
const SPEC_RE =
  /(?:^|[\s;{}])(?:import|export)\s[^"'`;]*?from\s*["']([^"']+)["']|(?:^|[\s;{}(=,])import\s*\(\s*["']([^"']+)["']\s*\)/gm;

function resolve(from: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = path.join(ROOT, spec.slice(2));
  else if (spec.startsWith(".")) base = path.resolve(path.dirname(from), spec);
  else return null;
  for (const ext of EXTS) {
    const p = base + ext;
    if (existsSync(p) && statSync(p).isFile()) return p;
  }
  return null;
}

/** Rendering code reachable from the public pages: app/ (not its API) and components/. */
function publicSurfaceFiles(): string[] {
  const seen = new Set<string>();
  const queue = PUBLIC_PAGES.map((r) => path.join(ROOT, r));
  while (queue.length) {
    const file = queue.pop()!;
    const rel = path.relative(ROOT, file);
    if (seen.has(rel)) continue;
    seen.add(rel);
    if (!/\.tsx?$/.test(file)) continue;
    for (const m of readFileSync(file, "utf8").matchAll(SPEC_RE)) {
      const hit = resolve(file, m[1] ?? m[2] ?? "");
      if (hit) queue.push(hit);
    }
  }
  return [...seen]
    .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f))
    .filter((f) => (f.startsWith("app/") && !f.startsWith("app/app/")) || f.startsWith("components/"))
    .sort();
}

/** Source without comments and import statements (the rendered code). */
function code(file: string): string {
  return readFileSync(path.join(ROOT, file), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "")
    .replace(/(^|[^:"'`])\/\/.*$/gm, "$1")
    .replace(/^\s*import[\s\S]*?from\s*["'][^"']+["'];?/gm, "");
}

const FILES = publicSurfaceFiles();

test("the walk reaches the public surfaces it must judge", () => {
  for (const f of [
    "components/film/chapters/CityChapters.tsx",
    "components/film/chapters/FoldChapter.tsx",
    "components/film/chapters/HallChapters.tsx",
    "components/landing/recall/RecallPricing.tsx",
    "components/sections/Footer.tsx",
    "components/sections/Pricing.tsx",
    "components/website/browse-library/BrowseLibraryHero.tsx",
  ]) {
    assert.ok(FILES.includes(f), `${f} is reached from the public pages`);
  }
});

test("a public surface shows the catalog floor, never the exact count (machine-readable counts excepted)", () => {
  assert.match(CATALOG_BOOK_COUNT_DISPLAY, /^\d+\+$/);
  const exact = new RegExp(`\\b${CATALOG_BOOK_COUNT}\\s+(books|titles|non-fiction)\\b`, "i");
  const catalogLength = /\b(?:ALL_BOOKS|BOOKS_CATALOG|BOOKS_CATALOG_METADATA|LIBRARY_BOOKS)\.length\b/;
  const offenders: string[] = [];
  for (const file of FILES) {
    const src = code(file);
    for (const line of src.split("\n")) {
      // The exact count may feed structured data (JSON-LD numberOfItems).
      if (/\bCATALOG_BOOK_COUNT\b(?!_)/.test(line) && !/numberOfItems:\s*CATALOG_BOOK_COUNT\b/.test(line)) {
        offenders.push(`${file}: ${line.trim()}`);
      }
      if (exact.test(line)) offenders.push(`${file}: hard-coded count: ${line.trim()}`);
      // The catalog's own length is the exact count by another name: it may
      // decide (a comparison), but not be shown or handed on to be shown.
      if (catalogLength.test(line) && !/\s(?:[<>]=?|[!=]==)\s/.test(line)) {
        offenders.push(`${file}: catalog length: ${line.trim()}`);
      }
    }
  }
  assert.deepEqual(offenders, []);
});

test("free-book counts come from PRICING, never a hard-coded number", () => {
  assert.equal(FREE_OFFER_LABEL, `${PRICING.freeBookLimit} free books`);
  const hardCoded = [
    /\b(?:one|two|three|four|five|\d+)\s+(?:free|complete)\s+books?\b/i,
    /\b(?:one|two|three|four|five|\d+)-book\b/i,
    /\bfree\s+(?:forever\s+)?for\s+(?:one|two|three|\d+)\s+books?\b/i,
    /\b(?:one|two|three|\d+)\s+are\s+(?:completely\s+)?free\b/i,
    /\bwith\s+(?:one|two|three|\d+)\s+books\b/i,
  ];
  const offenders: string[] = [];
  for (const file of [...FILES, "components/progress/ContinueLearningCard.tsx"]) {
    for (const line of code(file).split("\n")) {
      if (hardCoded.some((re) => re.test(line))) offenders.push(`${file}: ${line.trim()}`);
    }
  }
  assert.deepEqual(offenders, []);
});

/** Whether the export route gates on the plan (its own check, read from its source). */
function exportRouteIsPlanGated(): boolean {
  const src = code("app/app/api/book/me/export/route.ts");
  assert.match(src, /requireUser\(/, "the export route requires a signed-in user");
  return /requireActiveBookUser|requireAdminUser|isPro\b|plan\s*[!=]==|[!=]==\s*["']PRO["']/.test(src);
}

test("the Pro card, the pricing page and the FAQ agree with the export route's own plan check", () => {
  const gated = exportRouteIsPlanGated();
  assert.equal(gated, false, "note export is open to every plan (owner decision); this test assumes it");
  // Pro lists must not sell what every plan has.
  assert.deepEqual(PRO_FEATURES.filter((f) => /export/i.test(f)), [], "PRO_FEATURES (pricing page, in-app upsell)");
  for (const file of ["components/landing/recall/RecallPricing.tsx", "components/sections/Pricing.tsx"]) {
    const strings = [...code(file).matchAll(/["'`]([^"'`\n]*export[^"'`\n]*)["'`]/gi)].map((m) => m[1]);
    assert.deepEqual(strings, [], `${file} sells export`);
  }
  // The FAQ says everyone can export, without a plan condition.
  const answer = RECALL_FAQ.find((item) => /export/i.test(item.a));
  assert.ok(answer, "the FAQ answers how to export");
  assert.doesNotMatch(answer.a, /\bPro\b/);
});

test("the Summary chapter's minutes are its named chapter's own figure", () => {
  // The line reads "Atomic Habits, chapter one, in about N minutes", so N is
  // chapter one's reading time as the reader lists it, not a book or catalog
  // average.
  const meta = bookChapterMeta as Record<string, { chapters: { order: number; minutes: number }[] }>;
  const chapterOne = meta["atomic-habits"]?.chapters.find((c) => c.order === 1);
  assert.ok(chapterOne, "Atomic Habits chapter one has reading metadata");
  assert.ok(BOOKS_CATALOG_METADATA.some((b) => b.id === "atomic-habits"), "Atomic Habits is in the catalog");
  assert.equal(chapterMinutes("atomic-habits", 1), chapterOne.minutes);
  assert.equal(chapterMinutes("not-a-book", 1), null, "a book outside the catalog drops the number");
  assert.equal(chapterMinutes("atomic-habits", 999), null);

  const hall = code("components/film/chapters/HallChapters.tsx");
  assert.match(hall, /Atomic Habits, chapter one\{minutes === null \? "" : `, in about \$\{minutes\} minutes`\}/);
  assert.doesNotMatch(hall, /CATALOG_MEDIAN_CHAPTER_MINUTES|estimatedMinutes/, "the Hall shows no average");
  assert.doesNotMatch(
    readFileSync(path.join(ROOT, "components/film/chapters/HallChapters.tsx"), "utf8"),
    /from\s*["'][^"']*(?:chapter-meta|chapter-minutes)/,
    "the metadata stays out of the client bundle",
  );
  // The landing reads chapter one's figure on the server and hands it down.
  assert.match(code("app/page.tsx"), /hallMinutes=\{chapterMinutes\("atomic-habits", 1\)\}/);
  assert.match(code("components/film/BookReelLanding.tsx"), /<HallChapter[^>]*minutes=\{hallMinutes\}/);
});

test("each annual price names its plan, and the names match the in-app ones", () => {
  // lib/pricing has two yearly plans: billed annually (annualMonthlyAmount,
  // ANNUAL_SAVINGS_PCT, ANNUAL_TOTAL_AMOUNT) and annual upfront
  // (annualUpfrontAmount, ANNUAL_UPFRONT_*). A surface may show either, but
  // only under that plan's own name, so two pages never give one "Annual"
  // choice two prices and two savings.
  const billedAnnually = /\b(?:annualMonthlyAmount|ANNUAL_SAVINGS_PCT|ANNUAL_TOTAL_AMOUNT|PRICING_TIER_DISPLAY\.annual\b)/;
  const upfront = /\b(?:annualUpfrontAmount|ANNUAL_UPFRONT_[A-Z_]+|annual_upfront)\b/;
  const inApp = code("app/book/settings/components/SubscriptionCard.tsx");
  assert.match(inApp, /annual:\s*\{\s*name:\s*"Annual"/, "in-app name of the billed-annually plan");
  assert.match(inApp, /annual_upfront:\s*\{\s*name:\s*"Annual upfront"/, "in-app name of the upfront plan");

  const shown: string[] = [];
  for (const file of FILES) {
    const src = code(file);
    const a = billedAnnually.test(src);
    const u = upfront.test(src);
    if (!a && !u) continue;
    shown.push(file);
    if (a) assert.match(src, /billed annually/i, `${file} shows the billed-annually plan without naming it`);
    if (u) assert.match(src, /\bupfront\b/i, `${file} shows the upfront plan without naming it`);
    // A surface that shows only the upfront plan must not call it plain "Annual".
    if (u && !a) assert.doesNotMatch(src, />\s*ANNUAL\s*</i, `${file} labels the upfront plan plain "Annual"`);
  }
  for (const f of ["components/landing/recall/RecallPricing.tsx", "components/sections/Pricing.tsx"]) {
    assert.ok(shown.includes(f), `${f} is judged`);
  }
});

test("the Organization logo is the brand mark this site serves, not the share image", () => {
  const page = code("app/page.tsx");
  const logo = /logo:\s*`\$\{siteUrl\}(\/[^`]+)`/.exec(page)?.[1];
  assert.equal(logo, "/icon.svg");
  assert.ok(existsSync(path.join(ROOT, "app/icon.svg")));
});

test("robots, the sitemap and the SearchAction agree with the sign-in gate", () => {
  const pathOf = (u: string) => new URL(u, "https://example.test").pathname;
  for (const entry of sitemap()) {
    assert.equal(isProtectedSurfacePath(pathOf(entry.url)), false, `sitemap lists ${entry.url}`);
  }
  const rules = robots().rules[0]!;
  for (const allowed of rules.allow) {
    assert.equal(isProtectedSurfacePath(allowed), false, `robots allows ${allowed}`);
  }
  assert.ok(rules.allow.includes("/books"), "robots allows the catalog");
  for (const p of ["/book/", "/app/", "/dashboard/"]) assert.ok(rules.disallow.includes(p), `robots disallows ${p}`);
  const target = /target:\s*`\$\{siteUrl\}([^`?]+)\?q=\{search_term_string\}`/.exec(code("app/page.tsx"))?.[1];
  assert.equal(target, "/books");
  assert.equal(isProtectedSurfacePath(target), false);
});
