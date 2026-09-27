---
name: v26-campaign
description: v26 book campaign (from 2026-09-27) — whole-chapter writer replaces the v25 section compiler; kit ~/cf-wt/v26-plan; progress log
type: project
---

# v26 campaign — whole-chapter writing, owner reads, small pipeline

**Kit:** `~/cf-wt/v26-plan/` (source of truth: repo branch `claude/vibrant-ritchie-xaf7dm`, `docs/v26-plan/`).
Start with `README.md` (roadmap), `BRIEF.md` (shared facts, traps, safety), `DECISIONS.md` (owner choices + defaults),
`ANALYSIS.md` (root causes with evidence). Run-sheet artifact: https://claude.ai/artifact/PV5eE6p56KDCSXGFuNwZYP

**Why:** v25 (research sidecars → 4 section writers per chapter at Sonnet-medium → 138 SEC checks → panel → repair loops → QC →
rubric) produced no publishable book in ~10 weeks. The 2026-09-27 planning probe showed one Opus 5 call writes a whole Franklin
chapter from its source text in ~3 min for ~$0.45 (44/44 quotes verbatim), and an Opus 5 fact check caught 7/7 planted errors.

**Plan:** W1 prototype (2 chapters, owner reads, R1) → W2 build `scripts/book/v26/` (the whole-chapter tool; runbook
`scripts/book/v26/README.md`; tests in `scripts/book/v26/tests/`) + write all of Franklin (owner reads, R2) → W3 finish +
release (owner runs `ship` + S3 + deploy + register:api; P1; then verify:live) → W4a second book (Bennett) ∥ W4b cleanup
(retire v25 driver, CI, branches, worktrees, docs).
Reassess point: prototype not clearly better twice, or owner rejects the full book → stop and replan, never add rules.

**How to apply:** new sessions read the kit's BRIEF.md first; do NOT append to `v25-status-assessment-2026-09-23.md`.
Each session appends exactly one line below.

## Progress
- 2026-09-27 PLAN DONE — kit written, run-sheet published; first prompt: prompts/W1-prototype.md (planning session, 3 model calls, $0.86)
