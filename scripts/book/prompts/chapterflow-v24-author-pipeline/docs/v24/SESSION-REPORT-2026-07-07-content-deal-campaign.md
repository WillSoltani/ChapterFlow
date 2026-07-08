# Session Report — v24 Author Pipeline: Book-Sameness Campaigns

**Session:** `1296ba89` · **Branch:** `feat/anti-sameness-live-fix` (8 commits, **0 pushed**)
**Dates:** 2026-07-05 → 2026-07-07 · **Target book:** `start-with-why`
**Status:** durable systems shipped to branch; `start-with-why` improved but still below the
book-acceptance premium margin. Nothing pushed, nothing published, margin unchanged.

---

## 0. Executive summary

This session ran **four sequential owner `/goal`+`/loop` campaigns** on the v24 author-first book
pipeline, each peeling back one layer of *why* `start-with-why` produces individually-strong chapters
(14/14 passing, composites 84–90, clean quiz keys) yet the **book-acceptance panel keeps rejecting it as
"churn HIGH — every chapter reads like one template with different nouns."**

| # | Campaign | Result |
|---|---|---|
| 1 | Carry-churn fix + QC calibration | ✅ stable per-chapter 14/14 |
| 2 | Durable anti-sameness system (architecture) | ✅ built (detect + prevent + route) |
| 3 | Live architecture diversification | ⚠ 7 chapters diversified; book still rejected (openings ≠ churn) |
| 4 | Source-projection / content-deal sameness | ✅ durable system + live fix; book +1.9 over shipped, still below +5 margin |

**Net deliverable:** a durable, tested, committed **content-deal diversity system** that prevents the
body-device monoculture at write time for all future books, plus a saturation critic, a surgical
minimum-cover repair lane, and separated bounded ledgers. The live fix measurably improved
`start-with-why`, but the evidence now points at the **writer ceiling**, not the pipeline, as the binding
constraint on the premium margin.

---

## 1. The through-line problem

`start-with-why` chapters pass individually, but the blinded 3-reader book-acceptance panel unanimously
rejects the book for **cross-chapter sameness** ("churn HIGH"). Each campaign found the sameness lived one
layer deeper than the last:

- Campaign 1 → repair-churn (the pipeline regressing its own passing chapters).
- Campaign 2/3 → the dealt **skeleton** (opening architecture).
- Campaign 4 → the repeated **body machinery** (examples/quiz/cards), dealt by chapter-invariant house
  rules to every chapter — the true root.

---

## 2. Campaign 1 — Carry-churn fix + QC calibration

**Commit `4939fa576`.**

**Problem.** The pipeline oscillated 9–11/14 and could not stabilize. `ensureReaderBudgetsClean` routed
book-wide anchor/budget blockers into **full re-authors of chapters that already held a durable PASS**,
regressing them (ch04 85.6 → 73.4).

**Fix.**
- `ensureReaderBudgetsClean` made **carry-aware**: `holdsDurablePass` + `partitionBudgetBlockers` (a
  book-wide finding carried only by PASS-locked chapters downgrades to advisory rather than re-authoring)
  + a loud **A4 regression guard** that halts if a locked chapter's content hash changes.
- **CHB1 banded** — anchor over-repetition is `blocker` only at ≥2× cap, else advisory.
- **QC reviewer calibrated** — `mustFix` narrowed to a reserved-harm rubric (unsafe / factually-wrong /
  structurally-invalid / source-contradictory / schema-breaking / unusable / fabricated), with a
  `complaintNamesReservedHarm` code-side backstop; thin-but-usable examples route to surgical repair, not
  a block. "Production editor, not perfectionist."

**Result.** Stable per-chapter **14/14**. Book acceptance still rejected (pooled 74.2) → churn deeper than
repair-churn.

**Files:** `critics/readerBudgets.ts`, `orchestrator/authorRun.ts`, `orchestrator/authorReviewLedger.ts`,
`orchestrator/authorReview.ts`, `review/readerReview.ts`. New `budget-carry-lock.test.ts`.

---

## 3. Campaign 2 — Durable anti-sameness system (architecture)

**Commit `4355516fa`.**

**Diagnosis.** The sameness is baked into the dealt **skeleton** — every chapter ran one shape (3-anchor →
proxy cast → return-point → hard-detail-stays-home → Friday practice shell; Apple anchored 7/14). The
surface-variety dealer varied *dressing*, not the *skeleton*.

**Built (detect + prevent + route).**
- `critics/architectureMonoculture.ts` — ARCH1–4 axes + ARCH0 aggregate, wired into bookGate advisory;
  keys on **structural markers**, not word overlap.
- Architecture-family **deal v5** in `compiler/briefRotation.ts` (8 skeletons, 2/3 cap).
- `critics/bookSamenessRepair.ts` planner — ranks chapters, assigns distinct families, preserves
  already-distinct chapters.

6 new tests; suite == baseline.

---

