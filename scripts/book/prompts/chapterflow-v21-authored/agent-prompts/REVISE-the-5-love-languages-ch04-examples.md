# REVISE — the-5-love-languages ch04 (Words of Affirmation): example slate

**Scope:** `state/chapters/the-5-love-languages-ch04.v21-native.chapter.json`, the
`examples[]` array ONLY. Verdict from QC: **YELLOW / generated-draft** (not corruption).
All gates PASS, all 9 quiz keys are correct, prose/cards/plan are fine — do **not** touch them.

## Why this redo exists

The six example `scenario` fields share one structural skeleton — the
`example_coherence` shared-skeleton defect the deterministic gates cannot catch.
Five of six scenes are stamped with a minute-precise evening clock time, and nearly
all follow the same shell:

> **"[Name] is at [place] at [precise p.m. time] holding [a word-carrying object];
> before [an imminent moment], [Name] must say the loving words the right way."**

Verbatim tells (the timestamps):
- ex1 Madeline — "adult-school hallway at **8:20 p.m.**", three drafts, "submission window closes Friday"
- ex3 Sunil — "community dinner podium at **7:40 p.m.**", folded counseling note, "before the microphone reaches him"
- ex4 Romain — "before the car door opens at **9:05 p.m.**", "before the driveway argument hardens"
- ex5 Gilberte — "beside the apartment laundry machines at **6:10 p.m.**", typed accusation, "before sending it"
- ex6 Cedric — "during the **7:12** train commute", phone note, "before the train reaches his stop"

(ex2 Olena fits the shell more loosely — "after work on Friday … before dinner.")

A real author does not timestamp 5 of 6 vignettes to the minute. The lessons
themselves ARE well-differentiated (encouragement / request-vs-demand / public
sincerity / tone / forgiveness / practice), which is why this is YELLOW and not RED —
but the slate reads as mass-produced from one frame, so it is not publishable yet.

## What to change

For the six `examples[].scenario` (and, where it inherits the same shell,
`whatToDo`):

1. **Remove the minute-precise clock times.** At most ONE scene may carry a specific
   time, and only if it does real narrative work. Replace the rest with no time, or a
   natural beat ("after the kids were down", "on the drive home") used sparingly — not
   on every scene.
2. **Break the uniform "before [imminent moment], must [speak]" deadline frame.** Let
   the scenes have genuinely different shapes: a remembered moment, an ongoing habit, a
   quiet realization, a conversation already underway — not all "a ticking deadline
   before one decisive sentence."
3. **Diversify the props.** Right now nearly every scene hinges on a written
   word-carrier (drafts, a note, a typed text, a phone note). Vary them.
4. **Diagnostic to pass:** no single sentence template should describe ≥ half the
   scenes. If you can still write one frame that fits 4+ of the 6, keep revising.

## What must NOT change

- The **six lessons / sub-principles** each scene teaches (encouragement, humble
  request, sincere public praise, tone matching meaning, forgiveness without reloading
  the old charge, practicing as a learned skill). Keep one per scene.
- `exampleId`, `sourceAnchorId`, `tags`, and the chapter's named tool ("Sincere Words
  Check").
- Names already in use elsewhere in the chapter must stay one-name-one-person.
- The quiz, cards, breakdown, implementationPlan, memorableLines — leave untouched.
- Source grounding: keep scenarios faithful to the Words-of-Affirmation source notes.

## Done condition

1. `npx tsx src/cli.ts gate-chapter state/chapters/the-5-love-languages-ch04.v21-native.chapter.json`
   → `Gate verdict: PASS — 0 blockers`.
2. `npx tsx src/cli.ts book-gate the-5-love-languages` → still `Book gate: PASS`, 0 blockers.
3. The revised slate passes the skeleton diagnostic above (no template fits ≥ half the
   scenes; ≤ 1 precise clock time).
4. Re-QC: a reviewer reads the six scenes together and re-attests ch04 with
   `qc-attest … --verdict PUBLISHABLE`. (Editing the JSON will STALE the current REVISE
   attestation automatically, so promote stays blocked until ch04 is re-reviewed.)
