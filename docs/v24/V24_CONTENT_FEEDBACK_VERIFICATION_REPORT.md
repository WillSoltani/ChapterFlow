# V24 Content-Feedback Campaign — Verification Report

**Date:** 2026-07-08 · **Verifier:** the triage-orchestrator session (per the Orchestrator
Contract in `V24_CONTENT_FEEDBACK_ROADMAP.md`)
**Companions:** `V24_CONTENT_FEEDBACK_TRIAGE.md`, `V24_CONTENT_FEEDBACK_IMPLEMENTATION_PROMPTS.md`
**Branch:** `feat/anti-sameness-live-fix` — all campaign work is **uncommitted working-tree
changes** over HEAD `c8b6a1c52`. Nothing committed, pushed, published, or deployed by this
verification.
**Method:** diffs-not-reports — three independent read-only verification agents inspected the
actual diffs against each prompt's spec; the orchestrator re-ran all suites itself and
reproduced the catalog sweep. No implementer claim was accepted without diff evidence.

---

## 1. Verdict

**All eight prompts verified: PASS, zero blockers, nothing weakened.** Deviations found were
should-fix/cosmetic; a bounded cleanup pass fixed them the same day, and the final state is
independently re-confirmed green:

- **Typecheck:** clean.
- **Full suite:** **pass 1921 / fail 0 / xenv 6 / skip 12** (baseline at campaign start
  1891/0/6 — the +30 is exactly the campaign's new tests). Re-run twice by the orchestrator
  (pre- and post-cleanup); counts identical.
- **Fresh gold validation book:** `multipliers` launched from zero
  (`book-run multipliers --author --no-publish`,
  log `PIPE/logs/v24-content-feedback-validation/multipliers.book-run.log`) — results in §7
  when complete.

Untouchable surfaces verified byte-identical: QUALITY_BAR rule 3 (GATED timebox floor), rule 4,
PREMIUM_BLOCK VOICE, D9 round-timer contract, label-prefix strip, `OPENER_TYPES`,
`sceneConcreteness.ts` (C26), `exampleCraft.ts` (C29 logic), `evidenceWitness.ts` (EW1),
`plainLanguage.ts` (E7), `narrative.ts` (`named_protagonist`/CAST_CAP), `contentDeviceDeal.ts`,
`authorWriteContractFindings` example-count contract, `ENFORCED_MAJOR` = {EW1, SEAM1, SEAM2},
book-gate/final-gate verdict predicates, and all of `app/`, `lib/`, `components/`,
`book-packages/`.

## 2. Prompt-by-prompt verification (mapped to original findings)

| Prompt | Findings | Verified state | Deviations (all resolved or ratified) |
|---|---|---|---|
| **CF-A** | 1, 2, 12 | PASS. New QUALITY_BAR rule 8 "HOOK CARRIES A STAKE [SCORED]" — mode-agnostic stake test + DOORWAY clause (concrete fastRead beat before first abstract term) + self-verify item 5. No hook critic (as specced); OPENER_TYPES/titles/rubric/C26 untouched. | Card-length overrun → trimmed (§4). |
| **CF-B** | 3, 5, 13, 17-guardrail | PASS. Rule 7 rewritten (narrated-in-scene register; evaluator question-then-answer field openers banned; conditional stage-the-clash clause; no-new-named-person guardrail; "set, not met"=FAILED kept; "MEASURABLY CHANGED" phrasing removed from the card and pinned absent). New advisory critic **C31 `example_evaluator_register`** (`exampleRegister.ts`): field-opening interrogative ≤6 words + immediate answer, ≥3 fields → ONE minor. Fires on the HOM-ch8 distilled fixture (8 openers), silent on ch7-style imperatives/mid-field questions. Gold pins: synthetic corpora ZERO; start-with-why measured 2 chapters (honest pre-existing tic, documented). Registered in `runShipGate` beside C29 (house pattern), minor-only. | Label drift ("CF-E") → fixed. |
| **CF-C** | 4, 8 | PASS. Learning job = the brief's existing `coreMove` (spec-sanctioned reuse, no twin field) + new optional `ChapterBriefV1.adjacentJobs` (packet-derived, recompile-stable, **outside the lineage hash** — regen caps can't reset; F-1 sidecar invariant intact, verified against `applyLeadThreadOverride`). Brief-gate advisory **LJ1 `adjacent_learning_job`** (lemma-Jaccard ≥0.6, machine-brief v3 only, can never block). Card gets THIS CHAPTER'S JOB + NOT-THIS-CHAPTER line; rule 6 strengthened with merge escape intact. New advisory critic **C30 `example_lesson_repetition`** (`intraChapterExampleLesson.ts`): pairwise whyItMatters lemma-Jaccard ≥0.5, ≥2 pairs → ONE minor; v2-gated; **gold pin = 0** (start-with-why max 0.19 vs 0.5 threshold). | Label drift ("CF-D") → fixed; missing rule-6 card pin → added (§4). |
| **CF-D** | 7 | PASS. PLAIN WORDS extended: coined OR source-INHERITED load-bearing terms unpacked plainly at first use, one clause in flow; self-verify item 6 (2–4 terms); coined-terms clause + "never dodge a vocabulary budget" intact; E7 untouched. | Label drift ("CF-F") → fixed. |
| **CF-E** | 9, 10, 14 | PASS. Rule 9: skill name = imperative verb + concrete object, 2–5 words, virtue-noun ban, **coreSkill opens with it** — placement decided by the resolved title investigation: `implementationPlan.title` is **emitted-and-dropped** (`ChapterV21` carries it; the app projection `book-package-core.ts:380-384` builds implementationPlan from `coreSkill` and never reads `title` — independently corroborated). App-side surfacing correctly deferred. Plain action fields (zero coined shorthand in tryThisNow/24h/weekly); memorable-line selection (≥1 carries the chapter's central image; none reused across chapters); self-verify item 7. Rule 3 + D9 pinned unchanged. | Stale `types.ts` "4–7 words" comment → fixed. |
| **CF-F** | 11 | PASS. (a) Within-book **BP34 `aphorism_repetition`** (`bookRepetition.ts`): normalized 4–25-word aphorism-shaped sentences across counterintuition/keyTakeaway/tryThisNow/coreSkill/memorableLines/all breakdown tiers, ≥3 chapters → ONE minor; 2 chapters legal. (b) `crossBookSignatureAudit` now scans those fields; floor 4 words for aphorism-shaped sentences (documented heuristic); still watchlist-only. (c) Both "agreement nods" variants in `banned-phrases.json` (hardBanned → B4 major, NOT enforced-major; routes future repair). (d) **Root cause killed:** the phrase was being MINTED by the card itself — it was the `contrast-speak` example in `IDIOM_INSTRUCTION` (`briefRotation.ts:111`); neutralized, and `rhetoric-plan.test.ts` now pins deal↔gate consistency (no rotation instruction may hand the writer a banned phrase). Gate files verified innocuous: bookGate/finalGate changes are minor-severity plumbing; verdict predicates untouched. Gold pin BP34 = 0 (executed, not skipped). | Shape-gate narrowing vs literal spec → **ratified by orchestrator** (§3); missing sweep artifact → resolved by reproducing the sweep (§3). |
| **CF-G** | 6 | PASS (Phase 1 only, as sequenced). `PIPE/docs/v24/MODERN-EXAMPLES-POLICY.md` encodes the owner decisions verbatim (≤¼ of chapters, hard ceiling 4; pure permission; advisory-only quarantine over the EI2+sourceGrounding backstop; pilot-after-validation). **No Phase-2 code exists**; `contentDeviceDeal.ts` unmodified. Phase 2 triggers only after this validation book, explicitly. | none |
| **CF-H** | 16 | PASS (design only, as specced). `docs/v24/COMPARISON-DISPLAY-DESIGN.md`: four options with verified file:line blast-radius citations, deploy-order constraint for Option 3, sameness guard, test plans, owner approval checklist. **Recommends Option 1 (prose contrast) with Option 2 (existing expandable bullets) as fallback; against Option 3 now.** No app/schema/pipeline code touched. | none |

Rejected findings stayed rejected: no implementation exists for Finding 15 ("chart last") or a
standalone Finding-17 name-reduction — correct.

## 3. Orchestrator rulings made during verification

1. **BP34 aphorism-shape gate ratified.** The spec's literal "any 4–25-word sentence in ≥3
   chapters" would have fired on plain repeated hinges (start-with-why's "There is a limit."
   repeats in 12/14 chapters) — flooding advisories or forcing a nonzero gold pin. The
   implemented shape gate (semicolon / two-clause antithesis) caught the one real leak across
   the entire catalog with **zero false positives**. Evidence beats the literal wording; ratified.
