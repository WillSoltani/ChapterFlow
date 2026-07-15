# V25 Pilot-Readiness Plan — Owner Ratification (2026-07-15)

Owner (Will Soltani) approved the recovery-session plan in full, in chat, 2026-07-15. This document is the durable record the implementation binds to.

## Ratified decisions

- **D1 — Reader decision policy v3 (APPROVED).** PASS = composite ≥ 80 AND zero reader blocking findings; REVISE = composite < 80; BLOCK = any blocking finding. Advisory findings and `origin_ambiguous_to_reader` escalations become retained evidence/telemetry, never gates. Versioned change (`reader-decision-policy-v3`, additive aggregate version); qualification craft metric redefined to "required advisory category detected with valid evidence" (not "REVISE required"). Evidence basis: current behavior verified at reviewProtocolV2.ts:33-39 (any advisory → REVISE even at composite 100); 10/10 real controls carry advisories; conductor commits only on aggregate PASS — ACTIVE mode is statistically un-runnable under the old policy. Hard gates (blockers, the exact 80 bar, source/quiz gates) UNCHANGED. Closed identities keep their own historical semantics — no retained evidence is re-scored under v3.
- **D2 — Development-grade objective (APPROVED).** `PILOT_ROLE_READINESS` (12/12/12 holdouts + 2×2 semantic canaries; sequential stopping reader 2 / source 2 / quiz 1). Recorded flags: `ownerApprovedForDevelopmentBakeoff: true, independentHumanRater: false, publicationCertification: false`. Never citable as qualification.
- **D3 — De-correlated gold adjudication (APPROVED, REQUIRED).** Two context-isolated adjudicators from DIFFERENT model families (one SOL-family, one non-SOL), disagreements arbitrated from chapter bytes and rubric only; owner spot-checks 3 of the 10 selected controls. No candidate-model outputs used for labels.
- **D4 — Evidence/PR split (APPROVED).** Execute `V25_EVIDENCE_RETENTION_AND_PR_SPLIT_PROPOSAL.md` before pilot evidence lands; PR #401 shrinks to the reviewable code change.
- **D5 — Call budgets (AUTHORIZED).** Role readiness ≤84 base / 168 hard. Fresh pilot ~60–100 (8 first-writes + reviews + bounded repairs). Plus the cost-candidate probe budget below. ChatGPT-authenticated `codex exec` only; no API, no fallback; one typed infrastructure replay max per attempted call; no content replays.

## D6 — Cost-candidate extension: GPT-5.6 Terra and Luna (OWNER ADDITION, APPROVED)

Owner is open to `gpt-5.6-terra@{medium,high,xhigh}` and `gpt-5.6-luna@{high,xhigh}` **if output rates better than or close to SOL — quality first, cost second.** Design (operator judgment, ratified with the plan):

1. **Reviewer roles — shadow probe, not a reordering.** The readiness candidate order keeps sol/5.5 first (frozen minimum set unchanged; sequential stopping intact). After `PILOT_ROLE_SET_READY`, an explicitly budgeted, non-blocking **cost-candidate probe** runs the SAME frozen instrument (2 canaries + 12 holdouts per profile) for the Terra/Luna profiles, reader role first: ≤70 base / 140 hard additional calls (5 profiles × 14). Profiles unavailable in the local Codex models cache are recorded UNAVAILABLE with zero calls, never reordered.
2. **Extension to source/quiz** only for profiles at near-parity on reader (all floors met; zero hard-blocker misses; semantic accuracy within 1 case of the frozen role's): ≤2 shortlisted profiles × 14 × 2 roles = ≤56 base additional.
3. **Selection rule (quality-first):** all floors met → higher semantic metrics win → within tolerance (≤1 holdout case delta, identical zero-miss record), the cheaper profile may take the role. Any role swap happens BEFORE the pilot role freeze, or not at all for this pilot — roles never change mid-campaign.
4. **Authoring:** the pilot authors with the frozen SOL routes (unconfounded first-write evidence). A Terra/Luna AUTHORING bakeoff (blinded, judged — the existing model-bakeoff harness pattern) is deferred until after the pilot, and only if reviewer-side parity shows promise.
5. Probe results are labeled `COST_CANDIDATE_PROBE`, development-grade, non-qualifying, retained with the same evidence discipline.

## Standing constraints (unchanged)

Zero API calls; no threshold weakening beyond the ratified v3 policy versioning; closed identities immutable; no gold book or activation without the separate go/no-go; publish/promote/deploy/upload remain false; PR #401 stays draft until D4 executes; `BLOCKED_NEEDS_INDEPENDENT_GOLD` is superseded in scope by D2/D3 for DEVELOPMENT purposes only — publication-grade certification still requires independent gold.
