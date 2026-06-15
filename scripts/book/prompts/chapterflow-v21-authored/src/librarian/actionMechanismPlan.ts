/**
 * Action-mechanism plan — timingPlan's prevention pattern applied to the try-now
 * ACTION CONTAINER (the `location_stamping` sweep family, action-mechanism variant).
 *
 * THE PROBLEM: timingPlan deals the situational TRIGGER (WHEN to act) and BP29
 * gates reused CLOCK STAMPS, but neither touches the action MECHANISM — the
 * container the practice lives in. So mutually-blind authors reach for the same
 * arbitrary reminder shell: the-daily-stoic put "Set a 10-minute timer" / "Put a
 * calendar event" in ch1, ch2, ch7, ch8, ch10, ch11 (location_stamping x9). The
 * trigger varied; the timer/calendar CONTAINER did not, and no gate saw it.
 *
 * THE FIX: deal each chapter a DISTINCT action mechanism (write a line / say it
 * aloud / move an object / observe-and-count / mark a surface / pre-commit a
 * reply / stack on an existing cue / — and timer-or-calendar only where the
 * chapter is genuinely about scheduling). The deterministic BP30 gate catches any
 * residual container reuse across try-now fields; this allocator keeps it from
 * happening in the first place.
 *
 * RECONCILIATION: pedagogyPlan deals a `tacticFamily` (the chapter's marquee
 * TEACHING tactic). This plan governs ONLY the try-now / 24-hour ACTION field —
 * a narrower surface. The directive is scoped to "tryThisNow + the 24-hour
 * challenge" so it does not fight the teaching tactic.
 *
 * Deterministic and a PURE function of (bookId, n): FNV-1a(bookId) rotation +
 * stride-1 round-robin over the mechanism palette, keyed on absolute n-1 (a
 * single-chapter redo gets the same mechanism).
 */

import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url)); // .../src/librarian
const ACTION_MECHANISM_PLANS_DIR = resolve(__dirname, "../../state/action-mechanism-plans");

/** Distinct action CONTAINERS for the try-now / 24-hour action. Each is a
 *  different physical/verbal shape the practice takes — NOT a reskin of "set a
 *  reminder". {behavior}/{moment} are filled by the author with this chapter's
 *  own subject. Keep ≥ 8 so round-robin keeps any one mechanism well under the
 *  BP30 density floor. `timer_or_calendar` is included so it can legitimately own
 *  the one chapter that is actually about scheduling — but its directive forbids
 *  it everywhere else, which is exactly the container that over-recurred. */
export const ACTION_MECHANISMS: Array<{ id: string; directive: string }> = [
  { id: "write_a_line", directive: 'ACTION CONTAINER = WRITE. Have the reader write ONE specific line (a sentence, a label, a single note) about {moment} — a written artifact, not a scheduled reminder.' },
  { id: "say_aloud", directive: 'ACTION CONTAINER = SAY. Have the reader say ONE sentence aloud (to themselves or another person) the next time {moment} — a spoken rehearsal, not a timer.' },
  { id: "move_an_object", directive: 'ACTION CONTAINER = MOVE AN OBJECT. Have the reader physically move or reposition ONE object (turn the phone face-down, move a chair, set an item where they will see it) as the cue for {behavior}.' },
  { id: "observe_and_count", directive: 'ACTION CONTAINER = OBSERVE & COUNT. Have the reader notice and tally one specific thing ("count how many times {behavior} happens before noon") — a noticing task, not a scheduled block.' },
  { id: "mark_a_surface", directive: 'ACTION CONTAINER = MARK A SURFACE. Have the reader put one word or symbol on a surface they already see (a sticky note, the phone wallpaper, a margin) to cue {behavior}.' },
  { id: "pre_commit_a_reply", directive: 'ACTION CONTAINER = PRE-WRITE THE WORDS. Have the reader draft the ACTUAL words they will use next time {moment} (the reply, the ask, the refusal) — pre-written, not merely planned.' },
  { id: "stack_on_existing_cue", directive: 'ACTION CONTAINER = HABIT-STACK. Have the reader attach the action to an object/place they already touch daily (the kettle, the doorknob, the laptop lid) — a habit-stack cue, NOT a clock alarm or calendar event.' },
  { id: "rehearse_once", directive: 'ACTION CONTAINER = ONE REHEARSAL. Have the reader stage {moment} once and walk through the move physically — a single dress rehearsal, not a reminder to do it later.' },
  { id: "timer_or_calendar", directive: 'ACTION CONTAINER = TIMER/CALENDAR — use this ONLY because this chapter is genuinely about time, scheduling, or a fixed window. Anchor a timer or calendar block to {moment}. (Every other chapter must AVOID the timer/calendar container.)' },
];

