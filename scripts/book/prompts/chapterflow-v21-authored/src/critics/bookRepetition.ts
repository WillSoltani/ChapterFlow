/**
 * Book-level repetition checks for repeated exemplars and venues.
 */

import { readFileSync } from "fs";

import { ChapterV21, CriticFinding } from "../types.js";
import { extractExemplarCandidatesFromText, normalizeExemplarCandidate } from "../librarian/exemplarPlan.js";
import { findSourceSidecar } from "../librarian/sourceSidecars.js";
import { loadVenuePalette } from "../librarian/venuePlan.js";
import { finding, truncate } from "./shared.js";

type ChapterHit = {
  chapter: number;
  evidence: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function chapterTextForExemplars(chapter: ChapterV21): string {
  const parts = [
    chapter.breakdown?.fastRead ?? "",
    chapter.breakdown?.deepRead ?? "",
    chapter.breakdown?.fullRead ?? "",
  ];
  for (const ex of chapter.examples ?? []) {
    parts.push(ex.title ?? "", ex.scenario ?? "", ex.whatToDo ?? "", ex.whyItMatters ?? "");
  }
  return parts.filter(Boolean).join("\n");
}

function sidecarWhitelistTerms(bookId: string, chapters: ChapterV21[]): Set<string> {
  const whitelist = new Set<string>();
  for (const chapter of chapters) {
    const path = findSourceSidecar(bookId, chapter.number);
    if (!path) {
      console.warn(`BP26: no source sidecar for "${bookId}" ch${String(chapter.number).padStart(2, "0")}; framework whitelist is empty for this chapter.`);
      continue;
    }
    let sidecar: unknown;
    try {
      sidecar = JSON.parse(readFileSync(path, "utf8"));
    } catch (err) {
      console.warn(`BP26: unreadable source sidecar for "${bookId}" ch${String(chapter.number).padStart(2, "0")}: ${(err as Error).message}`);
      continue;
    }
    if (!isRecord(sidecar)) continue;
    const centralConcept = sidecar.centralConcept;
    if (isRecord(centralConcept) && typeof centralConcept.name === "string") {
      whitelist.add(normalizeExemplarCandidate(centralConcept.name));
    }
    if (Array.isArray(sidecar.frameworks)) {
      for (const framework of sidecar.frameworks) {
        if (!isRecord(framework)) continue;
        if (typeof framework.name === "string") whitelist.add(normalizeExemplarCandidate(framework.name));
        if (Array.isArray(framework.members)) {
          for (const member of framework.members) {
            if (typeof member === "string") whitelist.add(normalizeExemplarCandidate(member));
          }
        }
      }
    }
  }
  whitelist.delete("");
  return whitelist;
}

export function checkBookExemplarChapterReuse(bookId: string, chapters: ChapterV21[]): CriticFinding[] {
  const whitelist = sidecarWhitelistTerms(bookId, chapters);
  const byCandidate = new Map<string, { display: string; hits: ChapterHit[] }>();

  for (const chapter of chapters) {
    const text = chapterTextForExemplars(chapter);
    const seenInChapter = new Set<string>();
    for (const display of extractExemplarCandidatesFromText(text)) {
      const key = normalizeExemplarCandidate(display);
      if (!key || whitelist.has(key) || seenInChapter.has(key)) continue;
      seenInChapter.add(key);
      const record = byCandidate.get(key) ?? { display, hits: [] };
      record.hits.push({ chapter: chapter.number, evidence: display });
      byCandidate.set(key, record);
    }
  }

  const findings: CriticFinding[] = [];
  for (const record of byCandidate.values()) {
    const chaptersWithHit = [...new Set(record.hits.map((hit) => hit.chapter))].sort((a, b) => a - b);
    if (chaptersWithHit.length < 2) continue;
    findings.push(
      finding(
        "BP26.exemplar_chapter_reuse" as any,
        "minor",
        `marquee exemplar/proper noun "${record.display}" appears in ${chaptersWithHit.length} chapters (${chaptersWithHit.map((n) => `ch${n}`).join(", ")}). Deal it to one chapter as a teaching unit; other chapters may mention it only in passing.`,
        record.hits.slice(0, 6).map((hit) => `ch${hit.chapter}: ${hit.evidence}`).join("; "),
      ),
    );
  }
  return findings;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function venueAliases(): Map<string, RegExp[]> {
  const venues = [...loadVenuePalette(), "kitchen table", "conference room", "break room"];
  const aliases = new Map<string, RegExp[]>();
  for (const rawVenue of venues) {
    const venue = rawVenue.trim().toLowerCase();
    if (!venue) continue;
    const variants = new Set<string>([venue, venue.replace(/^(a|an)\s+/, "")]);
    aliases.set(
      venue.replace(/^(a|an)\s+/, ""),
      Array.from(variants).map((variant) => new RegExp(`\\b${escapeRegex(variant)}\\b`, "i")),
    );
  }
  return aliases;
}

function chapterExampleText(chapter: ChapterV21): string {
  const parts: string[] = [];
  for (const ex of chapter.examples ?? []) {
    parts.push(ex.title ?? "", ex.scenario ?? "", ex.whatToDo ?? "", ex.whyItMatters ?? "");
  }
  return parts.join("\n");
}

export function checkBookVenueStamping(chapters: ChapterV21[]): CriticFinding[] {
  const aliases = venueAliases();
  const byVenue = new Map<string, ChapterHit[]>();
  for (const chapter of chapters) {
    const text = chapterExampleText(chapter);
    for (const [venue, patterns] of aliases) {
      const matched = patterns.some((pattern) => pattern.test(text));
      if (!matched) continue;
      const hits = byVenue.get(venue) ?? [];
      hits.push({ chapter: chapter.number, evidence: venue });
      byVenue.set(venue, hits);
    }
  }

  const findings: CriticFinding[] = [];
  for (const [venue, hits] of byVenue) {
    const chaptersWithHit = [...new Set(hits.map((hit) => hit.chapter))].sort((a, b) => a - b);
    if (chaptersWithHit.length <= 2) continue;
    findings.push(
      finding(
        "BP27.venue_stamping" as any,
        "major",
        `venue "${venue}" appears as an example setting in ${chaptersWithHit.length} chapters (${chaptersWithHit.map((n) => `ch${n}`).join(", ")}). No venue should anchor more than two chapters in a book.`,
        truncate(chaptersWithHit.map((n) => `ch${n}`).join(", "), 180),
      ),
    );
  }
  return findings;
}
