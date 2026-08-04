/** IMP-19 — Layer-N v2 corpus builder (NO model calls, NO canonical writes).
 *
 *  Clean bases are TOP-APPROVED books (docs/v25 140-evaluation Content Design
 *  Score >= 87) from book-packages/*.v21.json, deterministically NORMALIZED to the
 *  current ChapterV21 schema (adds only missing non-reader-facing metadata; the
 *  sole reader-facing effect is fixing implementationPlan.title, which otherwise
 *  renders "Title: undefined" — a faithful short title derived from the existing
 *  coreSkill). Variants are controlled mutations with base->variant manifests. The
 *  whole corpus self-validates with validateNativeReviewCorpusV2 (fail-closed).
 *
 *  Usage: npx tsx state/migration-experiments/_owner-inputs/build-layer-n-v2-corpus.mts [--write]
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

import type { ChapterV21 } from "../../../src/types.js";
import {
  admitChapter,
  canonicalJson,
  nativeReviewCorpusSha256,
  resolveJsonPath,
  validateNativeReviewCorpusV2,
} from "../../../src/bakeoff/migration/nativeReviewQualification.js";
import { chapterContentHash } from "../../../src/critics/qcAttestation.js";
import {
  NATIVE_REVIEW_CORPUS_SCHEMA,
  type NativeReviewCorpusItemV2,
  type NativeReviewCorpusV2,
  type NativeReviewExpectedV2,
  type NativeReviewMutationManifestV2,
} from "../../../src/bakeoff/migration/nativeReviewTypes.js";

const BP = "/Users/radinsoltani/ChapterFlow-books/book-packages";
const OUT = "state/migration-experiments/_owner-inputs/stage-q/layer-n-v2-corpus.json";
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

/** Deterministic normalization of a 140-eval book-package chapter to the CURRENT
 *  ChapterV21 schema. Adds ONLY missing metadata; the single reader-facing effect
 *  is fixing implementationPlan.title (from the existing coreSkill's first sentence). */
export function normalizeChapter(input: ChapterV21): ChapterV21 {
  const ch = JSON.parse(JSON.stringify(input)) as Record<string, any>;
  for (const e of ch.examples ?? []) {
    if (!e.planSpec) e.planSpec = { domain: "general application", audience: "the reader", stakes: "applying the chapter's core skill", format: "scenario", requiredBeat: String(e.title ?? "apply the chapter's core skill") };
  }
  for (const q of ch.quiz?.questions ?? []) { if (!q.depthLevel) q.depthLevel = "standard"; }
  if (ch.implementationPlan && !ch.implementationPlan.title) {
    const cs = String(ch.implementationPlan.coreSkill ?? "").trim();
    const first = (cs.split(/(?<=[.!?])\s/)[0] ?? cs).replace(/[.]+$/, "").trim();
    ch.implementationPlan.title = first || "Practice the core skill";
  }
  for (const m of ch.memorableLines ?? []) { if (!m.location) m.location = "breakdown"; if (!m.why) m.why = "A memorable distillation of the chapter's core idea."; }
  return ch as ChapterV21;
}

function loadTopBook(book: string, chapter: number): ChapterV21 {
  const pkg = JSON.parse(readFileSync(`${BP}/${book}.v21.json`, "utf8")) as { chapters: ChapterV21[] };
  const c = pkg.chapters[chapter - 1];
  if (!c) throw new Error(`no chapter ${chapter} in ${book}`);
  return normalizeChapter(c);
}

function cloneAs(chapter: ChapterV21, newId: string): ChapterV21 {
  const c = JSON.parse(JSON.stringify(chapter)) as ChapterV21 & { chapterId: string };
  c.chapterId = newId;
  return c;
}
function setAtPath(root: unknown, path: string, value: unknown): void {
  const parts = path.split("/").filter(Boolean);
  let cur = root as Record<string, unknown>;
  for (let i = 0; i < parts.length - 1; i++) cur = cur[parts[i]] as Record<string, unknown>;
  cur[parts[parts.length - 1]] = value;
}
function diffPaths(a: unknown, b: unknown, prefix = ""): string[] {
  if (canonicalJson(a) === canonicalJson(b)) return [];
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object" || Array.isArray(a) !== Array.isArray(b)) return [prefix || "/"];
  const out: string[] = [];
  for (const k of new Set([...Object.keys(a as object), ...Object.keys(b as object)])) {
    const av = (a as Record<string, unknown>)[k]; const bv = (b as Record<string, unknown>)[k];
    if (canonicalJson(av) !== canonicalJson(bv)) out.push(...diffPaths(av, bv, `${prefix}/${k}`));
  }
  return out.length ? out : [prefix || "/"];
}
const TOP_SECTIONS = ["/title", "/hook", "/counterintuition", "/tryThisNow", "/keyTakeaway", "/breakdown", "/examples", "/quiz", "/reviewCards", "/implementationPlan", "/memorableLines"];
function buildManifest(base: ChapterV21, variant: ChapterV21, allowedPaths: string[]): NativeReviewMutationManifestV2 {
  const changedPaths = diffPaths(base, variant).filter((p) => p !== "/chapterId");
  const protectedRegionHashes: Record<string, string> = {};
  for (const sec of TOP_SECTIONS) if (!changedPaths.some((cp) => cp === sec || cp.startsWith(sec + "/"))) protectedRegionHashes[sec] = sha(canonicalJson(resolveJsonPath(base as unknown, sec)));
  return { baseContentSha256: chapterContentHash(base), variantContentSha256: chapterContentHash(variant), allowedPaths, changedPaths, protectedRegionHashes };
}

