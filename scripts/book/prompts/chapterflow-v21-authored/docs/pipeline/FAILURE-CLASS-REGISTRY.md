# Failure-class registry

This pipeline already promotes failures to fixes informally: a defect appears in a run, and we
add a prompt warning, a prevention plan, a shadow detector, or a gate. This file makes that
**formal and bounded** — so the pipeline keeps getting safer **without becoming overfit** to one
book's quirks. The discipline it encodes (calibrate before blocking; shadow before hard-fail) is
the one the code already implements; this registry is the ledger that keeps the two honest.

> One rule above all: **a new hard blocker is the last resort, not the first.** Most failures are
> fixed upstream (better source, a prevention allocator, a writer card) or surfaced as an advisory.
> A deterministic gate that fails a real, good book is worse than the defect it caught.

## The promotion ladder

Each rung maps to a real mechanism in the code — promotion means moving a class **up** only when
its rung's bar is met.

| Rung | Trigger | Mechanism in code |
|------|---------|-------------------|
| **0 — Document** | Observed **once** | Add a prompt warning / a note here + in the relevant `agent-prompts/*`. No gate. |
| **1 — Prevent** | Confirmed **twice** (same class, different books/chapters) | Add a prevention plan or authoring guidance — an allocator (`src/librarian/*Plan.ts`) or a writer card line — so the defect can't be dealt in the first place. |
| **2 — Shadow** | **Zero false positives on the clean corpus** | Add a SHADOW major — it *surfaces* (advisory) but does NOT fail the gate. See the `author-check` shadow rollout (`authoringContract.ts`) and the BP shadow majors (`bookGate.ts`). |
| **3 — Write-barrier actionable** | Repeated **true** positive **and** low FP, still zero on clean | Make it block the **write self-gate** (re-dispatch the offender) but not QC/publish. Code: `WRITE_BARRIER_ACTIONABLE_PREFIXES` in `bookGate.ts` (currently `BP28`–`BP31`). |
| **4 — Hard blocker** | See the gate below — all three must hold | Add the catalog id to `ENFORCED_MAJOR` (`finalGate.ts`). This FAILs the chapter. **`ENFORCED_MAJOR` is currently empty — nothing has met the bar.** |

### The hard-blocker gate (rung 4)

**Never** promote a class to a hard blocker (`ENFORCED_MAJOR`) unless **all** of:

1. **Clean corpus: zero.** The detector fires 0 times across the clean reference books.
2. **Gold corpus: zero.** It fires 0 times across the gold books (e.g. `daring-greatly`) — gold
   books trip a few *advisory* majors on genuinely good prose, so a detector that fires on gold is
   not separable and must stay advisory.
3. **At least 2 true positives.** It has caught a *real* defect in ≥2 distinct runs — one anecdote
   is not a class.

If any of the three fails, the class stays at rung ≤3. This is the anti-overfit valve: it is the
reason `ENFORCED_MAJOR` is empty and the BP family stops at rung 3 (write-barrier actionable).

## Registry

Status values: `observed once` · `confirmed twice` · `shadow` · `write-barrier actionable` ·
`hard blocker` · `retired`. FP-risk: `low` · `medium` · `high`.

---

**FC-2026-06-17-001 — source-verify rubber-stamp**
- Book: digital-minimalism · Stage: research
- Failure: 81 verifiable items marked VERIFIED under one identical note over reused sources — bulk
  attestation, not per-item verification.
- Root cause: sidecars were structurally valid (`check-source` passed) but never checked against
  reality; the grounding "gate" was decorative (nothing read the filled record back).
- Fix type: deterministic gate (`checkSourceVerifyRecord` SV1–SV5 in `critics/sourceVerify.ts`) +
  research-phase requirement (`source-verify-check` PASS) + ergonomics (`source-verify-workbench`).
- Status: **write-barrier actionable** (blocks at research/publish-preflight under
  `CHAPTERFLOW_REQUIRE_SOURCE_VERIFY=1`; absent record is absence-safe otherwise).
- FP-risk: **low** — SV4 requires ONE identical note **over reused sources** (`distinctRefs <
  verified`); distinct sources with a shared note do not fire (regression-tested).
