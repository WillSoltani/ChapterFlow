/**
 * SEC119 (P15, F13) calibration + live-defect proof.
 *
 * ZERO-FP TABLE — run the cast-leak logic against every tracked published package
 * (book-packages/*.v21.json). The gate's cast is `blueprint.allowedNames ∩ example-text`;
 * final packages carry no blueprint, so we ADAPT per the fix prompt: derive the cast from
 * each chapter's OWN examples, restricted to the protagonist name bank (config/name-bank.json)
 * — exactly the universe the blueprint deals fictional names from. Real recurring figures
 * (Edison, Buffett, Warren) are not in the bank, so citing them in a quiz is never a hit.
 * A hit = a bank-first-name used by a chapter's examples ALSO surfacing in that chapter's
 * quiz/action/summary reader text — i.e. the F13 defect. Target: zero on shipped ≥85 books.
 *
 * LIVE-DEFECT PROOF — run the real gate helpers (usedExampleCast + castContainmentFindings)
 * against the regenerated the-power-of-moments ch01 section artifacts. They MUST trip.
 *
 * Run: npx tsx scratch/calibrate-cast-containment.ts
 */
import { readFileSync, existsSync, readdirSync } from "fs";
import { resolve } from "path";

import { extractNamesFromText } from "../src/librarian/libraryState.js";
import { usedExampleCast, castContainmentFindings } from "../src/sections/sectionGate.js";

const PIPELINE_DIR = resolve(import.meta.dirname, "..");
const WORKTREE_ROOT = resolve(PIPELINE_DIR, "../../../..");
const CANONICAL = "/Users/radinsoltani/ChapterFlow-books";

// ── name bank (the fictional-protagonist universe) ───────────────────────────
function nameBank(): Set<string> {
  const raw = JSON.parse(readFileSync(resolve(PIPELINE_DIR, "config/name-bank.json"), "utf8"));
  const names: string[] = [];
  for (const [k, v] of Object.entries(raw)) if (!k.startsWith("_") && Array.isArray(v)) names.push(...(v as string[]));
  return new Set(names);
}
const BANK = nameBank();

const T = (v: unknown) => (typeof v === "string" ? v : "");

// Names that appear as "First Last" capitalized bigrams anywhere in the chapter are
// REAL FIGURES (Henry Ford, Anne Davin, James Williams). The real gate never puts these
// in the cast — blueprint.allowedNames is dealt DISJOINT from protectedSourceNames — so
// the calibration proxy must exclude them too, otherwise it over-reports the gate.
function realFigureFirstNames(ch: any): Set<string> {
  const all = [
    T(ch.hook), T(ch.counterintuition), T(ch.keyTakeaway), T(ch.tryThisNow),
    T(ch.breakdown?.fastRead), T(ch.breakdown?.deepRead), T(ch.breakdown?.fullRead),
    ...(ch.examples ?? []).flatMap((e: any) => [T(e.title), T(e.scenario), T(e.whatToDo), T(e.whyItMatters)]),
    ...(ch.quiz?.questions ?? []).flatMap((q: any) => [T(q.prompt), T(q.explanation), ...(q.choices ?? []).map(T)]),
    ...(ch.reviewCards ?? []).flatMap((c: any) => [T(c.front), T(c.back)]),
    T(ch.implementationPlan?.coreSkill), T(ch.implementationPlan?.twentyFourHourChallenge),
    T(ch.implementationPlan?.weeklyPractice),
    ...(ch.implementationPlan?.ifThenPlans ?? []).flatMap((it: any) => [T(it.context), T(it.plan)]),
  ].join(" \n ");
  const out = new Set<string>();
  // Both tokens of a "First Last" real-figure reference (Mary Oliver, Tom Brady, Jim Connor):
  // the gate excludes source figures via protectedSourceNames whether cited by first or last name.
  for (const m of all.matchAll(/\b([A-Z][a-z]{2,})\s+([A-Z][a-z]{2,})\b/g)) { out.add(m[1]); out.add(m[2]); }
  return out;
}

function chapterCast(ch: any): Set<string> {
  const exText = (ch.examples ?? [])
    .flatMap((e: any) => [T(e.title), T(e.scenario), T(e.whatToDo), T(e.whyItMatters)])
    .join(" \n ");
  const real = realFigureFirstNames(ch);
  return new Set(extractNamesFromText(exText).filter((n) => BANK.has(n) && !real.has(n)));
}

function readerFields(ch: any): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  const add = (p: string, v: unknown) => { if (T(v)) out.push([p, T(v)]); };
  // summary
  add("hook", ch.hook); add("counterintuition", ch.counterintuition);
  add("breakdown.fastRead", ch.breakdown?.fastRead); add("breakdown.deepRead", ch.breakdown?.deepRead);
  add("breakdown.fullRead", ch.breakdown?.fullRead); add("keyTakeaway", ch.keyTakeaway); add("tryThisNow", ch.tryThisNow);
  // quiz + cards
  (ch.quiz?.questions ?? []).forEach((q: any, i: number) => {
    add(`quiz[${i}].prompt`, q.prompt);
    (q.choices ?? []).forEach((c: string, ci: number) => add(`quiz[${i}].choices[${ci}]`, c));
    add(`quiz[${i}].explanation`, q.explanation);
  });
  (ch.reviewCards ?? []).forEach((c: any, i: number) => { add(`card[${i}].front`, c.front); add(`card[${i}].back`, c.back); });
  // action
  const ip = ch.implementationPlan;
  if (ip) {
    add("plan.coreSkill", ip.coreSkill); add("plan.twentyFourHourChallenge", ip.twentyFourHourChallenge);
    add("plan.weeklyPractice", ip.weeklyPractice); add("plan.title", ip.title);
    (ip.ifThenPlans ?? []).forEach((it: any, i: number) => { add(`plan.ifThen[${i}].context`, it.context); add(`plan.ifThen[${i}].plan`, it.plan); });
  }
  return out;
}

