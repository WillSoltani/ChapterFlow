/**
 * Book-level repetition checks for repeated exemplars and venues.
 */

import { readFileSync } from "fs";

import { ChapterV21, CriticFinding } from "../types.js";
import { extractExemplarCandidatesFromText, normalizeExemplarCandidate } from "../librarian/exemplarPlan.js";
import { findSourceSidecar } from "../librarian/sourceSidecars.js";
import { loadVenuePalette } from "../librarian/venuePlan.js";
import { finding, truncate } from "./shared.js";
import { normalizeSurfaceFrame } from "./bookPatternAudit.js";

/** A book-level finding that names the offending chapters structurally (not just
 *  in prose) so the write-orchestrator barrier can re-dispatch exactly those. */
export type BookRepetitionFinding = CriticFinding & { chapters: number[] };

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
        "BP26.exemplar_chapter_reuse",
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
        "BP27.venue_stamping",
        "major",
        `venue "${venue}" appears as an example setting in ${chaptersWithHit.length} chapters (${chaptersWithHit.map((n) => `ch${n}`).join(", ")}). No venue should anchor more than two chapters in a book.`,
        truncate(chaptersWithHit.map((n) => `ch${n}`).join(", "), 180),
      ),
    );
  }
  return findings;
}

// ── BP28 — review-card callback-frame reuse (the `repeated_unit` sweep family) ─
//
// The spaced-recall cards across a book collapse onto ONE concept+question
// shell with only the object swapped — the-daily-stoic shipped "How does
// January's control filter help with X?" in 6 chapters. normalizeSurfaceFrame
// strips names/numbers/stopwords, so the shared scaffold surfaces as a content
// n-gram (e.g. "control filter help"). We flag a content n-gram of length
// CALLBACK_NGRAM_LEN that recurs in review-card fronts across > 2 chapters.
//
// SHADOW major (surfaces, does not block the gate `passed`): a callback-frame is
// semantic-adjacent, so it is calibrated to ZERO on the clean corpus before any
// promotion to blocker (the SC9-reversal caution). callbackPlan prevents it at
// the deal; this catches a residual and names the chapters for re-dispatch.
const CALLBACK_NGRAM_LEN = 3;
// Calibrated against the clean corpus: generic phrase fragments recur in up to
// ~25% of a book's cards (the-year-of-less "rather than merely" 3/12; stillness
// "warning sign shows" 4/32), while a genuinely reused callback unit
// (the-daily-stoic "control filter help") spans 5/12 = 42%. Fire only at
// >= 40% of chapters AND an absolute floor of 4 — zero on the clean corpus,
// true-positive on the-daily-stoic. Mirrors the deal-cap<gate ordering
// (callbackPlan keeps any recall frame under 0.40 by construction).
const CALLBACK_MIN_CHAPTERS = 4;
const CALLBACK_MIN_FRACTION = 0.4;

function reviewCardFronts(chapter: ChapterV21): string[] {
  return (chapter.reviewCards ?? []).map((c) => c?.front ?? "").filter(Boolean);
}

