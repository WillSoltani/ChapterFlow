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
import { BookPatternAuditReport, runBookPatternAudit } from "./bookPatternAudit.js";
import {
  checkBookQuizCrossChapterDuplicates,
  checkBookQuizNgramTemplates,
} from "./quizQuality.js";
import { checkBookQuizPromptTemplates } from "./antiSalting.js";
import { loadBannedPhrases } from "./shared.js";
import {
  checkBookActionContainerReuse,
  checkBookCallbackFrameReuse,
  checkBookExemplarChapterReuse,
  checkBookTimingAnchorStamping,
  checkBookVenueStamping,
} from "./bookRepetition.js";

export type BookGateFinding = {
  catalogId: string;            // F1, F3, etc. (from FAILURE-MODES.md)
  severity: "blocker" | "major" | "minor";
  message: string;
  evidence?: string;
  /** Offending chapters, when the finding is chapter-scoped — lets the write-
   *  orchestrator barrier re-dispatch exactly those chapters. Absent for
   *  book-wide findings (e.g. F3 answer-position drift). */
  chapters?: number[];
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
    patternAudit: BookPatternAuditReport;
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
  // A "real protagonist" appears at least twice in the same chapter's examples
  // (a vet named "Anika" introduced once and referred to again in the same
  // scenario). One-off capitalized words like "Nobody", "Third", "Street" only
  // appear once and get filtered out as places / function words. This keeps
  // the duplication check from drowning in false positives — which is what
  // let real recurrences slip past the operator on the HWF run.
  const nameToChapters = new Map<string, Set<number>>();
  for (const ch of chapters) {
    const recurring = new Set<string>();
    for (const ex of ch.examples) {
      const counts = new Map<string, number>();
      for (const n of extractNamesFromText(ex.scenario)) {
        counts.set(n, (counts.get(n) ?? 0) + 1);
      }
      for (const [name, c] of counts) {
        if (c >= 2) recurring.add(name);
      }
    }
    for (const n of recurring) {
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
      severity: "blocker",
      message: `${duplicatedNames.length} protagonist name(s) appear as named characters in multiple chapters: ${duplicatedNames.slice(0, 5).map((d) => `${d.name}(ch${d.chapters.join(",")})`).join(", ")}${duplicatedNames.length > 5 ? ", …" : ""}. Regenerate affected examples with distinct names.`,
      chapters: [...new Set(duplicatedNames.flatMap((d) => d.chapters))].sort((a, b) => a - b),
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
        chapters: chs,
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
          chapters: [chapters[i].number],
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
        chapters: missing,
      });
    }
  }

  // ── Cross-chapter pattern audit (book-level C8) ───────────────────────
  // Per-chapter C8 catches templates inside one chapter. This catches the
  // Codex-session failure mode: hooks, counters, tryThisNow fields, quiz
  // explanations, and example shells repeated across many chapters.
  const patternAudit = runBookPatternAudit({ bookId, chapters });
  for (const f of patternAudit.findings) {
    findings.push({
      catalogId: f.code,
      severity: f.severity,
      message: f.message,
      evidence: f.evidence,
      chapters: f.chapters,
    });
  }

  // ── BP20 — book-wide quiz n-gram template repeats. ─────────────────────
  // Catches the catastrophic generation failure mode where a fixed phrase
  // appears in distractors across many chapters. The 86-book audit found:
  //   execution.v21: "Keep the old message…" × 80 in 10 chapters
  //   the-12-week-year.v21: "until the team feels more certain…" × 102 in 21
  //   deep-work.v21: "Answer every visible request first…" × 9 in 9
  // None of these were caught by any existing critic.
  for (const f of checkBookQuizNgramTemplates(chapters)) {
    findings.push({
      catalogId: f.checkId,
      severity: f.severity as "blocker" | "major" | "minor",
      message: f.message,
      evidence: f.evidence,
    });
  }
  // ── BP21 — cross-chapter duplicate distractors. ─────────────────────────
  // A wrong choice copied verbatim across chapters (e.g., the-one-thing.v21
  // shipping "Ranking would make action impossible" in 6 chapters) is a
  // generation artifact, not authored content.
  for (const f of checkBookQuizCrossChapterDuplicates(chapters)) {
    findings.push({
      catalogId: f.checkId,
      severity: f.severity as "blocker" | "major" | "minor",
      message: f.message,
      evidence: f.evidence,
    });
  }

  // ── BP26/BP27 — book-level repetition of marquee exemplars and venues. ───
  for (const f of checkBookExemplarChapterReuse(bookId, chapters)) {
    findings.push({
      catalogId: f.checkId,
      severity: f.severity as "blocker" | "major" | "minor",
      message: f.message,
      evidence: f.evidence,
    });
  }
  for (const f of checkBookVenueStamping(chapters)) {
    findings.push({
      catalogId: f.checkId,
      severity: f.severity as "blocker" | "major" | "minor",
      message: f.message,
      evidence: f.evidence,
    });
  }

  // ── BP28/BP29 — review-card callback-frame reuse + try-now clock stamping. ──
  // The two structural-sameness axes the model sweep (`repeated_unit` /
  // `location_stamping`) caught on the-daily-stoic but no deterministic gate saw.
  // Both carry chapters[] so the write-orchestrator barrier re-dispatches only
  // the offenders. BP28 is SHADOW major (calibrate to zero on the clean corpus
  // before any blocker promotion); BP29 is lexically FP-safe (clean corpus has
  // zero try-now clock stamps).
  for (const f of checkBookCallbackFrameReuse(chapters)) {
    findings.push({
      catalogId: f.checkId,
      severity: f.severity as "blocker" | "major" | "minor",
      message: f.message,
      evidence: f.evidence,
      chapters: f.chapters,
    });
  }
  for (const f of checkBookTimingAnchorStamping(chapters)) {
    findings.push({
      catalogId: f.checkId,
      severity: f.severity as "blocker" | "major" | "minor",
      message: f.message,
      evidence: f.evidence,
      chapters: f.chapters,
    });
  }
  // ── BP30 — try-now timer/calendar action-container density (location_stamping,
  // action-mechanism variant). SHADOW major; calibrated to zero on the clean
  // corpus by fraction. Carries chapters[] for the barrier.
  for (const f of checkBookActionContainerReuse(chapters)) {
    findings.push({
      catalogId: f.checkId,
      severity: f.severity as "blocker" | "major" | "minor",
      message: f.message,
      evidence: f.evidence,
      chapters: f.chapters,
    });
  }

  // ── AS4 — positional quiz prompt template substitution. ─────────────────
  // The May 2026 Covey incident: every chapter's q06 was "If the [TOKEN]
  // family calendar rewards push through fatigue, which plan best serves
  // [TOKEN] balance?" with TOKEN varying per chapter. BP20/BP21 missed it
  // because the salt tokens broke verbatim n-gram matching. AS4 uses
  // word-set similarity (not n-gram identity) to catch template skeletons
  // with substituted nouns.
  for (const f of checkBookQuizPromptTemplates(chapters)) {
    findings.push({
      catalogId: f.checkId,
      severity: f.severity as "blocker" | "major" | "minor",
      message: f.message,
      evidence: f.evidence,
    });
  }

  // ── F4 — soft-banned phrase budget. ──────────────────────────────────────
  // banned-phrases.json declares a `softBanned` list with `perBookBudget` per
  // phrase. The per-text register check collected occurrences but no caller
  // ever counted them against the budget — the feature was fictional. Without
  // this, a phrase like "That matters because" can appear 517 times in 62 of
  // 73 books (the actual observed count) while the writer system "thinks" it
  // is soft-capped at 10. Now: count occurrences across every reader-facing
  // text field in every chapter; fire MAJOR when a phrase exceeds its budget.
  for (const f of checkSoftBannedBudgets(chapters)) {
    findings.push(f);
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
      patternAudit,
    },
  };
}

