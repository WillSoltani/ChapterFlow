#!/usr/bin/env node
/**
 * scan-style-drift.mjs — pre-commit / CI guard for design-system drift.
 *
 * Four guards (see docs/CHAPTERFLOW-UI-AUDIT.md, Wave 0):
 *   (a) Dead Tailwind v4 arbitrary CSS-var syntax in className: `-[--x]` and
 *       `[family-name:--x]` (both compile to invalid CSS and are dropped).
 *   (b) var(--cf-…)/var(--cr-…) — and the v4 `(--…)` shorthand — referenced in
 *       app/components but never declared in app/globals.css (renders nothing).
 *   (c) Raw hex / rgba() color literals in components/**, app/book/**, and the
 *       auth-flow surfaces (app/signup,auth,ref,onboarding,account-deleted) TSX
 *       (use tokens). Baselined: only NEW literals fail.
 *   (d) Literal catalog-size counts ("93 more books", "60+ books", …) that
 *       bypass lib/catalog-stats. Baselined: only NEW literals fail.
 *
 * Guards (a) and (b) must be clean (no baseline). Guards (c) and (d) carry a
 * baseline (scripts/ci/style-drift-allowlist.txt) seeded from the pre-Wave-0
 * census, so they block only NEW drift; remove an entry when you fix it.
 *
 * Modes:
 *   --all            scan all tracked files                       [CI, default]
 *   --staged         scan files staged for commit                 [pre-commit]
 *   --selftest       verify the detection patterns vs samples     [CI sanity]
 *   --write-allowlist  regenerate the (c)+(d) baseline from --all  [maintenance]
 *
 * Exit non-zero on any finding. Bypass LOCALLY only with `git commit --no-verify`;
 * the CI job is the un-bypassable backstop. ESLint is advisory here and `next
 * build` does not lint, so this standalone guard is the enforcement path.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
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
// URL/id fragment refs (href="#abc", id="#x") whose all-hex fragments would
// otherwise false-positive as colors in guard (c).
const RE_FRAGMENT_ATTR = /\b(?:href|xlinkHref|to|id)\s*=\s*["']#[\w-]*["']/g;
const stripFragmentRefs = (line) => line.replace(RE_FRAGMENT_ATTR, "");
const RE_CATALOG = [
  /\b\d{2,3}\+?\s+more\s+books?\b/i, // "93 more books", "93+ more books"
  /\b\d{2,3}\+\s*books?\b/i, // "60+ books", "95+ books"
]; // (d)

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
]);

// ── file helpers ─────────────────────────────────────────────────────────────
function gitFiles(mode) {
  const cmd =
    mode === "--staged"
      ? "git diff --cached --name-only --diff-filter=ACM"
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
const norm = (s) => s.replace(/\s+/g, ""); // signature normalization

// ── allowlist (baseline) for guards (c) + (d) ────────────────────────────────
function loadAllowlist() {
  const raw = read(ALLOWLIST_REL);
  const set = new Set();
  if (!raw) return set;
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    set.add(t); // entries are "guard\trelpath\tnormalizedLiteral"
  }
  return set;
}
const sig = (guard, rel, literal) => `${guard}\t${rel}\t${norm(literal)}`;

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
    if (!isTsx(f) || !(inApp(f) || inComponents(f))) continue;
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

// ── --write-allowlist (maintenance) ──────────────────────────────────────────
function writeAllowlist() {
  const files = gitFiles("--all");
  const allowNone = new Set();
  const c = guardRawColors(files, allowNone).out;
  const d = guardCatalogCounts(files, allowNone).out;
  const lines = new Set();
  for (const v of c) lines.add(sig("c", v.file, v.literal));
  for (const v of d) lines.add(sig("d", v.file, v.literal));
  const sorted = [...lines].sort();
  const header = [
    "# style-drift-allowlist.txt — baseline for scan-style-drift.mjs guards (c) and (d).",
    "# Auto-seeded from the pre-Wave-0 census so the guards block only NEW drift.",
    "# Format: <guard>\\t<repo-relative-path>\\t<whitespace-stripped-literal>",
    "# Remove an entry when you replace that literal with a token / catalog-stats constant.",
    "# Regenerate (intentional churn only): node scripts/ci/scan-style-drift.mjs --write-allowlist",
    "",
  ].join("\n");
  writeFileSync(path.join(ROOT, ALLOWLIST_REL), header + sorted.join("\n") + "\n");
  console.log(`Wrote ${sorted.length} baseline entries to ${ALLOWLIST_REL} (${c.length} color, ${d.length} catalog).`);
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
  expect(!RE_CATALOG.some((r) => r.test("${CATALOG_BOOK_COUNT_DISPLAY} books")), "(d) false-positive on interpolation");
  expect(!RE_CATALOG.some((r) => r.test("2 books free")), "(d) false-positive on free-tier '2 books'");
  expect(!RE_CATALOG.some((r) => r.test("added 12 books from requests")), "(d) false-positive on '12 books'");

  if (fails === 0) {
    console.log("✓ selftest OK — all four guards detect samples with no false positives");
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

if (problems !== 0) {
  console.log(red("Style/token drift guard FAILED."));
  console.log("Bypass locally only if certain it is a false positive: git commit --no-verify");
  process.exit(1);
}
console.log(
  `✓ style/token drift guard passed (${mode}) — ${c.baselined} color + ${d.baselined} catalog literals baselined`,
);
process.exit(0);