export type ActionMechanismAllocation = { mechanismId: string; directive: string };
export type ActionMechanismPlan = {
  schemaVersion: "action-mechanism-plan-v1";
  bookId: string;
  createdAt: string;
  allocation: Record<number, ActionMechanismAllocation>;
  diagnostics: { mechanismCounts: Record<string, number> };
};

function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function planActionMechanisms(bookId: string, from: number, to: number): ActionMechanismPlan {
  // Defensive: a NaN/<1/inverted range from the CLI would index the rotation
  // with a negative modulo (undefined mechanism entries).
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from) {
    return { schemaVersion: "action-mechanism-plan-v1", bookId, createdAt: new Date().toISOString(), allocation: {}, diagnostics: { mechanismCounts: {} } };
  }
  const offset = fnv1a(`${bookId}:action-mechanism`) % ACTION_MECHANISMS.length;
  const allocation: Record<number, ActionMechanismAllocation> = {};
  const mechanismCounts: Record<string, number> = {};
  for (let n = from; n <= to; n++) {
    const idx = n - 1; // absolute → single-chapter redo matches the full deal
    const mech = ACTION_MECHANISMS[(offset + idx) % ACTION_MECHANISMS.length];
    allocation[n] = { mechanismId: mech.id, directive: mech.directive };
    mechanismCounts[mech.id] = (mechanismCounts[mech.id] ?? 0) + 1;
  }
  const N = to - from + 1;
  // Invariant only at the BP30 density threshold (a short redo never throws).
  // Round-robin over ≥8 mechanisms keeps any one container at ceil(N/8); the
  // assert guards a future palette shrink. Cap sits strictly under BP30's gate
  // fraction so the deal clears with margin (deal-cap < gate ordering).
  if (N >= 5) {
    const maxMech = Math.max(0, ...Object.values(mechanismCounts));
    if (maxMech / N >= 0.34) {
      throw new Error(`action-mechanism-plan invariant violated: one mechanism lands ${maxMech}/${N} >= 0.34 (BP30 risk).`);
    }
  }
  return {
    schemaVersion: "action-mechanism-plan-v1",
    bookId,
    createdAt: new Date().toISOString(),
    allocation,
    diagnostics: { mechanismCounts },
  };
}

export function actionMechanismPlanPath(bookId: string): string {
  return resolve(ACTION_MECHANISM_PLANS_DIR, `${bookId}.action-mechanism-plan.json`);
}

export function writeActionMechanismPlan(plan: ActionMechanismPlan): string {
  mkdirSync(ACTION_MECHANISM_PLANS_DIR, { recursive: true });
  const p = actionMechanismPlanPath(plan.bookId);
  writeFileSync(p, JSON.stringify(plan, null, 2), "utf8");
  return p;
}

export function loadActionMechanismPlan(bookId: string): ActionMechanismPlan | null {
  const p = actionMechanismPlanPath(bookId);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8")) as ActionMechanismPlan;
  } catch {
    return null;
  }
}

export function formatActionMechanismPlan(plan: ActionMechanismPlan): string {
  const lines = [`Action-mechanism plan — ${plan.bookId}`];
  for (const [n, a] of Object.entries(plan.allocation)) {
    lines.push(`  ch${String(n).padStart(2, "0")}: ${a.mechanismId}`);
  }
  lines.push(`  mechanism counts: ${JSON.stringify(plan.diagnostics.mechanismCounts)}`);
  return lines.join("\n");
}