## 4. Campaign 3 — Live architecture diversification

**Commits `d98fd859e`, `63bfdd3cb`, `15b5fb7d1`.**

Built the live driver (`orchestrator/bookSamenessRun.ts` `doBookSamenessRepair`) + `diversify-book` CLI
verb: re-authors only planner-selected chapters (directive injected as a writer complaint so it reaches
manual-brief books), near-bar-tolerant self-check, restore-on-regress, bounded `samenessRepairConsumed`
ledger lane, preserved-chapters byte-stable assertion.

**Result.** 7/14 chapters diversified (all re-PASS 81.5–88), 7 preserved byte-stable, deterministic ARCH0
monoculture cleared, a fabricated-example defect caught + fixed. **Book acceptance still rejected** (pooled
73.3 vs 76.8, churn HIGH, composite flat).

**Honest halt.** Architecture diversification varied *openings*, but the churn lived in repeated **body
content machinery** the source projection deals to every chapter — deeper than openings (out of scope at
the time).

---

## 5. Campaign 4 — Source-projection / content-deal sameness

**Commits `dae308a01`, `a3a21e2f0`, `2b93bea92`.** The owner put the deeper layer explicitly in scope:
"execute the live fix, don't stop at planning."

### 5.1 Diagnosis (quantified in code)

A body-device detector mapped all 14 chapters. The churn is **body machinery, not openings**:

| device | ubiquity (pre-fix) |
|---|---|
| **return-proof / receipt device** | **93%** (13/14) |
| **invented proxy-cast** | **93%** (13/14) |
| hard-detail-boundary | 57% |
| second-setting | 50% |
| named-anchor lead | 43% |
| three-part WHY/HOW/WHAT | 21% |

**Root cause in code.** `AUTHOR_HOUSE_RULES` **rule 6** ("what proof returns, when it comes back" =
return-proof) and **rule 7** ("a specific actor…" = proxy-with-arc) mandate these to *every* chapter, and
**manual-brief books get no per-chapter variety deal** (`buildAuthorCard` renders that section only when a
machine brief exists). All three acceptance readers named exactly this machinery; even "preserved" ch01
carried it in its body.

### 5.2 Durable system built (`dae308a01`)

- `compiler/contentDeviceDeal.ts` — deterministic per-chapter ban rotation over 6 body devices (cyclic
  difference-set → each device ≤~57% book-wide), rendered as an **always-on compact writer-card section
  that reaches manual-brief books** (the gap the prior campaign missed).
- `critics/contentMachinery.ts` — book-level saturation critic (`CM.<device>` + `CM0` aggregate), wired
  into bookGate advisory; keys on machinery, not thesis vocabulary (tested: thematic repetition does not
  trip it).
- `critics/contentDeviceRepair.ts` — greedy **minimum-cover** planner + a `content-deal-sameness-repair`
  directive.
- `orchestrator/bookSamenessRun.ts` `doContentDeviceRepair` driver + `content-repair-book` CLI verb
  (`--only` / `--preserve` / `--target-cap` / `--device-cap`).
- **Softened house rules 6/7** — device mandates removed; anti-fabrication + anti-thin-example protections
  preserved verbatim (trimmed to stay within the 16,700-char card budget).
- Manual-brief `voiceCharter` de-mandated — later found to be a **derived artifact** the pipeline
  regenerates on each book-run, so the durable lever is the code, not the brief.

### 5.3 Two durability fixes found during the live run

- **`a3a21e2f0`** — content repair got its own **`contentRepairConsumed` ledger lane**. The shared
  `samenessRepairConsumed` lane silently skipped ch03/06/08 on the first live run — they had spent the
  grant in campaign 3's architecture diversification. A chapter can now spend one architecture and one
  content grant independently; neither touches regen evidence.
- **`2b93bea92`** — **invisible-variety clause**: the directive now forbids *narrating* the machinery or
  using scaffold nouns ("source/token/material/anchor") in reader prose. Live evidence showed the directive
  made the writer self-conscious and produce "American Airlines is… an airline operations source" — flagged
  by a reader as "corrupted residue" (gate FAIL).

### 5.4 Live application (2 rounds, all 7 targets)

Re-authored ch01/03/04/05/06/07/08 (composites 83.6–87, keys 9/9); 7 preserved byte-stable.

Deterministic device shift:
- **return-proof 93 → 43%**, hard-detail 57 → 29%, three-part 21 → 14% ✓
- proxy-cast 93 → **79%** ⚠ (writer kept residuals; 6 preserved chapters keep theirs)
- second-setting 50 → **57%** ⚠ (balloon effect — writer substituted)

**Book acceptance: pooled composite 73.3 → 74.6 (+1.3).** Beats the floor (74) and beats v1-shipped
(72.7) by **+1.9**, but **below the +5 premium margin (77.7)**, and **churn STILL HIGH** on all 3 reads
(gate 1P/2F).

### 5.5 Why it did not clear — three honest findings

