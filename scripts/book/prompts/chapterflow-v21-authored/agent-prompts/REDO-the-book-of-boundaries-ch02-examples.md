# REDO — the-book-of-boundaries ch02 example slate (example_coherence)

**Scope:** ch02 only (`state/chapters/the-book-of-boundaries-ch02.v21-native.chapter.json`).
**Verdict that triggered this:** YELLOW / REVISE (no corruption). QC reviewer
`claude-qc:boundaries-20260609`. Every quiz key is correct and the prose, cards,
plan, and memorable lines are publishable — **do not touch them.** The only defect
is a shared skeleton across the example scenarios.

## Why this redo exists

`example_coherence` GENERATED_DRAFT hit: **5 of 6 example `scenario` fields open with
one interchangeable template** —

> "[Name] meets a request at [precise clock time] in [place]; must answer before
> [the window closes]."

Verbatim openers (note the clock-stamp in each):
- **ex01** "Jordan hears, 'Can you take one more slide?' during Tuesday's **11:40 a.m.**
  project meeting … Jordan must answer before the agenda moves on."
- **ex02** "Anatole counts four pizza boxes before the board-game night starts at
  **7:15 p.m.** in the church basement … needs to say no before the joke becomes a
  group project."
- **ex03** "Brigitte's calendar already shows three red blocks when the reunion
  invitation appears **Sunday night** at the kitchen table … has to answer before the
  thread fills."
- **ex04** "Benoit pins a Green note beside the clinic check-in tablet at **8:05 a.m.**
  … needs to choose the next color before the waiting room copies the behavior."
- **ex05** "Zoe's phone lights with three studio messages … at **9:20 p.m.** … must
  answer before the sign-up sheet fills."

The deterministic gates CANNOT catch this (clock times and decision language are
legitimate); a per-scene read passes too. The other 11 chapters of this same book
deliberately vary their openers (mid-action, dialogue-first, object-first, aftermath,
counted-items) — ch02 is the lone outlier. Use those chapters as the target.

## What changes

**ONLY** `examples[0..4].scenario` (ex01–ex05) — rewrite the **opening framing** so the
six scenes no longer share one entry template. Specifically:
- At most **2 of 6** scenarios may open with a clock time. Drop the rest.
- No single sentence template may describe **≥4 of the 6** scenes. Vary the entry:
  start one in mid-action, one with a line of dialogue, one with a physical object,
  one with an aftermath/consequence, etc. — the way ch01/ch04/ch09/ch10 already do.
- Keep each scenario the **same length, same domain, same situation, same teaching
  beat, and the same closing stakes** — only the *shape of the opening* changes.

## What must NOT change (hold these exactly)

- **All quiz questions, choices, and `correctIndex` values** — every key is verified
  correct; do not renumber, reorder, or reword.
- `breakdown` (fastRead/deepRead/fullRead), `reviewCards`, `implementationPlan`,
  `memorableLines`, `hook`, `counterintuition`, `tryThisNow`, `keyTakeaway`.
- Per example: `exampleId`, `sourceAnchorId`, `title`, `tags`, `planSpec` (keep each
  scene's `format` and `domain`), `whatToDo`, `whyItMatters`, and the **protagonist
  name** (Jordan, Anatole, Brigitte, Benoit, Zoe, Lane) and the **color rung** each
  scene teaches (Green / firm-no / 24-hour-maybe / Green→Yellow→Red / 24-hour-maybe /
  Red follow-through). ex06 (Lane) is already fine — leave it.

## Per-field composition rule

`scenario` = one short paragraph that (a) opens with a **distinct** framing per the
list above, (b) names the concrete request/pressure, (c) ends on the decision the
protagonist must make. The reader should not be able to write one sentence that
matches all six openings.

## Done-condition

1. `npx tsx src/cli.ts gate-chapter state/chapters/the-book-of-boundaries-ch02.v21-native.chapter.json`
   → `Gate verdict: PASS — 0 blockers`.
2. `npx tsx src/cli.ts book-gate the-book-of-boundaries` → `Book gate: PASS`, 0 blockers.
3. Re-QC confirms ex01–ex05 no longer share one opening template (≤2 clock-time
   openers; no sentence describes ≥4/6 scenes) **and** the quiz/keys are byte-identical.
4. Editing the chapter will make the QC hash go **STALE** — the chapter must be
   re-attested (`qc-attest … --verdict PUBLISHABLE`) after the reviewer re-reads it.
   `promote-book` blocks until ch02 is PASS again.
