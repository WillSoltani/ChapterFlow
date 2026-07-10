# V24 Release-Readiness Review — radical-candor

**Date:** 2026-07-09 · **Reviewer:** release-readiness conductor (direct content read, per the
operating release rule) · **Rule applied:** acceptance 76–80 with churn MEDIUM → direct-read
required before publish.
**Method:** two independent full-content readers (ch1–5; ch6–9 + all-9 book-texture survey) —
every hook, all three breakdown tiers, every example, all 81 quiz questions with per-key
verification, every review card, implementation plan, and memorable line.

## 1. Branch and commit

`feat/anti-sameness-live-fix` at `3c84ae1ee` (multipliers publish commit; CF-I at `116527f92`).
No commits, no code changes made by this review.

## 2. Dirty state

Tracked tree clean (0 modified). Untracked: prior-campaign generated state and logs only.

## 3–5. Pipeline numbers

Acceptance **78.9** (floor 74, premium target 80 — 1.1 short; band ±3.7, single read clear of
the noise band) · churn **MEDIUM** · chapters 9/9 PASS, **85.7–90.0**, keys 9/9 everywhere.

## 6. Direct-read summary

The book is **instructionally sound and faithful** — every framework and attribution checks out
(HHIPP, CCL/SBI, CORE, GSD Wheel order, Career Conversations/Laraway, rock-star/superstar
modes, Bob/Juice Software, Sandberg), plans and skill names are usable, prose repeatedly hits a
premium bar in ch03/ch04 ("The role does not rank the person; the person changes the role";
"Debate is the rock tumbler, not the rock fight"). But it **does not read premium end-to-end**:
a previously-undetected leakage class — the source guide's own APPARATUS narrated to the reader
— runs through 7 of 9 chapters, three chapters cast documents instead of people as
protagonists, and one house voice is stamped across all nine.

## 7. CF-I machinery leakage — NEW CLASS FOUND (reader-visible, below detector coverage)

The C32–C35/BP34 detectors were clean or near-clean (C31 ch02, C34 ch02 only) — and the read
shows why that was insufficient:

