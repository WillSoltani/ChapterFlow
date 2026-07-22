// Implements §6.5 — Contextual referral trigger moments.
// Max 1 per session. Never during a learning loop. Only after ≥3 loops completed.
// Priority system selects highest-priority trigger when multiple qualify.

export type ReferralTriggerType =
  | "book_completion"
  | "tier_advancement"
  | "streak_milestone_7"
  | "hidden_achievement";

export type ReferralTrigger = {
  type: ReferralTriggerType;
  priority: number; // Higher = more important
  copy: string;
};

const TRIGGER_PRIORITY: Record<ReferralTriggerType, number> = {
  book_completion: 4, // Highest
  tier_advancement: 3,
  streak_milestone_7: 2,
  hidden_achievement: 1, // Lowest
};

// §6.5 — Prompt copy (prosocial framing per §6.4)
const TRIGGER_COPY: Record<ReferralTriggerType, (context: Record<string, string>) => string> = {
  book_completion: (ctx) =>
    `You just finished ${ctx.bookTitle ?? "a book"}. Know someone who'd get value from it? Give them a free week.`,
  tier_advancement: (ctx) =>
    `You've reached ${ctx.tierName ?? "a new tier"}. Share ChapterFlow with someone who'd appreciate it — they'll get a free week of Pro.`,
  streak_milestone_7: () =>
    "A full week of learning. Want to bring someone along? Give a friend a free week.",
  hidden_achievement: () =>
    "You just discovered something special. Know a fellow reader who'd enjoy ChapterFlow?",
};

/**
 * Determine if a referral prompt should be shown, and which one.
 *
 * Rules per §6.5:
 * - Max 1 per session (caller manages session state)
 * - Only after ≥3 loops completed (caller passes loopCount)
 * - Returns null if no trigger qualifies
 * - Selects highest-priority trigger
 */
export function selectReferralTrigger(
  events: Array<{
    type: ReferralTriggerType;
    context: Record<string, string>;
  }>,
  loopsCompleted: number,
  alreadyShownThisSession: boolean
): ReferralTrigger | null {
  // §6.5 — Not shown until ≥3 loops
  if (loopsCompleted < 3) return null;

  // §6.5 — Max 1 per session
  if (alreadyShownThisSession) return null;

  if (events.length === 0) return null;

  // Select highest priority
  const sorted = [...events].sort(
    (a, b) => TRIGGER_PRIORITY[b.type] - TRIGGER_PRIORITY[a.type]
  );

  const winner = sorted[0];
  if (winner === undefined) return null;
  return {
    type: winner.type,
    priority: TRIGGER_PRIORITY[winner.type],
    copy: TRIGGER_COPY[winner.type](winner.context),
  };
}

// §6.4 — Pre-written editable share message template
export const REFERRAL_SHARE_MESSAGE =
  "I've been using ChapterFlow to learn key ideas from nonfiction books — it's the best way I've found to actually retain what I read. Here's a free week of Pro, on me:";
