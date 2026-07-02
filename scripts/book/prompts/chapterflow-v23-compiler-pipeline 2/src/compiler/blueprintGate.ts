import { resolveExpectedSourceChapters } from "../qc/sourceV2Gate.js";
import { blueprintPath, readJsonFile, type CompilerStoreRoots } from "../artifacts/artifactStore.js";
import { CHAPTER_BLUEPRINT_SCHEMA_VERSION, type ChapterBlueprintV1 } from "../artifacts/artifactTypes.js";
import { normSlug } from "../lib/chapterPaths.js";
import { C7_BANNED_NAMES } from "../critics/finalGate.js";
import { POSITIONAL_DEALS, resolvedPoolsForBook } from "./chapterBlueprint.js";
import type { ResolvedPools } from "./bookDesign.js";

/** Per-book pool-size overrides for the positional-collision math (P14). A book compiled from
 *  per-book design/genre pools deals from pools whose sizes differ from the global constants
 *  POSITIONAL_DEALS was built with, so BPV11's round-robin cap must be computed against the ACTUAL
 *  resolved sizes or it would false-positive/negative. The genre-neutral shape pools (quiz/card/
 *  hook/counter/if-then) are not designable and keep the descriptor's own poolSize. */
type PoolSizeOverride = { poolSize: number; poolSizeAt?: (slotIndex: number) => number };

function poolSizeOverrides(pools: ResolvedPools): Record<string, PoolSizeOverride> {
  const parity = (dec: number, exp: number) => (slotIndex: number) => (slotIndex % 2 === 1 ? exp : dec);
  return {
    exampleSceneFrame: { poolSize: pools.sceneFramesDecision.length, poolSizeAt: parity(pools.sceneFramesDecision.length, pools.sceneFramesExperiential.length) },
    exampleRequiredBeat: { poolSize: pools.beatsDecision.length, poolSizeAt: parity(pools.beatsDecision.length, pools.beatsExperiential.length) },
    practiceForm: { poolSize: pools.practiceForms.length },
    practiceConstraint: { poolSize: pools.practiceConstraints.length },
    actionMechanism: { poolSize: pools.actionMechanisms.length },
    weeklyPracticeForm: { poolSize: pools.weeklyForms.length },
  };
}

export type BlueprintFinding = {
  checkId: string;
  severity: "blocker" | "advisory";
  chapterNumber?: number;
  message: string;
  path?: string;
};

export type BlueprintGateReport = { bookId: string; passed: boolean; chaptersChecked: number; findings: BlueprintFinding[] };