2. **Catalog sweep (reproduced by the verifier, working-tree code, all ~130 published books):**
   - BP34 within-book: **exactly 1 finding** — `high-output-management` ch[2,5,8,11] ::
     "Agreement nods; commitment signs." (the target case).
   - Cross-book watchlist (data, no action this pass): `"agreement nods commitment signs"`
     [2 books / 9 hits — HOM + execution, incl. ch11 coreSkill];
     `"the limit is just as important"` [**12 books** incl. the-prince, peak, super-thinking];
     `"the overcorrection is easy to miss"` [3 books];
     `"the ending is evidence not a time machine"` [2 books];
     `"that is part of its value"` [2 books].
   - **Follow-up decision for the owner:** whether to add the other four lines to
     `banned-phrases.json` (same fix as "agreement nods") and/or content-repair the shipped
     books. Not done this pass — the prompt scoped only the proven variants.
3. **Published-book repair out of scope.** HOM ch 2/5/8/11 still carry the line; the campaign
   fixed the pipeline, not shipped content. A separate `content-repair-book` decision belongs to
   the owner.

## 4. Cleanup pass (same-day, orchestrator-ordered)

The verification found three should-fix deviations; one bounded cleanup agent fixed all three,
then the orchestrator independently re-ran typecheck + full suite (green, 1921/0):

