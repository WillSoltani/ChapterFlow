// Canonical learning-loop step vocabulary.
// Single source of truth for the 4-step loop used across the in-app
// progress indicators and the marketing "How it works" surface.
//
// These MUST match the names the live reader shows the user — the in-app
// PhaseStepper (Summary / Examples / Quiz, with Practice as the 4th phase)
// and the landing reader-demo (PhonePhaseStepper: Sum / Ex / Quiz / Prac).
// The earlier "Scenarios" / "Unlock" wording drifted from that shipped UI;
// one concept = one name, so the marketing copy, this lib, and the reader all
// say Summary / Examples / Quiz / Practice now.

export const LEARNING_LOOP_STEPS = ["Summary", "Examples", "Quiz", "Practice"] as const;
export const LEARNING_LOOP_STEPS_SHORT = ["Sum", "Ex", "Quiz", "Prac"] as const;
