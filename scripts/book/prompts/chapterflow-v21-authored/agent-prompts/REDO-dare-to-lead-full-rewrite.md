# Redo dare-to-lead — FULL STEP-2 REWRITE (all 8 chapters)

This is **not** a surgical patch. The book passes every gate GREEN
(`book-gate dare-to-lead` → PASS, 0 blockers, 0 majors) yet the actual
content is templated word-salad in multiple fields across all 8 chapters.
No critic fires, so there is no field to "nudge" — the generation itself
is broken. **Delete the chapter JSONs and regenerate from scratch** with the
current `STEP-2-WRITE-CHAPTERS.md`, after fixing the root cause below.

## Root cause — fix this FIRST (or the rewrite repeats the defect)

`.chapterflow/` is **empty**. There are **no source sidecars** for
dare-to-lead:
`.chapterflow/runs/dare-to-lead/<runId>/sidecars/source/ch{NN}.source.json`
do not exist. The writer had no grounded named cases from the real book, so
it filled templates with **concept labels used as physical objects and
people** ("Cleo lifts a productive vulnerability folder and points toward
John Gottman trust research"). **Re-run Step 1 (research) so real source
sidecars exist on disk**, confirm with `check-source dare-to-lead`, then
regenerate Step 2. Do not regenerate chapters against missing/fake source.

## What was shipped (verbatim broken output)

**1. `breakdown.fullRead` — catastrophic templated loop in ALL 8 chapters**
(repetition ratio 0.78–0.86). After 1–2 real sentences it degenerates into
the same clause repeated ~25× with only the actor label rotating. ch01:

> "Square Squad exercise keeps productive vulnerability tied to Productive
> vulnerability means acknowledging uncertainty, risk, and emotional exposure
> while staying boundaried and oriented. John Gottman trust research keeps
> productive vulnerability tied to Productive vulnerability means
> acknowledging uncertainty… [repeats ~25 times]"

`fullRead` is the longest reading tier and is unreadable in every chapter.
(`fastRead` and `deepRead` are mostly fine — coherent, if label-prefixed.)

**2. `examples[].scenario` — concept-label-as-object/actor word-salad**

> "Cleo lifts a productive vulnerability folder and points toward John
> Gottman trust research." (ch01-ex03)
> "Beatriz keeps Square Squad exercise inside a productive vulnerability
> notebook with a Square Squad exercise list." (ch01-ex02)

Concept names ("John Gottman trust research", "Square Squad exercise") are
not objects you hold or rooms you stand in. Scenarios must be concrete human
situations.

**3. `examples[].whatToDo` — internal template directive leaked into prose**

> "Tie unearned criticism could steer a promotion decision to John Gottman
> trust research; John Gottman trust research **outranks heat**." (ch01-ex03)
> "Let Theodore Roosevelt arena frame choose the first productive
> vulnerability action in product launch retrospective." (ch01-ex01)

`outranks heat`, `Let <label> choose the first <concept> action`, and
`Name the <concept> fact; set the <label> limit; describe the behavior`
are scaffolding strings, not reader-facing instructions. They appear
book-wide.

**4. `quiz` — templated non-explanations (all 72) + ≥1 wrong answer key**

Every one of the 72 `explanation` fields is `"<keyed choice text>.
<question text>"` — it restates the keyed choice and the prompt, never
explaining *why*. Because the explanation just echoes the key, it cannot
catch a wrong key — and one is wrong:

> **ch01 Q1**: "A product lead is stung by harsh online comments after a
> launch misses its mark."
> [0] "Let the whole comment thread steer the release plan." ← **marked correct**
> [2] "Filter serious feedback through the small circle that has earned access." ← actually correct
> `correctIndex` = 0. This is the `hooked` defect (wrong answer keyed correct).

(The other 71 keys read correct on inspection, but with echo-explanations
that is luck, not verification. Re-derive and re-check every key.)

**5. `implementationPlan` (ifThenPlans / 24h / weekly)** — heavily templated
with concept labels as grammatical subjects; degraded but secondary to the above.

## What MUST be true after the rewrite (per field)

- **breakdown.fullRead** — original explanatory prose, longer and deeper than
  deepRead, **zero** repeated sentence templates. No clause should appear more
  than once. It must teach the chapter's ideas in plain human prose.
- **examples[].scenario** — a concrete workplace moment with a real human
  actor doing a real action. A concept name may be *referenced* ("she applies
  the Square Squad idea") but **never** held, lifted, opened, or stood inside.
- **examples[].whatToDo** — plain reader instruction. Banned substrings
  anywhere in output: `outranks heat`, `Let <X> choose the first`,
  `Name the … fact; set the … limit; describe the behavior`,
  `<X> keeps <Y> tied to`.
- **quiz.explanation** — must state *why the keyed choice is right and why the
  others are wrong*. It may not simply restate the choice + question.
- **quiz.correctIndex** — must point at the genuinely correct choice. Verify
  ch01 Q1 → index 2. Re-judge every question.
- **reviewCards** — currently OK (front/back true and coherent); preserve that
  quality.

## Procedure
1. Regenerate Step 1 source for dare-to-lead; confirm `check-source dare-to-lead`
   and read 1–2 sidecars for real named cases.
2. Delete `state/chapters/dare-to-lead-ch{01..08}.v21-native.chapter.json` and
   regenerate all 8 with the current `STEP-2-WRITE-CHAPTERS.md`.
3. Per chapter: `npx tsx src/cli.ts gate-chapter state/chapters/dare-to-lead-ch{NN}.v21-native.chapter.json` → 0 blockers.
4. `npx tsx src/cli.ts book-gate dare-to-lead` → 0 blockers.

## Done condition (gates are necessary but NOT sufficient)
- Per-chapter gate-chapter: 0 blockers. Book gate: 0 blockers.
- **AND** a human/QC read confirms: `fullRead` has no repeated templates in any
  chapter; no `examples[].scenario` uses a concept label as an object/actor; no
  output contains the banned scaffolding substrings; ch01 Q1 keys index 2 and a
  spot-read of explanations shows real justification, not restatement.

Report back: per-chapter blocker count, book-gate blocker count, and confirm
the four content fixes above by quoting one corrected ch01 example.