export function validateBlueprint(bp: ChapterBlueprintV1): BlueprintFinding[] {
  const findings: BlueprintFinding[] = [];
  const ch = bp.chapterNumber;
  const push = (checkId: string, severity: BlueprintFinding["severity"], message: string, path?: string) => findings.push({ checkId, severity, chapterNumber: ch, message, path });
  if (bp.schemaVersion !== CHAPTER_BLUEPRINT_SCHEMA_VERSION) push("BPV1.schema", "blocker", `blueprint schemaVersion must be ${CHAPTER_BLUEPRINT_SCHEMA_VERSION}`, "/schemaVersion");
  if (!bp.plan || bp.plan.chapterId !== bp.chapterId || bp.plan.number !== bp.chapterNumber) push("BPV2.plan_identity", "blocker", "embedded ChapterDesignDoc identity must match blueprint", "/plan");
  if (bp.sections.examples.length !== 6) push("BPV3.example_count", "blocker", `blueprint must reserve exactly 6 example slots for the final v21 gate (got ${bp.sections.examples.length})`, "/sections/examples");
  const exampleSpecs = bp.plan?.exampleSpecs ?? [];
  if (bp.plan?.exampleCount !== 6) push("BPV3.plan_example_count", "blocker", `embedded plan.exampleCount must be exactly 6 (got ${bp.plan?.exampleCount ?? "missing"})`, "/plan/exampleCount");
  if (exampleSpecs.length !== 6) push("BPV3.plan_example_specs", "blocker", `embedded plan.exampleSpecs must contain exactly 6 entries (got ${exampleSpecs.length})`, "/plan/exampleSpecs");
  const exampleFormats = exampleSpecs.map((spec) => spec.format).filter(Boolean);
  if (new Set(exampleFormats).size !== exampleFormats.length) push("BPV3.plan_example_format_variety", "blocker", "embedded plan.exampleSpecs must use distinct formats so QC does not see reused example shapes", "/plan/exampleSpecs");
  if (bp.sections.quiz.length < 6) push("BPV4.quiz_floor", "blocker", "blueprint must reserve at least 6 quiz slots", "/sections/quiz");
  const pattern = bp.reservedVariety.answerIndexPattern;
  if (pattern.length !== bp.sections.quiz.length) push("BPV5.answer_pattern_length", "blocker", "answerIndexPattern length must match quiz slot count", "/reservedVariety/answerIndexPattern");
  const counts = [0, 1, 2].map((i) => pattern.filter((p) => p === i).length);
  if (Math.max(...counts) - Math.min(...counts) > 1) push("BPV6.answer_pattern_balance", "blocker", `answerIndexPattern is imbalanced: ${counts.join("/")}`, "/reservedVariety/answerIndexPattern");
  const names = bp.reservedVariety.allowedNames;
  if (new Set(names).size !== names.length) push("BPV7.name_collision", "blocker", "allowedNames contains duplicates", "/reservedVariety/allowedNames");
  const c7Banned = new Set(C7_BANNED_NAMES);
  for (const [i, name] of names.entries()) {
    if (c7Banned.has(name)) push("BPV7.c7_name", "blocker", `allowedNames includes final-gate C7 banned name "${name}"`, `/reservedVariety/allowedNames/${i}`);
  }
  const venues = bp.sections.examples.map((ex) => ex.venue);
  if (new Set(venues).size < Math.min(2, venues.length)) push("BPV8.venue_variety", "advisory", "example venues should not all be identical", "/sections/examples");
  const allowedFacts = new Set(bp.constraints.allowedFactIds);
  const allowedCases = new Set(bp.constraints.allowedCaseIds);
  for (const [i, ex] of bp.sections.examples.entries()) {
    for (const id of ex.requiredFactIds) if (!allowedFacts.has(id)) push("BPV9.unknown_fact", "blocker", `example slot ${i} references unknown fact ${id}`, `/sections/examples/${i}/requiredFactIds`);
    if (ex.requiredCaseIds.length === 0) push("BPV10.example_case_anchor", "blocker", `example slot ${i} needs a named-example anchor that can support example claims`, `/sections/examples/${i}/requiredCaseIds`);
    for (const id of ex.requiredCaseIds) if (!allowedCases.has(id)) push("BPV10.unknown_case", "blocker", `example slot ${i} references unknown case ${id}`, `/sections/examples/${i}/requiredCaseIds`);
    for (const [j, name] of ex.allowedNames.entries()) {
      if (c7Banned.has(name)) push("BPV7.c7_slot_name", "blocker", `example slot ${i} allowedNames includes final-gate C7 banned name "${name}"`, `/sections/examples/${i}/allowedNames/${j}`);
    }
  }
  return findings;
}

/**
 * Book-level positional-deal checks (P11), run across every chapter's blueprint:
 *
 *   BPV11.positional_collision (BLOCKER) — recomputes the book's per-position
 *     value distribution for every positional deal (POSITIONAL_DEALS) and fails
 *     if a same-position value repeats more often than the pool size makes
 *     unavoidable. For a fixed slotIndex over C chapters drawing from a pool of
 *     P values, perfect round-robin caps any single value at ceil(C / P) uses;
 *     any value exceeding that cap is an AVOIDABLE collision (the deal could
 *     have spread it further), exactly the same-position sameness AS5/AS6/AS8/AS9
 *     and the scene_skeleton sweep punish. dealPositional makes this pass by
 *     construction; the gate catches any future regression or hand-edit.
 *
 *   BPV12.pool_floor (ADVISORY) — a per-chapter deal (one value per chapter)
 *     whose pool is smaller than ceil(totalChapters / 2) cannot give even two
 *     chapters a distinct value on average; flag it early so a future thin pool
 *     is widened before it becomes a book-wide monoculture (the hookShape=3 /
 *     counterShape=2 problem this change fixed).
 */
