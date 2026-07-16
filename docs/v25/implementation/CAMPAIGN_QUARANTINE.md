# Campaign Quarantine (WP-202)

**Status: CLOSED — quarantined, not deleted.** Physical source deletion is deferred to the
Phase-8 deletion gate (WP-804), after the WP-802 pilot.

This records what the S-tier program retired from the ship path, why, and how to re-enable it
for archaeology. It is the closure artifact called for by WP-202 scope (c).

## What happened

The pilot-readiness / role-qualification / forward-attestation stack — ~46.7k LOC that produced
~1,578 paid calls with no durable outcome (findings V25-01, V25-05) — is retired from the ship
path per Lane 2 of the target architecture. Two things changed; no campaign SOURCE was deleted.

1. **CLI mint-prevention.** Every `migration-bakeoff` subverb that mints or runs a
   qualification / readiness / attestation / forward campaign now fails closed unless the operator
   passes the explicit `--campaign` opt-in flag. Invoked without it, the CLI exits **2**, prints a
   CLOSED notice, and does nothing — no read, no write, no model call, no identity minted.

2. **Ship-path decoupling.** `book-run` (`liveRun.ts`) and `book-autopilot` (`cli.ts`) no longer
   call `resolveStandardForwardAutopilotControl()`, no longer consult the `FORWARD_ACTIVE`
   runtime, and no longer pass a forward control into the conductor. WP-201 had already made the
   architecture flag-decided (default = v24 author) but left the factory call in place; WP-202
   removes it. The default author run resolves its writer solely through WP-301's central
   `modelPolicy` route. This is what makes the proof-of-non-use below hold.

## Why

- **Findings V25-01 / V25-05** — fresh-identity-per-ruling re-spends the instrument for zero
  durable outcome; the whole family is qualification/readiness/attestation overhead.
- **Directive 4** — every mechanism needs a removal condition.
- **Ledger L-15** — the P5 v6 campaign CONCLUDED (`PILOT_ROLE_SET_READY`) at live `8224f079a`,
  freeze `d54cc753`, 6 identities, 0 API calls, 0 gate weakening. The freeze condition was met
  naturally, so retirement proceeds with a clean closure artifact. The frozen v6 role set is the
  **advisory-lane seeding** (minus the void 5.5 adjudicator slot, per the no-5.5 directive).
  Freeze artifact: `docs/v25/reports/PILOT_ROLE_FREEZE_V1.md` (immutable — do not edit).
- **Ledger L-16** — records the quarantine direction and the instrument-seal lifecycle defusal
  (`CHAPTERFLOW_CAMPAIGN_INSTRUMENT_CHECKS`) that unblocked the src-touching Phase-2 packages.

The exact CLOSED notice (stderr):

> `<subverb>: retired from the ship path by the S-tier program (ledger L-16/L-15); the frozen v6
> role set is advisory-lane seeding; formal deletion at the Phase-8 gate. Pass the explicit
> --campaign flag to re-enable this subverb for archaeology.`

## What is gated (50 subverbs)

Computed in `src/bakeoff/migration/cli.ts` as `CAMPAIGN_GATED_SUBVERBS` — the union of the
existing families minus the exemptions, so it never drifts:

- **Live qualification** (8): `role-qualification-calibrate`, `role-qualification-holdout`,
  `imp24-transport-smoke-v3(-r2)`, `imp24e-transport-smoke(-r2)`, `imp24-role-qualification-v3`,
  `pilot-role-readiness-campaign`.
- **Schema probes** (2): `imp24e-schema-probes(-r2)`.
- **Live forward** (4): `forward-pilot`, `forward-gold`, `imp24-pilot-v2-envelope`,
  `imp24-gold-v2-envelope`.
