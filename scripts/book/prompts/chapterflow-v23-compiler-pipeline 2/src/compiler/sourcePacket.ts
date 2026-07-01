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

/** Chapter-title-stripped, punctuation-normalized signature of a fact's claim, used to
 *  detect the same boilerplate fact restamped across chapters. Removing the chapter title
 *  collapses "Defining Moments depends on ..." and "Thinking in Moments depends on ..." to
 *  the identical shared tail, so a book-thesis fact the researcher pasted into every chapter
 *  groups together while genuinely chapter-specific facts do not. */
function factClaimSignature(claim: string, chapterTitle: string): string {
  let s = (claim || "").toLowerCase();
  const title = (chapterTitle || "").toLowerCase().trim();
  if (title.length >= 3) s = s.split(title).join(" ");
  s = s.replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  return s;
}

/** Book-wide dedup pass: a fact whose title-stripped claim recurs across a majority of
 *  chapters (and at least 3) is boilerplate the researcher stamped onto every chapter —
 *  typically the book thesis. Tagging it bookWideDuplicate keeps it in packet.facts (so the
 *  fact floor and citation-permission list are unchanged) while letting the blueprint dealer
 *  drop it from the TEACHING pool, so no chapter is forced to teach the identical thesis and
 *  the section-gate SEC90 phrase budget is not saturated book-wide. Mutates the packets. */
export function tagBookWideDuplicateFacts(packets: SourcePacketV1[]): void {
  if (packets.length < 3) return;
  const threshold = Math.max(3, Math.ceil(packets.length / 2));
  const chaptersBySignature = new Map<string, Set<number>>();
  for (const p of packets) {
    for (const f of p.facts) {
      const sig = factClaimSignature(f.claim, p.chapterTitle);
      if (!sig) continue;
      let set = chaptersBySignature.get(sig);
      if (!set) { set = new Set(); chaptersBySignature.set(sig, set); }
      set.add(p.chapterNumber);
    }
  }
  for (const p of packets) {
    for (const f of p.facts) {
      const sig = factClaimSignature(f.claim, p.chapterTitle);
      if (sig && (chaptersBySignature.get(sig)?.size ?? 0) >= threshold) f.bookWideDuplicate = true;
    }
  }
}

export function compileSourcePackets(bookId: string, roots: CompilerStoreRoots = {}): CompileSourcePacketsResult {
  const normalized = normSlug(bookId);
  const canonical = readCanonicalChapterIndex(normalized, roots.stateRoot);
  if (!canonical.ok) {
    return { bookId: normalized, written: [], findings: canonical.blockers.map((b) => `${b.checkId}: ${b.message}`) };
  }
  const findings: string[] = [];
  const written: string[] = [];
  // Compile every chapter first, then run the book-wide dedup pass, then write — the pass
  // needs all chapters' facts in hand to spot a claim restamped across the book.
  const compiled: Array<{ packet: SourcePacketV1; path: string }> = [];
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
    compiled.push({ packet, path: sourcePacketPath(normalized, chapter.chapterNumber, roots) });
  }
  tagBookWideDuplicateFacts(compiled.map((c) => c.packet));
  for (const { packet, path } of compiled) {
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
