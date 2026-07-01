import { createHash } from "crypto";
import { existsSync, readFileSync } from "fs";

import type { ChapterSpec } from "../generateChapter.js";
import { loadCanonicalChapterIndex, readCanonicalChapterIndex } from "../lib/chapterSet.js";
import { normSlug } from "../lib/chapterPaths.js";
import { sourceHashFor, sourceSidecarPathFor, loadSourceV2Sidecar } from "../qc/sourceV2Gate.js";
import type { SourceSidecarV2 } from "../source/sidecarSchema.js";
import { buildSourceAnchorCatalog } from "../source/sourceEvidence.js";
import { canonicalJsonSha256 } from "../lib/canonicalJson.js";
import {
  sourcePacketPath,
  writeJsonFile,
  type CompilerStoreRoots,
} from "../artifacts/artifactStore.js";
import type { SourcePacketV1, SourcePacketCase, SourcePacketFramework } from "../artifacts/artifactTypes.js";
import { SOURCE_PACKET_SCHEMA_VERSION } from "../artifacts/artifactTypes.js";
import { REQUIRED_QUIZ_FACT_FLOOR, asText, compiledFactsFromSidecar, extractGroundedNumbers, properNounTokens, uniq } from "./sourcePacketFacts.js";

export { extractGroundedNumbers, REQUIRED_QUIZ_FACT_FLOOR };

export type CompileSourcePacketsResult = {
  bookId: string;
  written: string[];
  findings: string[];
};

function normalizedCase(raw: any, fallbackId: string): SourcePacketCase | null {
  const id = asText(raw?.id) || fallbackId;
  const label = asText(raw?.label) || id;
  const summary = asText(raw?.summary);
  const hardSpecifics = Array.isArray(raw?.hardSpecifics) ? raw.hardSpecifics.map(asText).filter(Boolean) : [];
  if (!label && !summary && hardSpecifics.length === 0) return null;
  const joined = [label, summary, hardSpecifics.join("; ")].join(" ");
  const restamp = hardSpecifics.filter((s: string) => /\b\d{4}\b|\b[A-Z][a-z]+,\s+[A-Z][a-z]+\b|\b(?:hospital|company|university|city|state|county|province)s?\b/i.test(s));
  return {
    id,
    label,
    summary,
    realWorld: raw?.realWorld !== false,
    naturalSetting: properNounTokens(joined)[0],
    hardSpecifics,
    allowedUses: ["example", "breakdown_claim", "quiz_prompt", "quiz_key_evidence", "review_card", "implementation_guidance"],
    forbiddenUses: ["Do not invent dialogue, participants, dates, outcomes, or quantified effects not present in hardSpecifics or testableFacts."],
    doNotRestamp: restamp,
  };
}

function normalizedFramework(raw: any, i: number): SourcePacketFramework | null {
  const name = asText(raw?.name);
  const members = Array.isArray(raw?.members) ? raw.members.map(asText).filter(Boolean) : [];
  if (!name || members.length === 0) return null;
  return { id: `framework.${i + 1}`, name, members, completenessRequired: true };
}

