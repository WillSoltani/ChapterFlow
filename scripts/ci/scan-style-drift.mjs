#!/usr/bin/env node
/**
 * scan-style-drift.mjs — pre-commit / CI guard for design-system drift.
 *
 * Five guards (see docs/CHAPTERFLOW-UI-AUDIT.md, Wave 0):
 *   (a) Dead Tailwind v4 arbitrary CSS-var syntax in className: `-[--x]` and
 *       `[family-name:--x]` (both compile to invalid CSS and are dropped).
 *   (b) var(--cf-…)/var(--cr-…) — and the v4 `(--…)` shorthand — referenced in
 *       app/components but never declared in app/globals.css (renders nothing).
 *   (c) Raw hex / rgba() color literals in components/**, app/book/**, and the
 *       auth-flow surfaces (app/signup,auth,ref,onboarding,account-deleted) TSX
 *       (use tokens). Baselined: only NEW literals fail.
 *   (d) Literal catalog-size counts ("93 more books", "60+ books", "21
 *       categories", …) that bypass lib/catalog-stats. Scans .tsx/.ts/.md under
 *       app/, components/, lib/, docs/ (copy can leak from any of them), matching
 *       both book counts AND category/topic/genre counts. Baselined: only NEW
 *       literals fail.
 *   (e) Numeric arbitrary font-size utilities (`text-[NNpx]`, including
 *       decimals) in tracked app/components TSX. Every occurrence is pinned by
 *       normalized line content and a duplicate ordinal so drift fails closed.
 *
 * Guards (a) and (b) must be clean (no baseline). Guards (c) and (d) carry a
 * baseline (scripts/ci/style-drift-allowlist.txt) seeded from the pre-Wave-0
 * census, while guard (e) carries an exact occurrence baseline. Remove entries
 * when their corresponding debt is fixed.
 *
 * Modes:
 *   --all            scan all tracked files                       [CI, default]
 *   --staged         scan files staged for commit                 [pre-commit]
 *   --selftest       verify the detection patterns vs samples     [CI sanity]
 *   --write-allowlist  regenerate the (c)+(d)+(e) baseline from --all [maintenance]
 *
 * Exit non-zero on any finding. Bypass LOCALLY only with `git commit --no-verify`;
 * the CI job is the un-bypassable backstop. ESLint is advisory here and `next
 * build` does not lint, so this standalone guard is the enforcement path.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";

const ROOT = execSync("git rev-parse --show-toplevel").toString().trim();
const SELF_REL = "scripts/ci/scan-style-drift.mjs";
const ALLOWLIST_REL = "scripts/ci/style-drift-allowlist.txt";
const GLOBALS_REL = "app/globals.css";

const red = (s) => `\x1b[31m${s}\x1b[0m`;

// ── detection patterns (also exercised by --selftest) ───────────────────────
// guard (a): dead `-[--x]` and `[prop:--x]` arbitrary forms (bare var, no var()).
const RE_DEAD_TW = /-\[--|\[[a-z-]+:--/;
const RE_TOKEN = /--c[fr]-[a-z0-9-]+/gi; // guard (b): any --cf-/--cr- reference
const RE_HEX = /(?<!&)#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b/g; // (c)
const RE_RGBA = /\brgba?\([^)]*\)/gi; // (c)
const RE_FONT_SIZE = /\btext-\[\d+(?:\.\d+)?px\]/g; // (e)
// URL/id fragment refs (href="#abc", id="#x") whose all-hex fragments would
// otherwise false-positive as colors in guard (c).
const RE_FRAGMENT_ATTR = /\b(?:href|xlinkHref|to|id)\s*=\s*["']#[\w-]*["']/g;
const stripFragmentRefs = (line) => line.replace(RE_FRAGMENT_ATTR, "");
const RE_CATALOG = [
  /\b\d{1,3}\+?\s+more\s+books?\b/i, // "93 more books", "93+ more books", "9 more books"
  /\b\d{1,3}\+\s*books?\b/i, // "60+ books", "95+ books", "9+ books"
  // Catalog-size category/topic/genre claims, e.g. "21 categories", "13+ topics".
  // Matches the "of 21 categories" / "across 21 topics" marketing/profile shape;
  // legitimate per-badge thresholds and code comments are absorbed by the baseline.
  /\b\d{1,3}\+?\s+(?:categories|topics|genres)\b/i,
]; // (d) — see lib/catalog-stats.ts (CATALOG_BOOK_COUNT_DISPLAY / CATALOG_CATEGORY_COUNT_DISPLAY)

// Tokens set by JS at runtime (style.setProperty / inline style) or consumed
// with a fallback — legitimately undeclared in globals.css.
const RUNTIME_TOKENS = new Set([
  "--cr-confetti-x",
  "--cr-confetti-y",
  "--cr-confetti-r",
  "--cr-ring-circumference",
  "--cr-ring-offset",
  "--cr-header-h",
  "--cr-spotlight-x",
  "--cr-spotlight-y",
  // RECALL landing: per-element reveal tuning set inline by RecallReveal.tsx and
  // consumed with a fallback in globals.css (.cf-reveal). Runtime-set, by design.
  "--cf-reveal-y",
  "--cf-reveal-delay",
]);

// ── file helpers ─────────────────────────────────────────────────────────────
function gitFiles(mode) {
  const cmd =
    mode === "--staged"
      ? "git diff --cached --name-only --diff-filter=ACMD"
      : "git ls-files";
  return execSync(cmd, { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 })
    .toString()
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

const read = (rel) => {
  try {
    return readFileSync(path.join(ROOT, rel), "utf8");
  } catch {
    return null;
  }
};

const inApp = (f) => f.startsWith("app/");
const inComponents = (f) => f.startsWith("components/");
const inBook = (f) => f.startsWith("app/book/");
const inLib = (f) => f.startsWith("lib/");
const inDocs = (f) => f.startsWith("docs/");
// Neglected surfaces that also ship raw UI but previously escaped the (c) scan.
const AUTH_FLOW_PREFIXES = [
  "app/signup/",
  "app/auth/",
  "app/ref/",
  "app/onboarding/",
  "app/account-deleted/",
];
const inAuthFlows = (f) => AUTH_FLOW_PREFIXES.some((p) => f.startsWith(p));
const isTsx = (f) => f.endsWith(".tsx");
const isStyleConsumer = (f) => /\.(tsx|ts|css)$/.test(f);
// guard (d) scans copy wherever it can leak a hardcoded count: TSX/TS components &
// copy-constant modules, plus committed Markdown docs/copy.
const isCatalogCopy = (f) => /\.(tsx|ts|md)$/.test(f);
const norm = (s) => s.replace(/\s+/g, ""); // signature normalization

// ── allowlist (baseline) for guards (c) + (d) + (e) ─────────────────────────
function loadAllowlist() {
  const raw = read(ALLOWLIST_REL);
  const set = new Set();
  if (!raw) return set;
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    set.add(t); // c/d use 3 fields; e adds normalized-line hash + ordinal
  }
  return set;
}
const sig = (guard, rel, literal) => `${guard}\t${rel}\t${norm(literal)}`;
const normalizedLineHash = (line) =>
  createHash("sha256").update(norm(line)).digest("hex").slice(0, 16);

function arbitraryFontSizeOccurrences(rel, src) {
  const out = [];
  const ordinals = new Map();
  src.split("\n").forEach((line, i) => {
    const hits = [...line.matchAll(RE_FONT_SIZE)];
    if (hits.length === 0) return;
    const lineHash = normalizedLineHash(line);
    for (const match of hits) {
      const literal = match[0];
      const ordinalKey = `${norm(literal)}\t${lineHash}`;
      const ordinal = (ordinals.get(ordinalKey) ?? 0) + 1;
      ordinals.set(ordinalKey, ordinal);
      out.push({
        file: rel,
        line: i + 1,
        detail: literal,
        literal,
        lineHash,
        ordinal,
        signature: `${sig("e", rel, literal)}\t${lineHash}\t${ordinal}`,
      });
    }
  });
  return out;
}

function collectArbitraryFontSizes(files) {
  const occurrences = [];
  const scopePaths = new Set();
  for (const f of files) {
    if (!isTsx(f) || !(inApp(f) || inComponents(f))) continue;
    scopePaths.add(f);
    const src = read(f);
    if (src == null) continue;
    occurrences.push(...arbitraryFontSizeOccurrences(f, src));
  }
  return { occurrences, scopePaths };
}

function evaluateArbitraryFontSizes(occurrences, allow, scopePaths, checkAllStale) {
  const out = [];
  let baselined = 0;
  const actual = new Set(occurrences.map((v) => v.signature));

  for (const occurrence of occurrences) {
    if (allow.has(occurrence.signature)) {
      baselined++;
      continue;
    }
    out.push({
      ...occurrence,
      detail: `${occurrence.literal} is not pinned (${occurrence.lineHash}/${occurrence.ordinal})`,
    });
  }

  for (const entry of allow) {
    if (!entry.startsWith("e\t")) continue;
    const [, rel, literal, lineHash, ordinal] = entry.split("\t");
    if (!checkAllStale && !scopePaths.has(rel)) continue;
    if (actual.has(entry)) continue;
    out.push({
      file: rel,
      line: 0,
      detail: `stale allowlist occurrence ${literal} (${lineHash}/${ordinal})`,
    });
  }

  return { out, baselined };
}

// ── guards ────────────────────────────────────────────────────────────────────
// Each returns { violations: [{file,line,detail}], baselined: number }

function guardDeadTailwind(files) {
  const out = [];
  for (const f of files) {
    if (!isTsx(f) || !(inApp(f) || inComponents(f))) continue;
    const src = read(f);
    if (src == null) continue;
    src.split("\n").forEach((line, i) => {
      if (RE_DEAD_TW.test(line)) out.push({ file: f, line: i + 1, detail: line.trim().slice(0, 140) });
    });
  }
  return out;
}

function guardUndeclaredTokens(files) {
  // Declared set comes from globals.css regardless of mode.
  const globals = read(GLOBALS_REL) ?? "";
  const declared = new Set();
  for (const m of globals.matchAll(/^\s*(--c[fr]-[a-z0-9-]+)\s*:/gim)) {
    declared.add(m[1].toLowerCase());
  }
  const out = [];
  const seen = new Set();
  for (const f of files) {
    if (!isStyleConsumer(f) || !(inApp(f) || inComponents(f))) continue;
    if (f === GLOBALS_REL) continue;
    const src = read(f);
    if (src == null) continue;
    const lines = src.split("\n");
    lines.forEach((line, i) => {
      for (const m of line.matchAll(RE_TOKEN)) {
        const tok = m[0].toLowerCase();
        if (declared.has(tok) || RUNTIME_TOKENS.has(tok)) continue;
        const key = `${tok}@${f}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ file: f, line: i + 1, detail: `${m[0]} is not declared in app/globals.css` });
      }
    });
  }
  return out;
}

function guardRawColors(files, allow) {
  const out = [];
  let baselined = 0;
  for (const f of files) {
    if (!isTsx(f) || !(inComponents(f) || inBook(f) || inAuthFlows(f))) continue;
    const src = read(f);
    if (src == null) continue;
    src.split("\n").forEach((line, i) => {
      const scan = stripFragmentRefs(line);
      const hits = [...scan.matchAll(RE_HEX), ...scan.matchAll(RE_RGBA)].map((m) => m[0]);
      for (const lit of hits) {
        if (allow.has(sig("c", f, lit))) {
          baselined++;
          continue;
        }
        out.push({ file: f, line: i + 1, detail: lit, literal: lit });
      }
    });
  }
  return { out, baselined };
}

function guardCatalogCounts(files, allow) {
  const out = [];
  let baselined = 0;
  for (const f of files) {
    if (f === SELF_REL || f === ALLOWLIST_REL) continue; // this script & its baseline name catalog literals
    if (!isCatalogCopy(f) || !(inApp(f) || inComponents(f) || inLib(f) || inDocs(f))) continue;
    const src = read(f);
    if (src == null) continue;
    src.split("\n").forEach((line, i) => {
      for (const re of RE_CATALOG) {
        const m = line.match(re);
        if (!m) continue;
        const lit = m[0];
        if (allow.has(sig("d", f, lit))) {
          baselined++;
          continue;
        }
        out.push({ file: f, line: i + 1, detail: lit, literal: lit });
      }
    });
  }
  return { out, baselined };
}

function guardArbitraryFontSizes(files, allow, checkAllStale) {
  const { occurrences, scopePaths } = collectArbitraryFontSizes(files);
  return {
    ...evaluateArbitraryFontSizes(occurrences, allow, scopePaths, checkAllStale),
    occurrences,
  };
}

// ── --write-allowlist (maintenance) ──────────────────────────────────────────
function writeAllowlist() {
  const files = gitFiles("--all");
  const allowNone = new Set();
  const c = guardRawColors(files, allowNone).out;
  const d = guardCatalogCounts(files, allowNone).out;
  const e = collectArbitraryFontSizes(files).occurrences;
  const lines = new Set();
  for (const v of c) lines.add(sig("c", v.file, v.literal));
  for (const v of d) lines.add(sig("d", v.file, v.literal));
  for (const v of e) lines.add(v.signature);
  const sorted = [...lines].sort();
  const header = [
    "# style-drift-allowlist.txt — baseline for scan-style-drift.mjs guards (c), (d), and (e).",
    "# Auto-seeded from the pre-Wave-0 census so the guards block only NEW drift.",
    "# Guards c/d: <guard>\\t<repo-relative-path>\\t<whitespace-stripped-literal>",
    "# Guard e: e\\t<repo-relative-path>\\t<normalized-literal>\\t<normalized-line-sha256-16>\\t<ordinal>",
    "# Remove an entry when you replace that literal with a token / catalog-stats constant.",
    "# Regenerate (intentional churn only): node scripts/ci/scan-style-drift.mjs --write-allowlist",
    "",
  ].join("\n");
  writeFileSync(path.join(ROOT, ALLOWLIST_REL), header + sorted.join("\n") + "\n");
  const rowCount = (guard) => sorted.filter((line) => line.startsWith(`${guard}\t`)).length;
  console.log(
    `Wrote ${sorted.length} baseline rows to ${ALLOWLIST_REL} ` +
      `(c=${rowCount("c")} rows/${c.length} occurrences, ` +
      `d=${rowCount("d")} rows/${d.length} occurrences, ` +
      `e=${rowCount("e")} rows/${e.length} occurrences).`,
  );
}

// ── --selftest ───────────────────────────────────────────────────────────────
function selftest() {
  let fails = 0;
  const expect = (cond, msg) => {
    if (!cond) {
      console.log(red(`selftest: ${msg}`));
      fails++;
    }
  };
  // (a) dead Tailwind.
  // NOTE: the example class tokens below are split with string concatenation so
  // Tailwind's source scanner can't extract them as real utilities. If written
  // as contiguous literals, `next dev` (Turbopack) compiles e.g. [color:var(--x)]
  // into invalid `color: var()` and the whole stylesheet fails to parse — and
  // `@source not "../scripts"` does NOT reliably exclude this file in dev. The
  // runtime strings are identical, so the regex assertions are unchanged.
  const cls = (...p) => p.join(""); // breaks the literal token for the scanner
  expect(RE_DEAD_TW.test(cls('className="text-[', '--text-heading]"')), "(a) missed -[--");
  expect(RE_DEAD_TW.test(cls('className="font-[', 'family-name:--font-body]"')), "(a) missed font-[family-name:--");
  expect(!RE_DEAD_TW.test(cls('className="text-(', '--text-heading)"')), "(a) false-positive on v4 shorthand");
  expect(!RE_DEAD_TW.test(cls('className="font-[', 'family-name:var(--font-body)]"')), "(a) false-positive on var() form");
  expect(RE_DEAD_TW.test(cls('className="[', 'color:--x]"')), "(a) missed [color:--x] bare-var arbitrary prop");
  expect(!RE_DEAD_TW.test(cls('className="[', 'color:var(--x)]"')), "(a) false-positive on [color:var()]");
  // (b) token extraction
  expect([...cls('bg-(', '--cf-card)').matchAll(RE_TOKEN)][0]?.[0] === "--cf-card", "(b) missed shorthand token");
  expect([...'var(--cr-danger, red)'.matchAll(RE_TOKEN)][0]?.[0] === "--cr-danger", "(b) missed var() token");
  // (c) raw colors
  expect(RE_HEX.test('color="#FFB874"') , "(c) missed bare hex");
  RE_HEX.lastIndex = 0;
  expect(!RE_HEX.test("&#10022;"), "(c) false-positive on HTML entity");
  RE_HEX.lastIndex = 0;
  expect(RE_RGBA.test("rgba(0,0,0,0.3)"), "(c) missed rgba()");
  RE_RGBA.lastIndex = 0;
  expect([...stripFragmentRefs('<a href="#abc">x</a>').matchAll(RE_HEX)].length === 0, "(c) false-positive on href fragment");
  RE_HEX.lastIndex = 0;
  // (d) catalog counts
  expect(RE_CATALOG.some((r) => r.test("Unlock 93 more books with Pro")), "(d) missed '93 more books'");
  expect(RE_CATALOG.some((r) => r.test("60+ books across")), "(d) missed '60+ books'");
  expect(RE_CATALOG.some((r) => r.test("Unlock 9 more books")), "(d) missed single-digit '9 more books'");
  expect(RE_CATALOG.some((r) => r.test("across 21 categories")), "(d) missed '21 categories'");
  expect(RE_CATALOG.some((r) => r.test("13+ topics to explore")), "(d) missed '13+ topics'");
  expect(RE_CATALOG.some((r) => r.test("9 genres")), "(d) missed '9 genres'");
  expect(!RE_CATALOG.some((r) => r.test("${CATALOG_BOOK_COUNT_DISPLAY} books")), "(d) false-positive on interpolation");
  expect(!RE_CATALOG.some((r) => r.test("2 books free")), "(d) false-positive on free-tier '2 books'");
  expect(!RE_CATALOG.some((r) => r.test("added 12 books from requests")), "(d) false-positive on '12 books'");
  expect(!RE_CATALOG.some((r) => r.test("category counts as one")), "(d) false-positive on bare 'category'");
  // (e) numeric arbitrary font sizes and occurrence identity.
  const integerSize = cls("text-[", "10px]");
  const decimalSize = cls("text-[", "13.5px]");
  expect([...integerSize.matchAll(RE_FONT_SIZE)][0]?.[0] === integerSize, "(e) missed integer px utility");
  expect([...decimalSize.matchAll(RE_FONT_SIZE)][0]?.[0] === decimalSize, "(e) missed decimal px utility");
  expect([..."text-sm text-cf-body text-lg".matchAll(RE_FONT_SIZE)].length === 0, "(e) false-positive on semantic/built-in utilities");
  expect([...cls("text-[", "var(--font-size)]").matchAll(RE_FONT_SIZE)].length === 0, "(e) false-positive on var() utility");

  const fixtureRel = "components/__font_size_selftest.tsx";
  const fixtureLine = `const x = <span className="${integerSize} ${integerSize}" />;`;
  const duplicateOccurrences = arbitraryFontSizeOccurrences(fixtureRel, fixtureLine);
  expect(
    duplicateOccurrences.length === 2 &&
      duplicateOccurrences[0].ordinal === 1 &&
      duplicateOccurrences[1].ordinal === 2 &&
      duplicateOccurrences[0].signature !== duplicateOccurrences[1].signature,
    "(e) duplicate occurrences did not receive distinct 1-based ordinals",
  );

  const singleLine = `const x = <span className="${integerSize}" />;`;
  const original = arbitraryFontSizeOccurrences(fixtureRel, singleLine);
  const moved = arbitraryFontSizeOccurrences(fixtureRel, `\n\n${singleLine}`);
  const baseline = new Set([original[0].signature]);
  expect(
    evaluateArbitraryFontSizes(moved, baseline, new Set([fixtureRel]), true).out.length === 0,
    "(e) line-number-only movement changed the occurrence signature",
  );
  expect(
    evaluateArbitraryFontSizes(
      duplicateOccurrences,
      new Set([duplicateOccurrences[0].signature]),
      new Set([fixtureRel]),
      true,
    ).out.length === 1,
    "(e) duplicate occurrence was not rejected",
  );
  const changed = arbitraryFontSizeOccurrences(fixtureRel, singleLine.replace(integerSize, decimalSize));
  expect(
    evaluateArbitraryFontSizes(changed, baseline, new Set([fixtureRel]), true).out.length === 2,
    "(e) changed occurrence did not produce new + stale findings",
  );
  expect(
    evaluateArbitraryFontSizes([], baseline, new Set([fixtureRel]), true).out.length === 1,
    "(e) stale allowlist occurrence was not rejected",
  );

  if (fails === 0) {
    console.log("✓ selftest OK — all five guards detect samples with no false positives");
    return 0;
  }
  return 1;
}

// ── main ──────────────────────────────────────────────────────────────────────
const mode = process.argv[2] || "--all";

if (mode === "--write-allowlist") {
  writeAllowlist();
  process.exit(0);
}
if (mode === "--selftest") {
  process.exit(selftest());
}

const files = gitFiles(mode);
const allow = loadAllowlist();
let problems = 0;

function report(title, violations, remediation) {
  if (violations.length === 0) return;
  console.log(red(`✖ ${title} (${violations.length}):`));
  for (const v of violations.slice(0, 60)) {
    console.log(`    ${v.file}:${v.line}  ${v.detail}`);
  }
  if (violations.length > 60) console.log(`    … and ${violations.length - 60} more`);
  console.log(`  ${remediation}\n`);
  problems++;
}

report(
  "Dead Tailwind v4 arbitrary CSS-var syntax in className",
  guardDeadTailwind(files),
  "Convert -[--x] → -(--x) and font-[family-name:--x] → font-(family-name:--x).",
);
report(
  "CSS variable referenced but never declared in app/globals.css",
  guardUndeclaredTokens(files),
  "Declare the --cf-*/--cr-* token in app/globals.css (or fix the typo). Runtime-set tokens are allowlisted in this script.",
);
const c = guardRawColors(files, allow);
report(
  "Raw hex / rgba() color literal in components/** or app/book/** (use tokens)",
  c.out,
  `Replace with a design token (var(--…)). Intentional exceptions: add to ${ALLOWLIST_REL}.`,
);
const d = guardCatalogCounts(files, allow);
report(
  "Literal catalog-size count (bypasses lib/catalog-stats)",
  d.out,
  "Use CATALOG_BOOK_COUNT_DISPLAY / CATALOG_CATEGORY_COUNT_DISPLAY from @/lib/catalog-stats.",
);
const e = guardArbitraryFontSizes(files, allow, mode !== "--staged");
report(
  "Numeric arbitrary font-size utility occurrence in app/components TSX",
  e.out,
  `Replace mapped sizes with semantic utilities. Intentional retained sizes require an exact occurrence row in ${ALLOWLIST_REL}.`,
);

if (problems !== 0) {
  console.log(red("Style/token drift guard FAILED."));
  console.log("Bypass locally only if certain it is a false positive: git commit --no-verify");
  process.exit(1);
}
console.log(
  `✓ style/token drift guard passed (${mode}) — ${c.baselined} color + ${d.baselined} catalog + ` +
    `${e.baselined} arbitrary font-size occurrences baselined`,
);
process.exit(0);
