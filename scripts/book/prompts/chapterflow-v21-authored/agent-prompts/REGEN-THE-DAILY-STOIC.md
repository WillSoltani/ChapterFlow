# Regenerate the-daily-stoic on the QC-first-pass-coverage fix

Branch `fix/qc-sweep-family-coverage`. This is the operator handoff for the acceptance
test that needs a **writer model + QC reviewer model** (no `codex` CLI exists in the
Claude session that authored the fix, so the deterministic half is proven here and the
model half runs in your Codex environment).

## What the fix does (and what it deliberately does NOT do)
- **Prevention (the real lever).** Three new librarian allocators deal a distinct
  per-chapter value so mutually-blind writers can't converge:
  - `actionMechanismPlan` — the try-now ACTION CONTAINER (write a line / say aloud / move
    an object / observe-and-count / … ; timer-or-calendar reserved for the one scheduling
    chapter). Reconciled with pedagogy's `tacticFamily`.
  - `weeklyPracticePlan` — the weeklyPractice FORM (single rehearsal / paired check-in /
    environment change / one weekly review / …), so it stops collapsing onto "seven-day log".
  - `fullReadSkeletonPlan` — the fullRead BOUNDARY beat (where it breaks / what it costs /
    when not to / …), so it stops closing every chapter on the bare "limit" hinge.
  All three are threaded into the `fanout` writer card.
- **One new deterministic gate: `BP30.action_container_reuse`** (shadow major, in book-gate
  + the `--barrier` re-dispatch). Fires when the timer/calendar container saturates ≥50% of
  chapters. Calibrated ZERO on all 5 clean books, fires on the current the-daily-stoic (8/12).
- **NO BP31/BP32 gates, NO enforced quality majors.** Calibration proved the
  `repeated_unit` (weeklyPractice) and `scene_skeleton` (fullRead) families, and every
  per-chapter quality major (C2/C3/E1/E4/E7/A13/C23), are **not deterministically separable
  from the clean corpus** — the gold/clean reference books exhibit the same patterns at equal
  or greater intensity and shipped. Gating them would fail reference-quality books (the SC9
  trap). Those are handled by the writer cards + the model QC, which judges them in context.
- **Correctness fixes:** book-gate now BLOCKS round creation on a dirty book; sweep findings
  no longer N-count in the ledger; `fanout` has the shadow-state guard; sceneMode dampen fails
  loud on palette exhaustion; shapePlan surfaces carried duplicates; timing cap 0.4; rhetoric
  counter seed namespaced.

## What is already PROVEN here (no model needed)
```bash
cd scripts/book/prompts/chapterflow-v21-authored
npx tsc -p . --noEmit                       # clean
npx tsx tests/run.ts                         # 273 pass / 1 fail (the 1 = gold book-gate CLI,
                                             #   environmental: needs .chapterflow/runs/daring-greatly research data)
npx tsx src/cli.ts book-gate the-daily-stoic # surfaces BP30 (timer/calendar 8/12) on the CURRENT (pre-regen) book
```
The new gates are ZERO on daring-greatly / start-with-why / stillness-is-the-key /
the-year-of-less / the-gifts-of-imperfection and FIRE on the-daily-stoic.

## Regenerate (run in your Codex environment)
Research is already on disk for the-daily-stoic (toc + 12 source sidecars + index) — do NOT
re-research. Purge the authored state, then re-run write → QC.

1. **Purge** (from the pipeline dir):
   ```bash
   rm -f state/chapters/the-daily-stoic-ch*.v21-native.chapter.json
   rm -f state/briefs/the-daily-stoic.manual-brief.json state/plans/the-daily-stoic-ch*.manual-plan.json
   rm -f state/qc/the-daily-stoic*.json
   rm -rf state/qc-orchestrator/the-daily-stoic
   # optional fully-fresh deal (fanout --all re-deals these anyway):
   rm -f state/{name-plans,shape-plans,pedagogy-plans,exemplar-plans,venue-plans,rhetoric-plans,answer-key-plans,callback-plans,scene-mode-plans,timing-plans,action-mechanism-plans,weekly-practice-plans,fullread-skeleton-plans}/the-daily-stoic.*.json
   # remove the forbidden repo-root /state shadow so output can't land in the wrong copy:
   rm -rf ../../../../../state/chapters ../../../../../state/qc-orchestrator
   ```
   Keep `state/indexes/the-daily-stoic.json` and `.chapterflow/runs/the-daily-stoic/**` (the research).

2. **Write** (Phase 2 — `WRITE-ORCHESTRATE-CODEX-SESSION.md`): the orchestrator runs
   `fanout the-daily-stoic --all --barrier`, dispatches ≤6 writer agents (each card now carries
   the action-mechanism / weekly-practice / fullRead-boundary directives, the quiz-key-from-
   testableFacts rule, the source-fidelity + card-back CORRUPTION rules, AND — the key change —
   a **self-score against the 8-axis publishable bar**: each writer runs `publishable-rubric`
   and fixes any axis <~0.85 before submitting, because gate-clean does NOT predict the QC
   verdict). The barrier re-dispatches any chapter that trips book-gate or BP28/BP29/BP30. Stop
   at `phase: qc` with book-gate clean AND every chapter self-scored bar-GREEN.

3. **QC** (Phase 3 — `QC-ORCHESTRATE-CODEX-SESSION.md`): `QC the-daily-stoic`. The book-gate
   round-creation gate now refuses a dirty book up front.

## Acceptance
- Deterministic (proven here): tsc clean, suite green (modulo the environmental gold test),
  BP30 + BP28 + BP29 zero on clean / firing on the pre-regen stoic.
- Model-judged (your Codex run): **12 PUBLISHABLE / 0 REVISE, and the sweep finds none of its
  4 families.** If the sweep still flags `location_stamping` on the try-now container, the
  writers ignored the dealt action mechanism — the barrier should have re-dispatched them; check
  `fanout --barrier` output named the offenders. If it flags `repeated_unit`/`scene_skeleton`,
  that is the prevention-only path (no gate) — tighten the writer adherence, re-dispatch, re-QC.
