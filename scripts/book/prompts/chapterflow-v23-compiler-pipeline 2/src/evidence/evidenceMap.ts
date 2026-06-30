import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

import type { ChapterV21 } from "../types.js";
import { expectedSourceChapters } from "../qc/sourceV2Gate.js";
import { CHAPTERS_DIR, chapterFileName, normSlug } from "../lib/chapterPaths.js";
import { canonicalJsonSha256 } from "../lib/canonicalJson.js";
import {
  blueprintPath,
  evidenceMapPath,
  readJsonFile,
  sourcePacketPath,
  writeJsonFile,
  type CompilerStoreRoots,
} from "../artifacts/artifactStore.js";
import { EVIDENCE_MAP_SCHEMA_VERSION, type ChapterBlueprintV1, type ChapterEvidenceMapV1, type SourcePacketV1 } from "../artifacts/artifactTypes.js";
import { extractGroundedNumbers } from "../compiler/sourcePacket.js";

export type EvidenceMapResult = { bookId: string; written: string[]; findings: string[] };

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function strings(value: unknown): string[] {
  if (typeof value === "string" && value.trim().length > 0) return [value];
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string" && v.trim().length > 0) : [];
}

function properNouns(s: string): string[] {
  const stop = new Set(["The", "A", "An", "If", "When", "Because", "This", "That", "You", "Your"]);
  const out = new Set<string>();
  for (const m of s.matchAll(/\b[A-Z][A-Za-z0-9&.'-]*(?:\s+[A-Z][A-Za-z0-9&.'-]*){0,3}\b/g)) {
    const v = m[0].trim();
    if (v.length >= 3 && !stop.has(v)) out.add(v);
  }
  return [...out];
}

function allowedEntityMatch(entity: string, allowed: Set<string>): boolean {
  const e = entity.toLowerCase();
  for (const a of allowed) {
    const low = a.toLowerCase();
    if (low === e || low.includes(e) || e.includes(low)) return true;
  }
  return false;
}

function entry(args: { text: string; anchors: string[]; allowedAnchors: Set<string>; factIds?: string[]; caseIds?: string[]; allowedNumbers: Set<string>; allowedEntities: Set<string> }) {
  const nums = extractGroundedNumbers(args.text);
  const ents = properNouns(args.text);
  return {
    sourceFactIds: args.factIds ?? [],
    sourceAnchorIds: args.anchors,
    namedCaseIds: args.caseIds ?? [],
    numbersUsed: nums,
    entitiesUsed: ents,
    unsupportedNumbers: nums.filter((n) => !args.allowedNumbers.has(n)),
    unsupportedEntities: ents.filter((e) => !allowedEntityMatch(e, args.allowedEntities)),
    unsupportedAnchorIds: args.anchors.filter((id) => !args.allowedAnchors.has(id)),
  };
}

