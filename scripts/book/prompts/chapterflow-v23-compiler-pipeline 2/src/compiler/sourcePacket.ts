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
import type { SourcePacketFact, SourcePacketV1, SourcePacketCase, SourcePacketFramework } from "../artifacts/artifactTypes.js";
import { SOURCE_PACKET_SCHEMA_VERSION } from "../artifacts/artifactTypes.js";
import type { SourceClaimType } from "../types.js";

const CLAIM_TYPES: SourceClaimType[] = ["core_move", "breakdown_claim", "example", "quiz_prompt", "quiz_key_evidence", "quiz_explanation", "review_card", "implementation_guidance", "takeaway"];

const NUMBER_WORDS: Record<string, string> = {
  zero: "0", one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9", ten: "10",
  eleven: "11", twelve: "12", thirteen: "13", fourteen: "14", fifteen: "15", sixteen: "16", seventeen: "17", eighteen: "18", nineteen: "19", twenty: "20",
  thirty: "30", forty: "40", fifty: "50", sixty: "60", seventy: "70", eighty: "80", ninety: "90", hundred: "100", thousand: "1000", million: "1000000",
};

export type CompileSourcePacketsResult = {
  bookId: string;
  written: string[];
  findings: string[];
};

function uniq(values: Iterable<string>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of values) {
    const v = raw.trim();
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

export function extractGroundedNumbers(text: string): string[] {
  const numbers = new Set<string>();
  for (const m of text.matchAll(/\b\d+(?:[.,]\d+)?\b/g)) numbers.add(m[0].replace(/,/g, ""));
  for (const m of text.toLowerCase().matchAll(/\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million)\b/g)) {
    numbers.add(NUMBER_WORDS[m[1]] ?? m[1]);
  }
  return [...numbers].sort((a, b) => Number(a) - Number(b));
}

function properNounTokens(text: string): string[] {
  const stop = new Set(["The", "A", "An", "If", "When", "Because", "This", "That", "Chapter", "Book"]);
  const out: string[] = [];
  for (const m of text.matchAll(/\b[A-Z][A-Za-z0-9&.'-]*(?:\s+[A-Z][A-Za-z0-9&.'-]*){0,4}\b/g)) {
    const token = m[0].trim();
    if (token.length < 3 || stop.has(token)) continue;
    out.push(token);
  }
  return uniq(out).slice(0, 80);
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizedFact(raw: any, fallbackId: string): SourcePacketFact | null {
  const id = asText(raw?.id) || fallbackId;
  const claim = asText(raw?.claim);
  if (!claim) return null;
  const mechanism = asText(raw?.becauseMechanism) || asText(raw?.mechanism) || "This fact supplies the source-grounded reason the chapter can teach the move.";
  const commonError = asText(raw?.commonError) || "The reader treats the claim as a vague slogan instead of applying the mechanism.";
  const whyWrong = asText(raw?.errorIsWhy) || asText(raw?.whyWrong) || "The mechanism, not the slogan, is what makes the lesson transfer.";
  const text = [claim, mechanism, commonError, whyWrong].join(" ");
  return {
    id,
    claim,
    mechanism,
    commonError,
    whyWrong,
    allowedClaimTypes: CLAIM_TYPES,
    groundedNumbers: extractGroundedNumbers(text),
    groundedEntities: properNounTokens(text),
    groundedPlaces: [],
    verificationRefs: [id],
    replicationStatus: raw?.replicationStatus,
  };
}

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
  const facts = (Array.isArray(sidecar.testableFacts) ? sidecar.testableFacts : [])
    .map((f, i) => normalizedFact(f, `ch${String(chapter.chapterNumber).padStart(2, "0")}.fact.${i + 1}`))
    .filter((f): f is SourcePacketFact => !!f);
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
  // The v23 blueprint always reserves exactly 9 quiz slots (chapterBlueprint.ts quizCount).
  // With fewer than 9 facts, requiredFactIds get reused across quiz questions, which trips
  // downstream quiz-similarity gates. SP3 already hard-floors at 6 facts; 6-8 facts clears
  // that floor but is still genuinely insufficient for the fixed 9-question quiz, so it is
  // the one status that must reach SP13 as a blocker.
  const status: SourcePacketV1["sourceQuality"]["status"] =
    facts.length < 6 ? "thin" : facts.length < 9 ? "blocked" : namedCases.length >= 2 ? "strong" : "adequate";
  const risks: string[] = [];
  if (facts.length < 9) risks.push(`only ${facts.length} testable fact(s); the v23 blueprint always builds a 9-slot quiz, so fewer than 9 facts forces requiredFactIds reuse across quiz questions`);
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
