/**
 * Callback plan — rhetoricPlan's prevention pattern applied to the spaced-recall
 * review card (the `repeated_unit` sweep family).
 *
 * THE PROBLEM: the spaced-recall instruction was a single hardcoded line
 * ("resurface a concept from an EARLIER chapter") with NO allocator. Every
 * mutually-blind author independently reached for the book's most salient
 * foundational concept and the same question shell, so the book converged — the-
 * daily-stoic shipped 6 of 13 review-card fronts as "How does January's control
 * filter help with X?" with only the object swapped. That is the single highest-
 * frequency genuine REVISE driver, and no per-chapter gate can see it.
 *
 * The fix is PREVENTION: deal each chapter (n>1) a DISTINCT prior chapter to
 * call back to AND a DISTINCT question FRAME, so the callback unit can't
 * collapse to one concept+shell. The deal is the TARGET — a re-dispatched
 * chapter gets the SAME assignment, so a drifted card converges on re-write.
 *
 * Deterministic (no RNG), like the sibling plans: a FNV-1a(bookId) rotation
 * picks the starting frame and a stride-1 round-robin spreads frames evenly
 * (with N chapters over K frames every frame lands ~N/K times, under the BP28
 * density cap). The callback TARGET walks the prior chapters with a coprime
 * stride so it isn't always chapter 1.
 */

import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url)); // .../src/librarian
const CALLBACK_PLANS_DIR = resolve(__dirname, "../../state/callback-plans");

/** Distinct spaced-recall question SCAFFOLDS. Each is a different question MOVE,
 *  not "How does X help with Y" reskinned — so even two cards that call back to
 *  the same prior chapter read as different retrieval practice. {concept} and
 *  {k} are filled by the author with the real prior concept + chapter number. */
export const RECALL_FRAMES: Array<{ id: string; directive: string }> = [
  { id: "apply_here", directive: 'Front: "How would {concept} (Ch {k}) change the way you handle THIS chapter\'s situation?" — force transfer, not restatement.' },
  { id: "where_it_misleads", directive: 'Front: "Where does {concept} (Ch {k}) help here — and where would leaning on it mislead you?" — ask for the boundary, not the definition.' },
  { id: "connect_moves", directive: 'Front: "In one sentence, connect {concept} (Ch {k}) to this chapter\'s core move." — a synthesis prompt across two ideas.' },
  { id: "naive_failure", directive: 'Front: "What does {concept} (Ch {k}) get WRONG if you applied it naively to this chapter\'s case?" — a falsification prompt.' },
  { id: "name_the_moment", directive: 'Front: "Recall {concept} (Ch {k}): name one concrete moment in this chapter where it actually bites." — retrieval anchored to a scene.' },
  { id: "which_matters_more", directive: 'Front: "Which matters more in this chapter\'s situation — {concept} (Ch {k}) or this chapter\'s idea — and why?" — a comparison prompt.' },
  { id: "restate_then_use", directive: 'Front: "Restate {concept} (Ch {k}) in your own words, then use it on this chapter\'s problem." — two-step elaboration.' },
];

export type CallbackAllocation = { callbackChapter: number; frameId: string; directive: string };
export type CallbackPlan = {
  schemaVersion: "callback-plan-v1";
  bookId: string;
  createdAt: string;
  /** chapter number (n>1) → the prior chapter to call back to + the question frame. */
  allocation: Record<number, CallbackAllocation>;
  diagnostics: { frameCounts: Record<string, number>; targetCounts: Record<number, number> };
};

function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** A prior chapter in [1, n-1], walked with a coprime stride so the callback
 *  target spreads across the book instead of every card pointing at chapter 1. */
function callbackTargetFor(bookId: string, n: number): number {
  const span = n - 1; // n > 1 guaranteed by the caller
  if (span <= 1) return 1;
  const offset = fnv1a(`${bookId}:recall:target`);
  // Stride 2 is coprime with most spans; the modulo keeps the target in range.
  return 1 + ((offset + (n - 1) * 2) % span);
}

export function planCallbacks(bookId: string, from: number, to: number): CallbackPlan {
  // Defensive: from/to come from parseInt(flags) at the CLI — a NaN/<1/inverted
  // range would otherwise index the frame rotation with a negative modulo
  // (undefined entries). ch1 legitimately yields an empty allocation (no prior
  // chapter to call back to); that is correct, not an error.
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from) {
    return { schemaVersion: "callback-plan-v1", bookId, createdAt: new Date().toISOString(), allocation: {}, diagnostics: { frameCounts: {}, targetCounts: {} } };
  }
  const frameOffset = fnv1a(`${bookId}:recall:frame`) % RECALL_FRAMES.length;
  const allocation: Record<number, CallbackAllocation> = {};
  const frameCounts: Record<string, number> = {};
  const targetCounts: Record<number, number> = {};
  for (let n = Math.max(from, 2); n <= to; n++) {
    // Absolute chapter index (not relative to `from`) so a single-chapter redo
    // gets the SAME assignment it had in the full-book deal.
    const idx = n - 1;
    const frame = RECALL_FRAMES[(frameOffset + idx) % RECALL_FRAMES.length];
    const callbackChapter = callbackTargetFor(bookId, n);
    allocation[n] = { callbackChapter, frameId: frame.id, directive: frame.directive };
    frameCounts[frame.id] = (frameCounts[frame.id] ?? 0) + 1;
    targetCounts[callbackChapter] = (targetCounts[callbackChapter] ?? 0) + 1;
  }
  const N = Object.keys(allocation).length;
  // Invariant only at the BP28 density threshold (a short redo never throws).
  // Round-robin spreads frames evenly; the assert guards a future palette change.
  if (N >= 5) {
    const maxFrame = Math.max(0, ...Object.values(frameCounts));
    if (maxFrame / N >= 0.4) {
      throw new Error(`callback-plan invariant violated: one recall frame lands ${maxFrame}/${N} >= 0.40 (BP28 risk).`);
    }
  }
  return {
    schemaVersion: "callback-plan-v1",
    bookId,
    createdAt: new Date().toISOString(),
    allocation,
    diagnostics: { frameCounts, targetCounts },
  };
}

export function callbackPlanPath(bookId: string): string {
  return resolve(CALLBACK_PLANS_DIR, `${bookId}.callback-plan.json`);
}

export function writeCallbackPlan(plan: CallbackPlan): string {
  mkdirSync(CALLBACK_PLANS_DIR, { recursive: true });
  const p = callbackPlanPath(plan.bookId);
  writeFileSync(p, JSON.stringify(plan, null, 2), "utf8");
  return p;
}

export function loadCallbackPlan(bookId: string): CallbackPlan | null {
  const p = callbackPlanPath(bookId);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8")) as CallbackPlan;
  } catch {
    return null;
  }
}

export function formatCallbackPlan(plan: CallbackPlan): string {
  const lines = [`Callback plan — ${plan.bookId}`];
  for (const [n, a] of Object.entries(plan.allocation)) {
    lines.push(`  ch${String(n).padStart(2, "0")}: callback→ch${a.callbackChapter} | frame=${a.frameId}`);
  }
  lines.push(`  frame counts:  ${JSON.stringify(plan.diagnostics.frameCounts)}`);
  lines.push(`  target counts: ${JSON.stringify(plan.diagnostics.targetCounts)}`);
  return lines.join("\n");
}
