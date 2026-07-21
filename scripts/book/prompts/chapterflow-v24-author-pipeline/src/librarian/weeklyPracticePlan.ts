/**
 * Weekly-practice plan — timingPlan's prevention pattern applied to
 * implementationPlan.weeklyPractice (the `repeated_unit` sweep family).
 *
 * THE PROBLEM: weeklyPractice had no dealt allocator, so mutually-blind authors
 * collapsed onto one "seven-day log" shell with only the noun swapped — the-
 * daily-stoic shipped "For seven days, keep one X log" across ch1, ch2, ch4, ch5,
 * ch8, ch9, ch11, ch12 (repeated_unit, 8 chapters). The intra-book pairwise
 * similarity backstop misses it because the per-pair object-swaps stay under the
 * blocker threshold; the templated SHELL is a book-wide pattern, not a pair.
 *
 * THE FIX: deal each chapter a DISTINCT practice FORM (daily log / single
 * rehearsal / paired check-in / environment change / one weekly review /
 * count-and-tally / swap experiment / teach someone). This is PREVENTION-only:
 * the repeated_unit shell is NOT given a deterministic book-gate because
 * calibration proved it inseparable from the clean corpus (stillness-is-the-key
 * uses the seven-day-log shell in 28/32 weeklyPractices and shipped). The model
 * QC sweep remains the backstop for any residual; this allocator keeps the
 * authors from converging in the first place.
 *
 * Deterministic and a PURE function of (bookId, n): FNV-1a(bookId) rotation +
 * stride-1 round-robin over the form palette, keyed on absolute n-1 (a single-
 * chapter redo gets the same form).
 */

import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { mkdirSync, writeFileSync } from "fs";
import type { BookContentReader } from "../books/candidateTypes.js";
import { fnv1a } from "../lib/fnv1a.js";

const __dirname = dirname(fileURLToPath(import.meta.url)); // .../src/librarian
const WEEKLY_PRACTICE_PLANS_DIR = resolve(__dirname, "../../state/weekly-practice-plans");

/** Distinct weekly-practice FORMS. Each varies the practice's shape, cadence,
 *  AND output — not "keep one X log" reskinned. {skill}/{behavior} are filled by
 *  the author with this chapter's own subject. Keep ≥ 8 so round-robin holds any
 *  one form well under the BP32 density floor. `daily_log` is included (it is a
 *  legitimate form) but its directive flags it as the over-used default so it
 *  lands in at most ~1 chapter of a 12-chapter book. */
export const WEEKLY_PRACTICE_FORMS: Array<{ id: string; directive: string }> = [
  { id: "single_rehearsal", directive: 'WEEKLY FORM = ONE DELIBERATE REHEARSAL. Stage {behavior} once this week and practice the move under real conditions — a single rehearsal, not a daily entry.' },
  { id: "paired_checkin", directive: 'WEEKLY FORM = PAIRED CHECK-IN. Ask one other person to flag {behavior} when they see it this week, then compare notes once — a relational practice, not a solo log.' },
  { id: "environment_change", directive: 'WEEKLY FORM = ENVIRONMENT CHANGE. Change ONE thing in the reader\'s space/setup for the week ({skill}) and watch the effect — an environmental experiment, not a journal.' },
  { id: "weekly_review", directive: 'WEEKLY FORM = SINGLE END-OF-WEEK REVIEW. Look back ONCE at the end of the week and name what changed about {skill} — one review, explicitly NOT a daily log.' },
  { id: "count_and_tally", directive: 'WEEKLY FORM = COUNT & TALLY. Tally one specific event ({behavior}) across the week, then read the tally — the output is a number, not prose entries.' },
  { id: "swap_experiment", directive: 'WEEKLY FORM = SWAP EXPERIMENT. Replace one habit with another for the week ({skill}) and compare the two halves — a controlled swap, not a log.' },
  { id: "teach_someone", directive: 'WEEKLY FORM = TEACH IT. Explain {skill} to one other person this week in your own words — the protégé effect, not a private record.' },
  { id: "scheduled_rep", directive: 'WEEKLY FORM = SPACED REPS. Do {behavior} three times across the week at widening gaps, harder each time — spaced repetition, not a continuous diary.' },
  { id: "daily_log", directive: 'WEEKLY FORM = DAILY LOG — use this ONLY if a running daily record is genuinely the right instrument for {skill}. Make the log column-specific to THIS chapter, and expect every OTHER chapter to use a non-log form.' },
];

