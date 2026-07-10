# F-09 — Harm-semantic complaint classifier + sub-band second-opinion guard

**Prompt 9** of `V24_PIPELINE_FIX_PROMPTS.md`. Branch `feat/anti-sameness-live-fix`.
No push / publish / deploy. Thresholds (floor 74, +5 margin, bar 80) untouched.

## Files changed
- `src/orchestrator/authorReview.ts`
  - Replaced the two substring nets (`RESERVED_HARM_RX` / `SUBJECTIVE_ONLY_RX`) with a
    table-driven, context-anchored classifier: `classifyComplaintHarm(text) → "block" |
    "downgrade" | "ambiguous"` (exported) backing `complaintNamesReservedHarm`. Ambiguous
    still → block (fail-direction unchanged).
  - Added `needsSecondOpinion(review, bar, band)` — the sub-band trigger (valid, clean-keyed,
    `ship84=false`, NOT near-bar, ≥1 complaint, none reserved-harm).
  - Added `subBandSecondOpinion(...)` — spawns exactly ONE independent read; the better read
    stands only on a genuine independent PASS (persisted last, tiebreak note); otherwise the
    original FAIL stands and its + the second read's complaints ride the regen.
  - Wired the guard as a bounded phase between the near-bar tiebreak and the `failing`
    computation, gated on `!regenExhausted` (only chapters that could still regen).
- `tests/reserved-harm-corpus.test.ts` (new) — the labeled corpus table test + the four
  required discriminations. **+2 tests.**
- `tests/author-arch.test.ts` — three guard ledger/integration tests appended. **+3 tests.**

