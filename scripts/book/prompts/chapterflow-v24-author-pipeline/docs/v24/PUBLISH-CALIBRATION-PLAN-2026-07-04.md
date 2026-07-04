# Publish calibration + external-review fold (plan) — 2026-07-04

Owner directive: the publish bar is too strict; the book (execution: 9/9 chapters at
85.7–88.9, panel 75.0–78.7 across 5 reads, gate 3P/0F, all caps spent) is good —
recalibrate intelligently (blockers → scored where severity warrants), fold the agreed
external-review items, red-team, surgically repair execution, publish it.

## Evidence base (from tonight's durable records)
- Panel noise ±3.7 on near-identical bytes (78.7 vs 75.0, same sample).
- Calibration anchors: atomic-habits (corpus #1) reads 80.2; shipped POM reads 80.0 WITH
  a unanimous correctness-gate FAIL; shipped execution comparable reads 63.4; no real
  book has read ≥84. Bar-80 therefore demands corpus-#1 quality of every book — an
  aspirational S-tier target, not a ship bar.
- Churn verdict fired on all 5 panels through EVERY texture lever (v3+v4) — it saturates
  on genre-inherent framework repetition; as a binary veto it produces only dead ends
  once caps are spent.

## A. Acceptance recalibration (authorReview.ts) — scored, multi-signal
ACCEPT iff: quorum AND gate === PASS (UNWEAKENED — note this is stricter in spirit than
history: shipped POM at 80.0/gate-FAIL would REJECT under this rule while the old world
shipped it) AND composite >= FLOOR (74) AND composite >= beatShipped + MARGIN (5).
- FLOOR 74: below the demonstrated good-book noise band (75.0–78.7), above every
  correctness-broken-era reading. MARGIN +5: "meaningfully better than shipped", not
  noise-equal.
- AUTHOR_BOOK_ACCEPT_BAR (80) stays in the record as the PREMIUM telemetry target.
- Churn HIGH: no longer an accept-time veto. It still drives the targeted repair round
  on REJECT (unchanged machinery, incl. B19's strong-pass filter) and is recorded.
- True blockers preserved end-to-end: schema/gate/counts/keys/provenance/promote chain
  untouched.

## B. CHB2 length: blocker → severity bands (readerBudgets.ts)
±20% window as a hard blocker halted the book over a 1.6% overflow (3 sessions to fix
309 chars). New bands: within ±20% pass; 20–30% out = ADVISORY (scored, non-blocking,
still listed); beyond ±30% = BLOCKER with the existing repair routing ("readers rejected
~40% inflation" stays comfortably protected).

## C. External-review fold (card rules — future books; STATIC text, no schema bump)
1. Hook register: add "tension-thesis" to OPENER_TYPES (direct thesis-with-friction
   hook, no named person required) — the dealt scene-mandate was minting formula hooks.
2. Lesson-facet rule: each example must teach a DIFFERENT facet/failure-mode of the
   move; two examples teaching the same lesson = merge and free the slot.
3. Skill-based cards rule: at most 2 review cards may quiz source-case recall; the rest
   drill the reusable tool in the reader's own terms.
4. Practice naturalness: the action must be something a person would actually do
   unprompted at a desk; if it reads as a ritual, write the plain version.
5. Plain-words for coined compounds: any compressed term the chapter invents (e.g. "the
   return pass") must be unpacked in plain words at first use — vocabulary budgets must
   not mint jargon.
6. Reader-agency line: teach the move so a reader WITHOUT title power can run it on
   their own promises/roles; one example or paragraph carries that angle.
REJECTED from the review (documented): domain-swap of source anchors (EW1 forbids
invented real-world cases; source fidelity is the product), wholesale second-person
examples (its own monotony; variety design), memorable-line-as-motif (saturation meters).
Hooks of ch03/ch05 NOT hand-repaired (dealt-coupled to fastRead opener mode; both passed
3 blinded readers; hook improvements ship via the new opener type for future books).

## D. Surgical repair to execution (repair-lane mechanics, owner-authorized)
Scopes: practice (tryThisNow + implementationPlan) + reviewCards on ch03 + ch05 —
the external review's high-priority field-scoped items. Patch-apply splice + gate +
preflight verify; changed hashes get fresh blinded reviews at the next conductor entry.
Prose/hooks untouched (87.5/88.8 boards stand).

## E. Publish
Final conductor entry WITHOUT --no-publish: carries + fresh reviews for repaired
chapters → recalibrated acceptance → publish evidence chain (key-pack/derive/resolve,
qc-submit/sweep) → promote. Push to origin remains a SEPARATE owner HOLD; prod quiz
grading needs a web deploy to pick up the package (bundled-JSON trap) — noted, not done.

## F. Red-team gate (before the repair/publish steps)
- Could a bad book now pass? Gate-FAIL still rejects (stricter than the shipped
  corpus's own history); 63.4-class books rejected by margin rule; sub-74 rejected.
- Could a good book still loop? CHB2 bands kill the 1.6%-overflow loop class; B17/B19
  stop good-chapter re-rolls.
- Suite must stay == 15 canonical (documented rebases only: acceptance-threshold pins,
  CHB2 band pins); root verify green.
