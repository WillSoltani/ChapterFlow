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
import { isAphorismShaped } from "./crossBookSignatureAudit.js";
import { checkQuizChoiceLabelUniform } from "./quizQuality.js";

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

function addSidecarWhitelistTerms(whitelist: Set<string>, sidecar: unknown): void {
  if (!isRecord(sidecar)) return;
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

function ambientSidecarWhitelistTerms(bookId: string, chapters: ChapterV21[]): Set<string> {
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
    addSidecarWhitelistTerms(whitelist, sidecar);
  }
  whitelist.delete("");
  return whitelist;
}

export type BookExemplarChapterReuseOptions = Readonly<{
  /** Candidate-native source-v2 values. Presence, including an empty array,
   * disables legacy ambient source discovery. */
  sourceSidecars?: readonly unknown[];
  /** Optional already-normalized or raw framework terms from a caller-owned snapshot. */
  whitelistTerms?: readonly string[];
}>;

export function checkBookExemplarChapterReuse(
  bookId: string,
  chapters: ChapterV21[],
  options: BookExemplarChapterReuseOptions = {},
): CriticFinding[] {
  const hasExplicitInputs = options.sourceSidecars !== undefined || options.whitelistTerms !== undefined;
  const whitelist = hasExplicitInputs ? new Set<string>() : ambientSidecarWhitelistTerms(bookId, chapters);
  for (const sidecar of options.sourceSidecars ?? []) addSidecarWhitelistTerms(whitelist, sidecar);
  for (const term of options.whitelistTerms ?? []) whitelist.add(normalizeExemplarCandidate(term));
  whitelist.delete("");
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

// ── BP33 — try-this-now opener reuse across chapters (the separable OPENER subset
// of the `repeated_unit` sweep family) ──────────────────────────────────────────
//
// the-slight-edge reused try-this-now OPENING CLAUSES across chapters ("Before you
// send your next reply", "During your next conversation"), flattening distinct
// practices into one instruction shell. Unlike the broader repeated_unit /
// scene_skeleton families — which the gold corpus legitimately reuses, so they stay
// PREVENTION-only (the SC9 caution in the BP30 note below) — the OPENER is
// deal-distinct by design: daring-greatly (7 ch) and start-with-why (14 ch) have
// ZERO repeated openers. So the opener subset IS separable from the clean corpus,
// and a deterministic gate shifts it left from the model sweep.
//
// SHADOW major: openerPlan prevents it at the deal; this catches the residual drift
// and names the chapters for re-dispatch. Fires when >= 2 chapters share the same
// normalized 5-word opening prefix (gold = 0 by construction; even a PAIR is a
// defect since the deal makes every opener unique).
const OPENER_PREFIX_WORDS = 5;
const OPENER_MIN_WORDS = 4; // ignore a too-short opener (no meaningful shared shell)

function tryThisNowOpener(chapter: ChapterV21): string {
  const words = (chapter.tryThisNow ?? "").toLowerCase().match(/[a-z']+/g) ?? [];
  return words.slice(0, OPENER_PREFIX_WORDS).join(" ");
}

export function checkBookTryThisNowOpenerReuse(chapters: ChapterV21[]): CriticFinding[] {
  const byOpener = new Map<string, number[]>();
  for (const chapter of chapters) {
    const opener = tryThisNowOpener(chapter);
    if (opener.split(" ").filter(Boolean).length < OPENER_MIN_WORDS) continue;
    const chs = byOpener.get(opener) ?? [];
    chs.push(chapter.number);
    byOpener.set(opener, chs);
  }
  const findings: CriticFinding[] = [];
  for (const [opener, chs] of byOpener) {
    const uniq = [...new Set(chs)].sort((a, b) => a - b);
    if (uniq.length < 2) continue; // distinct openers → good (the deal's job)
    findings.push(
      finding(
        "BP33.try_this_now_opener_reuse",
        "major",
        `try-this-now opener "${opener}…" opens ${uniq.length} chapters (${uniq.map((n) => `ch${n}`).join(", ")}). Each chapter's practice should start from its own concrete trigger — vary the opening clause.`,
        truncate(uniq.map((n) => `ch${n}`).join(", "), 180),
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

// ── BP30 — try-now action-container DENSITY (the `location_stamping` family) ───
//
// The migrated twin of BP29. BP29 catches a reused CLOCK STAMP; BP30 catches the
// timer/calendar-event scheduling CONTAINER funnelling the action in chapter after
// chapter — the-daily-stoic put "Set a 10-minute timer" / "Put a calendar event"
// in 8 of 12 chapters (0.67) even after the clocks varied. timingPlan deals the
// TRIGGER and actionMechanismPlan deals the MECHANISM (write / say / move /
// observe / …, with timer-or-calendar dealt to AT MOST the one scheduling
// chapter), so the container saturating the book means the deal was ignored.
//
// CALIBRATION (why DENSITY, not count): the clean corpus uses the timer/calendar
// container too, but sparsely — stillness-is-the-key has it in 10/32 chapters
// (0.31) and shipped; the-daily-stoic has it in 8/12 (0.67) and was REVISE'd. The
// absolute count does NOT separate them (10 > 8); the DENSITY does. So we fire
// only when the container saturates >= BP30_MIN_FRACTION of the book (with an
// absolute floor so a tiny book can't trip on 2 chapters). Measured densities:
// daring 0.14, start-with-why 0.00, stillness 0.31, year-of-less 0.00, gifts
// 0.08 — all clear at 0.50; the-daily-stoic 0.67 fires. SHADOW major: a saturated
// container is semantic-adjacent, so it surfaces (and names chapters for the
// barrier) without flipping the gate until the clean-zero pin + a confirmed
// true-positive justify a blocker promotion (the SC9-reversal caution).
//
// NOTE: the sibling sweep families repeated_unit (weeklyPractice "seven-day log"
// shell) and scene_skeleton (fullRead "limit" hinge) are NOT given deterministic
// gates: calibration proved they are not separable from the clean corpus
// (start-with-why uses a limit hinge in 14/14 fullReads; stillness uses the
// seven-day-log shell in 28/32 weeklyPractices — both shipped). Those families are
// handled by PREVENTION only (weeklyPracticePlan / fullReadSkeletonPlan deal a
// distinct form/beat per chapter) with the model sweep as the backstop; shipping a
// gate on a zero the clean corpus violates would be exactly the SC9 trap.
const BP30_MIN_FRACTION = 0.5;
const BP30_MIN_CHAPTERS = 4;
// An explicit timer or calendar-EVENT the reader sets/puts — the saturating
// container, not any mention of scheduling. Kept narrow (verb "schedule"/"block"
// alone over-fires on the clean corpus, which uses "schedule an evening review").
const ACTION_CONTAINER_RE: RegExp[] = [
  /\btimers?\b/gi,
  /\bcalendar (?:event|block|invite|reminder|hold)\b/gi,
  /\bput (?:a|an)[^.]{0,30}\bcalendar\b/gi,
  /\bset (?:a|an)[^.]{0,12}\b(?:alarm|timer)\b/gi,
];
// A container mention NEGATED in the same clause ("write a line — NOT a timer") is
// not the reader using the container; it's prevention copy. Don't count it — the
// actionMechanismPlan directives that steer writers AWAY from the timer/calendar
// shell literally say "not a timer / NOT a clock alarm or calendar event", so a
// writer who echoes that phrasing must not trip BP30 on the disclaimer.
const NEGATION_BEFORE = /\b(?:not|no|never|without|avoid|skip|isn['’]t|aren['’]t|don['’]t)\b[^.?!;]{0,30}$/i;

function usesSchedulingContainer(text: string): boolean {
  if (!text) return false;
  for (const re of ACTION_CONTAINER_RE) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const before = text.slice(Math.max(0, m.index - 30), m.index);
      if (!NEGATION_BEFORE.test(before)) return true; // an affirmative container use
    }
  }
  return false;
}

export function checkBookActionContainerReuse(chapters: ChapterV21[]): BookRepetitionFinding[] {
  const N = chapters.length;
  if (N === 0) return [];
  const hits: number[] = [];
  for (const ch of chapters) {
    if (usesSchedulingContainer(tryNowText(ch))) hits.push(ch.number);
  }
  if (hits.length < BP30_MIN_CHAPTERS || hits.length / N < BP30_MIN_FRACTION) return [];
  const chs = [...hits].sort((a, b) => a - b);
  return [{
    ...finding(
      "BP30.action_container_reuse",
      "major",
      `the try-this-now action funnels into the timer/calendar container in ${chs.length} of ${N} chapters (${(chs.length / N * 100).toFixed(0)}%): ch${chs.join(", ch")}. The practice keeps landing in the same arbitrary scheduling shell instead of a chapter-specific action. Deal each chapter a distinct action mechanism (write a line / say it aloud / move an object / observe-and-count / …); reserve the timer/calendar container for the one chapter genuinely about scheduling (actionMechanismPlan).`,
      `${chs.length}/${N} chapters use a timer/calendar container`,
    ),
    chapters: chs,
  }];
}

// ── BP31 — uniform Title-Case quiz choice labels (the quiz_distractor_quality
// valence-telegraph). Book-wide companion to the per-chapter gate check
// (checkQuizChoiceLabelUniform): lists every chapter whose quiz has a question
// with ALL choices Title-Case labelled, so the QC barrier + repair brief can
// name them. NOT density-gated — the signal is zero across the entire clean+gold
// corpus, so any chapter carrying it is a true positive. SHADOW major.
// ── BP34 — within-book aphorism repetition (the CF-F / Finding-11 leak) ───────
//
// high-output-management shipped the aphorism "Agreement nods; commitment signs"
// as a lede/coreSkill line in FOUR chapters (2/5/8/11); the previously published
// `execution` carried it in two more. No existing gate saw it: the phrase is 4
// words (below crossBookSignatureAudit's 6-word floor), it lands in fields the
// cross-book audit never scanned (coreSkill, counterintuition, memorableLines),
// BP10/BP12 only scan full breakdown PARAGRAPHS (not the one-sentence lede), and
// the banned-phrase list didn't carry it. A reader cycling chapters meets the
// same minted one-liner over and over.
//
// BP34 scans the reader-facing sentence surfaces (memorableLines,
// counterintuition, coreSkill, keyTakeaway, tryThisNow, and every breakdown-tier
// sentence), normalizes each — unifying case, terminal punctuation, and `;`↔`,`
// so the semicolon and comma variants collapse — and fires ONE advisory (MINOR)
// per sentence that recurs verbatim across ≥ 3 chapters. Threshold 3 is
// deliberate: a single intentional callback (2 chapters) stays legal.
//
// A repeated line only counts if it is APHORISM-SHAPED (a semicolon antithesis
// or a balanced two-clause couplet — the same shape gate the cross-book audit
// uses; see isAphorismShaped). This is the deliberate precision bar: books and
// the reference corpus legitimately REPEAT plain crafted/structural lines — the
// fullReadSkeletonPlan hinge ("There is a limit." in 12/14 start-with-why
// chapters), a book-wide coreSkill, a section refrain — and scanning every
// repeated sentence would flood the advisory and false-positive on gold (the SC9
// trap). The minted aphorism this campaign targets ("Agreement nods; commitment
// signs", in high-output-management ch2/5/8/11) IS aphorism-shaped, so the shape
// gate keeps it while dropping the plain repeats. Plain templated-line reuse is a
// separate defect class handled by BP1/BP10/BP12 and the model sweep. Advisory
// only — the semantic panel is the true gate; this names the chapters for repair.
const APHORISM_MIN_WORDS = 4;
const APHORISM_MAX_WORDS = 25;
const APHORISM_MIN_CHAPTERS = 3;

/** Unify case, terminal punctuation, and `;`↔`,` so punctuation-variant twins of
 *  the same minted line collapse to one key. Internal words are preserved. */
function normalizeAphorism(sentence: string): string {
  return sentence
    .toLowerCase()
    .replace(/;/g, ",")            // `;` ↔ `,` — collapse the two antithesis forms
    .replace(/[.!?]+\s*$/g, "")    // drop terminal punctuation
    .replace(/\s+/g, " ")
    .trim();
}

function wordCount(sentence: string): number {
  return sentence.trim().split(/\s+/).filter(Boolean).length;
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** The reader-facing surfaces an aphorism gets minted into. BP10/BP12 catch
 *  whole PARAGRAPH reuse; a minted one-liner hides as ONE sentence inside a
 *  per-chapter-distinct paragraph (in high-output-management it sat at sentence
 *  index 4–20 of the breakdown tiers, never the lede), so paragraph matching
 *  never sees it. BP34 works at the SENTENCE level across the short fields and
 *  every breakdown-tier sentence. */
function aphorismCandidateSentences(chapter: ChapterV21): Array<{ field: string; sentence: string }> {
  const out: Array<{ field: string; sentence: string }> = [];
  // Admit only aphorism-shaped sentences — the shape gate is what keeps this
  // FP-clean on plainly-repeated crafted/structural lines (see the header note).
  const push = (field: string, text: string | undefined) => {
    if (!text) return;
    for (const s of splitSentences(text)) if (isAphorismShaped(s)) out.push({ field, sentence: s });
  };

  // CF-I-1: `hook` added to the scan set. On the fresh `multipliers` run ch01/ch06
  // shipped a verbatim hook sentence ("No one knew who would bring back proof") — legal
  // at 2 chapters (below the ≥3 threshold), but the hook is exactly where a minted
  // aphorism lands, and it was outside the field set. Future-proofing, not a threshold change.
  push("hook", chapter.hook);
  push("counterintuition", chapter.counterintuition);
  push("keyTakeaway", chapter.keyTakeaway);
  push("tryThisNow", chapter.tryThisNow);
  push("implementationPlan.coreSkill", chapter.implementationPlan?.coreSkill);
  for (const m of chapter.memorableLines ?? []) push("memorableLines", m?.text);
  push("breakdown.fastRead", chapter.breakdown?.fastRead);
  push("breakdown.deepRead", chapter.breakdown?.deepRead);
  push("breakdown.fullRead", chapter.breakdown?.fullRead);

  return out;
}

export function checkBookAphorismRepetition(chapters: ChapterV21[]): BookRepetitionFinding[] {
  // normalized sentence → { chapters, a readable sample of the line + its fields }
  const byLine = new Map<string, { chapters: Set<number>; sample: string; fields: Set<string> }>();
  for (const ch of chapters) {
    for (const { field, sentence } of aphorismCandidateSentences(ch)) {
      const wc = wordCount(sentence);
      if (wc < APHORISM_MIN_WORDS || wc > APHORISM_MAX_WORDS) continue;
      const key = normalizeAphorism(sentence);
      if (!key) continue;
      const rec = byLine.get(key) ?? { chapters: new Set<number>(), sample: sentence, fields: new Set<string>() };
      // chapters is a Set, so a line repeated across fields in one chapter counts once.
      rec.chapters.add(ch.number);
      rec.fields.add(field);
      byLine.set(key, rec);
    }
  }

  const findings: BookRepetitionFinding[] = [];
  for (const rec of byLine.values()) {
    const chs = [...rec.chapters].sort((a, b) => a - b);
    if (chs.length < APHORISM_MIN_CHAPTERS) continue;
    findings.push({
      ...finding(
        "BP34.aphorism_repetition",
        "minor",
        `the line "${truncate(rec.sample, 90)}" recurs verbatim (punctuation-variants unified) in ${chs.length} chapters (${chs.map((n) => `ch${n}`).join(", ")}), across ${[...rec.fields].join(", ")}. A minted aphorism reused across the book reads as house voice, not chapter teaching — give each chapter its own chapter-native line (2 chapters is a legal callback; 3+ is repetition).`,
        rec.sample,
      ),
      chapters: chs,
    });
  }
  return findings.sort((a, b) => b.chapters.length - a.chapters.length);
}

// ── BP34.tail_clone — recurring distinctive sentence TAIL (CF-J, 2026-07-09) ────
//
// The radical-candor release review (§12) found a three-chapter near-verbatim
// signature clone the verbatim BP34 check above MISSED: "…comes back on a date, or
// it drifts." (ch3) / "…comes back on a short clock, or it drifts." (ch6) / "The
// promise gets a named path, or it drifts." (ch9). The sentence VARIES around a
// fixed final clause, so whole-sentence normalization never collapses the three.
//
// The tail-clone check keys on the sentence's FINAL COMMA-CLAUSE — the span after
// the last comma, normalized to 3-5 words (matching the review's quoted clone
// ", or it drifts") — and fires ONE advisory per tail that closes a sentence in
// ≥3 chapters. Two guards keep it narrow:
//   (1) COMMA-ANCHORED — the tail must be a clause set off by a comma. Plain
//       phrase endings ("…of the chapter.", "…at the end of the day.") never
//       carry the comma and are structurally excluded.
//   (2) CONTENT WORD — the normalized tail must carry ≥1 non-stopword ("drifts"),
//       so connective-only clauses (", and so on") never key.
// Same candidate surfaces as BP34 but WITHOUT the aphorism shape gate (the clone
// hides inside ordinary declarative sentences). Advisory (MINOR), like its parent.
//
// MEASURED (2026-07-09): gold start-with-why 1 (", not a slogan" ch4/11/12 — an
// honest soft refrain, pinned as the measured count, exactly as the C31/C33 gold
// pins do), the-culture-code 0, HOM package 0, multipliers package 0,
// radical-candor 1 (", or it drifts" ch3/6/9 — the target). Pins live in
// tests/aphorism-repetition.test.ts.
const TAIL_CLONE_MIN_CHAPTERS = 3;
const TAIL_MIN_WORDS = 3;
const TAIL_MAX_WORDS = 5;

// Function/connective words that can never make a tail distinctive on their own.
const TAIL_STOPWORDS = new Set((
  "the a an of in on at to for and or but it its is are was were be been being this that these those " +
  "you your yours we our ours they their theirs he she his her him them not no nor so as by with from " +
  "too then than there here one ones do does did done can could will would should shall may might must " +
  "have has had having what when where who whom whose how why if while because though although until " +
  "unless once again also just only even still yet more most much many some any all both each few other " +
  "another same own very"
).split(/\s+/));

/** The normalized final comma-clause of a sentence, when it is a 3-5 word span
 *  carrying at least one content word — else null. Pure. */
export function sentenceTailKey(sentence: string): string | null {
  const m = sentence.match(/,\s*([^,;]+?)[.!?]*\s*$/);
  if (!m) return null;
  const words = m[1].toLowerCase().replace(/[^a-z0-9'\s-]/g, " ").split(/\s+/).filter(Boolean);
  if (words.length < TAIL_MIN_WORDS || words.length > TAIL_MAX_WORDS) return null;
  if (!words.some((w) => !TAIL_STOPWORDS.has(w))) return null;
  return words.join(" ");
}

/** Same surface set as aphorismCandidateSentences, without the shape gate. */
function tailCandidateSentences(chapter: ChapterV21): string[] {
  const out: string[] = [];
  const push = (text: string | undefined) => {
    if (!text) return;
    out.push(...splitSentences(text));
  };
  push(chapter.hook);
  push(chapter.counterintuition);
  push(chapter.keyTakeaway);
  push(chapter.tryThisNow);
  push(chapter.implementationPlan?.coreSkill);
  for (const m of chapter.memorableLines ?? []) push(m?.text);
  push(chapter.breakdown?.fastRead);
  push(chapter.breakdown?.deepRead);
  push(chapter.breakdown?.fullRead);
  return out;
}

export function checkBookSentenceTailClone(chapters: ChapterV21[]): BookRepetitionFinding[] {
  // normalized tail → { chapters, a readable sample sentence }
  const byTail = new Map<string, { chapters: Set<number>; sample: string }>();
  for (const ch of chapters) {
    for (const sentence of tailCandidateSentences(ch)) {
      const key = sentenceTailKey(sentence);
      if (!key) continue;
      const rec = byTail.get(key) ?? { chapters: new Set<number>(), sample: sentence };
      rec.chapters.add(ch.number);
      byTail.set(key, rec);
    }
  }
  const findings: BookRepetitionFinding[] = [];
  for (const [key, rec] of byTail) {
    const chs = [...rec.chapters].sort((a, b) => a - b);
    if (chs.length < TAIL_CLONE_MIN_CHAPTERS) continue;
    findings.push({
      ...finding(
        "BP34.tail_clone",
        "minor",
        `the sentence tail ", ${key}" closes a sentence in ${chs.length} chapters (${chs.map((n) => `ch${n}`).join(", ")}) — e.g. "${truncate(rec.sample, 90)}". The frame varies but the final clause is a minted clone (the "…, or it drifts" class); give each chapter its own closing turn instead of reusing the tail.`,
        rec.sample,
      ),
      chapters: chs,
    });
  }
  return findings.sort((a, b) => b.chapters.length - a.chapters.length || a.evidence!.localeCompare(b.evidence!));
}

export function checkBookQuizChoiceLabelUniform(chapters: ChapterV21[]): BookRepetitionFinding[] {
  const hits: number[] = [];
  for (const ch of chapters) {
    if (checkQuizChoiceLabelUniform(ch.quiz).length > 0) hits.push(ch.number);
  }
  if (hits.length === 0) return [];
  const chs = [...hits].sort((a, b) => a - b);
  return [{
    ...finding(
      "BP31.quiz_choice_label_uniform",
      "major",
      `${chs.length} chapter(s) build quiz choices as uniform Title-Case category labels (ch${chs.join(", ch")}) — the key is sortable by label valence without reading the chapter. Rewrite every choice as a plain sentence in the same register (no "Label:" prefix on any choice).`,
      `${chs.length} chapter(s) with uniform Title-Case quiz labels`,
    ),
    chapters: chs,
  }];
}
