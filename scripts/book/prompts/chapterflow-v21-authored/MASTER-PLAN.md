# ChapterFlow v21 — Master Plan: high-quality generation, QC that catches everything

Status: design, 2026-06-03. Synthesizes four multi-book QC reports + a five-pillar
architecture pass + an adversarial red-team (which measured critics against the
clean gold book `daring-greatly`). This is the spec for the "major changes."

---

## AS-BUILT STATUS (2026-06-03)

What is implemented vs. the plan below. Everything ships in **shadow/advisory** mode,
calibrated to **zero false-positives on the clean corpus** (the red-team rollout rule).

| Phase | Status | Key artifacts (paths relative to this dir) |
|---|---|---|
| **0** — bugs, durability, quarantine | ✅ **done** | `src/lib/chapterPaths.ts` (casing fix + IDN1 + `assertNoShadowStateDir`); cli cmds `migrate-state`, `state-status`, `fix-chapter-ids`, `quarantine-book`; `SC11.0` (missing-source, shadow) in `src/critics/sourceGrounding.ts`; `.gitignore` hygiene; `range` quarantined to `book-packages/_quarantined/` |
| **1** — generation contract | ✅ **done** | `src/critics/authoringContract.ts` (`author-check`: AC1/2/4/5/6/7/8/9/11, calibrated via `src/scratch/calibrate-author-check.ts`); `agent-prompts/STEP-2-WRITE-CHAPTERS.md` (reframed) + `agent-prompts/FIELD-PURPOSE-CONTRACTS.md` (23 field contracts); 12 slot-fill generators in `scratch/_QUARANTINED-slot-fill/`; form-shift circuit-breaker in `cli.ts` `recordGateAttempt` (exit 3) |
| **2** — deterministic battery | ◐ **measured-out** | `src/critics/quizCorrectness.ts` (`D1` keyed-choice dup, the BP21 gap). The rest (format-key, truncation, skeleton-collapse) **do not separate on real data** — the documented defects were repaired and the residual needs the semantic tier (measured 2026-06-03) |
| **3** — source schema + provenance | ⏸ **deferred** | larger STEP-1 schema migration; risk of bricking the 160-chapter corpus — phase behind `schemaVersion` + migration when pursued |
| **4** — semantic tier | ✅ **done (no-API)** | `src/critics/semantic/publishableBar.ts` (rubric + `computeVerdict` reducer, unit-tested `src/scratch/validate-publishable-bar.ts`); `agent-prompts/QC-SESSION-PROMPT.md` scores it by reading. Automated judge (`quizKeyJudge.ts` + 7 siblings → same reducer) is the drop-in if a key is ever funded |

**Operator loop (as-built):** `next-task` → author chapter → `author-check` + `gate-chapter`
(iterate; circuit-breaker halts form-shifting at exit 3) → `book-gate` → **QC session
scores the publishable bar** (QC-SESSION-PROMPT) → `promote-book` (STEP-3 A0 now requires
every chapter GREEN). Typechecks clean; all command paths integration-tested.

**The honest boundary (unchanged):** the no-API deterministic layer catches 100% of
*form* (templating/structure/register); the *coherent-but-wrong residue* (wrong keys,
incoherence) is caught by the publishable-bar **read** today, or the automated judge if
a model key is funded. "GREEN" now means gate-clean **and** every chapter scored GREEN
on the bar.

---

## 0. The goal and the one honest constraint

**Goal:** the generator produces publishable chapters (~88–92/100) with minimal
repair, and QC catches every issue before ship.

**The honest constraint the whole plan is built around:** the dominant ship-GREEN
defect — a *wrong answer key whose choices are all coherent* (drive 99/99, UH
180/180, hooked 21/72, dare-to-lead 72/72) — **cannot be caught by any no-API
deterministic critic.** The red-team proved why: once distractors are coherent
(which Pillar 2 deliberately makes them), every structural tell disappears, and a
"because"-keyword test is defeated by inserting one "because." So:

