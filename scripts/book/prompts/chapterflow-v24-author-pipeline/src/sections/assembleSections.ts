import { mkdirSync } from "fs";
import { resolve } from "path";

import {
  assembleChapterV21OrThrow,
  authorV4SelectionError,
  readAuthorV4SelectedJson,
  type AssembleInput,
  type AuthorV4ContentSelection,
} from "../assembler.js";
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
import type { CandidateInputFile } from "../books/candidateTypes.js";
import type { SectionKind, SectionPackV1 } from "../artifacts/artifactTypes.js";

export type AssembleSectionsResult = {
  bookId: string;
  written: string[];
  findings: string[];
  candidateFiles?: readonly CandidateInputFile[];
  blockers?: readonly AssemblyBlocker[];
  /** Every blocking gate's checkId, including the ones that produced no structured
   *  blocker. `blockers` is the machine-readable EVICTABLE subset; this is the full
   *  set, so the port can tell an operator WHICH gate blocked a compile that evicted
   *  nothing (the permanent-wedge signature) instead of repeating an identical
   *  message every round. Deduped, first-seen order. */
  blockedCheckIds?: readonly string[];
};

/**
 * Task 11aa — a structured cross-chapter assembly blocker. The cross-chapter
 * anti-sameness gates (SEC93 venue stamping, …) fire only at assembly, over
 * independently-drafted packs, and their string findings do not tell the compiler
 * port WHICH cached (chapter, kind) packs to evict or WHICH phrase collided. This
 * projects the machine-readable fields of such a finding — chapter, section kind,
 * the grouping signature, and the colliding phrase — alongside the human message,
 * so the port can evict exactly the implicated packs and feed cross-chapter
 * avoid-context into the re-draft without parsing prose. Only findings that carry
 * a chapterNumber, a section, and a signature become blockers; anything else is
 * left unstructured so the port fails loud rather than guessing what to evict.
 */
export interface AssemblyBlocker {
  readonly chapterNumber: number;
  readonly kind: SectionKind;
  readonly checkId: string;
  readonly signature: string;
  readonly phrase: string;
  readonly message: string;
}

/** Project the structured cross-chapter blockers out of a section-gate finding
 *  list. A finding qualifies only when it carries the full machine-readable
 *  identity (chapterNumber + section + signature); the phrase is the signature's
 *  value component ("venue:kitchen table" → "kitchen table"). Per-chapter findings
 *  and any finding missing a component are intentionally dropped — the port treats
 *  an assembly failure with no structured blockers as unknown and evicts nothing. */
export function structureAssemblyBlockers(findings: readonly SectionFinding[]): AssemblyBlocker[] {
  const blockers: AssemblyBlocker[] = [];
  for (const finding of findings) {
    if (finding.severity !== "blocker") continue;
    if (typeof finding.chapterNumber !== "number" || finding.section === undefined || finding.signature === undefined) continue;
    const separator = finding.signature.indexOf(":");
    const phrase = separator >= 0 ? finding.signature.slice(separator + 1) : finding.signature;
    if (phrase.trim().length === 0) continue;
    blockers.push({
      chapterNumber: finding.chapterNumber,
      kind: finding.section,
      checkId: finding.checkId,
      signature: finding.signature,
      phrase,
      message: finding.message,
    });
  }
  return blockers;
}

export interface AuthorV4SectionChapterPaths {
  readonly chapterNumber: number;
  readonly blueprint: string;
  readonly sourcePacket: string;
  readonly sourceSidecar: string;
  readonly summary: string;
  readonly examples: string;
  readonly learning: string;
  readonly action: string;
  readonly output: string;
}

export interface AuthorV4SectionAssembly {
  readonly content: AuthorV4ContentSelection;
  readonly chapters: readonly AuthorV4SectionChapterPaths[];
}

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