## Classifier design (harm-semantics, not substrings)
Three signals, decided BLOCK-wins-over-AESTHETIC, else ambiguous→block:
- **BLOCK** (asserts a reserved defect): safety; factually-wrong/untrue (the *fact/date/number/
  quote* is wrong); fabrication/misleading; **key-or-answer *is* wrong** (subject-then-defect,
  anchored so "distractors are broadly wrong" and quiz *tells* never fire, and "not a broken
  key" / "keys are sound" never fire); multiple-correct; structural missing/duplicate/broken/
  render; unusable; self-contradiction (possessive/self anchor, so a *distractor* contradicting
  the chapter is fair design and does not block).
- **AESTHETIC**: quiz-tell / guessable / too-easy; thin-but-usable / slot-filler; prose taste /
  density / beginner-abstraction; key-soundness AFFIRMATIONS.

## Labeled corpus — before/after classification diff
34 entries (state-derived + rubric + required synthetics). "Blocks" = classifier returns
true (block **or** ambiguous); "downgrades" = false. 12 entries reclassify vs the old nets;
**all moves are into or within the safe set as justified below — no genuine-harm phrasing
moved from block→downgrade.**

| # | phrasing (truncated) | old | new | why the move is safe |
|---|---|---|---|---|
| 1 | "…creating answer tells even for readers who skim" | block | downgrade | quiz tell; keys sound. Old fired on substring `answer`. |
| 2 | "…distractors are broadly wrong, creating some answer-key tells" | block | downgrade | distractors *being* wrong = correct design; a tell. Old fired on `wrong`/`answer`/`key`. |
| 3 | "Some distractors are too obviously wrong because they endorse rank…" | block | downgrade | too-easy tell; distractor wrongness is by design. Old fired on `wrong`/`answer`. |
| 4 | "…this is a quiz tell, not a broken key." | block | downgrade | explicit key-sound affirmation. Old fired on `broken`/`key`/`answer`. |
| 5 | "The quiz is fair and key-sound, but it overweights founder/date…" | block | downgrade | key-sound affirmation + weighting taste. Old fired on `key`. |
| 6 | "The keyed answer is sound, but '…' is more abstract…" | block | downgrade | keyed answer sound; abstraction taste. Old fired on `answer`/`key`. |
| 7 | "Some correct choices are easier to guess…distractors…obviously wrong" | block | downgrade | guessable tell. Old fired on `wrong`. |
| 8 | "The answer feels generic." *(required)* | block | downgrade | aesthetic. Old fired on `answer`. |
| 9 | "…ends with a vague question rather than stating what proof returned" | ambiguous | downgrade | `vague` craft, usable. Old had no subjective hit → ambiguous(block). |
| 10 | "Distractor c is too easy to eliminate…contradicts the repeated order of the chapter" | block | downgrade | too-easy distractor; `contradicts the repeated order of the chapter` has no possessive/self anchor → not self-contradiction. Old fired on `contradict`. |
| 11 | "The example implies something untrue." *(red-team)* | ambiguous | block | `untrue` now names a factual defect (still blocks — no behavior change, tighter reason). |
| 12 | "The example is filler, teaches nothing, and is unusable." *(required, Req-2)* | downgrade | block | `filler` co-occurs with unusability → block now wins. **Req-2 recovery.** |

The remaining 22 entries are unchanged (block stays block, downgrade stays downgrade), incl.
the collision guards "The pacing makes the safety warning unreadable" (block) and "The generic
phrasing states a factually wrong date" (block), where an aesthetic word co-occurs with harm
and BLOCK correctly wins.

**Fail-direction invariant (Requirement 4):** the only complaints that went from
BLOCKING→DOWNGRADING are rows 1–10 (aesthetic quiz-tells / key-sound affirmations / a too-easy
distractor / a vague-but-usable summary) — each is, by the reviewer rubric's own definition,
NOT a mustFix category (a tell, a thin-but-usable example, prose polish). No safety / factual /
structural / fabrication / unusable / self-contradiction phrasing downgraded. Rows 11–12 stay
blocking (11 already blocked via ambiguous; 12 recovered from a wrong downgrade).

## Regen-spend delta (guard, in tests)
`tests/author-arch.test.ts`, all at bar 80 / band 3.7, ch01 composite 60 (sub-band):
- **taste FAIL + shipping second opinion** → `regenConsumedFor(zz,1) === 0` (was 1 before F-09).
  One `-2nd` read, no regen writer. **Saves 1 of 2 lifetime regen writes.**
- **taste FAIL + failing second opinion** → one `-2nd` read, then `regenConsumedFor === 1`
  (regen still spent — the guard never hides a durable fail).
- **reserved-harm FAIL** → zero `-2nd` reads, `regenConsumedFor === 1` (no cheap read wasted).

## Red-team
- **Cost:** the extra read fires only on (valid ∧ clean-keys ∧ ship84=false ∧ sub-band ∧ ≥1
  complaint ∧ no reserved-harm) chapters that are *also* not regen-exhausted — narrow and hard-
  capped at ONE read/chapter/round. It can only ever PREVENT a regen (~14 min) at the cost of
  one read (~1 min).
- **Degenerate/keyword-free complaints** ("implies something untrue") → ambiguous→block still
  catches; added to the corpus.
- **F5 dead-end ordering:** the dead-end pre-check (authorReview.ts ~1396–1416) HALTS the whole
  run before any reader when a chapter's exact bytes already hold a durable FAIL with budgets
  spent. The guard runs far downstream, so a dead-ended chapter never reaches it — it cannot
  resurrect one. Verified by the existing F5 test staying green.

## Suite result
`npx tsc --noEmit` clean. `npx tsx tests/run.ts`: **pass 1856, fail 1, xenv 6, skip 12** (my
+5 tests all green — 3 F-09 guard, 2 corpus). The one `fail` is
`source-anchored-planning.test.ts › source-v2 provenance … precisely`
(`SC11.6.unsupported_anchor` vs `SC11.2.anchor_specific_not_present`) — a source-integrity
anchor-classification detail in the branch's pre-existing WIP `M` files; it imports nothing from
`authorReview` and is independent of this change. The prompt's "14 known" (promote-gate ×9,
cast-discipline, name-commonality, generate-book-promotion, qc-run, drive/daring-greatly) are
counted by this harness as `xenv`/`skip`, not `fail`. No new failing test NAME was introduced.

## Remaining known-ambiguous phrasings (default → block, intentionally)
- "The keyed answer is derivable, but 'without inventing a new source' is less directly
  established than the airline case…" — no aesthetic keyword, no clear defect → ambiguous→block
  (conservative; a genuine key-soundness note).
- "The keyed answer is basically sound by elimination, but 'visible setting' misnames the thing
  being lost" — blocks via `misnames` even though soundness is affirmed (block-safe: it does name
  a wording/validity defect).
- Bare "invented named roles … feel manufactured" downgrades (aesthetic), but "invents a person/
  quote/number that did not happen" blocks (fabrication) — the split rests on `fabricat`/`did not
  happen`/`no such`, not bare `invent`.