> **Correctness is caught three ways, in this order: (1) make a wrong key hard to
> AUTHOR (upstream source seeding), (2) catch the structural/templated forms
> deterministically, (3) catch the coherent-but-wrong residue with a model judge OR
> a targeted human hidden-key read.** The no-API layer narrows the surface; it does
> not close it. Until a model key is funded, a scoped human read on flagged +
> sampled questions is the correctness backstop — not optional.

**Design principle (defense in depth):** *prevent at authoring → screen
deterministically → judge semantically → never let a repair or a promote silently
diverge.* No single layer is trusted; each catches what the one before it misses.

**Operating model (fixed):** Codex authors chapters by hand; Claude sessions QC;
operator promotes. Deterministic critics stay no-API. The semantic tier is opt-in
and **fails open** (loud "DID NOT RUN", never a silent pass). Everything is built
so it *also* becomes the verifier of an automated generate→gate→self-correct loop
the day a key is funded — zero rework.

---

## 1. The five pillars (with the red-team corrections folded in)

### Pillar 1 — Generation contract (prevent at authoring) — highest leverage
- **Rewrite `STEP-2-WRITE-CHAPTERS.md`** from a defense manual ("don't trip AS5–AS12")
  into a **source-bound authoring protocol**. The current framing *teaches the gate
  shapes*, which is why templating relocates field to field (RC4). New core rules:
  concept labels are never grammatical subjects/objects; never paste a source
  sentence into a reader field; no fixed per-field skeleton; **`correctIndex` follows
  correctness, never a rotation.**
- **`FIELD-PURPOSE-CONTRACTS.md`** — each field gets a one-line JOB + WRITE recipe.
  Worked POSITIVE/NEGATIVE pairs (the proven REDO-prompt format).
- **`author-check` (new CLI + `src/critics/authoringContract.ts`)** Codex runs as it
  writes, so it converges *in-session* (this is the 11%→high first-pass lever).