/**
 * F4 — count soft-banned phrase occurrences across every reader-facing text
 * field in every chapter. Fire MAJOR when count exceeds `perBookBudget`
 * declared in banned-phrases.json. Case-insensitive substring match — same
 * matching rule the per-text register check uses, so the count is consistent
 * with the writer's own detection.
 *
 * Why MAJOR not BLOCKER: these are phrases the writer *can* legitimately use,
 * they just shouldn't be the dominant rhetorical shape. A book that ships
 * with one or two budget overruns is still acceptable; the gate flag forces
 * the operator to see the count and decide.
 */
function checkSoftBannedBudgets(chapters: ChapterV21[]): BookGateFinding[] {
  const cfg = loadBannedPhrases();
  const softBanned: Array<{ phrase: string; perBookBudget: number; reason?: string }> =
    cfg.softBanned ?? [];
  if (softBanned.length === 0) return [];

  // Concatenate every reader-facing text field across all chapters into one
  // lowercase haystack. We count occurrences book-wide, not per-chapter,
  // because `perBookBudget` is a book-level allowance.
  const buf: string[] = [];
  for (const ch of chapters) {
    if (ch.hook) buf.push(ch.hook);
    if (ch.counterintuition) buf.push(ch.counterintuition);
    if (ch.keyTakeaway) buf.push(ch.keyTakeaway);
    if (ch.tryThisNow) buf.push(ch.tryThisNow);
    if (ch.breakdown?.fastRead) buf.push(ch.breakdown.fastRead);
    if (ch.breakdown?.deepRead) buf.push(ch.breakdown.deepRead);
    if (ch.breakdown?.fullRead) buf.push(ch.breakdown.fullRead);
    for (const ex of ch.examples ?? []) {
      if (ex.scenario) buf.push(ex.scenario);
      if (ex.whatToDo) buf.push(ex.whatToDo);
      if (ex.whyItMatters) buf.push(ex.whyItMatters);
      if (ex.title) buf.push(ex.title);
    }
    for (const q of ch.quiz?.questions ?? []) {
      if (q.prompt) buf.push(q.prompt);
      if (Array.isArray(q.choices)) buf.push(q.choices.join(" "));
      if (q.explanation) buf.push(q.explanation);
    }
    for (const c of ch.reviewCards ?? []) {
      if (c.front) buf.push(c.front);
      if (c.back) buf.push(c.back);
    }
    for (const line of ch.memorableLines ?? []) {
      if (line.text) buf.push(line.text);
    }
    const ip = ch.implementationPlan;
    if (ip) {
      if (ip.coreSkill) buf.push(ip.coreSkill);
      if (ip.twentyFourHourChallenge) buf.push(ip.twentyFourHourChallenge);
      if (ip.weeklyPractice) buf.push(ip.weeklyPractice);
      for (const it of ip.ifThenPlans ?? []) {
        if (it.plan) buf.push(it.plan);
      }
    }
  }
  const haystack = buf.join("\n").toLowerCase();

  const findings: BookGateFinding[] = [];
  for (const entry of softBanned) {
    const needle = (entry.phrase ?? "").toLowerCase().trim();
    if (!needle) continue;
    const budget = Number.isFinite(entry.perBookBudget) ? entry.perBookBudget : 0;

    let count = 0;
    let from = 0;
    while ((from = haystack.indexOf(needle, from)) !== -1) {
      count += 1;
      from += needle.length;
    }

    if (count > budget) {
      findings.push({
        catalogId: "F4",
        severity: "major",
        message: `soft-banned phrase "${entry.phrase}" appears ${count} times (budget ${budget}). ${entry.reason ?? ""}`.trim(),
        evidence: entry.phrase,
      });
    }
  }
  return findings;
}

export function formatBookGateReport(rep: BookGateReport): string {
  const lines: string[] = [];
  lines.push(`Book gate: ${rep.passed ? "PASS" : "BLOCK"} (${rep.bookId}, ${rep.chapterCount} chapters)`);
  lines.push(`  Quiz answer positions: ${rep.stats.answerPositionCounts.join(" / ")} (max ${(rep.stats.answerPositionPctMax * 100).toFixed(1)}%)`);
  lines.push(`  Cross-chapter name duplications: ${rep.stats.duplicatedNames.length}`);
  lines.push(`  Hook-opener duplications: ${rep.stats.duplicatedHookOpeners.length}`);
  if (rep.stats.patternAudit) {
    const patternBlockers = rep.stats.patternAudit.findings.filter((f) => f.severity === "blocker").length;
    const patternMajors = rep.stats.patternAudit.findings.filter((f) => f.severity === "major").length;
    lines.push(`  Pattern audit: ${rep.stats.patternAudit.passed ? "PASS" : "BLOCK"} (${patternBlockers} blocker(s), ${patternMajors} major(s))`);
  }
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
