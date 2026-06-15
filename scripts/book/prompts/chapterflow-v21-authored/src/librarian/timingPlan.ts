/**
 * Timing plan — rhetoricPlan's prevention pattern applied to the "try this now"
 * action anchor (the `location_stamping` sweep family, try-now variant).
 *
 * THE PROBLEM: the 24-hour action (tryThisNow / implementationPlan.
 * twentyFourHourChallenge) had no dealt anchor, so mutually-blind authors
 * reached for the same arbitrary clock stamp — the-daily-stoic scheduled
 * "tomorrow at 9:10 a.m. at your desk" in ch04, ch07, and ch10. A repeated
 * clock time makes the practical prompts read as templated. The clean corpus
 * uses GENERIC, situational anchors ("within 24 hours", "before your next…")
 * with zero clock stamps.
 *
 * The fix: deal each chapter a distinct SITUATIONAL trigger and forbid arbitrary
 * clock times. The deterministic BP29 gate catches any residual clock-stamp
 * reuse; this allocator keeps it from happening in the first place.
 *
 * Deterministic and a PURE function of (bookId, n): FNV-1a(bookId) rotation +
 * stride-1 round-robin over the trigger palette, keyed on absolute n-1 (a
 * single-chapter redo gets the same trigger).
 */

import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url)); // .../src/librarian
const TIMING_PLANS_DIR = resolve(__dirname, "../../state/timing-plans");

/** Situational trigger anchors — each ties the action to a moment in the
 *  reader's own day, NOT a fixed clock time. {behavior}/{moment} are filled by
 *  the author with this chapter's own subject. */
export const TRIGGER_CLASSES: Array<{ id: string; directive: string }> = [
  { id: "next_reply", directive: 'Anchor the action to "before you send your next reply / response" — a communication trigger.' },
  { id: "feel_the_pull", directive: 'Anchor the action to "the next time you feel the pull to {behavior}" — an internal-cue trigger.' },
  { id: "next_handoff", directive: 'Anchor the action to "at your next handoff / transition between tasks" — a workflow-seam trigger.' },
  { id: "before_starting", directive: 'Anchor the action to "before you start your next {moment}" — a threshold trigger.' },
  { id: "next_conversation", directive: 'Anchor the action to "during your next conversation about {moment}" — a relational trigger.' },
  { id: "existing_routine", directive: 'Anchor the action to an EXISTING daily routine the reader already has (their commute, their first coffee) — a habit-stacking trigger, described by the routine not the clock.' },
  { id: "within_24h", directive: 'Anchor the action to "within the next 24 hours, the first time {moment} comes up" — a deadline trigger with a situational cue.' },
];

export type TimingAllocation = { triggerId: string; directive: string };
export type TimingPlan = {
  schemaVersion: "timing-plan-v1";
  bookId: string;
  createdAt: string;
  allocation: Record<number, TimingAllocation>;
  diagnostics: { triggerCounts: Record<string, number> };
};

function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function planTiming(bookId: string, from: number, to: number): TimingPlan {
  // Defensive: a NaN/<1/inverted range from the CLI would index the rotation
  // with a negative modulo (undefined trigger entries).
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from) {
    return { schemaVersion: "timing-plan-v1", bookId, createdAt: new Date().toISOString(), allocation: {}, diagnostics: { triggerCounts: {} } };
  }
  const offset = fnv1a(`${bookId}:timing`) % TRIGGER_CLASSES.length;
  const allocation: Record<number, TimingAllocation> = {};
  const triggerCounts: Record<string, number> = {};
  for (let n = from; n <= to; n++) {
    const idx = n - 1; // absolute → single-chapter redo matches the full deal
    const trigger = TRIGGER_CLASSES[(offset + idx) % TRIGGER_CLASSES.length];
    allocation[n] = { triggerId: trigger.id, directive: trigger.directive };
    triggerCounts[trigger.id] = (triggerCounts[trigger.id] ?? 0) + 1;
  }
  const N = to - from + 1;
  if (N >= 5) {
    const maxTrigger = Math.max(0, ...Object.values(triggerCounts));
    if (maxTrigger / N >= 0.5) {
      throw new Error(`timing-plan invariant violated: one trigger class lands ${maxTrigger}/${N} >= 0.50.`);
    }
  }
  return {
    schemaVersion: "timing-plan-v1",
    bookId,
    createdAt: new Date().toISOString(),
    allocation,
    diagnostics: { triggerCounts },
  };
}

export function timingPlanPath(bookId: string): string {
  return resolve(TIMING_PLANS_DIR, `${bookId}.timing-plan.json`);
}

export function writeTimingPlan(plan: TimingPlan): string {
  mkdirSync(TIMING_PLANS_DIR, { recursive: true });
  const p = timingPlanPath(plan.bookId);
  writeFileSync(p, JSON.stringify(plan, null, 2), "utf8");
  return p;
}

export function loadTimingPlan(bookId: string): TimingPlan | null {
  const p = timingPlanPath(bookId);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8")) as TimingPlan;
  } catch {
    return null;
  }
}

export function formatTimingPlan(plan: TimingPlan): string {
  const lines = [`Timing plan — ${plan.bookId}`];
  for (const [n, a] of Object.entries(plan.allocation)) {
    lines.push(`  ch${String(n).padStart(2, "0")}: ${a.triggerId}`);
  }
  lines.push(`  trigger counts: ${JSON.stringify(plan.diagnostics.triggerCounts)}`);
  return lines.join("\n");
}
