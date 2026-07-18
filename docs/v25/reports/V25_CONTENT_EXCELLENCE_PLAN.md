# Content-excellence plan (owner directive 2026-07-15)

Goal: the pipeline reliably produces books like the rubric's top band
(87–90 CDS: difficult-conversations, the-willpower-instinct,
the-power-of-moments, decisive, behave, peak, make-it-stick,
the-checklist-manifesto) — measured by the owner's 9-domain Content Design
Score rubric (`.agents/skills/chapterflow-book-evaluator/references/rubric-v2.md`).

## Diagnosis (four-axis audit, 2026-07-15)

What separates the top band from the bottom, by rubric spread: epistemic
calibration (+1.61), mental-model coherence (+1.25), whole-book coherence
(+1.21), transfer/judgment (+1.16). The whole catalog shares one ceiling
defect: thin quiz feedback + decorative repetition (Learning Architecture /
Retention ≈3.3 even at rank 1).

The pipeline's failure is structural, not random:

1. **The gates hard-enforce shape and are near-blind to ~50% of rubric
   weight.** Blockers cover schema, counts, lengths, corruption tells;
   epistemic calibration (D1, 15%), mechanism/integration depth (D3, 15%),
   implementation-loop closure (D6, 15%), and whole-book coherence (D9) have
   no gate — and everything "texture"-level (sameness, uniform-success,
   evaluator register) is SHADOW (non-blocking) by default.
2. **Three gates actively force low-rubric behavior.** The CHB2 length-repair
   directive orders deletions "starting with the longest breakdown tier" —
   i.e. strip the deepest explanation first (kills D3). The
   E2 + B8/BP24/B15 + CHB2 triangle punishes the re-orientation prose a
   single-tier reader needs, which is what pushed writers into serial tiers.
   Fixed EXACT component quantities create the "template bloat" the rubric
   names at 9.3.
3. **The writer is instructed away from coherence.** The brief's only
   cross-chapter channel says "NOT THIS CHAPTER … never re-teach; at most one
   passing mention" — composition across chapters (D3.3, D5.2, D9) is
   forbidden rather than shaped. No instruction exists for misuse
   safeguards (D1.4), non-shaming tone (D7.3), mechanism-why (D3.2),
   beginner entry (D2.2), staged progress (D7.2), or final-chapter synthesis
   (D9.4). F-1..F-8 ride in the card but only F-2 is gated and the write-time
   self-check covers 5 of 8.
4. **The owner's own gate is not in the loop.** The D7 rubric instrument
   (s16-rubric-audit-v1) renders and verdicts, but has no rater harness, so
   nothing authored ever gets measured against the bar that matters. The v25
   reviewer-qualification apparatus is orthogonal to content quality
   (it governs who may review, not what gets written) and stays out of this
   plan's critical path.

## Changes (three tracks; deliberately minimal)

**Track A — writer instruction stack** (`authorRun.ts`, `compiler/chapterBrief.ts`):
mechanism-why quality-bar line; boundaries/misuse-safeguard + non-shaming
tone lines; beginner-entry line; staged-progress framing; central-model
threading; two-sided integration channel (never re-teach AND connect in one
sentence); ch1 model-definition + final-chapter synthesis directives;
example-count contract tolerance (dealt−1 permitted); full F-1..F-8
write-time self-check.

**Track B — gate re-alignment** (crisp adjustments only; STIER-2 lesson
honored — new semantic-adjacent checks ship SHADOW):
CHB2 repair directive stops targeting the deepest tier and protects
mechanism sentences; severe ceiling margin +0.1→+0.2; cross-tier overlap
exempts each deeper tier's leading re-orientation sentence; severe ARCH0
monoculture becomes a blocker on the NEW-authoring path only; new SHADOW
loop-closure/boundary critic (D6.3/6.4), zero-FP calibrated on gold.

**Track C — the measurement loop**: thin rater harness for the rubric
instrument (render rater tasks, fail-closed ingest through the EXISTING
validators; raters are Claude-side, zero codex) + a state→temp-package
assembler so unpublished chapters can be audited.

**Validation**: re-author two of the owner-audited chapters (sealed baselines
67.7 / 70.8) with the upgraded stack via the BASELINE authoring path, then
rubric-audit them with the third audited chapter as the hidden calibration
item. Success = clear movement toward the 80+ band with gates passing and
calibration inside ±3.0; full before/after reported.

Out of scope (unchanged, owner-gated elsewhere): the P5 canary adjudication
packet, reviewer-role qualification, the D10 web reader fix.
