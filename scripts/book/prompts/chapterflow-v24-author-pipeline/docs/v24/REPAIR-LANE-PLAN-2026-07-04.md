# Targeted review-repair lane (plan, GRILLED r1) — 2026-07-04

Owner directive: when a blinded review FAILS a chapter on localized must-fixes, repair the
disputed fields surgically instead of regenerating the whole chapter — then confirm with a
fresh blinded review. Fewer tokens, less variance, higher convergence. This plan makes that
safe against the v21 scars (repair treadmills, seams, self-attestation).

Grilled 2026-07-04 by two independent adversarial agents (mechanism-breaker: 3 BREAKs;
outcome-skeptic: read the live tiebreak logs and split the eligible population). All
findings folded below; the fold notes are inline as [G:...].

## A. Problem + evidence

- A full regen rerolls the ENTIRE chapter: prose that three blinded readers scored 86–89
  is discarded and redrawn, so fixing a quiz complaint risks minting a fresh prose
  complaint — the churn oscillation that halted the 77.7 run.
- STIER-2 live data (2026-07-04): 4 upheld tiebreak FAILs, composites 83.7–89.9, 9/9 keys.
  Ground truth from the tiebreak logs — the population is TWO species:
  - CONVERGENT single-defect: ch01 (3/3 readers: quiz Q1 not derivable), ch08 (3/3:
    example 5's duplicated "Why it matters:" label). Repair's home turf.
  - DIFFUSE texture: ch05 (readers name different quiz slices + scaffold smell), ch09
    (fully disjoint complaints incl. prose). Repair would PRESERVE the disease; a fresh
    confirm reader re-draws from the same texture. Regen's turf.
- Proofs the targeted pattern converges: ch07's C20 gate repair → re-reviewed 88.3
  ship=true; B12 measured TELL EVIDENCE took ch02 from stuck-identical retries to
  first-pass. Review is the last regen-only layer.
- Scar constraints (v21): complaint-chasing treadmills, prose seams (22 corpus books),
  redo self-attestation. Blocked structurally below.

## B. Design

### R1 — Eligibility (deterministic, fail-closed)
After a tiebreak UPHOLDS a FAIL, classify each must-fix complaint (across ALL 3 reads) to
JSON-path targets. Repair lane iff ALL hold:
1. CONVERGENCE [G:skeptic#1 — the best predictor we own]: ≥2 of the 3 readers' must-fix
   sets name the SAME target path. Divergent/disjoint complaint sets → regen.
2. median composite of the valid reads ≥ 84.
3. Every must-fix classifies into REPAIRABLE_FIELDS:
   `quiz.questions[]` (see quiz-scope rule), `examples[i]` (≤2 distinct), `tryThisNow`,
   `implementationPlan.*`, `memorableLines`, `reviewCards[i]`, `keyTakeaway`;
   and ≤3 distinct top-level targets total [G:mech — scope-union ≈ whole chapter].
4. VETOES → regen (fail-closed):
   - any prose/tone/voice/density/structure/pacing mention;
   - QUALITY-ADJECTIVE classes on fields ("generic", "flat", "padded", "repetitive",
     "template", "scaffold") — field-clothed prose symptoms [G:mech];
   - complaints requiring COUNT changes (add/cut/merge an example or question) — they
     violate the dealt-count contract (A16/B15) [G:mech];
   - unindexed "quiz overall" complaints UNLESS the convergent target is a measurable
     quiz-metric class (tell/derivability), which scopes to the FULL `quiz.questions[]`
     array [G:mech BREAK — single-question scope contradicts the chapter-wide tellRate/
     lengthTell aggregates; quiz-metric repairs always get the whole array + measured
     evidence for all 9];
   - unclassifiable text → regen.
5. the lineage's repair cap (R6) is unused.

### R2 — Repair card
Role: SURGICAL EDITOR ("you are fixing a chapter three readers scored ≥84 — smallest
change that makes the named defects true-fixed"). Inputs: chapter bytes; brief (all dealt
v3 constraints bind repairs); source packet; ACCEPTANCE CRITERIA distilled per complaint —
built by STRIPPING IMPERATIVE/REMEDY CLAUSES from the reviewer text [G:mech — verbatim
complaints smuggle remedies; G:skeptic#5 carve-out — a derivability complaint's
enumeration of what the prose actually teaches IS evidence and stays]; measured evidence
(key/distractor char counts, echo n-grams, tell lines) where computable. ANTI-ECHO rule
in the card: never reuse the reviewer's phrasing inside content fields — reviewer wording
in a key/distractor is a fresh tell [G:skeptic#5].
Scope statement: "modify ONLY these JSON paths: <derived>."

### R3 — Scope enforcement: harness-side PATCH-APPLY [G:mech BREAK — rewrite]
The session returns the full chapter JSON, but the harness EXTRACTS only the allowed
paths from the output and SPLICES them into the original bytes. Out-of-scope drift is
impossible BY CONSTRUCTION (not policed); serialization noise (key order, escapes,
whitespace) cannot reject a good repair. Remaining checks:
- inside-scope no-op → the repair agent must have returned an explicit NO-DEFECT verdict
  with evidence; then bytes are unchanged, R4 is skipped, and the confirm read (R5) runs
  as a 4th independent vote on the original bytes [G:mech — no-op-rejected punished a
  correct non-action; this keeps honesty without self-attestation]. A silent no-op (no
  verdict) → attempt consumed → regen.
- malformed/unparseable output → attempt consumed → regen.

### R4 — Full deterministic stack on spliced bytes
gate-chapter, rubric preflight, write contract (D7/D9/B15), then book-level reader
budgets. Any FAIL → repair failed → regen. NO repair retry loop. Budget attribution
[G:mech]: compare pre/post book-level budget verdicts — a breach that pre-existed in
OTHER chapters does not charge this repair; only a repair-introduced breach fails it.

### R5 — Fresh blinded confirmation
Standard review path, unchanged and repair-unaware: fresh reader, whole chapter, normal
flip/tiebreak rules. The confirm card must be byte-identical IN SHAPE to a first-round
review card — pin a test; no artifact naming (tiebreak-r2 style suffixes) may leak into
the spawn context [G:mech]. Ship → done. Withheld and upheld → regen, where the re-merge
DROPS complaints whose derived paths were repaired and R4-verified — only untouched-path
and NEW confirm complaints carry [G:mech BREAK — stale re-merge feeds the regen writer
already-fixed defects: the exact v21 overfit scar].

### R6 — Caps, lineage, provenance
`repairConsumed` joins the lineage-keyed ledger (schema bump; v1/v2 migrate with
repairConsumed=0). Cap: ONE repair per lineage; rejected/failed/no-op-silent all consume
it. Escalation regen consumes regen caps as today and NEVER re-deals the brief (so the
lineage — and the spent repair cap — persists through escalation). A deliberate re-deal
resets both caps by design, consistent with the C1 lineage contract [G:mech — stated
explicitly]. Provenance stamps kind=review-repair + the allowed-path set.

### R7 — Telemetry, attribution, kill criterion [G:skeptic#2/#4 — redesigned]
Per incident log: eligible? (and which R1 rule vetoed), convergence species, repaired?,
splice/stack/confirm verdicts, output tokens, confirm-complaint TARGETS (repaired-path vs
untouched-path), preventable-at-write? + proposed write-time check.
- Kill criterion: NET TOKENS PER SHIPPED CHAPTER vs the regen baseline for the SAME
  eligible stratum — NOT an absolute ship-rate (n=8 at 50% is a coin flip; reader dice on
  untouched prose are baseline variance, not lane failure). Only confirm-fails on
  REPAIRED-path targets count against the lane.
- Baseline mining (pre-build, free): the existing content-hash review files in
  state/reviews/* already contain regen-after-FAIL re-review outcomes; mine the
  convergent-stratum regen ship rate BEFORE building. If regen already ships ≥85% of the
  convergent stratum in one round, the lane's value is tokens only — build it smaller.
- Optional A/B: alternate eligible incidents repair/regen until the baseline is solid.
- PROCESS RULE [G:skeptic#4 — the shift-left guard]: the SAME repair class appearing
  twice without a new write-time contract/lint landing = process failure; the lane must
  FEED prevention, not replace it. (Proof case: ch08's duplicated "Why it matters:" label
  is regex-lintable at write time — see W1.)

## C. Scar contract (unchanged, plus)
- No prose-tier edits; no repair-on-repair; no repair-aware confirmation; no gate
  weakening; no reviewer-authored remedies in acceptance criteria.
- No reviewer phrasing echoed into content fields (anti-tell).
- Repair may never change dealt counts or any dealt design value.

## D. Implementation map
- `src/orchestrator/authorReview.ts` — post-tiebreak: classify → `doAuthorRepair` → any
  rejection falls through to regen routing (with R5's filtered re-merge).
- NEW `src/orchestrator/authorRepair.ts` — `classifyRepairEligibility` (convergence +
  vetoes), `buildRepairCard` (strip-remedies, anti-echo), `spliceRepairedPaths` (R3),
  `attributeBudgetBreach` (R4), orchestration.
- `src/orchestrator/authorRegenLedger.ts` — repair cap (schema bump + migration).
- Tests: classifier matrix (convergent/divergent/quality-adjective/count-change/
  quiz-overall/unclassifiable/low-composite), splice unit (out-of-scope input ignored,
  serialization noise immune, silent no-op consumed, verdict no-op → confirm), re-merge
  filter, confirm-card shape pin, ledger cap + migration + escalation persistence,
  kill-switch accounting.

## W. Independent write-time wins surfaced by the grill (do regardless of the lane)
- W1: duplicated field-label lint — `examples[].whyItMatters`/`whatToDo` beginning with
  their own label text ("Why it matters:") → write-contract complaint (regex). ch08's
  0-3 FAIL was entirely this class.
- W2: key-derivability floor at write time — ch01's 3/3 complaint (key not derivable
  from the chapter's teaching) suggests the TRANSFORM recipe needs a "key must be
  supported by a breakdown sentence" self-check line. Card-side only; no new gate.

## E. Expectations (honest)
Repair narrows the dice, it does not load them. The eligible stratum after convergence
gating is ~1-2 incidents per 9-chapter book (tonight: ch01+ch08 yes; ch05/ch09 no). The
claim is variance + token reduction on that stratum (~16k xhigh output per regen vs
~2–4k per repair) and a prevention feedback loop (R7 process rule) — not guaranteed
approval. Baseline mining decides the final shape before code.

## F. Status
- 2026-07-04: plan grilled (2 agents), all findings folded.
- 2026-07-04 (owner GO): IMPLEMENTED — commit `81a589bb2`. Deltas from this plan, per the
  owner's "a little compromise is allowed":
  - convergence binds at SCOPE level (three readers naming Q2/Q5/"quiz overall" all
    derive to `quiz` and agree — the live ch05 texture is eligible);
  - composite floor 82 (84 would veto the lane's own population — tiebreak reads on
    repair-worthy chapters run 83.x);
  - field match precedes the prose veto in the classifier (quiz-echo complaints cite
    "the prose" while being quiz-fixable);
  - baseline mining deferred to post-build (the lane's telemetry accumulates it);
  - confirmation = the NEXT normal hash-keyed review round (no special mode needed —
    blindness and tiebreak rules come free); R4 budget attribution deferred (budgets
    re-check at the next review entry);
  - no-defect-verdict no-op path deferred: any inside-scope no-op consumes the attempt.
- Live from the next conductor entry (kill switch CHAPTERFLOW_REVIEW_REPAIR, default on).