export function compileSourcePacketFromSidecar(args: {
  bookId: string;
  chapter: ChapterSpec;
  sidecar: SourceSidecarV2;
  sidecarPath?: string | null;
  sourceHash?: string | null;
}): SourcePacketV1 {
  const { bookId, chapter, sidecar } = args;
  const facts = compiledFactsFromSidecar(sidecar, chapter.chapterNumber);
  const namedCases = (Array.isArray(sidecar.namedExamples) ? sidecar.namedExamples : [])
    .map((ex, i) => normalizedCase(ex, `ch${String(chapter.chapterNumber).padStart(2, "0")}.case.${i + 1}`))
    .filter((c): c is SourcePacketCase => !!c);
  const frameworks = (Array.isArray(sidecar.frameworks) ? sidecar.frameworks : [])
    .map(normalizedFramework)
    .filter((fw): fw is SourcePacketFramework => !!fw);
  const joined = JSON.stringify(sidecar);
  const allowedNumbers = uniq([
    ...facts.flatMap((f) => f.groundedNumbers),
    ...namedCases.flatMap((c) => extractGroundedNumbers([c.label, c.summary, ...c.hardSpecifics].join(" "))),
  ]);
  const allowedEntities = uniq([
    ...properNounTokens(joined),
    ...namedCases.map((c) => c.label),
  ]).slice(0, 100);
  const anchors = buildSourceAnchorCatalog(sidecar as any);
  // The v23 blueprint always reserves exactly REQUIRED_QUIZ_FACT_FLOOR quiz slots
  // (chapterBlueprint.ts quizCount). With fewer facts, requiredFactIds get reused
  // across quiz questions, which trips downstream quiz-similarity gates. SP3 already
  // hard-floors at 6 facts; 6 to (REQUIRED_QUIZ_FACT_FLOOR - 1) facts clears that floor
  // but is still genuinely insufficient for the fixed-size quiz, so it is the one status
  // that must reach SP13 as a blocker. checkSourceV2PrewriteGate applies this same floor
  // earlier, before writer fanout, so a thin sidecar triggers re-research instead.
  const status: SourcePacketV1["sourceQuality"]["status"] =
    facts.length < 6 ? "thin" : facts.length < REQUIRED_QUIZ_FACT_FLOOR ? "blocked" : namedCases.length >= 2 ? "strong" : "adequate";
  const risks: string[] = [];
  if (facts.length < REQUIRED_QUIZ_FACT_FLOOR) risks.push(`only ${facts.length} testable fact(s); the v23 blueprint always builds a ${REQUIRED_QUIZ_FACT_FLOOR}-slot quiz, so fewer than ${REQUIRED_QUIZ_FACT_FLOOR} facts forces requiredFactIds reuse across quiz questions`);
  for (const c of namedCases) {
    if (c.realWorld && c.hardSpecifics.length < 2) risks.push(`namedCase ${c.id} "${c.label}" has fewer than two hardSpecifics`);
  }
  const packet: SourcePacketV1 = {
    schemaVersion: SOURCE_PACKET_SCHEMA_VERSION,
    bookId: normSlug(bookId),
    chapterId: chapter.chapterId,
    chapterNumber: chapter.chapterNumber,
    chapterTitle: chapter.chapterTitle,
    sourceSidecarPath: args.sidecarPath ?? null,
    sourceHash: args.sourceHash ?? null,
    facts,
    namedCases,
    frameworks,
    allowedAnchors: anchors,
    allowedNumbers,
    allowedEntities,
    allowedPlaces: [],
    forbiddenClaims: [
      "Do not claim guaranteed outcomes, exact score changes, or quantified effects unless a fact or hardSpecific explicitly states the number.",
      "Do not cast invented people as research subjects, participants, patients, or customers in a real case.",
    ],
    forbiddenLeakage: namedCases.map((c) => ({ into: c.id, warning: `Keep examples about ${c.label} source-local; do not import sibling chapter imagery or stakes.` })),
    sourceQuality: { status, risks },
  };
  return packet;
}

export function sourcePacketHash(packet: SourcePacketV1): string {
  return canonicalJsonSha256(packet);
}

export function compileSourcePackets(bookId: string, roots: CompilerStoreRoots = {}): CompileSourcePacketsResult {
  const normalized = normSlug(bookId);
  const canonical = readCanonicalChapterIndex(normalized, roots.stateRoot);
  if (!canonical.ok) {
    return { bookId: normalized, written: [], findings: canonical.blockers.map((b) => `${b.checkId}: ${b.message}`) };
  }
  const findings: string[] = [];
  const written: string[] = [];
  for (const chapter of canonical.chapters) {
    const sidecar = loadSourceV2Sidecar(normalized, chapter.chapterNumber) as SourceSidecarV2 | null;
    const sidecarPath = sourceSidecarPathFor(normalized, chapter.chapterNumber);
    if (!sidecar || !sidecarPath || !existsSync(sidecarPath)) {
      findings.push(`ch${String(chapter.chapterNumber).padStart(2, "0")}: missing validated source-v2 sidecar`);
      continue;
    }
    const packet = compileSourcePacketFromSidecar({
      bookId: normalized,
      chapter,
      sidecar,
      sidecarPath,
      sourceHash: sourceHashFor(normalized, chapter.chapterNumber),
    });
    const path = sourcePacketPath(normalized, chapter.chapterNumber, roots);
    writeJsonFile(path, packet);
    written.push(path);
  }
  return { bookId: normalized, written, findings };
}

export function parseChapterNumberFromArtifactPath(path: string): number | null {
  const m = path.match(/ch(\d{1,3})\./i) ?? path.match(/ch(\d{1,3})\//i);
  return m ? Number(m[1]) : null;
}

export function quickHash(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex").slice(0, 16);
}