- **Red-team corrections (mandatory):**
  - `author-check` reports the **JOB failed**, not the regex/span ("this card tests
    recall, rewrite from the concept") — so it is not a new evasion manual, and it
    carries an **in-session form-shift breaker** (≥3 distinct AC codes across
    iterations ⇒ "stop patching, re-author from source").
  - **Drop the "whatToDo must be imperative" rule** — it fires on 100% of the clean
    book (which uses third-person scene-continuation). The real defect is whatToDo =
    an abstract **proposition/source-claim**, not 2nd-vs-3rd person.
  - **"because/causal connective" is never a positive requirement** — 90% of clean
    explanations lack it. It is only an *exemption screen*. The echo-template catch
    must require the post-connective clause to carry **new content** (low overlap
    with key+prompt) and name a distractor's flaw.
  - **Named reader tool: accept imperative plan titles** ("Name the Scarcity Cue")
    as the "named move"; demote to advisory. Don't mandate a proper-noun product name
    (fires 7/7 clean).
- **Retire the 12 slot-fill `scratch/*.mjs` generators** → `scratch/_QUARANTINED-slot-fill/`
  + a tripwire blocker (`AC0`) when a chapter's mtime is within 120s of a slot-fill
  script (the QC "smoking gun" tell, promoted to an enforced gate).

### Pillar 2 — Source foundation (make correctness easy to author)
- **`SourceSidecarV2`** adds, per chapter, **`testableFacts[]`** = `{claim,
  becauseMechanism, commonError, errorIsWhy}`. This is the upstream correctness fix:
  the keyed choice = a stated true `claim`, the explanation paraphrases its
  `becauseMechanism`, and each distractor is seeded from a *real* `commonError`. A
  wrong key becomes hard to author because the keyed choice is literally a fact from
  the sidecar. Plus `namedExamples[].hardSpecifics` (concrete real tokens) and
  `realWorld` flag.
- **`SC10` source-REALNESS critic** — makes "nothing to check" a **blocker**
  (stub-shape sidecars, no real named entities, concept-label-only "anchors",
  degenerate testableFacts). `check-source` currently passes on invented notes; this
  closes it.
- **Declared provenance** (`sourceAnchorId` on examples/quiz/cards/plans) + **SC11**.
- **Red-team corrections:**
  - **`becauseMechanism` is a seed to PARAPHRASE, never paste** — exclude it from the
    paste detector's gram pool, or it contradicts the anti-paste rule.
  - **SC11.2 hardened:** require **≥2 distinct hardSpecifics from the same anchor in
    load-bearing positions** (object of the action / subject of the tradeoff), not one
    trailing checkbox token (else provenance is gamed by gluing a word on the end).
  - **Phase the hard provenance gate** (SC11.1/.2) behind `schemaVersion==='source-v2'`
    + a migration path + operator override — otherwise it **bricks all 160 existing
    chapters** the instant it's wired. `SC11.0` (missing-source = blocker) ships now
    (no back-fill cost; missing source reliably predicts word-salad).
  - **Framework completeness becomes a STEP-1 requirement** (sidecar captures every
    named multi-member framework structurally; `check-source` blocks if prose names a
    framework absent from the sidecar) — so it covers *every* book, not just
    hand-seeded `config` pairs.

### Pillar 3 — Deterministic QC battery (the no-API coverage layer, evasion-resistant)
- New critics across three files (`quizCorrectness.ts`, `fieldComposition.ts`,
  `templateSkeleton.ts`) for: format-identifiable key, echo-template explanation,
  cross-chapter duplicated keyed-choice, per-chapter answer-position collapse (F3 →
  blocker), truncation, card-front-is-a-question, concept-label-as-actor, scaffold
  strings, fullRead shingle-loop, plan-context/plan-pasted, framework completeness,
  memorable-line shape.
- **Red-team corrections (this is what makes it actually work):**
  - **Detect on normalized FRAMES, not raw lexical surface.** Re-implement on
    function-word/POS skeletons, **LCS-ratio and containment (not fixed n-gram /
    Jaccard)** so a synonym every 7 tokens or a clause reorder doesn't evade. Paste
    detection runs on a lemmatized stream at n=5, not verbatim 8-grams.
  - **Templating detection is permutation-invariant at the BOOK level**: count
    **distinct normalized skeletons / entropy** across all chapters × all slots. The
    per-slot-column detector is evaded by shuffling slot↔template assignment; the
    slot-agnostic corpus count is not.
  - **Format-identifiable-key (D2) is a SCREEN, not the catch.** A generator that
    writes three equally-coherent choices evades all structural sub-detectors *by
    design*. Add a cross-chapter `correctIndex`-rotation detector (AS12 successor).
    The actual wrong-key catch is escalated to Pillar 4. **Better distractors raise
    the need for the judge — they do not lower the bar.**
  - **Cover ALL user-facing string fields, exhaustively enumerated from `types.ts`** —
    not just the ~8 the catalog named. The red-team confirmed `hook, counterintuition,
    tryThisNow, keyTakeaway, whyItMatters, coreSkill, twentyFourHourChallenge,
    weeklyPractice` get *structural-only* checks today; the defects relocate there the
    moment the named fields are locked (Goodhart at the field-selection level). Paste,
    concept-label-as-subject, and shingle-loop critics run over every string field.

### Pillar 4 — Semantic tier + the publishable bar (catch the coherent-but-wrong residue)
- **One rubric** (`publishableBar.ts`), two interchangeable readers (the Claude QC
  session today; an automated judge when a key exists) scoring the same 8 axes.
- **Two-tier verdict:** **CORRUPTION = RED veto** (one confident wrong key red-gates
  even at overall 90 — the average can never launder it); **GENERATED_DRAFT = YELLOW**
  (key-correct but templated distractors / recall cards / planning-note examples — the
  61/100 chapter that passes the gate *and* a naive read). The bar is "finished
  publishable chapter," not "not corrupt."
- **Automated judge** generalizes the existing `quizKeyJudge.ts` to 5 axes (distractor,
  card, example, prose, fact), fail-open, content-hash cached.
- **Red-team corrections:**
  - **Targeted, not blanket, human read.** A per-chapter 8-axis + by-hand hidden-key
    read across 160 chapters will be sampled (re-opening the hole). Make the
    deterministic battery the **100% coverage layer**; require the expensive hidden-key
    read **only on questions Pillar 3 flags** (format-identifiable / echo / position
    skew) **+ a random audit** sample. Wrong-key is explicitly a model-tier-or-human
    catch — stop implying no-API closes it.
  - **Cache integrity:** semantic cache is merkle-tied and **invalidated by a
    rubric-content hash**, so it can never serve a stale pass after the rubric changes.

### Pillar 5 — Orchestration, process integrity, durability
- **Fix the casing bug** (`src/lib/chapterPaths.ts`: one case-insensitive,
  slug-normalized `isSiblingFile`/`parseChapterId` resolver; the capital-`U`
  chapterId currently makes AS5–AS12 silently skip on all 20 UH chapters). **+ `IDN1`
  blocker** so a chapterId≠filename mismatch can never silently skip again.
- **Canonicalize the two `state/chapters` dirs** (`assertNoShadowStateDir` + a
  `migrate-state` command that refuses on divergence). The repo-root copy holds the
  "missing" chapters (incl. `everything-is-fcked`'s 9) invisible to the gates.
- **`next-task` gates on actual gate-PASS** (fresh verdict vs file mtime), not file
  existence.
- **`verify-repair`** — a repair "landed" only if the file mtime advanced **and the
  full-gate blocker-UNION strictly shrank with no new blocker code** (red-team: a
  single-metric delta is gamed by relocating the defect). **Circuit-breaker** trips on
  same-sig ≥3 **or** form-shifting (≥3 distinct sigs) and exits a distinct code to halt
  loops; resets only on a clean full PASS / monotonic union reduction.
- **`promote-book` refuses on divergence** (per-chapter content hash + book merkle
  embedded in the package; the shipped artifact must match current chapters — this is
  how `range` shipped corrupt and stayed corrupt) and re-gates every field class.
  **Quarantine** state for known-bad shipped books (`range` quarantined immediately).
- **Durability:** `.gitignore` correctness + auto-commit on a PASS verdict + a
  `state-status` command, so Step-2 work can't be lost.
- **Red-team correction:** a **CI grep test fails if `new RegExp(...-ch` appears
  outside `chapterPaths.ts`**; the verdict sidecar records `siblingCount` + which
  AS/TS critics actually executed; **promote refuses if intra-book critics
  DID-NOT-RUN** on any chapter.

---

## 2. The rollout rule that makes this safe (the red-team's #1 mandate)

**Every new critic ships in SHADOW mode first.** It runs, logs what it *would* block,
and is calibrated to **zero fires on `daring-greatly` + the full clean promoted
corpus** (the AS13 "7/9-gap" protocol, documented inline at each threshold) **before**
it is promoted to blocker.

Why this is non-negotiable: the casing fix turns AS5–AS12 back ON for 20 previously
-skipped chapters at the *same moment* ~25 new content blockers + `IDN1` + finalize
-gating could go live. If any one critic is miscalibrated (and the red-team already
found three that are), a **good** chapter deadlocks into infinite-repair-then-escalate
— the exact inverse of the "minimal repair" goal. Shadow-mode + an **operator-waiver
path** (an auditable override so a confirmed false positive never stalls a book)
prevent that.

---

## 3. Defect → where it's caught (coverage matrix)

| Defect (ships GREEN today) | Prevent (P1/P2) | Deterministic screen (P3) | Correctness catch (P4) |
|---|---|---|---|
| Wrong answer key, coherent choices | testableFacts seed key=fact | rotation + position screens only | **judge OR targeted hidden-key read** |
| Echo-template explanation hides key | becauseMechanism paraphrase | echo detector (new-content req) | hidden-key read |
| Format-identifiable key (drive/UH) | distractor=commonError | D2 screen (3 sub-detectors) | judge confirms |
| Cross-chapter identical keyed string | R3 no skeleton | D1 book+chapter scope | — |
| Concept-label-as-actor / "<Name> studies <label>" | R1 | concept-label critic (all fields) | example axis |
| Fixed-timestamp header / scaffold titles | field contract | scaffold + header critics | example axis |
| whatToDo = proposition (not action) | field contract | proposition screen (not imperative) | example axis |
| Pasted source/breakdown into fields | R2 | LCS paste, **all string fields** | card/prose axes |
| fullRead loop / "X means The X" seam | breakdown contract | shingle-ratio + seam (all prose fields) | prose axis |
| Plan context=label / plan=editor language | field contract | plan critics | plan axis |
| Memorable line = 20-word enumeration | contract | shape critic | line axis |
| Incomplete named framework (BRAVING 6/7) | **STEP-1 captures framework** | check-source + completeness | fact axis |
| Word-salad whole-book | quarantine slot-fillers + AC0 | skeleton/shingle/truncation | prose/example axes |
| Missing/fake source | SC10 realness | SC11.0 blocker | source-realness judge |
| Per-slot rotation / source-dilution evasion | — | **corpus-level distinct-skeleton count** | — |
| Defects relocate to the 8 support fields | field contracts on ALL fields | critics over ALL string fields | all axes |
| Casing bug silently skips AS5–AS12 | — | IDN1 + case-insensitive resolver + DID-NOT-RUN block | — |
| Repairs never landed / partial | — | verify-repair (mtime+union) | promote re-gates all |
| Promoted package diverges | — | merkle divergence blocker + quarantine | — |

---

## 4. Build sequence (works-today first; nothing bricks the corpus)

**Phase 0 — unblock honest measurement & stop loss (no API, ship now).**
casing/resolver fix + `IDN1` (sequence chapterId migration *before* IDN1 blocker) ·
canonicalize state dirs + `migrate-state` · `.gitignore` + auto-commit + `state-status`
· `SC11.0` missing-source blocker · quarantine `range`. Effort: **S–M**. *Effect: AS5–AS12
actually run; lost chapters recovered; corrupt shipped book pulled.*

**Phase 1 — build the in-session author tool (before rewriting the prompt).**
`authoringContract.ts` (AC checks, **recalibrated** per §1) wired into `author-check`
+ `runShipGate`, **in shadow mode**, calibrated to zero clean-corpus fires. THEN rewrite
`STEP-2` + `FIELD-PURPOSE-CONTRACTS.md` to reference it. Effort: **M + L**.

**Phase 2 — deterministic battery, shadow → blocker.** `quizCorrectness.ts`,
`fieldComposition.ts`, `templateSkeleton.ts` (frame-based, corpus-level, all fields).
Ship shadow; calibrate each to zero clean fires; promote to blocker individually.
verify-repair + circuit-breaker (full-union) + next-task gate-on-PASS + promote
divergence guard. Effort: **L**.

**Phase 3 — source schema + provenance (phased, non-bricking).** `SourceSidecarV2` +
`testableFacts` in STEP-1; `SC10` realness; `SC11.1/.2` provenance gated behind
`schemaVersion==='source-v2'` + migration + override. Effort: **M–L**.

**Phase 4 — semantic tier.** `publishableBar.ts` rubric + upgraded QC-session
contract (targeted hidden-key read) ships value **today, no key**. The automated
judges (`distractorJudge`/`cardJudge`/`exampleJudge`/`proseJudge`/`factJudge` +
`runSemanticGate`) are built + unit-tested with an oracle now, and light up the day a
key is funded — becoming the self-correct loop's verifier. Effort: **M + L**.

**What needs a funded key:** only the *automated* semantic judge running at scale. Its
correctness checks work today via the Claude QC session against the same rubric;
the key makes them cheap, repeatable, and CI-able.

---

## 5. The bottom line
Phases 0–2 + the upgraded QC-session contract make the **no-API** pipeline catch every
*structural and templated* defect and prevent most at authoring — with shadow-mode
calibration guaranteeing it doesn't deadlock good books. The *coherent-but-wrong-key*
residue is narrowed upstream (testableFacts) and caught by a targeted human read now /
the automated judge later. That is the honest definition of "QC catches everything":
deterministic 100% coverage of form, plus a required correctness read on the residue
the no-API layer provably cannot see.
