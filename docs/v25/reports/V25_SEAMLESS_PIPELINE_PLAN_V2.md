# V25 Seamless-Pipeline Plan v2 — post-D3-rejection (2026-07-15)

Supersedes the Phase 3–7 sequencing of the original ratified plan. Owner directive:
*"Use your best judgement. Make a comprehensive and complete plan on how you're going
to address all the issues."* — decisions D7–D10 are therefore RATIFIED BY DELEGATED
JUDGEMENT with the parameters below (owner may adjust any number; changes are
versioned, never silent).

Inputs: `V25_OWNER_RUBRIC_RECONCILIATION.md` (defect inventory S-1..S-8, construct
gap), owner audit run `docs/v25/rubric-audit-2026-07-15/`, rubric anchors
`.agents/skills/chapterflow-book-evaluator/references/rubric-v2.md`,
D1–D6 ratification record.

---

## Ratified decisions (final parameters)

- **D7 — Gold bar = rubric v2.0, enforced by an in-repo audit instrument.**
  - Pilot chapter target: per-chapter chapter-diagnostic **≥ 85**; pilot passes if
    **mean ≥ 85 AND no chapter < 80**, certification `pass`, no core domain (1–6)
    below 3.0.
  - Gold book (13 ch): **every chapter ≥ 85**, full-book Content Design Score ≥ 85
    (Domain 9 assessable once whole book exists), certification `pass`.
  - Audits run on **app-faithful renderings** (quiz keys + explanations included,
    all components, layers labeled with their app mode), plus a dedicated
    **layer-independence hard gate** (below) instead of 3× full audits per layer.
  - Raters/adjudicators are isolated Claude agents under the owner's exact contracts
    (blind pair + fresh adjudicator + seals). **Zero codex/API calls.**
  - Calibration guard: every audit batch embeds one owner-audited chapter as a
    hidden calibration item; its re-adjudicated score must land within **±3.0** of
    the owner's 2026-07-15 result or the batch is void (rater-drift fail-closed).
- **D8 — Chapter Format v25** (full spec: `docs/v25/CHAPTER_FORMAT_V25.md`): eight
  requirements F-1..F-8 (layer independence; quiz feedback block; cognitive-economy
  caps; evidence-and-limits bridge; implementation loop closure; single taxonomy;
  reference context; ambiguity quota). Enforcement is layered: writer prompt +
  write-time self-check (primary), deterministic lints (hard only where crisp,
  advisory otherwise — STIER-2 lesson: no lexical semantic gates), reader-review
  advisories, rubric-audit gate (final).
- **D9 — Phase-3 re-scope.** The readiness instrument qualifies *reviewers*
  (blocker + craft detection) against pipeline-internal constructs; its corpus is
  labeled `pipeline-internal`, never "owner-bar acceptable". The three
  owner-audited chapters become craft-detection cases with adjudicated ground truth
  (their defect inventories are real, sealed, and rater-verified). Owner-bar
  acceptability anchors are deferred until Format-v25 exemplars exist (produced by
  the staged pilot itself).
- **D10 — Shipped v21 catalog mitigation: app-side progressive rendering.** The
  layers were written serially; render them serially. Standard mode renders
  fastRead + deepRead stacked; Challenge renders all three; Guided unchanged
  (fastRead). Mode-keyed prompts/quiz variants unchanged. No content regeneration
  for the shipped catalog (the full v21 corpus — cost/risk not justified when the
  app fix restores coherence). Separate small web-app PR (workstream W),
  independent of the pipeline critical path.

## Standing constraints (all unchanged)

Budgets are the D5/D6 ratified envelopes only (readiness ≤84 base/168 hard; probe
≤70 reader + ≤56 shortlisted; pilot ~60–100 — the staged pilot and one bounded
prompt-refinement round live INSIDE the pilot envelope). ChatGPT-auth `codex exec`
only; zero API; closed identities immutable; no threshold weakening (the bar only
went UP); publish/promote/deploy/upload false; PR #401 draft until D4 executes;
re-mint candidate after ANY src change; full suite in detached worktree; never rerun
failed CI.

---

## Phases (critical path P1→P7; W parallel)

### P1 — Rubric-audit instrument (`s16-rubric-audit-v1`) — model-free build
New module `src/bakeoff/migration/rubricAuditInstrument.ts` + CLI verbs:
1. `rubric-render-chapter` — deterministic app-faithful chapter rendering (keys +
   explanations + per-layer labeling), create-once manifest, sha256 per doc.
2. `rubric-validate-record` — TS port of the owner's record validators (schema,
   32 subcriteria, evidence minimums, arithmetic recompute, hash binding); the
   owner's python validators are retained as cross-check reference.
3. `rubric-audit-report` — deterministic scoring/report from validated records
   (band table, gates, agreement stats), byte-stable.
Layer-independence gate: the adjudicator additionally reads EACH layer standalone;
any unresolved reference, forward dependence, or missing-core-lesson finding fails
the gate. Focused tests; re-mint; detached suite; push; CI.

