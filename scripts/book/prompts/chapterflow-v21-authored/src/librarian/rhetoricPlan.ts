/**
 * Rhetoric plan — namePlan's prevention pattern applied to the two opener fields
 * that cluster across a book: the `counterintuition` paradox shape (B11/B14) and
 * the `hook` first-word class (B13).
 *
 * THE PROBLEM: blind parallel (or one fatigued sequential) author independently
 * reaches for the locally-most-natural opener, so the book converges — the-book-
 * of-boundaries shipped 11/13 counterintuitions as the "X is not Y" negation
 * shell (B11) and 7/13 hooks opening with "what" (B13). pedagogyPlan already
 * deals a hook auditClass, but NOTHING pre-allocates the counter shape — that is
 * the genuine gap. This deals BOTH so the caps hold BY CONSTRUCTION.
 *
 * Deterministic (no RNG), like the other plans: a FNV-1a(bookId) rotation picks
 * the starting shape (books don't share a global sequence) and a stride-1 round-
 * robin spreads shapes evenly — with N chapters over K shapes every shape lands
 * ≤ ceil(N/K) times, well under the B11/B13 caps, and adjacent chapters always
 * differ. NOT carried from disk: the deal is the TARGET, so re-dispatching a
 * chapter that drifted to the herd shape hands it the same varied assignment.
 */

import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";

import type { CounterShape } from "../critics/bookPatternAudit.js";

const __dirname = dirname(fileURLToPath(import.meta.url)); // .../src/librarian
const RHETORIC_PLANS_DIR = resolve(__dirname, "../../state/rhetoric-plans");

/** Paradox-signal shapes for the `counterintuition` field — the vocabulary
 *  classifyCounterShape() recognizes, minus "other". negation_correction is
 *  included but the round-robin keeps it to ~N/K, far under the B11 50% / B14
 *  40% caps. Each carries a one-line author directive. */
export const COUNTER_SHAPES: Array<{ id: CounterShape; directive: string }> = [
  { id: "paradox_colon", directive: 'Open "The paradox: …" — name the tension head-on, then resolve it.' },
  { id: "what_looks_like", directive: 'Open "What looks like X is actually Y" — reframe the surface read.' },
  { id: "x_can_y_still", directive: 'Use "X can … and still …" — hold two true-at-once facts the reader thinks exclude each other.' },
  { id: "despite_led", directive: 'Open "Despite …" — concede the obvious, then overturn it.' },
  { id: "in_fact_reversal", directive: 'Build to an "In fact, …" reversal — state the assumption, then invert it midstream.' },
  { id: "question_led", directive: 'Open "Why does/do …" — pose the puzzle the chapter answers.' },
  { id: "negation_correction", directive: 'Use sparingly: "X is not Y, but Z." (The herd shape — only this chapter may use it.)' },
];

/** Hook first-word CLASS — the auditClass vocabulary pedagogyPlan/B13 use. A
 *  dealt class fixes the hook's opening MOVE so first words spread across the
 *  book instead of all opening "what". */
export const HOOK_OPENER_CLASSES: Array<{ id: string; directive: string }> = [
  { id: "question", directive: "Open the hook with a concrete question (ends in '?'). Avoid starting consecutive hooks with the same question word." },
  { id: "direct_address", directive: "Open with 'You'/'Your' — put the reader at the threshold where the idea bites." },
  { id: "numeric", directive: "Lead with one number written as digits (a count, time, ratio) that creates contrast." },
  { id: "first_person", directive: "Open with a brief first-person admission that exposes the misconception." },
  { id: "declarative_image", directive: "Open with a vivid concrete image/object in motion — no question, no digits, no 'you'." },
];

export type RhetoricAllocation = { counterShape: CounterShape; counterDirective: string; hookOpenerClass: string; hookDirective: string };
export type RhetoricPlan = {
  schemaVersion: "rhetoric-plan-v1";
  bookId: string;
  createdAt: string;
  allocation: Record<number, RhetoricAllocation>;
  diagnostics: { counterShapeCounts: Record<string, number>; hookClassCounts: Record<string, number> };
};

