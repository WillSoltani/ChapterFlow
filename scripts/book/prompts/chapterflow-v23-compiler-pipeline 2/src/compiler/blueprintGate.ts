import { resolveExpectedSourceChapters } from "../qc/sourceV2Gate.js";
import { blueprintPath, readJsonFile, type CompilerStoreRoots } from "../artifacts/artifactStore.js";
import { CHAPTER_BLUEPRINT_SCHEMA_VERSION, type ChapterBlueprintV1 } from "../artifacts/artifactTypes.js";
import { normSlug } from "../lib/chapterPaths.js";
import { C7_BANNED_NAMES } from "../critics/finalGate.js";

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

export function checkBlueprintGate(bookId: string, roots: CompilerStoreRoots = {}): BlueprintGateReport {
  const normalized = normSlug(bookId);
  const resolved = resolveExpectedSourceChapters(normalized, { stateRoot: roots.stateRoot });
  const chapters = resolved.chapters;
  const findings: BlueprintFinding[] = [...resolved.findings];
  if (!resolved.ok || resolved.chapters.length === 0) {
    findings.push({ checkId: "BPV0.no_chapters", severity: "blocker", message: `No expected source chapters found for ${normalized}.` });
  }
  for (const chapterNumber of chapters) {
    const p = blueprintPath(normalized, chapterNumber, roots);
    try {
      findings.push(...validateBlueprint(readJsonFile<ChapterBlueprintV1>(p)));
    } catch (err) {
      findings.push({ checkId: "BPV0.missing_or_malformed", severity: "blocker", chapterNumber, path: p, message: `missing/unreadable blueprint: ${(err as Error).message}` });
    }
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
