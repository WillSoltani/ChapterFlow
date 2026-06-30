import { mkdirSync } from "fs";
import { resolve } from "path";

import { assembleChapterV21OrThrow, type AssembleInput } from "../assembler.js";
import { selectMemorableLinesDeterministic } from "../optimizers/memorableLines.js";
import { resolveExpectedSourceChapters } from "../qc/sourceV2Gate.js";
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
  for (const chapterNumber of resolved.chapters) {
    try {
      const bp = readJsonFile<ChapterBlueprintV1>(blueprintPath(normalized, chapterNumber, roots));
      const packet = readJsonFile<SourcePacketV1>(sourcePacketPath(normalized, chapterNumber, roots));
      const summary = readJsonFile<SummaryPackV1>(sectionPath(normalized, chapterNumber, "summary-pack", roots));
      const examples = readJsonFile<ExamplePackV1>(sectionPath(normalized, chapterNumber, "example-pack", roots));
      const learning = readJsonFile<LearningPackV1>(sectionPath(normalized, chapterNumber, "learning-pack", roots));
      const action = readJsonFile<ActionPackV1>(sectionPath(normalized, chapterNumber, "action-pack", roots));
      const normalizedQuiz: LearningPackV1["quiz"] = {
        ...learning.quiz,
        questions: (learning.quiz?.questions ?? []).map((q, i) => ({
          ...q,
          bloomsLevel: q.bloomsLevel ?? "apply",
          depthLevel: q.depthLevel ?? bp.sections.quiz[i]?.depthLevel ?? "standard",
        })),
      };
      const assembleInput: AssembleInput = {
        plan: bp.plan,
        breakdown: summary.breakdown,
        examples: examples.examples,
        quiz: normalizedQuiz,
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
