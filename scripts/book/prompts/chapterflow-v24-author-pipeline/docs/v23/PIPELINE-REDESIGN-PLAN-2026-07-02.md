# ChapterFlow Pipeline Redesign Plan — v24 "Author-First"

**Date:** 2026-07-02 · **Author:** Claude (pipeline architect) · **Companion doc:** `PIPELINE-AUDIT-2026-07-02.md`
**Status:** PLAN — nothing implemented. Every change below is evaluated for effect, blast radius, and worth-it before any code moves.

---

## 0. Goal and non-negotiables

Generate book content that is **good, informative, interesting, easy to read** — at **high first-pass rates** (low churn), **accurately grounded** in the source, **efficiently** (sessions and wall-clock), through a pipeline of **small, well-defined services** rather than one constraint monolith.

Non-negotiables carried forward from the current system:
- Every claim traceable to researched source (no invented witnesses, no unsupported numbers).
- Quiz keys derivable from prose, no tells, dealt answer patterns (fully solved today — do not regress).
- Session independence: the author of content never grades it.
- Publish is gated and attested; shipped books are never retro-broken.
- Fail-closed on real quality problems; halt for the owner rather than ship garbage.

**The measuring stick changes:** the current invariant "never weaken a gate" is replaced by **"never regress the blinded reader score."** Gates serve the score; the score is calibrated against the owner's rubric (§C9). This single rule prevents the constraint ratchet that overgrew v23.

### The worth-it test applied to every change
A change is worth it only if: (a) it traces to a *reader-visible* defect or a *measured* cost, (b) its blast radius is contained (flagged, additive, or compiler-path-untouched), and (c) it survives "would a simpler thing do?"

---

## 1. Evidence this plan is built on (measured, not vibes)

| Fact | Measurement |
|---|---|
| Old simpler pipeline beats full v23 output | 6/6 blinded readers, composite Δ −8.5 (ch01), −7.6 (ch09); v23 ships 0/6 at the 84 bar |
| One section-writer task card | 41,631 chars = 6,013 contract + 6,599 dealt-blueprint JSON + 28,582 packet JSON — **paid 4× per chapter** (~160k instruction chars/chapter) |
| Constraint surface | 126 SEC checks (2,633-line section gate), ~20,700 lines of gate/critic code |
| Cost of the last run | 81 codex sessions for one rejected book |
| Structure-dealing creates the templating it fights | 5-shape ifThen pool (`chapterBlueprint.ts:276-280`) → book-wide rotation; 3 repair passes each exposed a new shared layer (proven non-convergent) |
| Blind post-hoc repair degrades quality | Readers called pass-3 output "abstract calendar/process machinery" |
| The ceiling is real | Panel-2: one carefully-converged chapter beat the shipped book +3.0 |
| Readers' top complaints have no gate | Within-chapter anchor repetition, chapter length (+40%), practice theater — all ungated today |
| QC bar covers ~23/100 of the owner's rubric weight | From the campaign audit |

**Diagnosis (one line):** the pipeline writes like a machine and judges like a human; v24 inverts it — *author-shaped writing, machine-shaped checking, reader-shaped judging.*

---

## 2. Target architecture

Seven services. Each is an idempotent CLI verb (or small set) with a JSON artifact contract, independently runnable and testable — "microservices" at the verb/artifact level, which the repo already does well. **No network decomposition** (§C13 — evaluated and rejected).

```
┌──────────┐   ┌─────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌─────────┐   ┌─────────┐
│ RESEARCH │ → │ BRIEFS  │ → │  WRITE   │ → │  VERIFY  │ → │  REVIEW  │ → │ REPAIR  │ → │ PUBLISH │
│ (keep,   │   │ (new,   │   │ (1 whole │   │ (determ. │   │ (reader  │   │ (regen, │   │ (keep + │
│  harden) │   │  small) │   │ chapter) │   │  ~30 chk)│   │  proxy)  │   │  cap 2) │   │  fix)   │
└──────────┘   └─────────┘   └──────────┘   └──────────┘   └──────────┘   └─────────┘   └─────────┘
 SourcePacketV1  ChapterBriefV1  ChapterV21    gate-chapter   ChapterReviewV1  fresh write   attestations
 + SP gates      + BR gates      (direct)      + budgets      + BookReadV1     w/ complaints + package
```