export type WeeklyPracticeAllocation = { formId: string; directive: string };
export type WeeklyPracticePlan = {
  schemaVersion: "weekly-practice-plan-v1";
  bookId: string;
  createdAt: string;
  allocation: Record<number, WeeklyPracticeAllocation>;
  diagnostics: { formCounts: Record<string, number> };
};

export function planWeeklyPractices(bookId: string, from: number, to: number): WeeklyPracticePlan {
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from) {
    return { schemaVersion: "weekly-practice-plan-v1", bookId, createdAt: new Date().toISOString(), allocation: {}, diagnostics: { formCounts: {} } };
  }
  const offset = fnv1a(`${bookId}:weekly-practice`) % WEEKLY_PRACTICE_FORMS.length;
  const allocation: Record<number, WeeklyPracticeAllocation> = {};
  const formCounts: Record<string, number> = {};
  for (let n = from; n <= to; n++) {
    const idx = n - 1; // absolute → single-chapter redo matches the full deal
    const form = WEEKLY_PRACTICE_FORMS[(offset + idx) % WEEKLY_PRACTICE_FORMS.length];
    allocation[n] = { formId: form.id, directive: form.directive };
    formCounts[form.id] = (formCounts[form.id] ?? 0) + 1;
  }
  const N = to - from + 1;
  if (N >= 5) {
    const maxForm = Math.max(0, ...Object.values(formCounts));
    if (maxForm / N >= 0.34) {
      throw new Error(`weekly-practice-plan invariant violated: one form lands ${maxForm}/${N} >= 0.34 (BP32 risk).`);
    }
  }
  return {
    schemaVersion: "weekly-practice-plan-v1",
    bookId,
    createdAt: new Date().toISOString(),
    allocation,
    diagnostics: { formCounts },
  };
}

export function weeklyPracticePlanPath(bookId: string): string {
  return resolve(WEEKLY_PRACTICE_PLANS_DIR, `${bookId}.weekly-practice-plan.json`);
}

export function writeWeeklyPracticePlan(plan: WeeklyPracticePlan): string {
  mkdirSync(WEEKLY_PRACTICE_PLANS_DIR, { recursive: true });
  const p = weeklyPracticePlanPath(plan.bookId);
  writeFileSync(p, JSON.stringify(plan, null, 2), "utf8");
  return p;
}

export function loadWeeklyPracticePlan(bookId: string): WeeklyPracticePlan | null;
export function loadWeeklyPracticePlan(bookId: string, reader: BookContentReader, candidateId: string): Promise<WeeklyPracticePlan>;
export function loadWeeklyPracticePlan(bookId: string, reader?: BookContentReader, candidateId?: string): WeeklyPracticePlan | null | Promise<WeeklyPracticePlan> {
  if (!reader || !candidateId) throw new Error("CANDIDATE_READER_REQUIRED: BookContentReader and candidateId are required");
  return reader.open({ bookId, selector: { kind: "CANDIDATE", candidateId } }).then((opened) => {
    if (!opened.ok) throw new Error(`${opened.error.code}: ${opened.error.message}`);
    const logicalPath = `state/weekly-practice-plans/${bookId}.weekly-practice-plan.json`;
    const file = opened.value.files.find((entry) => entry.logicalPath === logicalPath);
    if (!file) throw new Error(`CANDIDATE_ENTRY_MISSING: ${logicalPath}`);
    try { return JSON.parse(Buffer.from(file.bytes).toString("utf8")) as WeeklyPracticePlan; }
    catch (cause) { throw new Error(`CANDIDATE_ENTRY_MALFORMED: ${logicalPath}: ${(cause as Error).message}`); }
  });
}

export function formatWeeklyPracticePlan(plan: WeeklyPracticePlan): string {
  const lines = [`Weekly-practice plan — ${plan.bookId}`];
  for (const [n, a] of Object.entries(plan.allocation)) {
    lines.push(`  ch${String(n).padStart(2, "0")}: ${a.formId}`);
  }
  lines.push(`  form counts: ${JSON.stringify(plan.diagnostics.formCounts)}`);
  return lines.join("\n");
}