- Caught by: `source-verify.test.ts`, `no-api-promote.test.ts` (SV4 fires on an injected rubber-stamp record).

**FC-2026-06-17-002 — allocator↔critic contradiction (`paradox_colon` vs B4)**
- Stage: write (deal time)
- Failure: the rhetoric allocator dealt an opener (`"The paradox: …"`) that a B-class banned-phrase
  critic forbids — the deal told the writer to do what a gate bans.
- Root cause: two independent tables (allocator directives vs `banned-phrases.json`) with no
  cross-check.
- Fix type: prevention (reworded directive) + a **class-level** deal↔gate invariant test (no
  allocator directive may contain any banned phrase) — fixes the whole class, not the instance.
- Status: **confirmed twice** → prevented. FP-risk: **low** (test is exact-substring).
- Caught by: `rhetoric-plan.test.ts` (no allocator directive may contain a hard-banned phrase).

**FC-2026-06-17-003 — exemplar double-owner (fanout card vs SP5)**
- Stage: QC/publish
- Failure: the fanout card computed exemplar ownership live while the SP5 gate read the persisted
  plan; the two diverged (card said "FORBIDDEN: none", gate enforced single-owner) → a QC-passed
  book blocked at publish.
- Root cause: two computations of one constraint (producer vs validator) from different artifacts.
- Fix type: single source of truth (cards read the same persisted plan the gate reads) + a
  producer↔validator contract test.
- Status: **confirmed twice** → prevented. FP-risk: **low**.
- Caught by: `exemplar-plan.test.ts`, `plan-enforcement.test.ts` (cross-chapter exemplar ownership + the producer↔validator contract).

**FC-2026-06-17-004 — QC PASS ≠ publishable (SP gate too late)**
- Stage: publish
- Failure: `checkPlanEnforcement` ran only at the publish preflight, so a certified-PASS book could
  still be blocked out-of-band at the last step.
- Root cause: the late gate was a poor predictor of the earlier verdict (stacked, non-predictive
  gate layers).
- Fix type: shift-left — fold SP into `finalize` + `verifyRepair` so a QC PASS predicts publish;
  keep the preflight as a now-no-op backstop.
- Status: **prevented** (shifted left). FP-risk: **low** (same deterministic check, run earlier).
- Caught by: `qc-finalize-evidence.test.ts` (a chapter violating its dealt SHAPE plan REVISEs at finalize).

**FC-2026-06-17-005 — reviewer session non-independence**
- Stage: QC
- Failure: "separate reviewers" was proven only by derived role-strings (`…:bar:chNN` ≠
  `…:confirm:chNN`), which differ by construction — so the bar≠confirm check never fired; keyA/keyB
  were compared only by answers.
- Root cause: no recorded evidence that bar/confirm/keyA/keyB were genuinely separate sessions.
- Fix type: deterministic gate (per-submission `reviewerSessionId` from the env + `sessionsCollide`
  enforcing keyA≠keyB, bar≠confirm, bar≠tiebreak, reviewer≠author).
- Status: **opt-in hard gate** under `CHAPTERFLOW_ENFORCE_SESSION_INDEPENDENCE=1` (absence-safe:
  legacy/un-stamped books and the inline single-session fallback never block). FP-risk: **low** —
  fires only when two roles provably share one session id.
- Caught by: `qc-session-independence.test.ts`, `manual-keyjudge.test.ts` (same-session keyA/keyB BLOCKs; collision primitives gated + absence-safe).

**FC-2026-06-17-006 — book-wide sameness families (BP28/BP29/BP30/BP31)**
- Stage: write
- Failure: templated review-card callback frames, try-now clock stamping, and uniform Title-Case
  quiz labels across chapters — cross-chapter sameness a single-chapter gate can't see.
- Root cause: blind parallel authoring reuses frames/stock phrases.
- Fix type: shadow majors calibrated to zero on the clean (BP28) / clean+gold (BP30/BP31) corpus,
  then promoted to **write-barrier actionable** (`WRITE_BARRIER_ACTIONABLE_PREFIXES`).
- Status: **rung 3 — write-barrier actionable** (NOT hard blockers: they have not cleared the
  gold-corpus-zero + ≥2-TP bar for `ENFORCED_MAJOR`). FP-risk: **low**.