export function assembleSections(bookId: string, roots: CompilerStoreRoots = {}, selected?: AuthorV4SectionAssembly): AssembleSectionsResult {
  const normalized = normSlug(bookId);
  if (selected) {
    const invalid = authorV4SelectionError(selected.content);
    if (invalid || selected.content.bookId !== normalized) {
      return { bookId: normalized, written: [], findings: [`V4 selector blocked: ${invalid ?? "bookId mismatch"}`], candidateFiles: [] };
    }
    const parsed: Array<{
      paths: AuthorV4SectionChapterPaths;
      blueprint: ChapterBlueprintV1;
      packet: SourcePacketV1;
      sidecar: unknown;
      packs: Record<SectionKind, SectionPackV1>;
    }> = [];
    const findings: string[] = [];
    for (const paths of selected.chapters) {
      try {
        const blueprint = readAuthorV4SelectedJson<ChapterBlueprintV1>(selected.content, paths.blueprint);
        const packet = readAuthorV4SelectedJson<SourcePacketV1>(selected.content, paths.sourcePacket);
        const sidecar = readAuthorV4SelectedJson<unknown>(selected.content, paths.sourceSidecar);
        const packs: Record<SectionKind, SectionPackV1> = {
          "summary-pack": readAuthorV4SelectedJson<SummaryPackV1>(selected.content, paths.summary),
          "example-pack": readAuthorV4SelectedJson<ExamplePackV1>(selected.content, paths.examples),
          "learning-pack": readAuthorV4SelectedJson<LearningPackV1>(selected.content, paths.learning),
          "action-pack": readAuthorV4SelectedJson<ActionPackV1>(selected.content, paths.action),
        };
        const nn = String(paths.chapterNumber).padStart(2, "0");
        const expectedChapterId = `${normalized}-ch${nn}`;
        const expectedOutput = `content/chapters/${chapterFileName(expectedChapterId)}`;
        const mappingProblems: string[] = [];
        if (blueprint.chapterNumber !== paths.chapterNumber || blueprint.chapterId !== expectedChapterId) {
          mappingProblems.push(`blueprint identity ${blueprint.chapterId}/ch${blueprint.chapterNumber} does not match caller ch${paths.chapterNumber}`);
        }
        if (packet.bookId !== normalized || packet.chapterNumber !== paths.chapterNumber || packet.chapterId !== expectedChapterId) {
          mappingProblems.push(`source packet identity ${packet.bookId}/${packet.chapterId}/ch${packet.chapterNumber} does not match ${normalized}/${expectedChapterId}/ch${paths.chapterNumber}`);
        }
        for (const kind of ["summary-pack", "example-pack", "learning-pack", "action-pack"] as const) {
          const pack = packs[kind];
          if (pack.artifactType !== kind || pack.chapterId !== expectedChapterId) {
            mappingProblems.push(`${kind} identity ${pack.chapterId}/${pack.artifactType} does not match ${expectedChapterId}/${kind}`);
          }
        }
        if (paths.output !== expectedOutput) {
          mappingProblems.push(`output ${paths.output} does not match canonical ${expectedOutput}`);
        }
        if (mappingProblems.length > 0) {
          findings.push(`ch${nn}: V4 mapping blocked: ${mappingProblems.join("; ")}`);
          continue;
        }
        parsed.push({
          paths,
          blueprint,
          packet,
          sidecar,
          packs,
        });
      } catch (error) {
        findings.push(`ch${String(paths.chapterNumber).padStart(2, "0")}: ${(error as Error).message}`);
      }
    }
    if (findings.length > 0 || parsed.length !== selected.chapters.length) {
      return { bookId: normalized, written: [], findings, candidateFiles: [] };
    }
    // Preserve legacy standalone assembly parity: same whole-book gate and
    // same SEC91 exception, but every input byte comes from selected snapshot.
    const gate = checkSectionGate(normalized, {}, {
      selectedChapters: parsed.map((chapter) => ({
        chapterNumber: chapter.paths.chapterNumber,
        blueprint: chapter.blueprint,
        sourcePacket: chapter.packet,
        sourceSidecar: chapter.sidecar,
        packs: chapter.packs,
      })),
    });
    const blockers = gate.findings.filter((finding) => finding.severity === "blocker" && finding.checkId !== "SEC91.sidecar_unavailable");
    if (blockers.length > 0) {
      return {
        bookId: normalized,
        written: [],
        findings: blockers.map((finding) => `ch${String(finding.chapterNumber ?? 0).padStart(2, "0")}: section-gate blocked assembly: [${finding.checkId}] ${finding.message}`),
        candidateFiles: [],
        // Task 11aa — the machine-readable projection of the cross-chapter blockers,
        // so the compiler port can evict the exact implicated cached packs and feed
        // avoid-context to the re-draft (empty when no blocker is cross-chapter).
        blockers: structureAssemblyBlockers(blockers),
        blockedCheckIds: [...new Set(blockers.map((finding) => finding.checkId))],
      };
    }
    const candidateFiles: CandidateInputFile[] = [];
    for (const chapter of parsed) {
      const summary = chapter.packs["summary-pack"] as SummaryPackV1;
      const examples = chapter.packs["example-pack"] as ExamplePackV1;
      const learning = chapter.packs["learning-pack"] as LearningPackV1;
      const action = chapter.packs["action-pack"] as ActionPackV1;
      const assembleInput: AssembleInput = {
        plan: chapter.blueprint.plan,
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
        sourceEvidence: sourceEvidenceFromPacket(chapter.packet),
      };
      const assembled = assembleChapterV21OrThrow(assembleInput);
      const deterministicLines = selectMemorableLinesDeterministic(assembled);
      assembled.memorableLines = deterministicLines.length >= 3 ? deterministicLines : assembled.memorableLines;
      candidateFiles.push({
        kind: "CHAPTER",
        mediaType: "application/json",
        logicalPath: chapter.paths.output,
        bytes: new TextEncoder().encode(JSON.stringify(assembled, null, 2) + "\n"),
      });
    }
    return { bookId: normalized, written: [], findings: [], candidateFiles };
  }
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
      // SEC91.sidecar_unavailable means the source-paste check could not RUN (the source
      // sidecar isn't co-located) — it is an input/environment condition, not invalid pack
      // CONTENT, so it must not gate assembly. The orchestrated conductor's pre-assembly
      // validate-sections still fails closed on it, so a genuinely-missing sidecar is caught
      // there rather than by silently assembling unverified content here.
      if (f.severity !== "blocker" || f.checkId === "SEC91.sidecar_unavailable") continue;
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