1. **Card budget overrun:** Lane-1 had added ≈ +2,452 net chars vs the ≤ +1,400 target. Trimmed
   −1,218 with every substantive requirement retained (verified via updated pins):
   final campaign delta **+1,395** (incl. CF-C's rule-6 wording). W1 card assertion tightened
   19,700 → **18,700** (fixture 18,217); self-verify ceiling 1,500 → 1,300.
2. **Missing CF-C rule-6 card pin:** 4 assertions added beside the QUALITY_BAR pins.
3. **Systematic label drift** (implementers tagged CF-B work "CF-E", CF-C "CF-D", CF-D "CF-F"):
   all comments/docstrings/test names corrected to match the prompts doc; stale `types.ts:627`
   and `finalGate.ts` ENFORCED_MAJOR comments fixed.

## 5. Cross-prompt conflict check

- Merged card constants read coherently in full; no contradictions. Rule 8's DOORWAY vs rule 4
  is a deliberate complement (mild restatement, accepted).
- CF-B's humanization vs Finding-17: guardrail present in rule 7; name machinery untouched.
- CF-A hook rule vs OPENER_TYPES deal: mode-agnostic by construction; **watch in the validation
  book** that hooks don't collapse into one shape (§7 checklist).
- CF-E "no line reused across chapters" (write-time) vs CF-F BP34 (book-level detector): agree
  on verbatim + punctuation-variant reuse.
- CF-C rule-6 edit merged after Lane 1 without collision; example-count contract untouched.
- No app/schema surface changed anywhere → no deploy-order hazard exists in this state.

## 6. What changed, at a glance

- `PIPE/src/orchestrator/authorRun.ts` — rules 7 (rewritten), 8, 9 (new), rule 6 (CF-C wording),
  PLAIN WORDS extension, schemaHint notes, self-verify items 5–7 (+ trim).
- `PIPE/src/compiler/chapterBrief.ts` — `adjacentJobs` emission, LJ1 brief-gate advisory,
  THIS-CHAPTER'S-JOB / NOT-THIS-CHAPTER card lines.
- `PIPE/src/compiler/briefRotation.ts` — contrast-speak idiom example neutralized (the
  "agreement nods" mint source).
- `PIPE/src/artifacts/artifactTypes.ts` — `ChapterBriefV1.adjacentJobs?`.
- `PIPE/src/critics/` — new `exampleRegister.ts` (C31), `intraChapterExampleLesson.ts` (C30);
  `bookRepetition.ts` + BP34; `crossBookSignatureAudit.ts` field/floor extension;
  `bookGate.ts`/`finalGate.ts` minor-severity registrations only.
- `PIPE/src/types.ts` — BP34 CriticCheckId.
- `PIPE/config/banned-phrases.json` — 2 entries.
- Tests: `example-register.test.ts`, `intra-chapter-example-lesson.test.ts`,
  `aphorism-repetition.test.ts` (new); `author-arch.test.ts`, `chapter-brief.test.ts`,
  `rhetoric-plan.test.ts` (extended). **+30 tests; suite 1921/0.**
- Docs: `PIPE/docs/v24/MODERN-EXAMPLES-POLICY.md`, `docs/v24/COMPARISON-DISPLAY-DESIGN.md`.

## 7. Fresh gold validation book — `multipliers` (IN PROGRESS)

Selection per the standing discipline: mainstream management nonfiction (closest genre analog to
the HOM baseline), five-discipline taxonomy (stresses CF-C distinct jobs + CF-D inherited
terms), rich real-leader cases (stresses CF-B staged tension), zero prior state, machine-brief
path. Launched `--author --no-publish`; CF-G Phase 2 is deliberately NOT live for this run.

**Run journal:**

1. **Entry 1 (2026-07-09 02:01–02:20 UTC):** research (codex, ~19 min) → 9-chapter TOC,
   packets/design/briefs compiled first-try — then an honest brief-gate halt:
   `BR1.case_collision` ("Google Project Aristotle" owned by BOTH ch2 and ch3). Pre-existing
   gate, not a campaign regression (case-partition logic untouched by the diffs; the new LJ1
   advisory was correctly silent). **Repair (orchestrator, per the generated repair prompt):**
   smallest safe state fix at the source of truth — removed the Aristotle entry from ch02's
   research-sidecar `namedExamples` (backup kept beside it), keeping ch03 as the owner
   (psychological safety IS ch03 "The Liberator"'s subject; ch02 used it peripherally and keeps
   the citable facts). Gate minimums checked (≥1 named example required; ch02 keeps 2). No gate,
   critic, or code touched.
2. **Entry 2 (02:35–03:16 UTC, 53 min):** brief gate PASS (0 blockers) → write phase: **7/9
   chapters wrote and gated clean first-entry**. ch04 and ch08 exhausted the write retry budget
   with MIXED causes (attempt 1 rubric `transferRatio`, attempt 2 lead-thread under-carry of
   legitimate owned-case leads "John F. Kennedy Moon goal" / "Getting to Yes negotiation frame")
   → honest bounded halt. F-1 degradation correctly did NOT fire (it requires lead-only failures
   across all attempts) — the F-1 design behaving as specced on its first fresh-book encounter.
3. **Entry 3 (03:18–04:33 UTC):** ch04/ch08 wrote clean on fresh budgets; blinded reviews 9/9;
   ch02 FAIL 83.6 → tiebreak (median-of-3) → review-repair → 85 PASS; ch03 FAIL (8/9 keys) →
   regen → 88.1 PASS — both recovered by the pipeline's own lanes with no operator action.
   Acceptance: sampled ch 2/5/7/9, 3/3 readers → **ACCEPT, pooled 79.4** (band ±3.7, gate PASS,
   churn MEDIUM, floor 74). Key-judge + sweep complete, 9 PUBLISHABLE attestations →
   **READY TO PUBLISH** (deliberately NOT published — validation only).

### 7.1 Results vs the HOM baseline

| Measure | HOM (baseline) | multipliers (fresh) |
|---|---|---|
| Chapters PASS | 16/16, 85.0–89.0 | 9/9, 85.0–88.6 |
| Pooled acceptance | 78.8 | **79.4** (premium target 80 — still short) |
| scene_skeleton advisory | all 16 | all 9 (dramatic-shell residual persists; NOT a campaign target) |
| repeated_unit advisory | ch 2/5/8/11 (the "agreement nods" chapters) | ch 1/3/5/7/9 (weekly-practice count-one-metric shell — different flavor) |
| Content devices | max 53% | max 56% — all under the 60% cap, zero findings |
| BP34 aphorism reuse | 1 finding (the target case) | **0** |
| C30 duplicate example lessons | n/a (not yet built) | **0** |
| C31 evaluator-opener chapters ≥ threshold | 3/16 (25 opener fields, 1.56/ch) | **2/9 (20 fields, 2.22/ch — NOT improved)** |
| LJ1 adjacent learning jobs | n/a | 0 advisories (no live FPs) |
| Brief gate | — | 1 honest BR1 blocker (repaired at source), then 0/0 |

### 7.2 Finding-class checks (detectors + direct read of ch02/ch06/ch08)

**Landed (verified in the fresh content):**
- **CF-E skill names — WIN.** 9/9 coreSkills open with a varied imperative+object name
  ("Circle the Edition", "Read the Risk Ledger", "Hand back the pen" as action form); no
  virtue-nouns, no same-verb monoculture.
- **CF-E/CF-F memorable-line integrity — WIN.** Every read chapter carries its central image in
  a memorableLine ("A cage is a weak magnet." / "A dated deck beats a warm reputation." /
  "Keep the problem on the table."); BP34 = 0 book-wide.
- **CF-D inherited terms — WIN.** Plain first-use unpacking graded GOOD in all three read
  chapters (best-in-book: "An interest is the need under a demand. A position is the demand
  stated as fixed.").
- **CF-E plain action lines — WIN.** All 9 tryThisNow imperative, timeboxed, zero coined
  shorthand.
- **CF-C distinct jobs — WIN (weakly exercised).** C30 = 0; LJ1 silent; each chapter owns a
  distinct central image; no cross-chapter re-teach observed in the read sample.
- **CF-B staged tension (Finding 5) — LANDED where it applied.** ch08 stages the clash with
  priced trade-offs ("You give up the clean rush of defiance. In return, the other side must
  face the limit, not only assert power.").
- **CF-A hook stakes + variety — MOSTLY LANDED.** Hook shapes genuinely rotate (question /
  scene / claim / date-anchor / aphorism); ch02's hook graded GOOD. Caveats: ch01/ch06 share a
  verbatim hook sentence ("No one knew who would bring back proof" — 2 chapters, legal under
  BP34's ≥3 threshold, and `hook` is not in BP34's field set), and stakes are sometimes implied
  rather than owned by a visible person.

**Not landed (honest):**
- **CF-B evaluator-voice — the write-time rule FAILED to move the needle.** C31 fired on ch02
  and ch08 (10 field-openers each); per-chapter density is *worse* than HOM (2.22 vs 1.56).
  Both offenders passed through repair/retry lanes. The detector half works exactly as designed
  — the tic is now measurable and attributable. **Recommendation:** calibration follow-up —
  surface C31 advisories into the review-repair directive text (NOT a gate) so the repair lane
  stops reinforcing the tic; consider a self-verify item naming the pattern.

### 7.3 NEW verified finding class (the direct read's discovery)

The "one template filled with different nouns" disease did not return at the opening layer — it
**migrated into the example layer as pipeline-machinery narration**:

1. **Meta-case examples:** ch02 (×2), ch06, ch08 each carry examples whose protagonist is "the
   case / the draft / the artifact," including editor-facing process talk shipped to the reader
   ("In the weak version, growth mindset stayed as a slogan… The late fix used Nadella's 2014
   CEO appointment as the concrete anchor.").
2. **Quiz keys rewarding citation hygiene over the book's principle:** ch02 q03/q08 and ch08
   q01/q04 key on *naming the source lineage* ("Tie the move to Getting to Yes and its named
   authors… so the frame is traceable") — the pipeline's anchor discipline leaking into reader
   pedagogy.
3. **Dealt beat-vocabulary becoming house phrasing:** "return point … set (but not met)",
   "early signal", "the miss is caught late" recur across chapters, plus a verbatim 8-gram in
   ch04 AND ch07 ("Rescue can finish the task while teaching…"). The contract's own beat names
   are this book's nascent "Agreement nods; commitment signs."
4. **Date-as-doorway gaming:** 7 of 9 fastRead ledes satisfy CF-A's concreteness with a dated
   *citation* (1961, 1986, 2009, 2014, 2017…) rather than a scene — provenance metadata gaming
   the concrete-beat rule.

This is a verified engineering/craft gap with quote-level evidence → per the Orchestrator
Contract it mints the next campaign's prompt (**CF-I: contract-vocabulary and provenance
leakage into reader content** — writer-card register rule + a deterministic beat-vocabulary
detector + a quiz-key citation-hygiene check + hook added to BP34's field set + CF-A tightened
from "concrete beat" to "scene beat, not a citation date"). Not implemented in this pass.

### 7.4 Improvement verdict

**The pipeline improved — decisively on 7 of the 9 targeted finding classes, honestly not on
one (evaluator voice, now measurable), with zero regressions and every gate behaving honestly**
(one BR1 blocker caught real research duplication; F-1 correctly declined to fire on
mixed-cause failures; repair/tiebreak/regen lanes recovered two chapters unaided). Acceptance
rose 78.8 → 79.4 but remains under the 80 premium bar, and the direct read agrees with that
number: ch06 reads close to premium; ch02 shows the floor. The dominant remaining sameness is
no longer nouns, hooks, or aphorisms — it is the offstage narrator inspecting anchors and
setting return points. That is CF-I's job.

**Comparison checklist against the HOM baseline (85.0–89.0 composites, pooled 78.8 vs premium
80, scene_skeleton ×16, repeated_unit ch2/5/8/11):**

- [ ] chapter composites + pooled acceptance vs baseline
- [ ] scene_skeleton / repeated_unit advisory counts
- [ ] direct read of 2–3 chapters: hook stake visible; doorway concrete; evaluator-opener density
      (C31 should be silent or explained); example lessons distinct (C30 silent); inherited terms
      unpacked; skill name opens coreSkill; action fields shorthand-free; ≥1 central-image
      memorable line; zero recycled aphorisms (BP34 silent)
- [ ] no NEW sameness pattern (hook shapes still varied across opener modes; not every example a
      staged clash; skill names not all the same verb)
- [ ] content-device profile still under the 60% cap
- [ ] LJ1/adjacentJobs behavior on a real machine-brief book (advisory counts, card renders)

Results and the improvement verdict will be appended here when the run completes.

## 8. Standing state (for the next session)

- Everything is **uncommitted** on `feat/anti-sameness-live-fix` over `c8b6a1c52`. Do not push
  (standing constraint; the branch's remote state is already deviated by the earlier publish
  transaction). Commit decision belongs to the owner — suggested shape: one campaign commit
  (feat: CF-A..CF-F content-feedback wave) once the validation verdict is in.
- HOM deploy is still PENDING from the publish (sentinel recorded; see
  `PIPE/docs/v24/V24_HIGH_OUTPUT_MANAGEMENT_COMPLETION_AND_PUBLISH_REPORT.md` §12).
- CF-G Phase 2: frozen until explicitly triggered after this validation book; then pilot on ONE
  further fresh book.
- CF-H: awaiting owner pick on the four options (recommendation: Option 1 with Option 2
  fallback).
- Open owner decisions: the four additional leaked cross-book lines (§3.2); shipped-HOM repair
  (§3.3).