export function checkPositionalDeals(blueprints: ChapterBlueprintV1[], overrides: Record<string, PoolSizeOverride> = {}): BlueprintFinding[] {
  const findings: BlueprintFinding[] = [];
  const C = blueprints.length;
  if (C === 0) return findings;

  for (const d of POSITIONAL_DEALS) {
    const override = overrides[d.poolKey];
    const poolSize = override?.poolSize ?? d.poolSize;
    const poolSizeAt = override?.poolSizeAt ?? d.poolSizeAt;
    const columns = blueprints.map((bp) => d.extract(bp));
    for (let slot = 0; slot < d.slots; slot++) {
      const values = columns.map((col) => col[slot]).filter((v): v is string => typeof v === "string" && v.length > 0);
      if (values.length === 0) continue;
      const P = poolSizeAt ? poolSizeAt(slot) : poolSize;
      const cap = Math.max(1, Math.ceil(values.length / Math.max(1, P)));
      const counts = new Map<string, number>();
      for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
      for (const [value, count] of counts) {
        if (count > cap) {
          findings.push({
            checkId: "BPV11.positional_collision",
            severity: "blocker",
            message: `positional deal "${d.poolKey}" slot ${slot}: value "${value}" is dealt to ${count} of ${values.length} chapters, exceeding the pool-${P} round-robin cap of ${cap} — an avoidable same-position collision the writers cannot self-diverge past`,
            path: `/positional/${d.poolKey}/${slot}`,
          });
        }
      }
    }
    if (d.perChapter) {
      const floor = Math.ceil(C / 2);
      if (poolSize < floor) {
        findings.push({
          checkId: "BPV12.pool_floor",
          severity: "advisory",
          message: `per-chapter deal "${d.poolKey}" draws from a pool of ${poolSize}, below the ceil(${C}/2)=${floor} floor for a ${C}-chapter book — widen it to avoid a book-wide monoculture`,
          path: `/positional/${d.poolKey}`,
        });
      }
    }
  }
  return findings;
}

export function checkBlueprintGate(bookId: string, roots: CompilerStoreRoots = {}): BlueprintGateReport {
  const normalized = normSlug(bookId);
  const resolved = resolveExpectedSourceChapters(normalized, { stateRoot: roots.stateRoot });
  const chapters = resolved.chapters;
  const findings: BlueprintFinding[] = [...resolved.findings];
  if (!resolved.ok || resolved.chapters.length === 0) {
    findings.push({ checkId: "BPV0.no_chapters", severity: "blocker", message: `No expected source chapters found for ${normalized}.` });
  }
  const loaded: ChapterBlueprintV1[] = [];
  for (const chapterNumber of chapters) {
    const p = blueprintPath(normalized, chapterNumber, roots);
    try {
      const bp = readJsonFile<ChapterBlueprintV1>(p);
      loaded.push(bp);
      findings.push(...validateBlueprint(bp));
    } catch (err) {
      findings.push({ checkId: "BPV0.missing_or_malformed", severity: "blocker", chapterNumber, path: p, message: `missing/unreadable blueprint: ${(err as Error).message}` });
    }
  }
  // Book-level positional-deal audit only runs when every expected chapter loaded,
  // so a partially-compiled book (some blueprints missing) doesn't produce spurious
  // "avoidable collision" findings off an incomplete column.
  if (loaded.length === chapters.length && loaded.length > 0) {
    // Size the positional-collision math to the SAME per-book pools the compile dealt from (P14),
    // so a design/genre book isn't flagged against the global constant sizes. Best-effort: a
    // resolution failure falls back to the descriptor's own (constant) sizes.
    let overrides: Record<string, PoolSizeOverride> = {};
    try {
      overrides = poolSizeOverrides(resolvedPoolsForBook(normalized, roots));
    } catch {
      /* fall back to constant sizes */
    }
    findings.push(...checkPositionalDeals(loaded, overrides));
  }
  return { bookId: normalized, passed: !findings.some((f) => f.severity === "blocker"), chaptersChecked: chapters.length, findings };
}

export function formatBlueprintGateReport(report: BlueprintGateReport): string {
  const blockers = report.findings.filter((f) => f.severity === "blocker").length;
  const advisories = report.findings.filter((f) => f.severity === "advisory").length;
  const lines = [`blueprint-gate: ${report.passed ? "PASS" : "BLOCK"} (${report.chaptersChecked} chapter(s), ${blockers} blocker(s), ${advisories} advisory)`];
  for (const f of report.findings) lines.push(`  [${f.severity.toUpperCase()} ${f.checkId}] ${f.chapterNumber ? `ch${String(f.chapterNumber).padStart(2, "0")}: ` : ""}${f.message}${f.path ? ` (${f.path})` : ""}`);
  return lines.join("\n");
}
