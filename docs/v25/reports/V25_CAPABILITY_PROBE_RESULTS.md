# V25 Capability-Probe Results — WP-502 live execution (Phase 6)

**Executed:** 2026-07-17 ~07:55–07:57 UTC · **Custody:** orchestrator (direct CLI invocation, no agent)
**Authorization:** owner D-3 (ledger L-37) — probe budget ≤10 live calls within the 150-session ceiling
**Command:** `capability-probe <model> --effort <effort> --execute-live` (WP-502, runbook `docs/v25/CAPABILITY_PROBE_RUNBOOK.md`)
**Pipeline SHA at execution:** plan branch, post-WP-502-merge (see git history of this commit)

## Verdicts — ALL FOUR BAKEOFF CONFIGS FULLY SUPPORTED

| Config | existence | auth-route | output-schema | effort-flag | Overall | Live calls |
|---|---|---|---|---|---|---|
| gpt-5.6-sol @ xhigh | SUPPORTED | SUPPORTED | SUPPORTED | SUPPORTED | **SUPPORTED** | 2/3 |
| gpt-5.6-terra @ xhigh | SUPPORTED | SUPPORTED | SUPPORTED | SUPPORTED | **SUPPORTED** | 2/3 |
| gpt-5.6-luna @ xhigh | SUPPORTED | SUPPORTED | SUPPORTED | SUPPORTED | **SUPPORTED** | 2/3 |
| gpt-5.6-sol @ high | SUPPORTED | SUPPORTED | SUPPORTED | SUPPORTED | **SUPPORTED** | 2/3 |

- Dry pre-passes (zero calls) confirmed existence + ChatGPT-subscription auth for all
  four configs before any live spend.
- Every live call: `codex exec` accepted the `--output-schema` strict subset and returned
  schema-bound authoritative JSON; `-c model_reasoning_effort=<effort>` accepted and completed.
- **Terra and luna exist and are fully usable** — D-3 bundled acknowledgment (i)
  (possible UNSUPPORTED shrinkage) did NOT materialize. The Stage-1 screening (WP-703)
  proceeds at its full registered width: sol@xhigh, terra@xhigh, luna@xhigh, sol@high.

## Call accounting (WP-503 unified ledger)

Ledger slices (committed with this doc, `state/run-ledger/__capability-probe__/`):

| Call | Stage | Outcome | Latency |
|---|---|---|---|
| gpt-5.6-sol@xhigh | output-schema | content_completed | 6416 ms |
| gpt-5.6-sol@xhigh | effort-flag | content_completed | 11426 ms |
| gpt-5.6-terra@xhigh | output-schema | content_completed | 5402 ms |
| gpt-5.6-terra@xhigh | effort-flag | content_completed | 6266 ms |
| gpt-5.6-luna@xhigh | output-schema | content_completed | 5407 ms |
| gpt-5.6-luna@xhigh | effort-flag | content_completed | 6685 ms |
| gpt-5.6-sol@high | output-schema | content_completed | 6031 ms |
| gpt-5.6-sol@high | effort-flag | content_completed | 6261 ms |

**Live calls this execution: 8** (happy path, no retries, no refusals; per-model cap 3 never hit).
**Program Phase-6 ceiling: 8 / 150 spent.** (Separately: 1 completed + 1 partial UNAUTHORIZED
calls from the L-22 verifier incident remain disclosed and excluded from the authorized count.)

## Process notes

1. First live attempt was **refused fail-closed** by the WP-502 forbidden-env guard: the
   operator shell carried `OPENAI_API_KEY`, which the probe (correctly) rejects so the
   metered-API route is unrepresentable. Execution used `env -u OPENAI_API_KEY` — genuinely
   removing the key from the probe's environment, satisfying (not bypassing) the guard.
   **Operator note for every future live step (freeze, screening, pilot): invoke with
   `env -u OPENAI_API_KEY`.** The guard proved itself on its first real encounter.
2. The RT-1 pre-merge fix (real `spawnCodexAgent` wired into the CLI verb only under
   `--execute-live`) is what made this execution possible through the exposed verb; the
   dry default remains structurally spawn-less.

## Consequence for WP-703

The WP-703 dependency "capability probe gate must pass for sol/terra/luna existence,
`--output-schema`, effort flags BEFORE any authoring" is **satisfied for all four
registered configs**. No config is dropped; no substitution occurred.
