/**
 * Book-level gate. Runs AFTER all chapters of a book have been generated and
 * each has individually ship-gated. Catches issues that only show up at the
 * book level:
 *   - Cumulative answer-position drift across the whole book
 *   - Protagonist names duplicated between chapters
 *   - Hook/key-takeaway/title accidental duplication across chapters
 *
 * Returns a report. Whether the book ships is the caller's policy decision.
 */

import { ChapterV21 } from "../types.js";
import { extractNamesFromText } from "../librarian/libraryState.js";

export type BookGateFinding = {
  catalogId: string;            // F1, F3, etc. (from FAILURE-MODES.md)
  severity: "blocker" | "major" | "minor";
  message: string;
  evidence?: string;
};

export type BookGateReport = {
  bookId: string;
  chapterCount: number;
  passed: boolean;
  findings: BookGateFinding[];
  stats: {
    answerPositionCounts: [number, number, number];
    answerPositionPctMax: number;
    totalQuizQuestions: number;
    duplicatedNames: Array<{ name: string; chapters: number[] }>;
    duplicatedHookOpeners: Array<{ opener: string; chapters: number[] }>;
    schemaInconsistencies: Array<{ field: string; presentInChapters: number[]; missingInChapters: number[] }>;
  };
};

const ANSWER_POSITION_MAX_FRAC = 0.45;  // book-wide ceiling for any one position

/**
 * Top-level fields whose presence should be consistent across every chapter
 * in a book. If ≥80% of chapters have one but some don't, it's almost
 * always a cache-skip regression: the field was added by a later pipeline
 * version (a new agent, a schema bump) and chapters generated before that
 * change auto-resumed from cache without ever getting re-touched. The gate
 * blocks promotion until the missing chapters are backfilled.
 */
const SCHEMA_CONSISTENCY_FIELDS = [
  "hook",
  "counterintuition",
  "keyTakeaway",
  "memorableLines",
  "tryThisNow",
  "reflectionBefore",
  "reflectionAfter",
] as const;
const SCHEMA_CONSISTENCY_THRESHOLD = 0.8;