type BuildItem = { item: NativeReviewCorpusItemV2; admission: ReturnType<typeof admitChapter> };
const PROV = (b: string, n: number, extra = "") => `top-approved:${b}:ch${n} (140-eval score>=87; schema-metadata normalized${extra ? "; " + extra : ""})`;

function cleanItem(book: string, chapter: number): BuildItem {
  const ch = loadTopBook(book, chapter);
  const itemId = `LNV2-CLEAN-${book}-ch${String(chapter).padStart(2, "0")}`;
  return { admission: admitChapter(ch), item: { itemId, baseItemId: itemId, kind: "clean-pass", chapter: ch, expected: { expectedPass: true, prohibitMustFix: true }, mutationManifest: null, evidenceProvenance: PROV(book, chapter), approvalStatus: "owner-approved-development-fixture", requiresPhase2: false } };
}
function keyMismatchItem(book: string, chapter: number, qIndex0: number, baseItemId: string): BuildItem {
  const base = loadTopBook(book, chapter);
  const itemId = `LNV2-KEYMISMATCH-${book}-ch${String(chapter).padStart(2, "0")}-q${qIndex0 + 1}`;
  const variant = cloneAs(base, `${itemId}-chapter`);
  const q = (variant.quiz as { questions: Array<{ correctIndex: number; choices: string[] }> }).questions[qIndex0];
  const orig = q.correctIndex; const wrong = (orig + 1) % q.choices.length;
  setAtPath(variant, `/quiz/questions/${qIndex0}/correctIndex`, wrong);
  return { admission: admitChapter(variant), item: { itemId, baseItemId, kind: "quiz-key-mismatch", chapter: variant, expected: { expectedKeyMismatchQuestions: [qIndex0 + 1] }, mutationManifest: buildManifest(base, variant, [`/quiz/questions/${qIndex0}/correctIndex`]), evidenceProvenance: PROV(book, chapter, `correctIndex ${orig}->${wrong} q${qIndex0 + 1}`), approvalStatus: "owner-approved-development-fixture", requiresPhase2: true } };
}
function craftItem(book: string, chapter: number, exIndex0: number, append: string, baseItemId: string): BuildItem {
  const base = loadTopBook(book, chapter);
  const itemId = `LNV2-CRAFT-${book}-ch${String(chapter).padStart(2, "0")}`;
  const variant = cloneAs(base, `${itemId}-chapter`);
  const cur = resolveJsonPath(variant as unknown, `/examples/${exIndex0}/whyItMatters`) as string;
  setAtPath(variant, `/examples/${exIndex0}/whyItMatters`, cur + append);
  return { admission: admitChapter(variant), item: { itemId, baseItemId, kind: "craft-nonblocker", chapter: variant, expected: { prohibitMustFix: true, targetUnits: [`example ${exIndex0 + 1}`] }, mutationManifest: buildManifest(base, variant, [`/examples/${exIndex0}/whyItMatters`]), evidenceProvenance: PROV(book, chapter, `mild generic-phrasing append to example ${exIndex0 + 1}`), approvalStatus: "owner-approved-development-fixture", requiresPhase2: false } };
}

// spec-driven variants (hard-blocker + ambiguity), authored + gold-audited
type MutationOp = { path: string; op: "append" | "replace"; value: string };
type SpecVariant = { variantKey: string; baseBookId: string; baseChapter: number; kind: NativeReviewCorpusItemV2["kind"]; ops: MutationOp[]; expected: NativeReviewExpectedV2; goldRationale: string };
function applyOps(chapter: ChapterV21, ops: MutationOp[]): void {
  for (const o of ops) {
    if (o.op === "append") { const cur = resolveJsonPath(chapter as unknown, o.path); if (typeof cur !== "string") throw new Error(`append target not a string: ${o.path}`); setAtPath(chapter, o.path, cur + o.value); }
    else setAtPath(chapter, o.path, o.value);
  }
}
function specVariantItem(v: SpecVariant): BuildItem {
  const base = loadTopBook(v.baseBookId, v.baseChapter);
  const baseItemId = `LNV2-CLEAN-${v.baseBookId}-ch${String(v.baseChapter).padStart(2, "0")}`;
  const variant = cloneAs(base, `${v.variantKey}-chapter`);
  applyOps(variant, v.ops);
  const requiresPhase2 = v.kind === "quiz-key-mismatch" || v.kind === "quiz-ambiguity";
  return { admission: admitChapter(variant), item: { itemId: v.variantKey, baseItemId, kind: v.kind, chapter: variant, expected: v.expected, mutationManifest: buildManifest(base, variant, v.ops.map((o) => o.path)), evidenceProvenance: PROV(v.baseBookId, v.baseChapter, v.variantKey), approvalStatus: "owner-approved-development-fixture", requiresPhase2 } };
}

