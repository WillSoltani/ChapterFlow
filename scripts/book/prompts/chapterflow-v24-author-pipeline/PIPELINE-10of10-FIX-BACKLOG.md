# Pipeline 10/10 — Fix Backlog, Prevention Rules & Agent Prompts

> Goal: make the pipeline generate **10/10 content**, and — the big bonus — make it **pass QC on the first round** (today it converges on the 3rd) to save tokens.
>
> Problem **#1 (testimonial-as-evidence) is already DONE** and is the reference implementation for everything here: `src/critics/evidenceIntegrity.ts` + `tests/evidence-integrity.test.ts` + the `R7` rule in `agent-prompts/STEP-2-WRITE-CHAPTERS.md`. Every prompt below mirrors that shape.
>
> Scope: findings **#2–#15** (pipeline-fixable) + a **first-pass-QC** track. Findings **#16–#20** (personalization, doing-loop, spaced retrieval, multimodality, generative assessment) are *app/product*, not pipeline — out of scope here; noted at the end. Honest ceiling: pipeline fixes top out near **9.5** (best static prose); the last half-point is the app track.

---

## ROADMAP — sequence, worktrees, where to paste each prompt

```
                         ┌─────────────────────────────────────────────┐
   PHASE 0 (first, alone)│ WT0  Regression corpus + harness check       │
                         └───────────────────────┬─────────────────────┘
                                                🚩 CP-0  (I verify corpus labels)
                                                 │
        ┌───────────────┬───────────────┬────────┴───────┬───────────────┐
 PHASE 1 │ WT-A Trust   │ WT-B Prose    │ WT-C Cast/Scene │ WT-D Quiz     │ WT-E Semantic bar
 (parallel)│ #2 #4       │ #6 #11 #12d   │ #5 #7 #8 #14d   │ #3            │ #2h #9 #12s #13 #14s #15
        └──────┬────────┴──────┬────────┴───────┬─────────┴──────┬────────┴───────┬────────┘
            🚩 CP-1 each worktree returns → I run it vs gold corpus → merge (append-only seams)
                                                 │
                         ┌───────────────────────┴─────────────────────┐
 PHASE 2 (serial, 1 WT)  │ WT-F  First-pass QC shift-left (5 levers)     │
                         │  wire new gates into qc-converge + writer     │
                         │  pre-submit; regenerate a benchmark book;     │
                         │  tune prevention until round-1 is CLEAN       │
                         └───────────────────────┬─────────────────────┘
                                                🚩 CP-2  (regeneration-validated: 1st-pass clean)
```

| Worktree | Findings (prompts to paste) | Touches (mostly-disjoint) | Validation | Parallel? |
|---|---|---|---|---|
| **WT0** | corpus | `tests/fixtures/*`, harness check | n/a | first, alone |
| **WT-A** Trust | #4, #2 (sidecar half) | `sourceGrounding.ts`, new critic, `STEP-1`, `STEP-2` | gold corpus | ✅ |
| **WT-B** Prose | #6, #11, #12 (det) | `prose.ts`, `intraBookFieldSimilarity.ts`, `writer-breakdown.system.md` | gold corpus | ✅ |
| **WT-C** Cast/Scene | #5, #7, #8, #14 (det) | `narrative.ts`, `catalogAudit.ts`, `writer-example.system.md` | gold corpus | ✅ |
| **WT-D** Quiz | #3 | `pedagogy.ts`/`quizQuality.ts`, `writer-quiz.system.md` | gold corpus | ✅ |
| **WT-E** Semantic bar | #2 (hedge), #9, #12s, #13, #14s, #15 | `semantic/publishableBar.ts`, `QC-SESSION-PROMPT.md` | rubric review | ⚠️ internally serial (one file) |
| **WT-F** First-pass QC | levers 1–5 | `STEP-2`, `REPAIR-CODEX-SESSION.md`, `autopilot.ts` | regenerate a book | after Phase 1 |

**Shared seams** (`finalGate.ts` `SEVERITY_FROM_CATALOG`, `STEP-2`) are **append-only** — each worktree adds its own rows/rules, so merges are trivial. The `tests/check-registry.test.ts` catches any duplicate catalog id. **Next free C-id is C24+** (C18/19 were a past collision).

---

## SHARED LAW — every agent prompt below assumes this is prepended

**1. Two deliverables per finding, always: DETECTION + PREVENTION.**
- **DETECTION** = a gate/critic (deterministic) or a `publishableBar` rubric clause (semantic) that *catches* the defect.
- **PREVENTION** = a writer rule that stops it being generated. Prevention is what buys **first-pass QC**; detection is the safety net. Ship both.