function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function planRhetoric(bookId: string, from: number, to: number): RhetoricPlan {
  // Defensive: a NaN/<1/inverted range from the CLI would index the rotation
  // with a negative modulo (undefined shape entries).
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from) {
    return { schemaVersion: "rhetoric-plan-v1", bookId, createdAt: new Date().toISOString(), allocation: {}, diagnostics: { counterShapeCounts: {}, hookClassCounts: {} } };
  }
  const counterOffset = fnv1a(bookId) % COUNTER_SHAPES.length;
  const hookOffset = fnv1a(`${bookId}:hook`) % HOOK_OPENER_CLASSES.length;
  const allocation: Record<number, RhetoricAllocation> = {};
  const counterShapeCounts: Record<string, number> = {};
  const hookClassCounts: Record<string, number> = {};
  for (let n = from; n <= to; n++) {
    // Absolute chapter index (not relative to `from`) so a single-chapter redo
    // gets the SAME assignment it had in the full-book deal — re-dispatch must
    // hand a drifted chapter its original varied shape, not a new one.
    const idx = n - 1;
    const counter = COUNTER_SHAPES[(counterOffset + idx) % COUNTER_SHAPES.length];
    const hook = HOOK_OPENER_CLASSES[(hookOffset + idx) % HOOK_OPENER_CLASSES.length];
    allocation[n] = { counterShape: counter.id, counterDirective: counter.directive, hookOpenerClass: hook.id, hookDirective: hook.directive };
    counterShapeCounts[counter.id] = (counterShapeCounts[counter.id] ?? 0) + 1;
    hookClassCounts[hook.id] = (hookClassCounts[hook.id] ?? 0) + 1;
  }
  const N = to - from + 1;
  // Invariants apply only at the book-gate threshold (B11/B13/B14 don't fire for
  // < 5 chapters), so a single-chapter redo or small sub-range never throws.
  // Round-robin satisfies the caps for any contiguous range ≥ 5; the assert
  // guards against a future palette/length change breaking the math.
  if (N >= 5) {
    // B14 caps EVERY counter shape at 0.40 (not just negation_correction) — and
    // a profile-less fresh book gets the 0.40 default (the author-voice
    // relaxation is never wired in bookGate/cli). daring-greatly ships its top
    // two shapes at 42.9%, so we must keep the MAX of all shapes < 0.40, not
    // only the negation shell.
    const maxCounter = Math.max(0, ...Object.values(counterShapeCounts));
    if (maxCounter / N >= 0.4) {
      throw new Error(`rhetoric-plan invariant violated: a counter shape lands ${maxCounter}/${N} >= 0.40 (B11/B14 risk — B14 caps every shape).`);
    }
    // Keep the dominant hook class under 0.45 — strictly under B13's 0.50
    // default so a profile-less fresh book clears the gate with margin (clean
    // books sit at 46-47%).
    const maxHook = Math.max(0, ...Object.values(hookClassCounts));
    if (maxHook / N >= 0.45) {
      throw new Error(`rhetoric-plan invariant violated: a hook class lands ${maxHook}/${N} >= 0.45 (B13 0.50 with margin).`);
    }
  }
  return {
    schemaVersion: "rhetoric-plan-v1",
    bookId,
    createdAt: new Date().toISOString(),
    allocation,
    diagnostics: { counterShapeCounts, hookClassCounts },
  };
}

export function rhetoricPlanPath(bookId: string): string {
  return resolve(RHETORIC_PLANS_DIR, `${bookId}.rhetoric-plan.json`);
}

export function writeRhetoricPlan(plan: RhetoricPlan): string {
  mkdirSync(RHETORIC_PLANS_DIR, { recursive: true });
  const p = rhetoricPlanPath(plan.bookId);
  writeFileSync(p, JSON.stringify(plan, null, 2), "utf8");
  return p;
}

export function loadRhetoricPlan(bookId: string): RhetoricPlan | null {
  const p = rhetoricPlanPath(bookId);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8")) as RhetoricPlan;
  } catch {
    return null;
  }
}

export function formatRhetoricPlan(plan: RhetoricPlan): string {
  const lines = [`Rhetoric plan — ${plan.bookId}`];
  for (const [n, a] of Object.entries(plan.allocation)) {
    lines.push(`  ch${String(n).padStart(2, "0")}: counter=${a.counterShape} | hook=${a.hookOpenerClass}`);
  }
  lines.push(`  counter shape counts: ${JSON.stringify(plan.diagnostics.counterShapeCounts)}`);
  lines.push(`  hook class counts:    ${JSON.stringify(plan.diagnostics.hookClassCounts)}`);
  return lines.join("\n");
}