The conductor (`autopilot.ts`) remains the orchestrator with a third architecture value: `"compiler" | "legacy" | "author"`. The compiler path is **not deleted** — it stays flagged for rollback and A/B.

---

## 3. Change register

Each change: **What / How (files, artifacts, size) / Effect / Blast radius / Worth it?**

### C1. Chapter Briefs service — replace structure-dealing with a one-page brief
**What:** New `compile-chapter-briefs <book>` + `chapter-brief-gate <book>`. Per chapter, ONE page that carries *reservations and intent*, not dealt structure.

Brief contents (`ChapterBriefV1`, Appendix B):
- `coreMove` — from the packet's `coreMoveFactId` (P13 already computes this).
- `thesis` + `readerPromise` — one line each, derived from ranked facts.
- `ownedCases` — **one-owner allocation** of marquee named cases across the book (new allocator ~120 LOC; other chapters may *mention* a non-owned case ≤1 time, never scene it). Kills exemplar bleed (bystander-scripts ×5, old YES-Prep ×7 disease).
- `cast` — chapter-disjoint first names (reuse the existing name-dealing lib from `chapterBlueprint.ts`; extract to `src/lib/nameDeal.ts`).
- `answerIndexPattern` — **kept verbatim** from the P11 dealer (quiz anti-gaming is solved; do not regress).
- `avoid` — ≤6 lines extracted deterministically from sibling briefs/chapters: opener signatures, challenge formats, venue keywords already used.
- `lengthBudget` — rendered-char target from the catalog median (~16k; the shipped book readers prefer).
- `flavor` — ≤5 non-binding suggestions from the P14 design pools (pools survive as *suggestion palettes*, not generators).

**Deleted from the write path:** dealt hook/counter/ifThen/quiz-shape/scene-frame/beat grammars (the F16 five-move rotation dies at the root — cheaper and more complete than the planned "widen the pools" fix).

**Effect:** structure now comes from the writer's per-chapter judgment (where variety actually lives) with hard reservations where collisions actually hurt (names, cases, keys).
**Blast radius:** additive (new module/verbs/artifacts under `runs/v23-current/briefs/`). Compiler path untouched; zero existing tests affected. New tests ~10 (determinism, one-owner disjointness, avoid-list extraction).
**Worth it? YES — the core enabler.** ~2 days incl. tests.

### C2. Whole-chapter Writer — one author owns the chapter
**What:** New `doAuthorWrite` in the conductor (~150 LOC, adapted from the *existing* legacy `doWrite` at `autopilot.ts:1205` — the chassis is alive). One writer per chapter, parallel ≤ `maxParallel`, writing `state/chapters/<book>-chNN.v21-native.chapter.json` **directly** (no packs, no assembly).