**2. The calibration law (non-negotiable).** A check may be registered as **`blocker`** only after its test proves **zero findings on the gold corpus** (`daring-greatly`, `start-with-why`, and `goldChapterFiles()` synthetic gold). Until then ship it **`major` in shadow** (it surfaces as QC debt but does not block — `ENFORCED_MAJOR` stays empty). Every quality-major historically fired *harder* on clean reference books than on the defect book; assume yours will too until the gold test says otherwise. A gate that flags nothing is also rejected — you need ≥1 true-positive AND zero gold FPs.

**3. Two generation surfaces — patch BOTH for parity.**
- **Surface A (agent-session):** `agent-prompts/STEP-2-WRITE-CHAPTERS.md` (writer "authoring law", the `R<N>` rules — `R7` at L293-321 is your template) and `STEP-1-RESEARCH.md` (only if you need a new *sidecar field*).
- **Surface B (programmatic per-field):** the matching `prompts/writer-*.system.md` read verbatim as the sub-agent `system:` (`generateChapter.ts:107-119`). The #1 fix only patched A — do not repeat that gap.
- Per-finding craft rules go in these **static** prompts, never in `authoringGuardrails.ts` (that file is data-only: name allocations + per-book blocklists).

**4. New deterministic critic — wiring checklist (mirror `evidenceIntegrity.ts`).**
1. New file `src/critics/<name>.ts`. Imports use **`.js`** extensions (NodeNext). Import `{ ChapterV21, CriticFinding } from "../types.js"`, `{ finding, truncate } from "./shared.js"`, `{ splitSentences } from "./textUtils.js"`.
2. Export a **pure** detector `(text|chapter) → Hit[]` (exhaustively unit-testable) **and** a gate-facing `export function checkX(chapter: ChapterV21, sidecarOverride?): CriticFinding[]` with a private field-walker returning `{unit, text}[]` (unit paths like `breakdown.fastRead`, `examples[${i}].scenario`, `quiz.questions[${i}].choices[${j}]`).
3. `finding("<ID>.<slug>" as any, "<severity>", message, evidence)` — `evidence` auto-truncates to 200; quote the offending sentence. Message shape: `` `${unit}: <what> — "${truncate(subject,60)}" (<why>). <FIX sentence>` `` with the fix as a module const.
4. Register severity: add `"<ID>.<slug>": "major"` to `SEVERITY_FROM_CATALOG` (`finalGate.ts:122`). `push()` **throws** if the id is unregistered — the emitted `checkId` and the map key must be byte-identical.
5. Invoke in `runShipGate` (`finalGate.ts`, near L748): `for (const f of checkX(chapter)) push(f.checkId as string, "<unit-label>", f.message, f.evidence);`
6. Cross-chapter (book-level) checks go in `bookGate.ts` instead (different push pattern, no severity map) — use it when the signal needs all chapters (cast/templating across the book).

**5. Re-arm an advisory.** One-line change in `SEVERITY_FROM_CATALOG` (`minor`→`major`/`blocker`). If the critic emits its own severity that finalGate re-routes by id (e.g. `D1` vs `D1.short_prompt` at L833), change the routing ternary too. Promote to ship-blocking only via the gold-corpus proof (Law 2).

**6. Semantic bar change (`semantic/publishableBar.ts`).** For judgment-class findings (hedge, hook strength, depth, etc.):
- Add a clause to the relevant axis string in `AXIS_RUBRIC` (L174) — this is the prose both the Claude QC reader and the future model-judge score against. Each clause must carry its own FP-guard ("NOT the defect: …").
- New axis only if needed: add to `AxisId` (L27) + `AXIS_WEIGHTS` (L46) **and rebalance so the sum stays exactly 100** (hard invariant; a test asserts it). Put it in `CORRUPTION_AXES` (L59) *only* if a hit should RED-veto; otherwise it can only drag to YELLOW (`AXIS_FLOOR` 0.6).
- Mirror the clause into `QC-SESSION-PROMPT.md` so the reader scores it.

**7. Test contract (mirror `tests/evidence-integrity.test.ts`).** Custom harness — `import { test, skip } from "./harness.js"`, `node:assert/strict`, fixtures from `./helpers.js` (`makeChapter`, `goldChapterFiles`, `STATE_CHAPTERS`). Every test file has: (a) `TRUE_POSITIVES` (bad lines lifted verbatim from the reverted tiny-habits regen / the six audited books — each must fire), (b) `MUST_NOT_FIRE` (clean/real-source constructions — each silent), (c) a wiring test that asserts the planted defect surfaces via `runShipGate(...).blockers`/`.majors`, (d) **gold zero-FP** over `goldChapterFiles()` + the real `daring-greatly`/`start-with-why` chapters (`skip()` when absent).

