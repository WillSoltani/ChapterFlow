import { mkdirSync } from "fs";
import { resolve } from "path";

import { assembleChapterV21OrThrow, type AssembleInput } from "../assembler.js";
import { selectMemorableLinesDeterministic } from "../optimizers/memorableLines.js";
import { resolveExpectedSourceChapters } from "../qc/sourceV2Gate.js";
import { checkSectionGate, type SectionFinding } from "./sectionGate.js";
import { CHAPTERS_DIR, chapterFileName, normSlug } from "../lib/chapterPaths.js";
import { writeFileAtomic } from "../lib/atomicWrite.js";
import {
  assemblyInputPath,
  blueprintPath,
  readJsonFile,
  sectionPath,
  sourcePacketPath,
  writeJsonFile,
  type CompilerStoreRoots,
} from "../artifacts/artifactStore.js";
import type { ActionPackV1, ChapterBlueprintV1, ExamplePackV1, LearningPackV1, SourcePacketV1, SummaryPackV1 } from "../artifacts/artifactTypes.js";
import type { PlanningSourceEvidence } from "../source/sourceEvidence.js";

export type AssembleSectionsResult = { bookId: string; written: string[]; findings: string[] };

function sourceEvidenceFromPacket(packet: SourcePacketV1): PlanningSourceEvidence {
  return {
    schemaVersion: "planning-source-evidence-v1",
    bookId: packet.bookId,
    chapterNumber: packet.chapterNumber,
    bookSource: null,
    toc: null,
    chapterSource: null,
    chapterSidecar: null,
    chapterSidecarPath: packet.sourceSidecarPath,
    chapterSourcePath: null,
    bookSourcePath: null,
    tocPath: null,
    sourceHash: packet.sourceHash ?? "source-packet",
    anchorCatalogHash: packet.sourceHash ?? "source-packet",
    anchors: packet.allowedAnchors,
    available: true,
    sourceV2: true,
  } as PlanningSourceEvidence;
}

export function assembleSections(bookId: string, roots: CompilerStoreRoots = {}): AssembleSectionsResult {
  const normalized = normSlug(bookId);
  const findings: string[] = [];
  const written: string[] = [];
  const resolved = resolveExpectedSourceChapters(normalized, { stateRoot: roots.stateRoot });
  if (!resolved.ok || resolved.chapters.length === 0) {
    const reason = resolved.findings.map((f) => f.message).join("; ") || `no chapters resolved for ${normalized}`;
    findings.push(`no resolvable chapters: ${reason}`);
  }
  // Standalone `assemble-sections` use can run out of order (validate-sections skipped or
  // stale). Re-run the whole-book section gate here so an unvalidated pack can never reach
  // ChapterV21 assembly. In the orchestrated path validate-sections has already passed, so
  // this repeats the same deterministic, side-effect-free checks and blocks nothing new.
  const blockedChapters = new Map<number, SectionFinding[]>();
  if (resolved.chapters.length > 0) {
    const gate = checkSectionGate(normalized, roots);
    for (const f of gate.findings) {
      if (f.severity !== "blocker") continue;
      const targets = typeof f.chapterNumber === "number" ? [f.chapterNumber] : resolved.chapters;
      for (const n of targets) {
        const list = blockedChapters.get(n) ?? [];
        list.push(f);
        blockedChapters.set(n, list);
      }
    }
  }
  for (const chapterNumber of resolved.chapters) {
    const chapterBlockers = blockedChapters.get(chapterNumber);
    if (chapterBlockers && chapterBlockers.length > 0) {
      const detail = chapterBlockers.map((f) => `[${f.checkId}] ${f.message}`).join("; ");
      findings.push(`ch${String(chapterNumber).padStart(2, "0")}: section-gate blocked assembly: ${detail}`);
      continue;
    }
    try {
      const bp = readJsonFile<ChapterBlueprintV1>(blueprintPath(normalized, chapterNumber, roots));
      const packet = readJsonFile<SourcePacketV1>(sourcePacketPath(normalized, chapterNumber, roots));
      const summary = readJsonFile<SummaryPackV1>(sectionPath(normalized, chapterNumber, "summary-pack", roots));
      const examples = readJsonFile<ExamplePackV1>(sectionPath(normalized, chapterNumber, "example-pack", roots));
      const learning = readJsonFile<LearningPackV1>(sectionPath(normalized, chapterNumber, "learning-pack", roots));
      const action = readJsonFile<ActionPackV1>(sectionPath(normalized, chapterNumber, "action-pack", roots));
      // bloomsLevel/depthLevel are trusted as-is: the section gate (SEC93) already required
      // every question to carry a valid bloomsLevel and a depthLevel matching the blueprint
      // before this chapter was allowed past the block above, so backfilling defaults here
      // would risk assembling metadata the gate never actually checked.
      const assembleInput: AssembleInput = {
        plan: bp.plan,
        breakdown: summary.breakdown,
        examples: examples.examples,
        quiz: learning.quiz,
        cards: learning.cards,
        implementationPlan: action.implementationPlan,
        keyTakeaway: summary.keyTakeaway,
        keyTakeawaySourceAnchorIds: summary.keyTakeawaySourceAnchorIds,
        hook: summary.hook,
        tryThisNow: action.tryThisNow || summary.tryThisNow,
        tryThisNowSourceAnchorIds: action.tryThisNowSourceAnchorIds || summary.tryThisNowSourceAnchorIds,
        sourceEvidence: sourceEvidenceFromPacket(packet),
      };
      writeJsonFile(assemblyInputPath(normalized, chapterNumber, roots), assembleInput);
      const chapter = assembleChapterV21OrThrow(assembleInput);
      const deterministicLines = selectMemorableLinesDeterministic(chapter);
      chapter.memorableLines = deterministicLines.length >= 3 ? deterministicLines : chapter.memorableLines;
      mkdirSync(CHAPTERS_DIR, { recursive: true });
      const out = resolve(CHAPTERS_DIR, chapterFileName(chapter.chapterId));
      writeFileAtomic(out, JSON.stringify(chapter, null, 2) + "\n");
      written.push(out);
    } catch (err) {
      findings.push(`ch${String(chapterNumber).padStart(2, "0")}: ${(err as Error).message}`);
    }
  }
  return { bookId: normalized, written, findings };
}