### P2 — Format v25 into the authoring path — model-free build
1. Additive package-schema fields: `quiz.questions[].choiceRationales` (one per
   choice, incl. the correct one), `quiz.questions[].revisit` (component + ref),
   optional `confidencePrompt`. Verify the web adapter tolerates unknown fields
   (root typecheck + adapter test) — app adoption of the new fields is future work,
   not a pilot dependency.
2. Writer prompts (v25 author pipeline) encode F-1..F-8 + emit a write-time
   self-check block (shift-left: write-time self-checks >> post-hoc judgment).
3. Deterministic lints: HARD = schema completeness (feedback block present, 3
   rationales, revisit resolves to a real component). ADVISORY = example-similarity
   (n-gram), component restage counter, layer forward-reference heuristic —
   advisory feeds review, never gates (inversion risk).
4. Conductor v3-policy threading prepared with this wiring (still inert in
   BASELINE). AGENTS.md operational rules updated.

### P3 — Readiness instrument (`s16-forward-pilot-role-readiness-v1`) — model-free build
As previously specified (12/12/12 holdouts + 2×2 canaries; IMP-24G §5.5 thresholds;
sol/5.5 frozen order + Terra/Luna probe orders per D6; v3-policy metrics) with the
D9 re-scope: corpus labels `pipeline-internal`; reader craft cases enriched from the
three owner-audited chapters' sealed defect inventories (detection targets: massed
repetition, missing loop closure, thin evidence qualification — verified-evidence
scoring per scorer v2.2). Re-mint; detached suite; push; exact-head CI green.

### P4 — D4 evidence/PR split — before any new live evidence lands
Execute `V25_EVIDENCE_RETENTION_AND_PR_SPLIT_PROPOSAL.md` (evidence branch split;
PR #401 shrinks to the reviewable code change). Scheduled here so readiness + pilot
evidence land on the post-split structure.

### P5 — Live readiness campaign + D6 probe (ratified budgets)
Sequential stopping reader 2 / source 2 / quiz 1; canary 2/2 semantic gate; ≤84
base/168 hard. Then the Terra/Luna shadow probe (≤70 reader; ≤2 shortlisted → +56).
Role freeze bound to candidate generation + policies + hashes. Quality-first swap
rule unchanged.

### P6 — Staged pilot (8 ch, Format v25, frozen SOL routes) — inside the ~60–100 envelope
- **Stage 1 (2 chapters):** materialize v2 envelope → author → v2 lanes → rubric
  audit (P1 instrument, Claude-side). Both ≥85 → proceed. Otherwise ONE bounded
  systemic prompt-refinement round (fresh identity, per pilot rules: ≤1 systemic
  correction) → re-author the 2 → re-gate. Still failing → HARD STOP, report to
  owner with the audit records (no threshold negotiation).
- **Stage 2 (remaining 6):** author under the proven prompts; first-writes frozen
  before repair; ≤1 typed repair or 1 regen per chapter; every chapter rubric-
  audited. Pilot verdict = IMP-24G §6.5 criteria AND the D7 bar (mean ≥85, min ≥80).

### P7 — Gold book + activation (separate owner go/no-go, unchanged)
13-chapter gold book under frozen roles + Format v25; every chapter ≥85 + full-book
CDS ≥85 + cert pass (first full Domain-9 assessment); then `imp24-activate-local-v3`
only on explicit owner go.

### W — Web app D10 fix (parallel, separate PR off main)
Progressive depth rendering in the chapter reader: Standard = fastRead + deepRead
stacked, Challenge = all three, Guided unchanged; reading-time display summed;
mode-keyed quiz/prompt variants untouched; dead `ReadingDepthSwitch` stays dead.
`npm run verify` + normal web-app review. Removes the live serialized-layer defect
for the whole shipped catalog without touching content.

### Background (non-critical-path)
F-018 test migration to mkTestRoots (batch); factfulness-ch11 dispute is moot under
D9 (corpus re-labeled).

---

## Risks and mitigations
1. **Format v25 can't reach 85 by prompting alone** → staged pilot catches it at 2
   chapters (≤ ~20 calls exposed), one bounded refinement round, then hard stop +
   owner report. The bar is never lowered to pass.
2. **Claude raters drift from the owner's calibration** → hidden calibration item
   per batch, ±3.0 fail-closed; owner's contracts/validators reused verbatim.
3. **Schema additions ripple into the app** → additive-only; adapter tolerance
   verified in P2 before any authoring.
4. **Deterministic-lint inversion (STIER-2)** → only schema-crisp lints gate;
   semantic checks are advisory + rubric-gated.
5. **Reviewer-contract stability** → frozen IMP-20 contracts untouched; format
   enforcement lives writer-side + rubric gate, so no requalification cascade.

## Success criteria (whole plan)
Qualified role set (P5) · pilot 8/8 chapters through v2 lanes with mean ≥85 / min
≥80 rubric + cert pass (P6) · all budgets respected with full call ledgers · D4
executed and PR #401 reviewable · shipped-catalog defect neutralized app-side (W) ·
gold book + activation strictly behind the final owner go/no-go (P7).