- **Source-apparatus narration (HIGH, systemic, 7/9 chapters):** page citations in reader prose
  ("the organization tied to SBI **on Ch. 6 p. 138**", "**Ch. 7 pp. 177-182**", "Ch. 1 pp. 9
  and 14", "On page 33"); guide-structure narration ("**The official guide puts Results in
  Part 2, the tools-and-techniques part**", "The official guide marks Bonus Chapter…
  **That placement matters**", "the source guide's practice questions for this unit"). ch01
  ex03's "scene" is literally a penciled bracket joining page numbers.
- **Machinery inside assessment surfaces (HIGH):** ch6 q01's distractor/explanation speak pure
  pipeline ("accepting **page references as proof**", "**The page span points to** delivery");
  ch9 q07 + card c06 reward knowing the guide's unit layout (lineage-class); ch1 q08/c06 and
  ch5 card06 are credential/marketing trivia.
- **Spec-narration sentences printed verbatim (blocker-class):** "**The outcome is not claimed
  here. The proof is earlier.**" (ch2 ex01 — the fact-discipline hedge as reader prose);
  "**The blue calendar block is the only hard detail**" (ch4 ex02) and "**One object was left
  from the earlier exchange.** A cold mug sat beside him" (ch5 ex01) — prop-budget specs
  narrating themselves.
- **Beat-phrase leaks at paraphrase level:** "the demand has already passed" (ch3/4/8), "first
  feels the effect" (ch3/7/8/9), "answers for the earlier commitment" (ch4/5), "barely in
  time / barely pulled back" (ch6/7/8/9) — the executed scenes collapse to one skeleton despite
  the dealt rotation.

## 8. C31 evaluator voice

Detector said 1/9 chapters; the read says the detector under-counts: **ch02's example fields
are saturated (~15 question-then-answer openers across all six examples)** — the biggest
single premium-feel failure — with low-level presence in ch4/ch5. Elsewhere within normal
rhetorical range. Advisory stayed advisory as designed; the trend across books is still down.

## 9. Proxy-cast / examples

Cap respected (33%) but the *distribution* inverts the source: **16 invented proxies vs 4 real
figures**, with the real ones confined to ch1–2 (+ a Laraway credit); **ch6/ch8/ch9 contain
zero named humans** — their protagonists are checklists, prompts, and calendars (the real
Radical Candor is dense with real stories). Also: one incoherent scene (ch4 ex03 stages a work
decision handoff "in the family group chat"), duplicate example jobs in ch2 (ex01≈ex02) and
ch5 (ex01≈ex05, ex02≈ex06), a one-color-object prop stamped into nearly every scene
(cold mug ×2 chapters, blue folder/dot/box/block across ch4–ch9), and role drift (Gloria
Director→project lead).

## 10. Quiz/card quality

**Keys: 80 of 81 verified genuinely-best, unambiguous, application-over-recall — zero wrong
keys** (the 81st, ch9 q07, is a lineage item, not a wrong key). Distractor MOLD is stamped:
~20/81 use borrowed-authority wrong answers and 10+ use delay-until-formal-cycle — a test-wise
reader learns the pattern by ch3. Cards uniform-format but useful; 3 trivia cards flagged.

## 11. Source fidelity

**Clean — zero factual defects found** across both readers. Named frameworks, people,
institutions, and orderings all check out; invented proxies are never passed off as source
figures. Two soft notes: "2017 as the anchor" frames the book's publication year as if it
were the event date of the mid-2000s Sandberg story (reader-visible oddity, not a false
claim); the famous "um" feedback is abstracted so far its content never appears.

## 12. Book-level texture

Corroborates churn MEDIUM on the honest side: hook shapes vary but share one cost/ledger
register (hedge-verb "can" in 6/9); skill names 9/9 distinct verbs but one "Verb the Adjective
Noun" stamp; memorable lines run two molds ("not-X; it-Y" ×4, "Do X before Y" ×4) plus a
"who pays" ledger motif in 5+ chapters and **one three-chapter near-verbatim signature clone**
("…comes back…, **or it drifts**" — ch3/ch6/ch9; BP34 missed it because the sentence varies
around the clone); every tryThisNow/challenge carries a numeric micro-action token (a few
contrived to hit the number); 9/9 fastReads restate the hook as sentence one; ~6/9 fullReads
close on the same limits cadence.

## 13. Publish classification

**C — hold due to verified content defects.** Not for facts or keys (both clean) but for
concrete reader-visible defects: the spec-narration sentences (§7), machinery inside quiz
surfaces (ch6 q01, ch9 q07 + c06), the incoherent ch4 venue, and the systemic apparatus
leakage — publishing now would ship the pipeline's study-guide scaffolding to readers. This is
C rather than B because the items are enumerable defects requiring repair, not just texture
taste.

## 14–15. Publish status · condition for publishing later

**Local publish NOT run.** Condition: a targeted content-repair pass (same discipline as the
culture-code/multipliers repairs — repair-prompt scope, no gate changes) covering:
(1) strip/rewrite all apparatus narration (page cites, "official guide/bonus unit" structure
talk) across ch1–ch9; (2) rewrite the 3 spec-narration sentences and the ch4 ex03 venue;
(3) de-saturate ch02's evaluator openers; (4) replace 2 lineage/trivia quiz items + 3 trivia
cards; (5) humanize at least one example each in ch6/ch8/ch9 (a person, not a prompt-sheet, as
actor); (6) break the "or it drifts" three-chapter clone — then re-gate, blind re-review
touched chapters, re-run acceptance, and re-classify under the release rule. Owner approval
required before that repair (it is content work on an unpublished book, but it consumes model
spend and this task's mandate is review-only).

## 16–19. Confirmations

No S3 upload, no deploy, no `verify:live`, no push, no publish of anything ✓ · `multipliers`
untouched (tree byte-clean; sentinel unchanged: HOM + multipliers) ✓ · `the-culture-code`
remains unpublished ✓ · `start-with-why` untouched ✓ · no gates or policy changed ✓.

## 20. Recommended next owner action + freeze recommendation

1. **Approve the targeted radical-candor repair pass** (scope above) — the book is one bounded
   repair away from publishable; its bones (keys, fidelity, plans) are already there.
2. **One narrowly-scoped pipeline follow-up is warranted under the freeze rule** (drift severe
   enough to block a publish): a **CF-J pair** — (a) a source-apparatus-leakage detector
   (page-citation patterns `Ch. N p[p]. N`, "the official guide/bonus unit/discussion prompts"
   as sentence subjects, in reader-facing fields AND quiz/card text) + matching card register
   clause ("the reader never sees the map's page numbers"); (b) extend the writer card so
   packet page-anchors are never quotable (the same mint-removal pattern as CF-F/CF-I-2 — the
   packets carry `Ch. N pp.` labels and the writer is citing them faithfully). Everything else
   observed (distractor molds, hook register, numeric micro-action stamp, aphorism molds) is
   recorded as **release-review notes, not pipeline bugs** — the broad v24 engineering freeze
   stands.
3. Standing queue unchanged: HOM+multipliers deploy run; the-culture-code publish decision;
   CF-G Phase 2 / CF-H deferred.
