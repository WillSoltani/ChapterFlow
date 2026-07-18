# Chapter Format v25 (D8) — authoring requirements

Derived from the converged defect inventory (owner rubric-v2 audit 2026-07-15 ×
owner observation × artifact verification; see
`reports/V25_OWNER_RUBRIC_RECONCILIATION.md`). Every requirement states its
acceptance criterion and which enforcement layer checks it:
**[W]** writer prompt + write-time self-check · **[L]** deterministic lint
(HARD = gates, ADV = advisory) · **[R]** reader-review advisory ·
**[G]** rubric-audit gate.

## F-1 — Layer independence (fixes S-1)
Each of `fastRead` / `deepRead` / `fullRead` is a complete, self-contained rendition
of the chapter's core lesson at its depth. Deeper layers are supersets in insight,
never complementary slices.
- Every layer opens with its own hook/context; no definite-article or possessive
  references to entities established only in another layer or in Examples below
  ("Rachel's proof…", "the towel study", "Those three patterns").
- Every named person/object used in a layer is introduced in that layer.
- The core claim + primary mechanism appear in ALL layers; Deep adds evidence and
  nuance; Full adds boundary conditions, misuse, and integration.
- Acceptance: a reader given ONLY one layer hits zero unresolved references and can
  state the core lesson. **[W][L-ADV forward-reference heuristic][G layer gate]**

## F-2 — Quiz feedback block (fixes S-2)
Per question, in addition to `correctIndex` + `explanation`:
- `choiceRationales`: one rationale per choice — why the correct one is right, why
  each distractor specifically fails (the misconception it encodes).
- `revisit`: pointer to the component that reteaches the tested idea (breakdown
  section / example / review card) — must resolve.
- `confidencePrompt` (optional, app adoption later).
- Acceptance: schema-complete for 9/9 questions. **[W][L-HARD schema][G]**

## F-3 — Cognitive economy (fixes S-3, S-8)
- A worked case may be restaged at most ONCE outside its home component.
- No two examples may share the same underlying demonstration (no duplicate
  Harlow-style staging).
- One consolidation map replaces repeated restatements; closing components
  (takeaway/memorable lines/etc.) capped at the template set with no new
  restatements of already-restaged cases.
- Concrete props must carry decision weight; no decorative timestamps/rooms/props.
- Acceptance: restage counter ≤1 per case; example-pair similarity below threshold.
  **[W][L-ADV counters/similarity][R][G]**

## F-4 — Evidence-and-limits bridge (fixes S-4)
Every named study/researcher/statistic states: what was observed, what the chapter
infers from it, and at least one boundary condition or competing explanation, at the
point of use. **[W][R][G]**

## F-5 — Implementation loop closure (fixes S-5)
If-then plans end with an observe→evaluate→revise/stop step: what to watch after
acting, a concrete success/failure check, and what to change (or when to stop /
seek support) after a poor result. **[W][R][G]**

## F-6 — Single stable taxonomy (fixes S-6)
One category map per chapter; any re-listing uses identical labels; overlapping
lists must be explicitly reconciled ("knowledge/fear/approval/repetition" vs
"information/approval/authority/hidden-fear" style drift is a defect). **[W][R][G]**

## F-7 — Named-reference context (fixes S-7)
Every real-world named reference gets one sentence of local context (who/what/why it
bears on the claim) at first mention in each layer where it appears. **[W][R][G]**

## F-8 — Ambiguity quota
At least 2 of the worked cases are mixed-signal, failure, or boundary cases (the
routine gives the wrong answer, signals conflict, or the honest move is to stop),
not clean successes. **[W][R][G]**

## Write-time self-check
The writer emits a per-requirement self-check block (F-1..F-8, pass/fail + one-line
evidence) with the draft. A failed self-check is a write-time revision trigger, not
a reviewer discovery. Self-checks are retained evidence, not gates.

## Enforcement notes
- Only schema-crisp lints gate (F-2). Semantic lints are ADVISORY ONLY —
  STIER-2 lesson: lexical gates invert (CHB14/15/17).
- Frozen IMP-20 reviewer contracts are NOT reopened for this; reader-lane
  format advisories ride the existing v3 `escalationReasons` channel.
- Final arbiter is the rubric-audit gate (D7): ≥85 chapter diagnostic,
  certification pass, no core domain < 3.0, layer-independence gate.