**8. Verify (run from the pipeline dir).**
```bash
npm run typecheck
npx tsx tests/run.ts <your-test-substring>     # focused
npm run test                                    # full suite incl. check-registry
npx tsx src/cli.ts gate-chapter state/chapters/<bad>.v21-native.chapter.json   # manual fire check
npx tsx src/cli.ts qc-converge <bookId>         # the deterministic battery (CLEAN/DIRTY)
```

**9. Definition of done (every finding).** typecheck green; new test passes (fires on bad, zero-FP on gold); severity registered; **both** generation surfaces carry the prevention rule; a `FAILURE-MODES.md` row added; if blocker-promoting, the gold proof is in the test.

---

# PHASE 0 — WT0: Regression corpus + harness

**PROMPT (paste to one agent):**
> Establish the labeled regression corpus the calibration law depends on. (1) Recover the reverted tiny-habits **regen** package — it is the richest single source of labeled defects: `git show dae06394a:book-packages/tiny-habits.v21.json`. Save it as `tests/fixtures/regression-tiny-habits-regen.json`. (2) Create `tests/fixtures/regressions.ts` exporting, per finding id (#2–#15), an array of **verbatim bad spans** lifted from that file + the six audited books (examples are seeded in each prompt below). (3) Confirm the gold corpus is reachable: `goldChapterFiles()` returns fixtures, and `state/chapters/` contains `daring-greatly-*` and `start-with-why-*` (if not, document which machine has them; tests `skip()` gracefully). (4) Run `npm run test` to confirm the harness is green before Phase 1 starts.
> **Done when:** the regression fixture + `regressions.ts` exist and `npm run test` is green.

🚩 **CP-0:** I verify each labeled bad span actually exhibits its finding (no mislabels) before gates are built against them.

---

# PHASE 1 — Detection + prevention (parallel worktrees)

## WT-A — Trust & numbers

### Finding #4 — Ungrounded / fabricated numbers in narrative prose `[NEW deterministic]`
**WHY.** Invented precision erodes trust: *"The notebook gets opened ninety percent of the time, which is roughly ninety percent more often…"* (Atomic Habits). The known "deterministic grounded-number gate" backlog item.
**EXISTING.** None deterministic. Only the semantic `factual_accuracy` axis flags numbers absent from `groundedNumbers`. `sourceGrounding`/SC11 check anchor *text* specifics, never numbers.
**DETECTION.** New `src/critics/groundedNumbers.ts`. Pure `findUngroundedNumbers(text, allow: Set<string>): Hit[]` — extract numeric tokens (`/\b\d[\d,.]*\s*(%|percent|x|times|million|billion|years?|days?)?\b/`) from every reader-facing prose field; allow-list numbers present in the sidecar `testableFacts`/`groundedNumbers`/`hardSpecifics`, plus trivially-safe ones (small list ordinals ≤ list length, 4-digit years, clock times, the chapter's own counts). Fire on a load-bearing unsourced figure. Gate fn `checkGroundedNumbers(chapter, sidecarOverride?)`; severity `GN1.ungrounded_number: "major"` (shadow until gold-clean — high-FP risk, calibrate hard). Skip cleanly when no v2 sidecar (return `[]`).
**PREVENTION.** STEP-2 §Step 0 already has a grounded-numbers line — **strengthen it** into an `R8` rule mirroring R7: *"Every number in reader prose must trace to a `testableFact`/`hardSpecific`/`groundedNumber` in this chapter's sidecar, or be written qualitatively ('most nights', 'far more often'). A fabricated percentage in a vignette is `GN1` (major) and reads as `factual_accuracy` corruption at QC. Do not invent precision to sound rigorous."* Mirror into `writer-breakdown.system.md` (new "Numbers" sub-rule) and `writer-example.system.md`.
**TEST** `tests/grounded-numbers.test.ts`: TP = the Atomic "ninety percent" line + 2 regen figures; MNF = a sidecar-grounded "1,112 rulings", "in 1939", "7 a.m.", "one of three"; gold zero-FP.
**DONE WHEN** Shared Law §9. Add `FAILURE-MODES.md` row `GN1`.

### Finding #2 — Contested science stated as settled fact (sidecar + authoring half) `[NEW: sidecar field + rule; bar clause is in WT-E]`
**WHY.** Willpower asserts ego-depletion/glucose as fact, zero hedge (verified). Faithful-but-disputed ≠ fabricated, so `factual_accuracy` scores it clean today.
**EXISTING.** None. Irreducibly semantic for detection; the *prevention* is a research-time flag.
**DETECTION (this WT — the source half).** STEP-1: add an optional `replicationStatus: "robust"|"mixed"|"contested"|"failed"` to a sidecar claim/`testableFact`. (The *scoring* clause lives in WT-E's `factual_accuracy` rubric.)
**PREVENTION.** STEP-1 rule: researcher marks any claim with known replication trouble. STEP-2 `R9`: *"If the sidecar marks a claim `contested`/`failed`, you may use it only with a calibrated hedge ('the evidence here is mixed', 'some studies question this') or reframed as a heuristic, never as flat law. Stating a contested finding as settled is a `factual_accuracy` defect."* Mirror into `writer-breakdown.system.md`.
**TEST.** STEP-1 schema test that `replicationStatus` round-trips; the scoring test is in WT-E.
**DONE WHEN** sidecar field lands + STEP-1/STEP-2 rules added.

## WT-B — Prose & structure

### Finding #6 — Monotone SHORT-sentence rhythm (low variance) `[STRENGTHEN]`
**WHY.** New books read choppy/listy at CoefVar 0.46 vs 0.61 for the good books; `prose.checkCadenceVariance` catches the **opposite** (long-drone) and is advisory.
**EXISTING.** `prose.ts checkCadenceVariance` (long-run only, routed to E4). `plainLanguage`/`readingLevel` only cap the *upper* bound. No variance/short-run detector exists.
**DETECTION.** Strengthen `checkCadenceVariance` (or add `checkSentenceLengthVariance`) in `prose.ts`: per breakdown tier, compute sentence-length **coefficient of variation** (stdev/mean); fire when CoefVar < 0.50 over a tier of ≥6 sentences, AND/OR when ≥4 consecutive sentences are within ±2 words. New id `E8.monotone_cadence: "major"` (shadow; calibrate — the gold books sit ~0.58-0.61 so a 0.50 floor should be clean, prove it). Keep the existing long-run arm.
**PREVENTION.** `writer-breakdown.system.md` §"Sentence-complexity caps" — add: *"Vary cadence: every paragraph needs at least one short (<6-word) punch AND one long (>20-word) flowing sentence. A run of same-length sentences reads like a list (`E8`). Target the rhythm of the reference books, not uniform brevity."* Mirror to `line-editor.system.md` readability section.
**TEST** `tests/cadence-variance.test.ts`: TP = a Willpower monotone passage ("Defaults handle small repeat calls. Routines keep daily choices from reopening. Option limits stop search…"); MNF = a 48 Laws / original-tiny-habits passage (CoefVar ~0.6); gold zero-FP is the load-bearing assertion here.
**DONE WHEN** Shared Law §9 + `FAILURE-MODES.md` `E8` (the short-side twin of E5).

### Finding #11 — Read-tiers paraphrase instead of build `[STRENGTHEN]`
**WHY.** fastRead/deepRead/fullRead restate the same ideas in different words (defeats the verbatim gates).
**EXISTING.** `E2` (identical first sentence, blocker), `B8` (one 4-word cross-tier phrase, minor), `BP24` (≥150-char verbatim, blocker) — all **verbatim**. A reworded restatement passes all three.
**DETECTION.** Add `checkCrossTierContentOverlap` to `intraBookFieldSimilarity.ts`: content-lemma Jaccard between deepRead↔fullRead (and fastRead↔deepRead); fire advisory when overlap is high *below* the BP24 verbatim floor (a paraphrase-restate proxy). `B15.cross_tier_paraphrase: "minor"` (heuristic — keep advisory; the precise judgment is the `prose_coherence` axis, strengthen that clause in WT-E too).
**PREVENTION.** `writer-breakdown.system.md` §tiers — add the **tier-job contract**: *"fastRead = one scene + the move. deepRead = the mechanism (why) + a second domain. fullRead = edge cases, the failure mode, the reversal. Each tier must add a NEW concept/scene/nuance — never re-explain the prior tier in new words (`B15`/`prose_coherence`)."* Mirror to STEP-2 §Step 5.
**TEST** `tests/cross-tier-overlap.test.ts`: TP = a regen tier-pair that restates; MNF = Atomic Habits ch5 tiers (each adds new scenes); gold zero-FP.
**DONE WHEN** Shared Law §9; note E2 (FAILURE-MODES) is the catalog owner — extend, don't duplicate.

### Finding #12 (deterministic half) — Over-length / low idea-density `[NEW, advisory]`
**WHY.** One idea stretched to hit the char floor; no ceiling, no density measure.
**EXISTING.** `A15` length **floor** (blocker). No ceiling, no density. (Note: the catalog `E5` is *sentence-length*, not idea-density — do not cite it as coverage.)
**DETECTION.** Add `checkIdeaDensity` to `prose.ts`: distinct content-lemma count per 1000 chars per tier, and repeated-sentence-skeleton density; fire advisory below a floor. `E9.low_idea_density: "minor"`. (The judgment version is a WT-E bar clause.)
**PREVENTION.** STEP-2 §Step 5 + `writer-breakdown.system.md`: *"Match length to substance. If one idea fills the tier, three varied examples beat six redundant ones — cut to the char floor, don't pad to a ceiling. Low new-idea-per-paragraph density (`E9`) reads as filler."*
**TEST** `tests/idea-density.test.ts`: TP = a regen padded tier; MNF = a dense 48 Laws tier; gold zero-FP.
**DONE WHEN** Shared Law §9 + `FAILURE-MODES.md` `E9`.

## WT-C — Cast & scenes

### Finding #5 — Cast discipline `[RE-ARM + NEW]`
**WHY.** "Bailey" is three different people across examples+quiz (Willpower); regen ch8 ran 9 interchangeable coaches; names shuffle between examples and quiz with no detector.
**EXISTING.** `C23 checkExampleProtagonistReuse` (**major, SHADOW** — re-arm candidate), `F1` (within-book recurring name, blocker), `C22` (single-location stamping). **Nothing** counts distinct protagonists/chapter or compares the example cast to the quiz cast.
**DETECTION.** (a) **Re-arm `C23`** to gating once a confirmed TP exists and gold is clean. (b) New `checkCastSize(chapter)` in `narrative.ts`: cap distinct named protagonists per chapter (>6 → `C24.cast_overflow: "major"`). (c) New `checkExampleQuizNameConsistency(chapter)`: a quiz prompt's named actor must match its source example's name or be deliberately novel — a silent reshuffle fires `C25.cast_shuffle: "major"`. Both shadow until gold-clean.
**PREVENTION.** STEP-2 §"Name plan" rule 4 ("one name = one person") — strengthen + add: *"≤1 protagonist per example (a named foil is fine), ≤6 named people per chapter (`C24`). A quiz scenario reuses its example's protagonist name or introduces a clearly new one — never silently reassign a name to a new role (`C25`)."* Mirror to `writer-example.system.md` + `writer-quiz.system.md`.
**TEST** `tests/cast-discipline.test.ts`: TP = the Willpower Bailey reshuffle + a >6-name chapter; MNF = a clean chapter where each name = one role; gold zero-FP.
**DONE WHEN** Shared Law §9; `FAILURE-MODES.md` rows `C24`,`C25` + C23 re-arm note.

### Finding #7 — Abstract scenes vs concrete sensory `[STRENGTHEN, advisory]`
**WHY.** Lessons staged on forms/emails ("Facebook reactivation email", "green sign-in button") vs grounded scenes ("a quilt his wife stitched in 1974").
**EXISTING.** `C2 checkSpecificScene` (major) is a binary *anchor-presence* gate — one clock-time passes the whole scene. No sensory **density**; the real owner is the semantic `example_coherence` axis. C2 has a history of over-firing.
**DETECTION.** Add an advisory density signal to `checkSpecificScene` (or `C26.scene_abstraction: "minor"`): flag a scenario whose "stage" is an abstract system (form/email/app/dashboard/spreadsheet) with no physical-human detail, OR < N concrete/sensory tokens. **Keep advisory** — calibrate hard against gold; the gating judgment stays in WT-E's `example_coherence` clause.
**PREVENTION.** `writer-example.system.md` §"what good looks like" — add: *"Stage every scene in a lived human moment with a sensory detail (an object, a texture, a sound), not an abstract process (a form, an email, a dashboard). Illustrate the idea THROUGH a person; never make the system the protagonist."* Mirror to STEP-2 §Scenarios.
**TEST** `tests/scene-concreteness.test.ts`: TP = the regen Facebook-email scene; MNF = the quilt / "valve oil and floor wax" / "11:42 on a Tuesday" scenes; gold zero-FP (high-FP risk — assert hard).
**DONE WHEN** Shared Law §9 + `FAILURE-MODES.md` `C26`.

### Finding #8 — Exotic / uncommon names overused `[NEW, advisory]`
**WHY.** Thomasina, Rhiannon, Soledad, Osvald, Eero, Saoirse — affected, and hard to track.
**EXISTING.** None. `catalogAudit` tracks name *collisions* (reuse), C7 bans *common* names (the opposite). Nothing scores commonness.
**DETECTION.** New `checkNameCommonality(chapter)` in `narrative.ts` (or `catalogAudit.ts`): share of protagonist names absent from a bundled common-given-name frequency list; fire `C27.exotic_name_density: "minor"` over a threshold (e.g. >60% uncommon). Bundle a small frequency list in `config/`.
**PREVENTION.** `writer-example.system.md` rule 1 (name pool) — add: *"Prefer common, varied, demographically diverse, easy-to-hold names. Reserve an unusual name for when it does characterization work. A cast of exotic names reads as trying-too-hard (`C27`)."* Reconcile with the C7 banned-common-name pool so the two don't fight (allow a broad common-name set, ban only the over-used handful).
**TEST** `tests/name-commonality.test.ts`: TP = a chapter of all-exotic names; MNF = a gold chapter; gold zero-FP.
**DONE WHEN** Shared Law §9 + `FAILURE-MODES.md` `C27`. **Coordinate with C7** owner.

### Finding #14 (deterministic half) — Too-clean resolutions `[NEW, advisory]`
**WHY.** Every example succeeds instantly ("closes on Friday", "approves that afternoon").
**EXISTING.** None. C1–C3 validate scene *structure*, never *outcome*.
**DETECTION.** New `checkOutcomeVariety(chapter)`: advisory flag a book/chapter where 0% of examples use a friction-bearing `format` (`mistake_recovery`/`postmortem`/`before_after`-with-cost). `C28.uniform_success: "minor"`. (Judgment version is WT-E.)
**PREVENTION.** STEP-2 §Step 6 + `writer-example.system.md`: *"Not every example wins. At least one scene per chapter shows a failed first attempt, a relapse, or a cost — and some outcomes stay partial. Uniform instant success (`C28`) reads as survivorship gloss and makes the reader feel like the failure when it doesn't work first try."*
**TEST** `tests/outcome-variety.test.ts`: TP = an all-success chapter; MNF = a chapter with a mistake_recovery scene; gold zero-FP.
**DONE WHEN** Shared Law §9 + `FAILURE-MODES.md` `C28`.

## WT-D — Quiz

### Finding #3 — Quiz tests recall, not transfer; key references same-chapter entity `[NEW; implements D4]`
**WHY.** Regen ch8 q07 keyed to a testimonial; ch5 asked "what did Deborah D. say" ×4. Catalog **D4** ("no transfer / same scenarios as chapter") is **prompt-only — no critic exists**.
**EXISTING.** `pedagogy.checkQuizTestsApplication` (D1) blocks recall *openers* only; `quizCorrectness.checkKeyedChoiceDuplication` (cross-chapter). The same-chapter-entity reuse and "key references a chapter character" cases have **no detector**.
**DETECTION.** New `checkQuizScenarioNovelty(chapter)` in `pedagogy.ts` (implements `D4`): tokenize each quiz prompt's proper nouns; compare to the chapter's example/breakdown proper-noun set; fire `D4.recycled_scenario: "major"` when a question's named actor/scene is a chapter entity (exempt the central-concept name, mirroring SC9's title-word exemption). Add `checkQuizKeyEntity`: the keyed choice/explanation must not ground the answer in a same-chapter character (`D5.key_references_chapter_entity: "major"`). Both shadow until gold-clean.
**PREVENTION.** `writer-quiz.system.md` rule 1 (test application) — strengthen + add: *"Every question is a NEW scenario the reader hasn't met in this chapter — never recycle the chapter's own characters or scenes (`D4`). The correct answer derives from a verifiable source fact, never from 'what a character in the chapter did' (`D5`). Distractors encode distinct, named failure modes; no two questions test the same sub-idea."* Mirror to STEP-2 §Step 7.
**TEST** `tests/quiz-novelty.test.ts`: TP = a regen recycled-scenario question + a key-references-character question; MNF = a 48 Laws ch16 transfer question (new scenario); gold zero-FP.
**DONE WHEN** Shared Law §9; `FAILURE-MODES.md` `D4` upgraded from prompt-only to critic-enforced + new `D5`.

## WT-E — Semantic bar (`publishableBar.ts` + `QC-SESSION-PROMPT.md`) — internally serial

> All edits touch the same two files; do them sequentially within one worktree. Preserve `AXIS_WEIGHTS` sum = 100.

### #2 (hedge clause) — add to `factual_accuracy` rubric
*Clause:* "If the sidecar marks a claim `replicationStatus: contested|failed` and the prose states it as settled fact with no hedge, that is a `factual_accuracy` defect (YELLOW; CORRUPTION only if also fabricated/misattributed). A faithfully-reported contested claim WITH a hedge is fine. NOT the defect: hedging is not required for robust findings."

### #9 — hook & counterintuition strength (clause on `prose_coherence`, or a light new sub-score)
*Clause:* "Score the hook: does it open a curiosity gap with a concrete image, or is it a flat topic sentence? Score the counterintuition: does it actually reverse a stated default ('you'd think X, but Y'), or merely assert? A bland non-reversing counter drags `prose_coherence`. NOT the defect: a quiet hook that still creates a question."

### #12 (semantic half) — idea-density clause on `prose_coherence`
*Clause:* "Penalize a tier that stretches one idea across many paragraphs with low new-information density (filler). NOT the defect: deliberate, vivid repetition for emphasis."

### #13 — boundary/reversal teaching `[likely NEW behavior — gate `experiencePlan.failureRecovery` or a clause]`
Either (a) make `experiencePlan.failureRecovery` non-optional and gate its presence (`EXP` family), or (b) add a clause to `card_learning_value`/`prose_coherence`: "Does the chapter teach when the idea does NOT apply (its boundary/failure mode)? A chapter that only teaches the move, never its limits, is shallower — drag the axis. NOT the defect: a tightly-scoped chapter that names its boundary in one line."

### #14 (semantic half) — outcome realism clause on `example_coherence`
*Clause:* "If every example resolves in instant, frictionless success, flag survivorship gloss. Real teaching shows at least one failed attempt or partial outcome. NOT the defect: a genuinely simple action that does reliably work."

### #15 — lens-vs-tactic depth `[NEW axis or clause]`
Preferred: add a clause to `card_learning_value` (avoids a rebalance): "Does the chapter hand a reusable LENS (changes how the reader sees a class of situations) or just a one-off tactic? Lens-level insight scores higher. NOT the defect: an actionable tactic is still valuable — this is a tiebreaker, not a veto." If you make it a full axis: add `insight_depth` to `AxisId`+`AXIS_WEIGHTS`, **rebalance to 100** (carve ~6-7 proportionally as `behavioral_naturalness` was), leave OUT of `CORRUPTION_AXES`, add to `AXIS_RUBRIC` + `QC-SESSION-PROMPT.md`.

**WT-E TEST/VERIFY.** No deterministic test (semantic), but: `npm run typecheck`, confirm `AXIS_WEIGHTS` still sums to 100 (the invariant test passes), and run `npx tsx src/cli.ts publishable-rubric` to eyeball the rendered rubric. Update `QC-SESSION-PROMPT.md` so the reader scores the new clauses.
**DONE WHEN** rubric clauses live in both `publishableBar.ts` and `QC-SESSION-PROMPT.md`; weight sum = 100; `FAILURE-MODES.md` MB rows added.

[APPENDED: One soft exception: WT-E (semantic bar) and WT-F (first-pass prompts) edit rubric wording and writer prompts that change generation behavior — no deterministic test catches a bad rubric clause. For those two, having the agent paste its exact proposed wording for a 👎/👍 before it edits is cheap insurance. You don't need full plan mode for that — just tell the agent "show me the final clause text before writing." Everything in WT0/A/B/C/D is test-gated, so let it run.]

🚩 **CP-1 (per worktree):** the agent returns; I run its test against the gold corpus, confirm zero-FP, confirm both generation surfaces carry the rule, then merge. Append-only seams keep merges trivial.

---

# PHASE 2 — WT-F: First-pass QC (the token-saver)

> **Diagnosis (why it takes 3 rounds today):** Round 1 = deterministic nits surfaced one-at-a-time inside expensive rounds (the G6 treadmill) — *already solved by `qc-converge`, but the manual/writer path never runs it.* Round 1→2 = book-wide templating (BP13/AS10) only visible after all chapters exist. Round 2 = irreducibly semantic (wrong key, scene skeleton, testimonial-as-research). Round 3 = repair-introduced regressions + sweep stochasticity. The fix is to move every *self-catchable* class to write-time.

**PROMPT (paste to one agent, do the levers in order):**

> **Lever 1 (highest leverage) — close the writer↔converge gap.** In `STEP-2-WRITE-CHAPTERS.md`, add `qc-converge <bookId>` to the writer's pre-submit checklist (it runs the exact deterministic battery `finalize` uses; `CLEAN ⟺ finalize raises zero deterministic findings`). The writer must reach `DETERMINISTIC-CLEAN` before declaring Step 2 done. This provably removes the entire deterministic-finding class — including all new gates from Phase 1 — from round 1. (Autopilot's `doGate` already does this; you're closing the manual path.)
>
> **Lever 2 — catch book-level templating early.** Instruct the writer to run `qc-converge <bookId>` (which includes `book-gate`/`intra-book`) **after every chapter once ≥3 exist**, not only at the end — so BP13/AS10 cross-chapter templating surfaces at chapter 4, not chapter 14.
>
> **Lever 3 — writer self-runs the semantic pre-checks it CAN.** Add to STEP-2 the **hidden-key protocol** before submit: `quiz-blind <ch>` → derive the key independently → `quiz-verify <ch> --answers …`. A wrong key caught at write time costs 0 rounds; at QC it costs a full round. Also have the writer self-score the 9-axis `publishable-rubric`, hard-gating the four CORRUPTION axes (quiz_key_correctness, example_coherence, prose_coherence, factual_accuracy).
>
> **Lever 4 — promote the two self-catchable sweep classes to a write-time artifact.** STEP-2 R6.3/R6.4 already mention scene_skeleton/location_stamping; make them a required pre-submit list: "Write out your 6 scene openers, 6 venues, and each chapter's dealt SCENE MECHANISM; if one template covers ≥half, restage before submit."
>
> **Lever 5 — stop repairs from regenerating round-3 work.** In `REPAIR-CODEX-SESSION.md`, after edits require `major-status <book>` and confirm no NEW major key (A13/C23/BP28-31) appeared vs the pre-repair list, and re-run `qc-converge` to CLEAN before handback. (Autopilot does this via `majorFindingKeys`; close the manual path.)
>
> **Then validate end-to-end:** regenerate one benchmark book (`book-autopilot <id> --regen --no-publish`), and measure: did round 1 come back `DETERMINISTIC-CLEAN` and did the semantic round find only irreducible items? Tune the Phase-1 prevention rules (STEP-2 + writer-*.system.md) until a fresh book's first round is clean. **Target: deterministic layer + self-catchable semantic classes = 0 findings at round 1; ≤1 formal semantic round to publish.**

**VERIFY.** `npm run typecheck && npm run test`; then a regen run and inspect the round-1 `qc-converge` + first formal round output.
**DONE WHEN** the writer/repair prompts run `qc-converge`/`major-status`/hidden-key pre-submit; a regenerated benchmark book reaches `DETERMINISTIC-CLEAN` at round 1 and publishes in ≤1 semantic round (vs 3 today).

🚩 **CP-2:** regeneration-validated — I review the first-pass round output of the benchmark book.
[APPENDED: One soft exception: WT-E (semantic bar) and WT-F (first-pass prompts) edit rubric wording and writer prompts that change generation behavior — no deterministic test catches a bad rubric clause. For those two, having the agent paste its exact proposed wording for a 👎/👍 before it edits is cheap insurance. You don't need full plan mode for that — just tell the agent "show me the final clause text before writing." Everything in WT0/A/B/C/D is test-gated, so let it run.]
---

## Out of scope here — the app track to true 10/10 (#16–#20)
Pipeline fixes cap at ~9.5 (best static prose). The last half-point is **personalization by selection**, the **doing-loop** (read back the reader's own intention), **cross-chapter spaced retrieval**, **dual-coding visuals**, and **generative/adaptive assessment** — all app/infra, not this pipeline. Track separately.

---

## Quick reference — catalog ids introduced
`GN1` numbers · `E8` cadence-variance · `B15` cross-tier-paraphrase · `E9` idea-density · `C24` cast-overflow · `C25` cast-shuffle · `C26` scene-abstraction · `C27` exotic-name · `C28` uniform-success · `D4` recycled-scenario (now critic-enforced) · `D5` key-references-chapter-entity · `replicationStatus` sidecar field · bar clauses on `factual_accuracy`/`prose_coherence`/`example_coherence`/`card_learning_value` (+ optional `insight_depth` axis). Confirm next-free via `tests/check-registry.test.ts`.