- **Local qualification** (1): `role-qualification-attest-calibration`.
- **Local forward / materializers / activation / attestation** (27): `forward-materialize-*`,
  `forward-verify-production-instrument-seal-v2`, `imp24-materialize-*`, `imp24-certify-instrument`,
  `imp24-record-activation-full-suite-v3`, `imp24-activate-local-v3`, `imp24-verify-local-activation-v3`,
  `forward-activate-local`, `forward-verify-local-activation`, `role-qualification-freeze`,
  `pilot-role-readiness(-v2..v6)`.
- **Campaign-seeding / recovery split-lane** (8): `build-{reader,source,quiz}-corpus(-v2)`,
  `recovery-preflight`, `recovery-pilot-dryrun`.

## What is NOT gated (deliberately)

- **Read-only / closure** split-lane verbs: `close-legacy-campaign`, `retrospective`, and the
  read-only `status`. They mint nothing.
- **Core migration-experiment harness**: `plan | seal | qualify | run | analyze | decide`. Not
  part of the readiness/qualification subverb family.
- **Rubric-audit (D7) instrument**: `reader-gold-dev-pool`, `reader-gold-dev-docs`,
  `rubric-audit-batch`, `rubric-audit-report`, `rubric-verify-owner-run`, `rubric-audit-render-task`,
  `rubric-audit-ingest`, `rubric-audit-status`, `assemble-audit-package`. WP-401 owns these; WP-202
  must not touch them.

## Un-gate procedure (archaeology only)

Pass the explicit `--campaign` flag. It is a gate-level control: the dispatcher consumes it before
the subverb runs, so the strict per-subverb flag allowlists see the exact original flag set and
behaviour is byte-for-byte identical to before the gate.

```
migration-bakeoff imp24-materialize-thresholds --campaign --json           # dry, model-free
migration-bakeoff imp24-role-qualification-v3 --campaign --execute-live ... # a real campaign run
```

The opt-in is **flag-only** — never an environment variable. The migration module is
spec/argv-driven and reads no ambient environment; `tests/migration-guards.test.ts` enforces this
statically. A `--campaign` run that targets a CLOSED experiment id still refuses via the existing
`refuseClosedQualification` disposition — un-gating restores prior behaviour, it does not revive a
closed campaign.

## Proof-of-non-use (ship path → family = ∅)

`tests/campaign-quarantine.test.ts` computes the runtime import closure of the author-first ship
path (`orchestrator/autopilot.ts`, `orchestrator/liveRun.ts`, `promoteBook.ts`) — value imports
and dynamic `import()` only; `import type` is elided by tsc and is not a runtime edge — and asserts
zero modules matching the retired family (`imp24*`, `roleQualification*`, `pilotRoleReadiness*`,
`forwardRoleAssignmentFreeze*`, `forwardValidationCampaign`, `forwardActivation*`, `forwardInput*`,
`forwardTransportSmoke*`, `forwardRetained*`) are reachable.

Before WP-202 the closure reached the family via one edge only:
`liveRun.ts → forwardLocalAutopilot.ts → { imp24InstrumentCertification, roleQualificationRunnerV3,
imp24Corpus, forwardActivation, forwardRoleAssignmentFreeze(V3), forwardValidationCampaign }`.
Removing the `resolveStandardForwardAutopilotControl()` call from the two ship-path entrypoints
severs it. The `exec/cliQualification.ts` and reviewer `contracts/judgeCapabilityQualification.ts`
modules are NOT the retired family — they are legitimate ship-path infra and the precise patterns
do not match them.

## Pointers

- Gate + gated set + notice: `src/bakeoff/migration/cli.ts` (`CAMPAIGN_GATED_SUBVERBS`,
  `CAMPAIGN_QUARANTINE_NOTICE`, `campaignVerbsEnabled`, `refuseQuarantinedCampaignSubverb`).
- Tests: `tests/campaign-quarantine.test.ts`.
- Retained evidence: everything under `scripts/.../state/migration-experiments/**` is
  byte-unchanged and read-only (archive-not-delete rule).
- Phase-8 physical deletion: WP-207 / WP-804 (owner-authorized deletion gate).
