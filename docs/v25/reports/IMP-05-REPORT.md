# IMP-05 — Global Writer-Card Prompt Diet, Precedence, and Instruction/Data Separation

**Status:** Implemented and verified (typecheck clean; full suite **2,178 pass / 0 fail**, +10 net new
tests; `contract-validate` PASS). **Baseline:** `e076c9ff1` (IMP-10). **Findings:** F-008, F-009, F-016
(P1/P2); F-019, F-021 inputs. **Gate:** G3 (with IMP-04). **Owner decision:** the owner explicitly chose
the FULL diet per the plan (not the conservative-structural option).
**Requirement ledger:** `docs/v25/IMP-05-REQUIREMENT-LEDGER.md`. **Machine report:** `implementation-report.imp-05.json`.

## 1. Before / after

The always-sent writer card carried five accreted control surfaces (house rules, a 9-rule QUALITY BAR, a
7-line PREMIUM block, a 7-check self-verify, and ~100 lines of embedded incident-lesson comments). IMP-05
reduces the card to **global invariants + one explicit precedence order + compact chapter-local craft
targets**, with every removed protection proven to already live in a gate, critic, the source-use plan,
the brief/deal compiler, or the blinded reviewers (the ledger's moved-enforcement map).

| Surface | before | after |
|---|---|---|
| control blocks total | ~10,900 chars | **4,286 chars** (−61%) |
| — QUALITY BAR | ~6,300 (9 rules) | 1,665 (5 compact craft targets) |
| — PREMIUM block | ~2,700 (incl. VOICE 4-move formula) | 1,036 (7 named axes) |
| — house rules | ~560 | invariants 1,122 + precedence 463 (new) |
| self-verify | ~1,380 (7 checks) | **861** (4 ordered high-risk checks) |
| realistic fixture card | 19,924 (post-IMP-03) | **14,862** (−25%) |
| directive-line count | (much higher) | 33 |

## 2. The dieted card (instructions 2-3, 5, 10)

- **Precedence (new, instruction 3):** one explicit order rides first — safety/source/identity → schema/
  product completeness → thesis/evidence/quiz → chapter objective → active book constraints → optional
  style. A lower-priority style/deal line can never outrank a source or schema invariant.
- **Global invariants (instruction 2):** COMPLETE (valid ChapterV21, every required field; finish required
  fields before optional ornament — the priority-completion rule, instruction 5), FACTUAL (obey the
  source-use plan; trace every fact; hedge below-robust claims), QUIZ (key is a move not a source;
  distractor = key warped by a dealt failure mode; answer-key pattern), IDENTITY (no scaffold vocabulary;
  reader never meets the machinery), PLAIN & DENSE (Flesch 72-84; every paragraph adds).
- **Craft targets (was the 9-rule QUALITY BAR):** 5 compact aims — QUIZ DISTRACTORS `[GATED]`, PRACTICE
  `[GATED floor]`, EXAMPLES `[SCORED]`, HOOK `[SCORED]` (with one sparse FAIL/PASS micro-example), TAKE-HOME
  `[SCORED]`. The mechanical-distractor word list, the tell-length audit protocol, and the VOICE 4-move
  formula were REMOVED — naming banned words / fixed formulas on the card is exactly the repeated-"X not Y"
  pattern the SOL guidance warns against; their gates/critics/reviewers still enforce them.
- **Reviewer axes (was PREMIUM):** the 7 rubric axes named compactly (the blinded reviewers own scoring).
- **Self-verify (instruction 10):** 4 ordered highest-risk checks (KEYS, FACTS, SCAFFOLD, COMPLETE) whose
  answer is structured evidence, not a restatement of the prompt.

## 3. Instruction/data separation + structured findings (instructions 6-7)

Already begun in IMP-03: the source projection and prior-attempt complaints ride the typed
untrusted-data envelope (`<chapterflow_untrusted_artifact …>`), so their content cannot act as
instruction. IMP-05 pins that the control blocks render OUTSIDE any envelope (they are the sole
instruction channel) and that the regeneration card is the SAME dieted core + enveloped findings — never
a larger legacy block (retry/regen parity, instruction 11). Fully structured findings from IMP-07/08 will
replace the complaint strings at their contract; the envelope holds the boundary until then.

## 4. Versioning + telemetry (instructions 12-13)

`CARD_BLOCK_VERSIONS` stamps a version per control block (precedence/invariants/qualityBar v2/premium v2/
schemaHint/selfVerify v2/dataEnvelope); `authorCardComposition()` returns the versions + a deterministic
sha256 of the control text so IMP-10 evidence can identify card drift independent of the data payload.
`authorCardMetrics(card)` reports chars + directive-line count + control-char total for the representative-
chapter budget tests.

## 5. Removed-protection audit (rollback criterion #1)

Every deleted card sentence maps to a retained enforcement owner (ledger §"Removed-protection audit"):
- mechanical-distractor word list + 7% stake → the CHB12 strawman gate in `readerBudgets.ts`
  (`STRAWMAN_LEXICON` now exported as the sole owner; tests assert the gate, not the card);
- tell-length caps → the quizQuality tellRate/lenTell gates;
- Flesch band → the readerBudgets Flesch gate;
- machinery/register lessons → invariant I4 + the C31-C35 advisory critics;
- example decision→consequence + competing-interests + F17 → C31 + the CONTENT DEVICES deal;
- VOICE 4-move formula → the "this book's voice" axis stays SCORED; the mechanical pair-sentence ritual
  was itself the fixed-formula anti-pattern the diet targets;
- quiz key-is-a-move → invariant I3 + rule 1 + the C35 lineageKeyQuiz critic (the test proves the C35
  detector still fires on the exact key shape the card forbids — the protection moved, it did not vanish).

No gate, threshold, source blocker, acceptance predicate, retry cap, independence rule, promotion
requirement, or critic severity changed. The public ChapterV21 schema, the source ontology, and model
routing are untouched.

## 6. Tests (net +10; full suite 2,178/0)

`tests/card-diet.test.ts` (10, new): precedence order + precedence-conflict; data separation (projection +
findings enveloped, control outside); retry/regen parity (no legacy block re-enters); no named-scene-
taxonomy leakage; full-artifact completeness (no product field made optional); the 4-check <=900-char
self-verify; block versioning + deterministic hash; card metrics; root-instruction dedup (owned by IMP-00/
IMP-12). `tests/author-arch.test.ts`: the 6 CF-era card-text pins CONSOLIDATED into 6 IMP-05 tests that
assert the compact invariants + keep each enforcement-owner consistency check (C35 detector, D9 timer set)
+ the diet/size/versioning pins. `tests/stier-levers`, `stier2-levers`, `content-machinery`: card-text
assertions retargeted to the compact invariants or their enforcement owners (the CHB12 gate lexicon).

## 7. Honest gaps / risks (recorded, not hidden)

- **Content-quality effect is UNMEASURED** and NOT claimed. The plan gates any quality claim on the
  controlled bakeoff (IMP-11/§16), which needs the API (billed, owner-controlled) and cannot run here. The
  diet is justified structurally (smaller prompt, invariants preserved, enforcement owners intact); whether
  it helps or harms first-draft quality is the bakeoff's question. Recorded loudly.
- The first-draft-pass-rate rationale for the verbose QUALITY BAR (avoiding the ~19-min whole-chapter
  retry) is a latency/cost tradeoff the bakeoff measures — not a protection. If the diet raises retry rate
  materially, that surfaces in the bakeoff and the craft targets can be selectively re-expanded.
- Fully structured findings (instruction 7) await IMP-07/08; today the envelope holds the boundary and the
  complaint strings are data-quarantined but not yet a typed schema.

## 8. Constraint compliance

No gate/threshold/blocker/cap/acceptance/independence/promotion/critic-severity weakened. No book/chapter/
author-specific behavior. No silent fallback or unbounded retry. No new scene recipe added (the
no-scene-taxonomy test enforces this). No publish/promote/deploy/S3/outer-repo/push. No production state as
a fixture. No quality claim (deferred to the controlled evaluation). Backward compatible: the card builder's
public interface is unchanged; block versions bumped so evidence flags the composition change. Frozen
contracts untouched (`contract-validate` PASS).
