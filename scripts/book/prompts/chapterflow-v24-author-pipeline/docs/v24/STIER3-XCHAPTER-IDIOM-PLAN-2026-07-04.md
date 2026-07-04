# STIER-3: cross-chapter idiom variation (plan) — 2026-07-04

Owner GO ("proceed as recommended") after the round-2 halt: book panel 76.2/churn HIGH
with chapter reviews at 87.4–88.9. All three panel readers named the SAME residual:
cross-chapter sameness — shared framework idiom ("promise/proof/person/return" verbalized
identically in every chapter), repeated What-to-do/Why-it-matters phrasing shells, same
case mechanics. Per-chapter regens cannot fix this (proven: churn-routed regen dropped
ch03 87.4 → 83.3); the fix belongs at brief-compile, where all nine writers diverge by
construction — the same shift-left doctrine as every prior lever.

## Levers (v4 rotation schema)

### P17 — framework idiom deals
Each chapter draws 2–3 IDIOM FAMILIES for verbalizing the book's framework nouns
(pool ~9: mechanism-speak "the loop that closes", people-speak "who owes whom what by
when", artifact-speak "the date written where the team reads it", cost-speak, question-
speak, contrast-speak, motion-speak, ledger-speak, sensory-speak). Dealt via
dealDistinctSet (2/3 cap, stride) like every pool. VARIETY line: "FRAMEWORK IDIOM: when
the framework recurs beyond your noun budget, verbalize it through YOUR dealt families
(<examples>); other chapters own other idioms."

### P18 — example-shell idiom deals
Per chapter, ONE shell register for whatToDo/whyItMatters SENTENCE OPENERS (pool ~6:
verb-first imperative, condition-first, actor-first, artifact-first, cost-first,
question-first) + the rule that no two of the chapter's examples open both fields the
same way. This is the CHAPTER-level complement to the per-slot arc fieldStyle (which the
panel proved insufficient book-wide).

### Mechanics
- ROTATION_SCHEMA_VERSION → "brief-rotation-v4"; new BriefRotation + ChapterBriefV1
  fields `idiomFamilies: string[]`, `shellRegister: string`. BR6 all-or-none extends to
  the v4 pair; BR8 spread caps advisory for idiom families.
- Version bump RE-KEYS every lineage (C1 contract: new design = fresh budgets) — this is
  the DELIBERATE re-deal that gives ch03 its write budget back. Other chapters keep
  their bytes + hash-bound PASS reviews (reviews bind to content, not briefs).
- Card: the two VARIETY lines only; no new gates (the panel is the instrument; adding
  lexical idiom-meters would repeat the CHB14/15 inversion mistake).

## Execution finish path
1. Implement + test (suite == 15 canonical) + commit.
2. Recompile briefs (v4 deals stamp; all lineages re-key).
3. Delete ch03's chapter file only → conductor writes it fresh under the v4 brief
   (idiom + shell deals + all v3 deals re-dealt), reviews it, then acceptance re-runs
   (round-1 semantics again — fresh acceptance records).
4. HONEST EXPECTATION: only ch03 carries the new idiom texture this round; the panel
   samples 4 chapters. If churn holds HIGH on the other chapters' residual sameness,
   the decision point returns to the owner: regen more 87+ chapters under v4 (each is
   the proven-risky rewrite of a good chapter) vs ship-hold. Do NOT auto-regen good
   chapters on churn routing — tonight proved that trade negative (B17 in the ledger).

## Status
- 2026-07-04: plan written post-halt; implementation starting. Repair lane (`81a589bb2`)
  is live for any review-failed incidents in this round.