- Caught by: `book-repetition.test.ts` (BP28–30), `quiz-choice-label.test.ts` (BP31) — inject-and-catch + paired no-false-positive.

**FC-2026-06-17-007 — poor source fit (doomed / repetitive run)**
- Stage: research
- Failure: a book whose chapters are all facets of one idea taught by the same few figures, or
  whose sidecars are too thin, fights v21 pedagogy → a doomed or templated run discovered only
  AFTER 7+ chapters are authored.
- Root cause: the research prompt's "poor fit" warning is prose the operator can skip (the same
  decorative-guidance failure as the source-verify rubber-stamp, FC-001).
- Fix type: prevention (rung 1) — `source-fit` computes diversity metrics from the sidecars
  (thin chapters, figure concentration, framework repetition, fact thinness) and prints
  OK/WATCH/RISKY at research time. ADVISORY (never blocks).
- Status: **advisory**. FP-risk: **low** — calibrated zero-RISKY across the clean corpus
  (gifts/year-of-less/stillness + digital-minimalism all read OK); thresholds grounded in the
  measured clean floors (MIN_NAMED=2, MIN_FACTS=3, figure-concentration ≥60% vs the clean ~15%).
- Caught by: `source-fit.test.ts` (a monotonous/thin fixture reads RISKY; a varied one reads OK).

---

## Gold-corpus regression — how to check the rung-2/3/4 bars

The "zero on clean corpus / zero on gold corpus" bars above are not aspirational — they are
**executable**, and they already run on every `npm test`. The gold-corpus regression IS the
calibration test subset; run just that subset with:

```bash
npx tsx tests/run.ts corpus calibration enforced repetition label pronoun
```

That selects exactly the regression battery — `gold-corpus`, `calibration`,
`critic-register-calibration`, `enforced-major`, `book-repetition` (BP28–30), `quiz-choice-label`
(BP31), `quiz-pronoun-referent` (BP32), and `defect-corpus` (the must-CATCH side) — running every
detector over the real reference chapters in `state/chapters/` and asserting the bar each rung
requires. A green run is the evidence for a promotion; a new detector that fires here is NOT
zero-FP and must not move up.

**Why this is the harness, not a separate `corpus-regression` command:** "clean corpus" is
**per-detector**, not global — e.g. `stillness-is-the-key` is clean for BP28/29/30 but is a DEFECT
book for BP31 (78/288 uniform Title-Case labels), so BP31's clean set deliberately excludes it
(`labelCleanCorpusChapterFiles()`). Each calibration test already uses the RIGHT clean set for its
detector; a flat command that ran every detector over one corpus would falsely flag those known
per-family defects as regressions. The corpus book lists live in `tests/helpers.ts`
(`goldChapterFiles` / `cleanCorpusChapterFiles` / `labelCleanCorpusChapterFiles`) — one source,
shared by the whole battery. (Books absent on a machine SKIP loudly, never silently pass.)

## Keeping the registry honest

- The actual enforcement state lives in **code**, not here: `ENFORCED_MAJOR` (`finalGate.ts`) is the
  hard-blocker set, `WRITE_BARRIER_ACTIONABLE_PREFIXES` (`bookGate.ts`) is rung 3. This registry must
  agree with them. A contract test (`tests/docs-contract.test.ts`) asserts the registry documents
  the hard-blocker gate **and** that `ENFORCED_MAJOR` is still empty — so a future promotion forces a
  co-update of both the code and this ledger.
- When a class is promoted, move it **one rung** and record the evidence (which corpus, how many
  TPs). Skipping rungs is how a pipeline overfits.
- **Every class carries a `Caught by:` test** — the fault-injection inventory. The calibration
  corpus (above) proves a detector does NOT fire on good books (no false **positive**); the
  `Caught by:` test proves it DOES fire on an injected defect (no false **negative**). Together they
  bound each class. The contract test asserts every `FC-*` entry names a `*.test.ts` that actually
  exists in `tests/`, so deleting a catch-test — or adding a class with none — fails CI. (These are
  synthetic fixtures, not real books: see `defect-corpus.test.ts` for the canonical pattern.)