export function checkBookCallbackFrameReuse(chapters: ChapterV21[]): BookRepetitionFinding[] {
  // Map each normalized content n-gram (from review-card fronts) → set of
  // chapters whose fronts contain it. Count an n-gram once per chapter.
  const ngramChapters = new Map<string, Set<number>>();
  for (const ch of chapters) {
    const seenInChapter = new Set<string>();
    for (const front of reviewCardFronts(ch)) {
      const tokens = normalizeSurfaceFrame(front);
      for (let i = 0; i + CALLBACK_NGRAM_LEN <= tokens.length; i++) {
        const gram = tokens.slice(i, i + CALLBACK_NGRAM_LEN).join(" ");
        if (seenInChapter.has(gram)) continue;
        seenInChapter.add(gram);
        if (!ngramChapters.has(gram)) ngramChapters.set(gram, new Set());
        ngramChapters.get(gram)!.add(ch.number);
      }
    }
  }
  // Collect offending n-grams, then dedupe: many overlapping grams
  // ("control filter help", "filter help plan") describe ONE defect. Emit the
  // longest-spanning grams and skip any whose chapter set is a subset of one
  // already emitted.
  const N = Math.max(1, chapters.length);
  const offenders = [...ngramChapters.entries()]
    .map(([gram, set]) => ({ gram, chs: [...set].sort((a, b) => a - b) }))
    .filter((o) => o.chs.length >= CALLBACK_MIN_CHAPTERS && o.chs.length / N >= CALLBACK_MIN_FRACTION)
    .sort((a, b) => b.chs.length - a.chs.length || a.gram.localeCompare(b.gram));

  const findings: BookRepetitionFinding[] = [];
  const emitted: Array<Set<number>> = [];
  for (const o of offenders) {
    const chSet = new Set(o.chs);
    if (emitted.some((e) => [...chSet].every((c) => e.has(c)))) continue;
    emitted.push(chSet);
    findings.push({
      ...finding(
        "BP28.callback_frame_reuse",
        "major",
        `review-card callback frame "${o.gram}" recurs across ${o.chs.length} chapters (${o.chs.map((n) => `ch${n}`).join(", ")}). The spaced-recall cards reuse one concept+question shell with only the object swapped. Give each chapter a distinct prior-chapter callback and a distinct question frame (callbackPlan).`,
        o.gram,
      ),
      chapters: o.chs,
    });
  }
  return findings;
}

// ── BP29 — try-now timing-anchor stamping (the `location_stamping` sweep family) ─
//
// The 24-hour action reuses one arbitrary clock stamp across chapters — the-
// daily-stoic scheduled "tomorrow at 9:10 a.m." in ch04/ch07/ch10. The clean
// corpus uses zero clock stamps in try-now fields, so a repeated clock time is
// lexically unambiguous: we scan ONLY the try-now fields (examples have their
// own time/place gates) and flag a clock stamp reused across > 2 chapters.
// Match a clock time with a meridiem in any common form (9:10 a.m. / 9:10am /
// 9:10 AM / 9:10 p.m.). NO trailing \b — it would fail after the "." in "a.m."
// when followed by a comma (the bug that hid the-daily-stoic's 9:10 a.m.). A
// negative letter-lookahead instead, so "9:10 ambient" can't match.
const TIMING_CLOCK_RE = /\b\d{1,2}:\d{2}\s*(?:a\.?m\.?|p\.?m\.?)(?![a-z])/gi;
const TIMING_MIN_CHAPTERS = 3;

function tryNowText(chapter: ChapterV21): string {
  return [chapter.tryThisNow ?? "", chapter.implementationPlan?.twentyFourHourChallenge ?? ""]
    .filter(Boolean)
    .join("\n");
}

export function checkBookTimingAnchorStamping(chapters: ChapterV21[]): BookRepetitionFinding[] {
  const clockChapters = new Map<string, Set<number>>();
  for (const ch of chapters) {
    const seenInChapter = new Set<string>();
    for (const m of tryNowText(ch).matchAll(TIMING_CLOCK_RE)) {
      const clock = m[0].toLowerCase().replace(/[\s.]/g, ""); // "9:10 a.m." & "9:10am" → "9:10am"
      if (seenInChapter.has(clock)) continue;
      seenInChapter.add(clock);
      if (!clockChapters.has(clock)) clockChapters.set(clock, new Set());
      clockChapters.get(clock)!.add(ch.number);
    }
  }
  const findings: BookRepetitionFinding[] = [];
  for (const [clock, chSet] of clockChapters) {
    if (chSet.size < TIMING_MIN_CHAPTERS) continue;
    const chs = [...chSet].sort((a, b) => a - b);
    findings.push({
      ...finding(
        "BP29.timing_anchor_stamping",
        "major",
        `try-this-now action reuses the clock stamp "${clock}" across ${chs.length} chapters (${chs.map((n) => `ch${n}`).join(", ")}). Repeated arbitrary clock times read as templated. Anchor each action to a situational trigger, not a fixed clock time (timingPlan).`,
        clock,
      ),
      chapters: chs,
    });
  }
  return findings;
}