export function buildEvidenceMap(bookId: string, chapter: ChapterV21, packet: SourcePacketV1, blueprint: ChapterBlueprintV1): ChapterEvidenceMapV1 {
  const allowedAnchors = new Set(packet.allowedAnchors.map((a) => a.id));
  const allowedNumbers = new Set(packet.allowedNumbers);
  const allowedEntities = new Set(packet.allowedEntities);
  // Invented first names are allowed for fictional application examples. Add the blueprint's dealt names
  // so the evidence map does not falsely block ordinary fictional protagonists.
  for (const n of blueprint.reservedVariety.allowedNames) allowedEntities.add(n);
  const paths: ChapterEvidenceMapV1["paths"] = {};
  const put = (path: string, content: string, anchors: string[], factIds?: string[], caseIds?: string[]) => {
    paths[path] = entry({ text: content, anchors, allowedAnchors, factIds, caseIds, allowedNumbers, allowedEntities });
  };
  const effective = chapter.authoring?.sourceAnchors?.effectiveAnchors ?? {};
  put("/hook", text(chapter.hook), strings(effective.hook));
  put("/counterintuition", text(chapter.counterintuition), strings(effective.counterintuition));
  put("/keyTakeaway", text(chapter.keyTakeaway), strings(effective.keyTakeaway));
  put("/tryThisNow", text(chapter.tryThisNow), strings(effective.tryThisNow));
  put("/breakdown/fastRead", text(chapter.breakdown?.fastRead), strings(effective["breakdown.fastRead"]));
  put("/breakdown/deepRead", text(chapter.breakdown?.deepRead), strings(effective["breakdown.deepRead"]));
  put("/breakdown/fullRead", text(chapter.breakdown?.fullRead), strings(effective["breakdown.fullRead"]));
  for (const [i, ex] of (chapter.examples ?? []).entries()) {
    const anyEx = ex as any;
    put(`/examples/${i}`, [text(ex.scenario), text(ex.whatToDo), text(ex.whyItMatters)].join(" "), strings(ex.sourceAnchorIds), strings(anyEx.sourceFactIds), strings(anyEx.namedCaseIds));
  }
  for (const [i, q] of (chapter.quiz?.questions ?? []).entries()) {
    const quizAnchors = strings(
      effective[`quiz.questions[${i}].keyEvidence`] ??
      effective[`quiz.questions[${i}]`] ??
      q.keyEvidenceAnchorIds ??
      q.sourceAnchorIds ??
      q.sourceAnchorId,
    );
    put(`/quiz/questions/${i}`, [text(q.prompt), ...(q.choices ?? []).map(text), text(q.explanation)].join(" "), quizAnchors);
  }
  for (const [i, card] of (chapter.reviewCards ?? []).entries()) {
    put(`/reviewCards/${i}`, [text(card.front), text(card.back)].join(" "), strings(card.sourceAnchorIds));
  }
  const plan = chapter.implementationPlan;
  if (plan) {
    put("/implementationPlan/title", text(plan.title), strings(plan.titleSourceAnchorIds));
    put("/implementationPlan/coreSkill", text(plan.coreSkill), strings(plan.coreSkillSourceAnchorIds));
    put("/implementationPlan/twentyFourHourChallenge", text(plan.twentyFourHourChallenge), strings(plan.twentyFourHourChallengeSourceAnchorIds));
    put("/implementationPlan/weeklyPractice", text(plan.weeklyPractice), strings(plan.weeklyPracticeSourceAnchorIds));
    for (const [i, it] of plan.ifThenPlans.entries()) put(`/implementationPlan/ifThenPlans/${i}`, [text(it.context), text(it.plan)].join(" "), strings(it.sourceAnchorIds ?? (it.sourceAnchorId ? [it.sourceAnchorId] : [])));
  }
  const summary = {
    unsupportedNumbers: [...new Set(Object.values(paths).flatMap((p) => p.unsupportedNumbers))],
    unsupportedEntities: [...new Set(Object.values(paths).flatMap((p) => p.unsupportedEntities))],
    unsupportedAnchorIds: [...new Set(Object.values(paths).flatMap((p) => p.unsupportedAnchorIds))],
    factCoverage: packet.facts.length === 0 ? 0 : new Set(Object.values(paths).flatMap((p) => p.sourceAnchorIds)).size / Math.max(1, packet.allowedAnchors.length),
  };
  return {
    schemaVersion: EVIDENCE_MAP_SCHEMA_VERSION,
    bookId: normSlug(bookId),
    chapterId: chapter.chapterId,
    chapterNumber: chapter.number,
    sourcePacketHash: canonicalJsonSha256(packet),
    paths,
    summary,
  };
}

export function buildEvidenceMaps(bookId: string, roots: CompilerStoreRoots = {}): EvidenceMapResult {
  const normalized = normSlug(bookId);
  const written: string[] = [];
  const findings: string[] = [];
  for (const chapterNumber of expectedSourceChapters(normalized, { stateRoot: roots.stateRoot })) {
    try {
      const packet = readJsonFile<SourcePacketV1>(sourcePacketPath(normalized, chapterNumber, roots));
      const blueprint = readJsonFile<ChapterBlueprintV1>(blueprintPath(normalized, chapterNumber, roots));
      const chPath = resolve(CHAPTERS_DIR, chapterFileName(blueprint.chapterId));
      if (!existsSync(chPath)) throw new Error(`missing assembled chapter ${chPath}`);
      const chapter = JSON.parse(readFileSync(chPath, "utf8")) as ChapterV21;
      const map = buildEvidenceMap(normalized, chapter, packet, blueprint);
      const out = evidenceMapPath(normalized, chapterNumber, roots);
      writeJsonFile(out, map);
      written.push(out);
    } catch (err) {
      findings.push(`ch${String(chapterNumber).padStart(2, "0")}: ${(err as Error).message}`);
    }
  }
  return { bookId: normalized, written, findings };
}