function isFieldPresent(chapter: any, field: string): boolean {
  const value = chapter[field];
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

export function runBookGate(bookId: string, chapters: ChapterV21[]): BookGateReport {
  const findings: BookGateFinding[] = [];

  // ── Cumulative answer-position balance (F3 / A4 escalated to book level) ─
  const positionCounts: [number, number, number] = [0, 0, 0];
  let totalQ = 0;
  for (const ch of chapters) {
    for (const q of ch.quiz.questions) {
      if (q.correctIndex === 0 || q.correctIndex === 1 || q.correctIndex === 2) {
        positionCounts[q.correctIndex] += 1;
        totalQ += 1;
      }
    }
  }
  const maxFrac = totalQ > 0 ? Math.max(...positionCounts) / totalQ : 0;
  if (maxFrac > ANSWER_POSITION_MAX_FRAC) {
    const dominant = positionCounts.indexOf(Math.max(...positionCounts));
    findings.push({
      catalogId: "F3",
      severity: "major",
      message: `Book-wide answer position drift: idx ${dominant} wins ${(maxFrac * 100).toFixed(0)}% of ${totalQ} questions (ceiling ${(ANSWER_POSITION_MAX_FRAC * 100).toFixed(0)}%). Quiz balance fix needed.`,
    });
  }

  // ── Within-book name duplication (F1 escalated to book level) ────────────
  const nameToChapters = new Map<string, Set<number>>();
  for (const ch of chapters) {
    const chapterNames = new Set<string>();
    for (const ex of ch.examples) {
      for (const n of extractNamesFromText(ex.scenario)) {
        chapterNames.add(n);
      }
    }
    for (const n of chapterNames) {
      if (!nameToChapters.has(n)) nameToChapters.set(n, new Set());
      nameToChapters.get(n)!.add(ch.number);
    }
  }
  const duplicatedNames: Array<{ name: string; chapters: number[] }> = [];
  for (const [name, chSet] of nameToChapters) {
    if (chSet.size > 1) {
      duplicatedNames.push({ name, chapters: Array.from(chSet).sort((a, b) => a - b) });
    }
  }
  if (duplicatedNames.length > 0) {
    findings.push({
      catalogId: "F1",
      severity: "major",
      message: `${duplicatedNames.length} protagonist name(s) appear in multiple chapters: ${duplicatedNames.slice(0, 5).map((d) => `${d.name}(ch${d.chapters.join(",")})`).join(", ")}${duplicatedNames.length > 5 ? ", …" : ""}`,
    });
  }

  // ── Hook/title accidental duplication ────────────────────────────────────
  const hookOpeners = new Map<string, number[]>();
  for (const ch of chapters) {
    if (!ch.hook) continue;
    const opener = ch.hook.split(/[.!?]/)[0]?.trim().toLowerCase().slice(0, 50);
    if (!opener) continue;
    if (!hookOpeners.has(opener)) hookOpeners.set(opener, []);
    hookOpeners.get(opener)!.push(ch.number);
  }
  const duplicatedHookOpeners: Array<{ opener: string; chapters: number[] }> = [];
  for (const [opener, chs] of hookOpeners) {
    if (chs.length > 1) {
      duplicatedHookOpeners.push({ opener, chapters: chs });
      findings.push({
        catalogId: "B6",
        severity: "minor",
        message: `Multiple chapters open hook with same 50-char prefix "${opener}": chapters ${chs.join(", ")}`,
      });
    }
  }

  // ── Voice charter sanity: every breakdown should sound like the book ─────
  // Crude check: average sentence length variance across chapters. If one
  // chapter is wildly different from the others, voice has drifted.
  // (Optional, advisory only.)
  const avgSentLen = chapters.map((ch) => {
    const text = ch.breakdown.deepRead;
    const sents = text.split(/(?<=[.!?])\s+/).filter(Boolean);
    const words = text.match(/\b[A-Za-z'-]+\b/g) ?? [];
    return sents.length ? words.length / sents.length : 0;
  });
  if (avgSentLen.length >= 3) {
    const mean = avgSentLen.reduce((a, b) => a + b, 0) / avgSentLen.length;
    for (let i = 0; i < avgSentLen.length; i++) {
      if (Math.abs(avgSentLen[i] - mean) > 7) {
        findings.push({
          catalogId: "B6",
          severity: "minor",
          message: `Chapter ${chapters[i].number} sentence-length avg (${avgSentLen[i].toFixed(1)}) deviates >7 words from book mean (${mean.toFixed(1)}). Possible voice drift.`,
        });
      }
    }
  }

  // ── Schema completeness (A10): catch cache-skip regressions ─────────────
  // If a field is present on ≥80% of chapters but absent on others, the
  // missing ones are almost certainly stale cache artifacts from a pipeline
  // version that pre-dates the field's introduction. Block promotion so the
  // operator backfills before shipping a structurally inconsistent book.
  const schemaInconsistencies: Array<{ field: string; presentInChapters: number[]; missingInChapters: number[] }> = [];
  for (const field of SCHEMA_CONSISTENCY_FIELDS) {
    const present: number[] = [];
    const missing: number[] = [];
    for (const ch of chapters) {
      if (isFieldPresent(ch as any, field)) present.push(ch.number);
      else missing.push(ch.number);
    }
    if (chapters.length === 0 || missing.length === 0) continue;
    const frac = present.length / chapters.length;
    if (frac >= SCHEMA_CONSISTENCY_THRESHOLD) {
      schemaInconsistencies.push({ field, presentInChapters: present, missingInChapters: missing });
      findings.push({
        catalogId: "A10",
        severity: "blocker",
        message: `Schema inconsistency: "${field}" present on ${present.length}/${chapters.length} chapters but missing on ${missing.length} (chapters ${missing.join(", ")}). Likely cache-skip regression. Backfill before shipping.`,
      });
    }
  }

  const blockers = findings.filter((f) => f.severity === "blocker");
  return {
    bookId,
    chapterCount: chapters.length,
    passed: blockers.length === 0,
    findings,
    stats: {
      answerPositionCounts: positionCounts,
      answerPositionPctMax: maxFrac,
      totalQuizQuestions: totalQ,
      duplicatedNames,
      duplicatedHookOpeners,
      schemaInconsistencies,
    },
  };
}

export function formatBookGateReport(rep: BookGateReport): string {
  const lines: string[] = [];
  lines.push(`Book gate: ${rep.passed ? "PASS" : "BLOCK"} (${rep.bookId}, ${rep.chapterCount} chapters)`);
  lines.push(`  Quiz answer positions: ${rep.stats.answerPositionCounts.join(" / ")} (max ${(rep.stats.answerPositionPctMax * 100).toFixed(1)}%)`);
  lines.push(`  Cross-chapter name duplications: ${rep.stats.duplicatedNames.length}`);
  lines.push(`  Hook-opener duplications: ${rep.stats.duplicatedHookOpeners.length}`);
  if (rep.findings.length === 0) {
    lines.push(`  No findings.`);
  } else {
    lines.push(`  Findings:`);
    for (const f of rep.findings) {
      lines.push(`    [${f.catalogId} ${f.severity}] ${f.message}`);
    }
  }
  return lines.join("\n");
}