// ── zero-FP sweep ────────────────────────────────────────────────────────────
const pkgDir = existsSync(resolve(WORKTREE_ROOT, "book-packages"))
  ? resolve(WORKTREE_ROOT, "book-packages")
  : resolve(CANONICAL, "book-packages");
const pkgs = readdirSync(pkgDir).filter((f) => f.endsWith(".v21.json")).sort();

type Hit = { book: string; chapter: string; name: string; field: string; snippet: string };
const surfaceOf = (field: string): "summary" | "quiz+cards" | "action" =>
  field.startsWith("plan.") ? "action" : field.startsWith("quiz[") || field.startsWith("card[") ? "quiz+cards" : "summary";
const hits: Hit[] = [];
let chaptersScanned = 0;
for (const f of pkgs) {
  const pkg = JSON.parse(readFileSync(resolve(pkgDir, f), "utf8"));
  const book = pkg.packageId ?? f.replace(/\.v21\.json$/, "");
  for (const ch of pkg.chapters ?? []) {
    chaptersScanned++;
    const cast = chapterCast(ch);
    if (cast.size === 0) continue;
    for (const [field, textValue] of readerFields(ch)) {
      for (const name of new Set(extractNamesFromText(textValue))) {
        if (!cast.has(name)) continue;
        const idx = textValue.indexOf(name);
        hits.push({ book, chapter: ch.chapterId, name, field, snippet: textValue.slice(Math.max(0, idx - 25), idx + 40).replace(/\s+/g, " ") });
      }
    }
  }
}

console.log("=== SEC119 ZERO-FP SWEEP (published catalog, cast = name-bank ∩ example-text) ===");
console.log(`packages: ${pkgs.length}   chapters scanned: ${chaptersScanned}   raw shared-name hits: ${hits.length}`);
const bySurface = new Map<string, Hit[]>();
for (const h of hits) { const s = surfaceOf(h.field); (bySurface.get(s) ?? bySurface.set(s, []).get(s)!).push(h); }
console.log("\n| surface | hits | books affected |");
console.log("|---|---|---|");
for (const s of ["summary", "quiz+cards", "action"]) {
  const hs = bySurface.get(s) ?? [];
  console.log(`| ${s} | ${hs.length} | ${new Set(hs.map((h) => h.book)).size} |`);
}
console.log(`\nINTERPRETATION: 'summary' and 'quiz+cards' hits are the v1 HOUSE STYLE — the summary`);
console.log(`narrates example protagonists as lived moments (SUMMARY_VOICE), and the quiz reuses an`);
console.log(`example protagonist as a callback (the C25-BLESSED gold pattern: single-owner reuse in the`);
console.log(`quiz does NOT fire). Blocking those would contradict an existing rule → NOT zero-FP-able.`);
console.log(`The ACTION plan is the only surface where naming a fictional character is nonsensical to the`);
console.log(`reader ("hand it to Sophie by name") — SEC119 scopes its blocker there.`);
const actionHits = bySurface.get("action") ?? [];
console.log(`\n--- ACTION-surface hits (SEC119's scope) on shipped catalog: ${actionHits.length} ---`);
for (const h of actionHits.slice(0, 40)) console.log(`| ${h.book} | ${h.chapter} | ${h.name} | ${h.field} | …${h.snippet}… |`);

// ── live-defect proof (POM ch01 section artifacts) ───────────────────────────
console.log("\n=== SEC119 LIVE-DEFECT PROOF (the-power-of-moments ch01) ===");
const base = resolve(CANONICAL, "scripts/book/prompts/chapterflow-v23-compiler-pipeline 2/state/books/the-power-of-moments/runs/v23-current");
const bpPath = resolve(base, "blueprints/ch01.blueprint.json");
const secDir = resolve(base, "sections/ch01");
if (!existsSync(bpPath) || !existsSync(secDir)) {
  console.log(`(skipped — artifacts not on disk at ${secDir})`);
} else {
  const bp = JSON.parse(readFileSync(bpPath, "utf8"));
  const exPack = JSON.parse(readFileSync(resolve(secDir, "example-pack.json"), "utf8"));
  const usedCast = usedExampleCast(bp, exPack);
  console.log(`used cast: ${[...usedCast].sort().join(", ")}`);
  let total = 0;
  console.log("\n| section | field | name | message |");
  console.log("|---|---|---|---|");
  for (const kind of ["learning-pack", "action-pack", "summary-pack"]) {
    const p = resolve(secDir, `${kind}.json`);
    if (!existsSync(p)) continue;
    const pack = JSON.parse(readFileSync(p, "utf8"));
    for (const finding of castContainmentFindings(pack, usedCast, 1)) {
      total++;
      const name = finding.message.match(/names "([^"]+)"/)?.[1] ?? "?";
      console.log(`| ${finding.section} | ${finding.path} | ${name} | ${finding.checkId} |`);
    }
  }
  console.log(`\nSEC119 blockers on POM ch01: ${total}`);
  console.log(total > 0 ? "→ LIVE DEFECT TRIPPED. ✓" : "→ FAILED to trip live defect. ✗");
}