Writer card (~18k chars vs today's ~160k/chapter):
1. The brief (2k) — C1.
2. Style card (~1.5k) — reuse `src/lib/voiceCard.ts` + register line + the audit's 10-line house rules (plain verbs, short words, Flesch 72–84, honest limits, no filler, length budget).
3. Packet writer-projection (~15k) — C3.
4. ChapterV21 schema hint + a trimmed `WRITER_SELF_VERIFY` (exists at `autopilot.ts:1107`, 4.6k → ~2k: key derivability, grounding, length, no label-transcription).

**Effect:** 48 → 12 writer sessions/book; one voice per chapter (readers scored old higher on tone/summaries — this is the fix); instruction tokens ÷9.
**Blast radius:** new code path behind `CHAPTERFLOW_ARCH=author` (conductor already switches on an `architecture` option). Chapters land where every downstream tool already reads them (`statusOf`, gates, evidence maps, promote). Section-pack machinery not invoked in this arch. Existing suite untouched.
**Risk & mitigation:** one big JSON per session — v21/v22 shipped 130 books this way; `gate-chapter` returns precise blockers; retry once with the blocker text appended.
**Worth it? YES — the central bet, and it's panel-backed.** ~1.5 days.

### C3. Packet writer-projection — the card diet's biggest lever
**What:** `writerPacketProjection()` in `src/compiler/sourcePacket.ts` (~60 LOC): keep claims, mechanism/commonError/whyWrong, namedCases + hardSpecifics + anchors + allowed entities; drop compiler internals and long source-note excerpts. Target ≤15k chars (from 28.6k).
**Effect:** with C2, per-chapter instruction payload drops ~9×; the packet is read once, not four times.
**Blast radius:** new function; the section-pack path keeps its existing projection. One golden test.
**Worth it? YES.** Half a day.

### C4. Deterministic Verify — consolidate to ~30 reader-correlated checks + 5 new ones
**What:** In the author arch, `gate-chapter` (ship gate) + `book-gate` become the *only* deterministic gates (no `validate-sections` — no packs). Keep in them: SC11 source-grounding family (incl. the F15 min-1 calibration), quiz structural soundness + tell metric + answerIndexPattern conformance, readability bands (rubric-metrics thresholds), scaffold/label-leak checks (port SL6 + SEC105 logic to chapter level), cast containment (port SEC119 logic), name reservations, and a banned-signature shortlist cut from 117 scar entries to the ~20 cross-book signatures.

**NEW checks** (new `src/critics/readerBudgets.ts`, each ~40–80 LOC, all zero-FP-calibrated against the 130-package catalog before enforcement, enforced only on the author path — no retro-blocking):
- **CH-REP** within-chapter anchor-repetition budget (mentions per named case ≤ N, calibrate ≈6) — the #1 reader complaint, currently ungated.
- **CH-LEN** chapter length vs `brief.lengthBudget` ±20% — the padding complaint.
- **BK-NAME** cross-chapter first-name disjointness — deterministic (the scout caught Margaret ×3; nothing deterministic does today).
- **BK-OPEN** opener-signature uniqueness across the book (extracted shape signature, not LLM judgment).
- **BK-FORM** practice/challenge format-signature budget (≤2 repeats book-wide).

**Effect:** every gate in the write loop is cheap, consistent, and points at a line. LLM judgment leaves the write loop entirely.
**Blast radius:** section gate untouched (compiler path). Ship-gate additions are additive check IDs; shipped-book re-verification unaffected (checks keyed to author-arch runs). New tests ~12 (5 calibration proofs + ports).
**Worth it? YES.** ~1.5 days incl. calibration runs.

### C5. Review service — the reader proxy becomes the quality gate
**What:** New `src/review/readerReview.ts` + verb `review-chapter <book> [--chapters N]`. One blinded read per chapter (prompt = today's *validated* panel-3 reader prompt, single-doc absolute form): scores the owner's **10 rubric factors** (definitions imported verbatim from P12 `craftBar.ts` rubric text where they overlap), derives all quiz answers from prose before seeing the key, gives ship y/n at the bar, and 2–4 quotes.

Deterministic adjudication in-process (port `adjudicate.py` → TS ~100 LOC): **byte-verify every quote**, check derived answers vs the actual key, reject invalid reviews and re-spawn once. Output `ChapterReviewV1` (Appendix B) with `complaints[]` structured for the regen prompt.

**Pass rule:** weighted composite ≥ bar AND ship=true AND key derivation 9/9. **Publish confirm:** two *independent* reviewers on the final book state (reuses `sessionProvenance` independence). On book PASS, write **the same PUBLISHABLE attestation records** promote-book already requires (reuse `src/critics/qcAttestation.ts`) — **promote is untouched**.

**Replaces (author arch only):** sweep, keyA, keyB, bar, craft-shadow, confirm role stack → 12 chapter reviews + 1 book read (C6) + 2 publish confirms ≈ **15 reads** vs 6+ roles × N rounds.
**Blast radius:** new module; QC verbs remain fully functional for the compiler path and rollback. Promote path byte-untouched. New tests ~8.
**Worth it? YES — this is the calibration fix; the rubric becomes the gate.** ~1.5 days (the prompt, quote-verifier, and key-checker were built and validated today).

### C6. Book-level sameness read — replace the scout→detemplate loop
**What:** After all chapters pass review: ONE whole-book read asking the *reader's* question — "did chapters feel same-y? name the worst pairs and quote why" (`BookReadV1`). Uses P08's `sweepSpec.ts` family definitions as background language (kept as the single source of truth), but the verdict is reader-feel, not family taxonomy. Complaints name specific chapters → those chapters regen (C7), cap one round of ≤3 chapters.
**Effect:** cross-chapter quality still guarded, but by a bounded, reader-shaped signal that converges (regen, not layer-peeling repair). The unbounded structure-detector loop — proven non-convergent across 3 passes — leaves the pipeline.
**Blast radius:** author arch only; scout/detemplate code untouched for compiler path. Tests ~4.
**Worth it? YES.** Half a day.

### C7. Repair = regeneration, never patching
**What:** A chapter failing review (or named by the book read) goes back to a **fresh writer session**: same brief + packet + the structured complaints ("previous attempt failed review for these specific reasons — do not repeat them"), *without* the previous prose (prevents anchoring; preserves voice coherence). **Cap: 2 total write attempts per chapter, then HALT for the owner** with the review attached.
**Retired from the author loop:** `repairRouting.ts` class routing, slot salts, artifact-sync, multi-pass surgical detemplates. All code stays in-repo (compiler path + rollback).
**Effect:** repair preserves coherence (panel-proven direction); bounded cost (≤12 extra sessions worst case); no oscillation by construction.
**Blast radius:** none outside the author phase graph. Tests ~3 (cap, complaint threading, halt).
**Worth it? YES.** Half a day.

### C8. Conductor phase graph for the author arch
**What:** `decidePhase` unchanged. Author ladder: `research → briefs → write(12∥) → deterministic converge (qc-converge subset + blocking-majors, kept — it cheaply fixed 4 real majors today) → review → regen(≤2/chapter) → book read → regen(≤1 round) → 2-reviewer confirm → attestations → ready/publish`. All spawns through the existing `spawnAndLog` / lock / heartbeat / provenance machinery (unchanged).
**Blast radius:** ~200 LOC in `autopilot.ts` + `compilerRun.ts`-style new `authorRun.ts`; plan-mode (`--plan`) output extended. Tests ~5 (phase ladder with stubs, mirroring existing patterns).
**Worth it? YES.** 1 day.

### C9. Calibration harness — the score-ratchet
**What:** Freeze an eval set: 3 owner-scored catalog books spanning the range (proposal: the-compound-effect ~85, a ~78 mid, a ~72 low — final picks are an owner question, §12) + old-POM. Verb `eval-reader-proxy` runs C5 reviews over them and reports composite scores + rank correlation vs the owner's historical scores (`book-score` skill output). **GO/NO-GO for everything else: Spearman ≥ 0.8** and stable re-run variance (±3). Thereafter, any prompt/gate/pool change must not regress the eval set by >2 points — enforced as a checklist step, recorded in the run log.
**Effect:** the alignment problem (writers/QC/rubric = three definitions of "good") becomes a measured, regression-tested property.
**Blast radius:** read-only over shipped packages; zero pipeline code touched.
**Worth it? YES — prerequisite; do it FIRST.** Half a day.

### C10. Research hardening
**What:** (a) Close the proven restore hole: `doResearch` postcondition gains a freshness proof — newest run's sidecar mtimes > task start AND not byte-identical to any `_regen-backups` copy (~40 LOC); anti-restore rule added to `RESEARCH-CODEX-SESSION.md`. (b) **Atomic hardSpecifics**: research prompt rule ("'red phone', not 'the Los Angeles hotel with a red phone by the pool'") + `SP16.atomic_specifics` advisory (specifics >6 words flagged). Kills the recitation pressure at its source (panel-2's residual disease).
**Blast radius:** research prompt + one gate advisory; SP gates otherwise untouched. Tests ~3.
**Worth it? YES.** Half a day.

### C11. QC role stack disposition (author arch)
keyA/keyB → folded into review's key derivation + deterministic pattern/tell checks. sweep → C6. bar → review composite. craft (P12) → its rubric text lives on inside the review prompt; the separate role retires. confirm → two-reviewer publish confirm. **All QC verbs remain operational** for the compiler path; nothing is deleted.
**Worth it? YES (it's the consequence of C5/C6, not extra work).**

### C12. Publish path fix — sandbox → live
**What:** The v23 pipeline is a standalone sandbox; `publish-after-qc` promotes to the *sandbox* `book-packages/` and refuses the repo-root commit (documented trap; blocked the Jul-1 regen). New `publish-to-live <book>` step: copy package to repo-root `book-packages/`, refresh catalog metadata (`generate-catalog-metadata`), re-verify with `verify-production-package` against repo-root, then commit/push **only on owner request**.
**Blast radius:** additive verb; promote untouched. Tests ~3.
**Worth it? YES — independent of everything else; nothing can ship without it.** Half a day.

### C13. Evaluated and REJECTED (explicitly not worth it)
| Candidate | Verdict | Why |
|---|---|---|
| True network microservices (separate processes/APIs) | **NO** | Single-operator pipeline; verbs+artifacts already give isolation, testability, replaceability. Network split adds ops burden, zero quality. |
| Rewrite artifact store / run layout | **NO** | Works; migration risk for nothing. |
| Delete P09 sweep ledger / P10 routing / scout code | **NO** | Dormant in author arch; keep for compiler rollback. Delete only after v24 is proven across several books. |
| Widen ifThen/shape pools (the original F16 fix) | **SUPERSEDED** | C1 removes dealt grammars entirely — cheaper, more complete. |
| Regenerate the 130-book catalog now | **DEFER** | Only after v24 proves on POM; then bottom-scored books first, owner-scheduled (Phase 6). |
| More detemplate/repair machinery | **NO** | Proven net-negative (3 passes, panel). |

---

## 4. What is KEPT, verbatim (the good of the current design)

| Asset | Where | Why kept |
|---|---|---|
| Research → chapter-distinct packets + SP gates (SP14) | `sourcePacket*.ts` | Readers praised mechanism language + source range — this layer works |
| P13 fact ranking + coreMoveFactId | `sourcePacketFacts.ts` | Feeds the brief's core move; proven byte-safe |
| Answer-key pattern dealing + tell metrics + blind derivation | blueprint/rubric-metrics | Quizzes: 9/9 derivable, 0 tells, both panels — solved |
| Deterministic ship gates (SC11 incl. F15), book-gate, majors policy | `sourceGrounding.ts`, gates | Cheap, consistent, reader-neutral correctness |
| Session independence + author provenance | `sessionProvenance.ts` | Trust model — unchanged |
| Attestation + promote + package verify | `qcAttestation.ts`, promote | Publish contract — byte-untouched by this plan |
| P08 `sweepSpec.ts` single source of truth | `qc/sweepSpec.ts` | Feeds the book-read's background definitions |
| P12 craft rubric text | `craftBar.ts` | Becomes the review prompt's factor definitions |
| P14 design pools | `bookDesign.ts` | Demoted to non-binding flavor palettes in briefs |
| Conductor: locks, heartbeats, halts, resume, plan mode | `autopilot.ts` | The orchestration shell is good engineering |
| Fail-closed philosophy | everywhere | Right instinct — now pointed at reader-correlated signals |

## 5. What is RETIRED from the author loop (kept in repo, flagged off)

| Retired | Replaced by | Rollback |
|---|---|---|
| 4 blind section writers + packs + assembly | C2 whole-chapter writer | `CHAPTERFLOW_ARCH=compiler` |
| Dealt structure grammars (hook/counter/ifThen/scene/beat/quiz-shape) | C1 briefs (reservations + suggestions) | same flag |
| `validate-sections` 126-check gate (in author arch) | C4 ~30-check chapter/book gates | same flag |
| Pre-QC variety scout + detemplate passes | C6 book read + C7 regen | same flag |
| Repair routing / slot salts / artifact sync | C7 regeneration | same flag |
| keyA/keyB/sweep/bar/craft/confirm role rounds | C5 review + C6 + 2-reviewer confirm | QC verbs still work |
| Risk-gated polish pass | style card + CH-LEN budget | verb remains |

---

## 6. Migration plan (phased, each with GO/NO-GO and rollback)

**Phase 0 — Calibrate the judge (0.5 day).** Build C9. Run reader-proxy on the eval set.
GO: Spearman ≥0.8 vs owner scores, re-run variance ≤3. NO-GO: fix the review prompt, not the pipeline.

**Phase 1 — Independent hardening (0.5 day).** C10 (research holes) + C12 (publish-to-live). Zero interaction with arch work; both are needed regardless.

**Phase 2 — Build the author arch (2–3 days).** C1 briefs, C3 projection, C2 writer, C4 gates, C8 conductor, behind `CHAPTERFLOW_ARCH=author`. Full suite must stay green (author path is additive; the pre-P13==P13==P14 byte-compat goldens and all compiler tests untouched). ~30 new tests.

**Phase 3 — The decisive experiment (0.5 day).** Regen **POM ch01 + ch09 only** through the author arch. Then the *identical* blinded panel vs the shipped book (today's harness, unchanged, 6 readers).
GO: paired Δ ≥ +3 AND both chapters pass C5 review first-or-second attempt. NO-GO: flag back to compiler; the loss is ~3 days and we've learned the writer needs different inputs — iterate on the brief/style card only.

**Phase 4 — Full POM through v24 (1 day).** 12 chapters → verify → review → regen loop → book read → 2-reviewer confirm → attestations → ready. Spot-check panel (3 readers, 2 sampled chapters). Owner decides publish (via C12).
Success bar: first-pass review ship-rate ≥10/12; ≤1 regen round; total ≤40 sessions.

**Phase 5 — Lock it in (0.5 day).** Calibrate CH-REP/CH-LEN/BK-* budgets against the catalog; wire the score-ratchet checklist into the campaign docs; metrics logging (sessions/book, first-pass rate, wall-clock) into the run summary.

**Phase 6 — Catalog policy (owner-scheduled).** Regen bottom-scored catalog books through v24, N at a time, panel-sampled. Retire compiler-path code only after ~5 clean v24 books.

Rollback at every phase = flip the arch flag; no shared state is mutated (new artifacts live in new files; chapters are the shared interface and are gated identically).

---

## 7. Efficiency budget (per book)

| | v23 today (measured) | v24 target |
|---|---|---|
| Writer sessions | 48 (+polish +repairs) | 12 (+≤12 regens worst case) |
| Gate/scout/QC reads | ~20–30 across rounds | 12 reviews + 1 book read + 2 confirms = 15 |
| Repair sessions | unbounded-ish (today: 36 sweep editors + scouts) | ≤12, capped |
| Instruction chars per chapter | ~160k (4 × 41k cards) | ~18k (one card) |
| Total sessions | 81 (rejected book) | **≈30–40 (shipped book)** |
| Wall-clock | 50 min to halt, no QC | ~60–90 min to ready |

---

## 8. Test & QA strategy

- **Existing suite (1,299):** stays green untouched — every change is additive or flag-gated; compiler-path tests, gold corpus, and byte-compat goldens are not in any changed code path. Any suite delta = a bug in this plan's execution.
- **New tests (~35):** brief compiler determinism + BR gates (10); packet projection golden (1); the 5 reader-budget checks with zero-FP catalog calibration proofs (12); review adjudication — quote byte-verify, key check, invalid-review re-spawn (8); author phase ladder with stubbed deps (5); regen cap + halt (3).
- **Eval harness (C9)** runs at every phase boundary; results logged in the campaign memory.
- **Panels** remain the ground truth instrument at Phases 3–4 (harness already built and validated: counterbalanced, byte-verified quotes, key derivation).

## 9. Risk register

| # | Risk | L×I | Mitigation |
|---|---|---|---|
| 1 | Whole-chapter JSON reliability | M×M | v21 shipped 130 books this way; gate-chapter gives precise blockers; 1 retry with blocker text |
| 2 | Reader-proxy miscalibrated → wrong gate | M×H | Phase 0 GO/NO-GO (Spearman ≥0.8); 2-reviewer publish confirm; quotes byte-verified |
| 3 | Cross-chapter house-voice sameness returns (old book's known weakness) | M×M | Brief `avoid` lists + BK-OPEN/BK-FORM/BK-NAME deterministic checks + C6 book read; panel evidence says readers prefer coherence anyway — the eval loop arbitrates |
| 4 | Writers game the review | L×M | Writers never see review prompts; session independence enforced; review is blinded |
| 5 | Regen non-convergence on a hard chapter | M×L | Cap 2 → owner halt with the review attached (bounded, visible) |
| 6 | Length budget suppresses depth | L×M | ±20% band; calibrated on the catalog; density is a review factor, not only a char count |
| 7 | Two sessions/conductors colliding on state (bit us today) | M×M | Existing run-lock honored; single-conductor rule documented; freshness proof (C10) |
| 8 | Plan scope creep re-grows the monolith | M×H | The worth-it test + score-ratchet are written into the campaign docs; every new gate needs a reader-visible defect |

## 10. Success criteria (v24 is "functional toward the goal" when)

1. Blinded paired panel: v24 POM ≥ +3 over the shipped book (and no factor crater ≤ −10).
2. Reader-proxy composite ≥84 median across chapters, confirmed by 2 independent reviewers.
3. First-pass review ship-rate ≥10/12 chapters; ≤1 regen round per book.
4. ≤40 sessions and ≤90 min wall-clock per book.
5. Zero grounding/key regressions (SC11 + key checks green; derivation 9/9).
6. Eval-set scores not regressed by any subsequent change (the standing ratchet).

## 11. Sequencing summary

```
P0 eval harness (GO gate) → P1 hardening ┐
                                          ├→ P2 author arch (flagged) → P3 ch01+ch09 PANEL (GO gate)
                                          ┘        → P4 full POM → P5 lock-in → P6 catalog (owner-paced)
```
Total to the Phase-4 decision: **~6 working days** of focused build, two hard GO/NO-GO gates before any real commitment.

## 12. Open questions for the owner (blocking only where marked)

1. **Bar threshold** — keep 84 as the ship bar for the reader-proxy? (default: yes)
2. **Eval-set picks** — I propose the-compound-effect (top), one ~78 mid, one ~72 low + old-POM; happy to take your three. (non-blocking; needed at Phase 0)
3. **Voice policy** — readers rewarded the coherent house voice; per-book `voiceCard` remains the differentiation lever. OK to accept one-voice-per-book as the design position? (default: yes)
4. **Phase 6 appetite** — regen the bottom of the catalog once v24 proves? (non-blocking)

---

## Appendix A — SEC check disposition (by band)

| Band | Theme | Author-arch disposition |
|---|---|---|
| SEC0–SEC12 | pack schema/identity/slot shape | **Die with the packs** — ChapterV21 schema + gate-chapter structural checks cover the chapter |
| SEC13–SEC32 | summary/hook prose rules, memorable lines | Deterministic parts (lengths, counts) → chapter gate; judgment parts → review factors (summaries/retention) |
| SEC33–SEC74 | grounding/anchors/specifics/quiz/cards/action | **Already mirrored by ship-gate SC11 + quiz checks** (F14/F15 calibrations preserved); section-level duplicates retire |
| SEC80–SEC99 | cross-pack seams, phrase budgets, n-gram echoes | Seam checks die with the packs; cross-chapter parts → BK-OPEN/BK-FORM/BK-NAME (deterministic) + C6 book read |
| SEC100–SEC118 | scaffold/label/casing leaks | **Port the ~6 reader-facing leak checks** (SL6, SEC105 class) to the chapter gate |
| SEC119 | cast containment | **Port** to chapter gate (calibration already done in P15) |

Net: ~30 checks live on the author path, each cheap and byte-actionable.

## Appendix B — New artifact contracts

```jsonc
// ChapterBriefV1 — state/books/<book>/runs/<run>/briefs/chNN.brief.json
{
  "schemaVersion": "chapterflow-brief-v1",
  "chapterId": "ch01", "chapterNumber": 1, "title": "Defining Moments",
  "coreMove": "…",                     // from packet.coreMoveFactId (P13)
  "thesis": "…", "readerPromise": "…",
  "ownedCases": ["ch01.example.1", "ch01.example.3"],   // one-owner across book
  "mentionOnlyCases": ["ch03.example.2"],               // ≤1 mention, never scened
  "cast": ["Renee", "Marcus"],                          // book-disjoint first names
  "answerIndexPattern": [1,1,0,2,0,1,2,0,2],            // kept P11 dealer
  "avoid": ["opener: calendar-review (ch02)", "challenge: receipt-audit (ch12)", "…"],
  "lengthBudget": { "renderedChars": 16000, "tolerance": 0.2 },
  "flavor": ["hospital ward", "school assembly"]        // ≤5, non-binding
}

// ChapterReviewV1 — state/reviews/<book>/chNN.review.json
{
  "schemaVersion": "chapterflow-review-v1",
  "chapterId": "ch01", "contentHash": "…", "reviewerSessionId": "…",
  "scores": { "retention": 0, "quizzes": 0, "transfer": 0, "practical": 0, "summaries": 0,
               "tone": 0, "limits": 0, "insight": 0, "density": 0, "beginner": 0 },
  "composite": 0.0, "ship": false,
  "keyCheck": { "derived": ["b","b","a"], "matches": 9, "of": 9, "disagreements": [] },
  "quotes": [{ "quote": "…", "why": "…", "verified": true }],
  "complaints": [{ "unit": "implementationPlan", "problem": "…", "mustFix": true }]
}

// BookReadV1 — state/reviews/<book>/book-read.json
{ "schemaVersion": "chapterflow-bookread-v1",
  "sameyPairs": [{ "chapters": [4, 9], "what": "…", "quotes": ["…","…"] }],
  "complaints": [], "ship": true }
```

## Appendix C — Author write-card skeleton (~18k chars total)

```
ROLE — You are the author of chapter NN of <book>. You own the whole chapter: hook,
breakdown (fast/deep/full), examples, quiz, review cards, implementation plan, memorable lines.

THE BRIEF (1 page)          ← ChapterBriefV1 rendered
HOUSE STYLE (10 lines)      ← voiceCard + register + length budget
SOURCE PACKET (projection)  ← facts/mechanisms/cases/specifics/anchors — the ONLY allowed material
OUTPUT — write state/chapters/<book>-chNN.v21-native.chapter.json matching ChapterV21.
SELF-VERIFY (short)         ← keys derivable from your prose · every claim in the packet ·
                              length inside budget · no compiler/label vocabulary in prose
VALIDATE — npx tsx src/cli.ts gate-chapter state/chapters/<book>-chNN…json (0 blockers)
```
