import type { ChapterApplicationState } from "@/app/app/api/book/_lib/types";

/**
 * Two-axis completion (feedback #4) — the celebration copy for the APPLICATION axis.
 *
 * Pure (no React) so the per-state copy + branch decisions are unit-testable and the
 * modal can't drift from them. The application axis is display-only: it gates nothing
 * and awards no IP; the quiz pass stays the sole completion gate.
 *
 * `tone` selects the visual treatment in the modal:
 *   - "applied"   → gold celebration (the real finish line)
 *   - "committed" → neutral confirmation (the plan is set, not yet done)
 *   - "invite"    → dashed invitation pointing at the CommitmentPrompt below
 *
 * `isInvitation` is true ONLY for the "none" state, so the invitation hides the
 * moment a commitment exists — correct under either phase ordering (commit-in-modal
 * or commit-before-quiz).
 */
export type ApplicationAxisTone = "applied" | "committed" | "invite";

export type ApplicationAxisView = {
  tone: ApplicationAxisTone;
  isInvitation: boolean;
  /** Bolded lead-in word(s). */
  label: string;
  /** Honest, non-gamey trailing copy. */
  description: string;
};

export function getApplicationAxisView(
  state: ChapterApplicationState,
): ApplicationAxisView {
  switch (state) {
    case "applied":
      return {
        tone: "applied",
        isInvitation: false,
        label: "Applied",
        description: "you came back and did it.",
      };
    case "committed":
      return {
        tone: "committed",
        isInvitation: false,
        label: "Committed",
        description: "your if-then plan is set. Applying it is the real win.",
      };
    case "none":
    default:
      return {
        tone: "invite",
        isInvitation: true,
        label: "Go use it",
        description: "lock in one if-then action below to put this chapter to work.",
      };
  }
}
