# V24 CF-J Repair Report — radical-candor

**Date:** 2026-07-09/10 · **Conductor:** release-repair conductor (targeted CF-J pass per the
Class-C release-readiness review) · **Branch:** `feat/anti-sameness-live-fix` at `3c84ae1ee`
**Companions:** `V24_RADICAL_CANDOR_RELEASE_READINESS_REVIEW.md` (the defect inventory),
CF-J engineering + two content-repair agent reports (synthesized here).

## 1–3. State, dirty state, defect inventory

Tracked tree clean at start; CF-J work now sits UNCOMMITTED in the working tree (18 src/test
files + repaired chapter state). Checkpoint taken before any change:
`PIPE/state/chapters/radical-candor-cf-j.bak/` (9 chapters + reviews snapshot) — preserved.
The release review's §7 inventory was reproduced exactly by the new detector before repair
(page cites ch1/2/3/4/6/7 · guide-structure ch3/4/7/8/9 incl. quiz q07 + card c06 · machinery
ch1/6 incl. ch6 q01 choice/explanation · spec-narration ch2/4/5 · tail clone ch3/6/9 · C31
ch02 at 12 openers under the corrected counter).

## 4. CF-J detector (C36) — implemented

`PIPE/src/critics/apparatusLeakage.ts`: four advisory-minor sub-ids (page_citation,
guide_structure, machinery_term, spec_narration) scanning every reader surface INCLUDING quiz
prompts/choices/explanations and cards. Negative fixtures pin legitimate source discussion,
real dates, and page-as-content books. Corpus pins: gold/HOM/multipliers/culture-code all
zero; radical-candor = the defect corpus (pre-repair). Also: BP34 tail-clone check (final
comma-clause key — catches "…, or it drifts" varying-frame clones; gold's one soft refrain
pinned honestly), and the C31 opener cap corrected 6→8 words (diagnosed on the actual ch02
bytes; all five corpora re-pinned; zero new firing chapters — only ch02's count rose 7→12).

## 5. Packet/page-label mint-removal — implemented, root cause closed

Investigation finding: **the grounding checker itself forced the leak** — research minted page
citations INTO packet `hardSpecifics`, and SC11.2 requires unit text to contain hardSpecifics
verbatim, so writers satisfied grounding *by quoting the citation into reader prose*. Fixes:
(a) `sourcePacketProjection.ts` strips citation spans from ALL projected text (raw packets
untouched, anchor IDs unchanged, purity + golden tests); (b) `sourceGrounding.ts` counts
citation-shaped specifics as satisfied-by-construction — strictly tolerant (findings can only
shrink; a unit missing a REAL specific still blocks — test-proven); (c) second channel closed:
`chapterBrief.ts` thesis/coreMove rendering carried "at Ch. 2 p. 33" into 4/9 briefs — stripped;
(d) card self-verify SCAFFOLD now names page/section citations as internal coordinates.

## 6. Repair routing — implemented

C36 joined `collectRegisterAdvisories` → rides the existing three lanes (write-retry cards,
review-repair directives, regen attempt-1 cards) with directive text that survives fix-line
truncation. Advisory-only proven (planted-vs-clean gate parity; `passed === true` set extended).

## 7–9. Files and tests

CF-J engineering: 2 new files (critic + 19-test suite), 16 modified (src+tests). Content
repair: 9 chapter JSONs (targeted leaf-field edits only; structural diffs prove no
added/removed nodes), 3 documented detector-pin updates. Suite: 1974 → **2013** (CF-J, +39) →
**2045 / fail 0** final (the extra growth is a parallel session's bakeoff tests on the shared
checkout — fail 0 throughout; typecheck clean at every step).

## 10–13. Repairs applied (full detail in the agent reports)

- **Apparatus strip:** every flagged surface across 9 chapters (page cites naturalized,
  guide-structure narration replaced with the ideas themselves, ch01's page-bracket "scene"
  replaced with a packet-grounded manager-audit scene).
- **3 spec-narration sentences** rewritten (fact discipline held silently).
- **ch02 de-saturation:** 12 → 2 evaluator openers (C31 silent).
- **Quiz swaps:** ch6 q01 machinery distractor/explanation; ch9 q07 lineage item → review-as-
  summary-of-guidance MOVE. **Card swaps:** ch9 c06, ch1 c06, ch5 card06 → principle cards.
- **Humanization:** one example each in ch6/ch8/ch9 (role-framed people act; documents become
  objects; ch8's change also cleared a pre-existing C2 major).
- **Tail clone broken** (ch3 keeps the single strongest instance) · **ch4 venue fixed**
  ("family group chat" → "the project's group chat") · 2017-as-event-date framing removed
  (ch1/ch2) · 6 ifThenPlans deduplicated (ch8/ch9) · ch9 flat memorable line replaced.
- **Round-2 repairs (regen-minted, caught by blind re-review):** ch01 regen's quiz Q5
  contradicted the prose's own staged-care guardrail + an implied-incident example two tiebreak
  readers flagged FABRICATED → re-keyed to the guardrail verbatim, example made explicitly
  hypothetical; ch02 regen REVERSED the chapter's cost mechanism and placed the Sandberg–Scott
  relationship "in 2017" (publication year as event date — Sandberg left Google in 2008; the
  same error class the acceptance panel caught on the-culture-code) → all six surfaces fixed to
  the packet's "Google-era" framing with 2017 only as the account's publication year.

## 14–17. Detector and fidelity results after repair

C36 all four categories: **0/9** · C31: **silent** (ch02 = 1 opener) · tail-clone: **0**
(1 legal instance) · CF-I (C32/C33/C34/C35/BP34): **0** · gate-chapter: PASS ×9 ·
qc-converge: DETERMINISTIC-CLEAN · source fidelity: the two factual regressions the regens
minted were fixed against packet authority; no invented facts anywhere (structural diffs +
packet citations in the agent reports).

## 18. Chapter review result (blind, post-repair)

All 9 PASS: ch01 84.6/84.8 tiebreak-PASS (after the round-2 fix), ch02 87.7, ch03 89.3,
ch04 89.3 (regen), ch05 85.4, ch06 85.1 (tiebreak), ch07 86.1, ch08 87.6, ch09 85.6. Keys 9/9
everywhere. The re-review journey: 4 near-bar ship=false FAILs in round 1 → 2 recovered by
tiebreak, 3 regens (ch04 89.3 clean; ch01/ch02 regens minted NEW defects that the panel caught
and round-2 targeted repairs fixed) + one infra halt (codex 30-min timeout; resumed).

## 19. Book acceptance result — the honest headline

**ACCEPT at pooled 74.3, churn HIGH** (3 independent panel reads via the noise-band protocol;
floor 74; valid 3/3). **This is a 4.6-point drop from the pre-repair 78.9/MEDIUM.** The
CF-J defects are gone — the panel raised zero apparatus, factual, or key complaints — but the
regen churn re-homogenized the book's texture, and the panel now names it precisely:
scene_skeleton across all 9 ("a miss has already happened or nearly happened, a character
traces it to a skipped framework…"), repeated_unit ch1/3/9 (numerical self-audit shell), and
two location_stamping advisories (the cold-mug/stale-cup prop across ch3/5/9; calendar
containers across ch3/4/7/8). All advisisory/non-blocking — but they are exactly the premium
ceiling.

## 20. Release classification

**B — hold for minor editorial review.** The Class-C defects are verifiably fixed (apparatus
gone incl. quiz/card surfaces, spec-narration gone, factual framing corrected, fabricated
example fixed, keys sound, fidelity clean) and no pipeline bug remains — but under the
operating release rule the book now sits at **74.3 with churn HIGH → hold and inspect**. What
remains is texture saturation (one dramatic skeleton, stamped props), which is editorial, not
defect-class. Publishing now would ship a technically-clean book that reads homogenized.

## 21. Publish/deploy/push

**None.** No publish, no S3, no deploy, no push, no gate/policy change; `multipliers`
untouched; `the-culture-code` unpublished; `start-with-why` untouched.

## 22. Remaining risks / notes

1. **Texture regression via regen churn is the finding of record:** targeted repairs + regens
   fixed defects but cost 4.6 acceptance points of texture variety. The scene-skeleton mold is
   now unambiguously the fleet's premium ceiling (flagged on all four fresh books) and is a
   FUTURE editorial campaign (scene-shape diversity), not a bug — the freeze on broad
   engineering stands.
2. Regen lanes mint new semantic defects under pressure (quiz-prose contradictions, date-as-
   event framing) — twice observed, both caught by blind review; the layered net works but
   each costs a round.
3. The C36/CF-J prevention stack is live for all FUTURE books (projection de-mint means fresh
   packets never show writers page cites) — radical-candor needed content repair only because
   it was written pre-CF-J.
4. Suite drift note: a parallel session's tests share this checkout (2045 vs 2013) — fail 0
   under both counts.

## 23. Exact next command

None to run — owner decision: (a) accept classification B and hold radical-candor pending an
editorial texture pass (recommended; the scene-skeleton campaign would serve all future books),
or (b) direct-read and ship as-is via
`npx tsx src/cli.ts promote-book radical-candor --title "Radical Candor" --author "Kim Scott"`
→ `npx tsx src/cli.ts publish-final "radical-candor"` (transaction pushes the branch), or
(c) commit the CF-J engineering wave regardless (recommended in all cases — it protects every
future book): the 18 src/test files are ready for a `feat(v24): CF-J apparatus-leakage
detector + page-cite de-mint` commit on owner instruction.