1. **The churn is a ~9-device mold, not 2.** Readers also name if-then practice shells, quiz-distractor
   logic, and limit paragraphs — devices the 6-device set did not target, still at ~100%, plus the 7
   preserved chapters keep the full mold.
2. **The writer reproduces banned devices.** Passing review (87.3) ≠ devices removed — ch06 kept the
   hard-detail device verbatim ("Keep the details with the source that earned them…"); ch01 kept proxies
   (Colleen, Raymond).
3. **The directive induced meta-narration** (scaffold-vocabulary leak) — fixed forward in `2b93bea92`,
   not re-run.

**Classification (per campaign Phase 9):** product-quality ceiling (whole-book uniform texture; the
writer reproduces the mold even under explicit bans; targeted repair of a subset cannot clear a *holistic*
cross-chapter judgment) **+** margin-policy (the +5 premium bar penalizes the book's inherent thematic
consistency — Sinek genuinely returns to Apple / the Wright brothers / MLK).

---

## 6. Verification & final state

- **Full test suite == 14-failure baseline** (all pre-existing env/gold-corpus failures: promote-gate /
  generate-book / qc-run `CHSET.index_missing` + drive/daring-greatly ENOENT, source-anchored SC11,
  cast-discipline + name-commonality on the on-disk chapters). **13 new tests pass; typecheck clean.**
- **8 unpushed commits** on `feat/anti-sameness-live-fix`; source tree clean.
- **Nothing pushed, nothing published, margin unchanged, not force-published.** v1 remains the published
  `start-with-why`. The on-disk v24 state is the 7-content-repaired version (+1.9 over v1, unpublished);
  full checkpoints in the session scratchpad.
- Memory updated: `content-deal-system-2026-07-07.md` (+ prior campaign files) and the MEMORY.md index.

### Commit ledger (branch `feat/anti-sameness-live-fix`, newest → oldest)

```
2b93bea92  fix(v24): content-deal directive forbids meta-narration of the teaching machinery
a3a21e2f0  fix(v24): content-deal repair gets its own bounded ledger lane (no collision with architecture)
dae308a01  feat(v24): content-deal diversity system — de-saturate book-level body machinery
15b5fb7d1  feat(v24): diversify-book --only targeted retry + example-grounding directive
63bfdd3cb  fix(v24): sameness driver self-check is near-bar-tolerant
d98fd859e  feat(v24): live book-sameness repair driver + diversify-book verb
4355516fa  feat(v24): durable anti-sameness system (detect + prevent + route)
4939fa576  feat(v24): carry-aware budget repair + QC reviewer calibration
```

---

## 7. Key traps & non-obvious findings (for future work)

- **The manual brief is a derived artifact.** `start-with-why.manual-brief.json` (`derivedFromInlineMode`)
  is regenerated by book-run — hand-edits to `signatureMoves` do NOT persist. Durable levers must be code.
- **Manual-brief books skip the per-chapter VARIETY card section** — they only get variety via the
  always-on content-device deal (added this campaign) or a writer complaint. Machine-brief deals never
  reach them.
- **Passing chapter review ≠ devices removed.** The self-check gates composite/keys/validity, not device
  usage; the writer can produce a passing chapter that still runs the banned machinery.
- **Balloon effect.** Banning a device pushes the writer to substitute another (proxy/return banned →
  second-setting rose). Chasing the deterministic critic to zero converges slowly and can approach a
  full-book rewrite.
- **Repair-lane collisions.** Architecture (`samenessRepairConsumed`) and content
  (`contentRepairConsumed`) repair are now separate bounded lanes; sharing one silently skipped chapters.
- **Regen budget is a global 2-writes/chapter cap** across review + acceptance rounds — exhausted after a
  couple of repair passes; further work needs controlled grant resets (`--only`).

---

## 8. Owner decisions (all require sign-off)

- **(a) Full 14-chapter re-author** against all ~9 devices — the campaign now permits it (diagnosis proves
  targeted is insufficient), but **low confidence**: 7 chapters bought +1.3, the writer reproduces the mold
  under bans, and it risks more meta-narration. ~5h, needs grant resets.
- **(b) Lower the +5 premium margin** (explicit approval) to accept the +1.9-better book.
- **(c) Hold v1 + keep the durable system** *(recommended)* — the evidence says the writer ceiling, not
  the pipeline, is now the binding constraint.

**Exact next commands (only on owner sign-off):**

```
# open the branch for review
git push -u origin feat/anti-sameness-live-fix

# (a) full re-author experiment
CHAPTERFLOW_ALLOW_MODEL_GEN=1 npx tsx src/cli.ts content-repair-book start-with-why \
  --only 2,9,10,11,12,13,14 --device-cap 0.35 --log <file>
CHAPTERFLOW_ALLOW_MODEL_GEN=1 npx tsx src/cli.ts book-run start-with-why --author --no-publish --log <file>
```