// ── Composition (security -> Layer-O per LN-08) ───────────────────────────────
const CLEAN_BASES: Array<[string, number]> = [
  ["the-willpower-instinct", 1], ["the-power-of-moments", 1], ["peak", 1], ["decisive", 1],
  ["difficult-conversations", 1], ["the-checklist-manifesto", 1], ["the-willpower-instinct", 2], ["the-power-of-moments", 2],
];
const baseId = (b: string, n: number) => `LNV2-CLEAN-${b}-ch${String(n).padStart(2, "0")}`;
const cleanBuilds = CLEAN_BASES.map(([b, n]) => cleanItem(b, n));

const KEYMISMATCH: Array<[string, number, number]> = [["the-willpower-instinct", 1, 0], ["the-power-of-moments", 1, 0], ["peak", 1, 0], ["decisive", 1, 0]];
const keymBuilds = KEYMISMATCH.map(([b, n, qi]) => keyMismatchItem(b, n, qi, baseId(b, n)));

const CRAFT: Array<[string, number, number, string]> = [
  // Neutral, method-aligned padding (owner-approved 2026-07-11): a mild "restates
  // the lesson" transfer weakness that makes NO meta-claim about the chapter's
  // method — so no defensible reviewer reads it as SOURCE-CONTRADICTORY (the
  // root-cause fix for the borderline "not overthinking / overcomplicating" template).
  ["difficult-conversations", 1, 1, " In the end, this is the kind of move worth practicing until it feels routine."],
  ["the-checklist-manifesto", 1, 1, " In the end, this is the kind of move worth practicing until it feels routine."],
  ["the-willpower-instinct", 2, 1, " In the end, this is the kind of move worth practicing until it feels routine."],
  ["the-power-of-moments", 2, 1, " In the end, this is the kind of move worth practicing until it feels routine."],
];
const craftBuilds = CRAFT.map(([b, n, ei, s]) => craftItem(b, n, ei, s, baseId(b, n)));

const SPEC_PATH = "/private/tmp/claude-501/-Users-radinsoltani-ChapterFlow-books/64ea07aa-d31b-4777-9498-41e7a453e5a2/scratchpad/layer-n-v2-mutation-spec-topbooks.json";
const specBuilds: BuildItem[] = existsSync(SPEC_PATH) ? (JSON.parse(readFileSync(SPEC_PATH, "utf8")).variants as SpecVariant[]).map(specVariantItem) : [];

const builds = [...cleanBuilds, ...keymBuilds, ...craftBuilds, ...specBuilds];
const items = builds.map((b) => b.item);
const corpus: NativeReviewCorpusV2 = {
  schema: NATIVE_REVIEW_CORPUS_SCHEMA, corpusId: "s16-layer-n-native-review-v2", version: "v2.0",
  sourceCorpus: "top-approved book-packages (docs/v25 140-evaluation Content Design Score >= 87), deterministically schema-metadata normalized to current ChapterV21",
  items, approvalStatus: "owner-approved-development-fixture", independentHumanRater: false,
};

console.log("=== Layer-N v2 corpus (top-approved bases) ===");
for (const b of builds) console.log(`${b.item.kind.padEnd(24)} ${b.item.itemId.padEnd(52)} render=${b.admission.renderedBytes}B ship=${b.admission.shipClean} complete=${b.admission.complete}${b.admission.shipBlockers.length ? " blk=" + [...new Set(b.admission.shipBlockers)].join(",") : ""}`);
const problems = validateNativeReviewCorpusV2(corpus);
console.log(`\ncorpus items: ${items.length} | validate problems: ${problems.length}`);
for (const p of problems) console.log("  PROBLEM:", p);
if (problems.length === 0) console.log("corpus sha256 (full-semantic):", nativeReviewCorpusSha256(corpus));
if (process.argv.includes("--write") && problems.length === 0) { writeFileSync(OUT, JSON.stringify(corpus, null, 2) + "\n"); console.log("WROTE", OUT); }
