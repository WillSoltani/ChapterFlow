// Canonical learning-loop step vocabulary.
// Single source of truth for the 4-step loop used across the in-app
// progress indicators and the marketing "How it works" surface.
// Keep this in sync with the gloss in components/sections/HowItWorks.tsx.

export const LEARNING_LOOP_STEPS = ["Summary", "Scenarios", "Quiz", "Unlock"] as const;
export const LEARNING_LOOP_STEPS_SHORT = ["Sum", "Scen", "Quiz", "Unlk"] as const;
