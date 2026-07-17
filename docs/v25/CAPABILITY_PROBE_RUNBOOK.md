# Capability-Probe Runbook (WP-502)

**Command:** `capability-probe` · **Owner module:** `scripts/book/prompts/chapterflow-v24-author-pipeline/src/exec/modelCapabilityProbe.ts` · **Contract:** `model-capability-probe` (frozen, v1)

A bounded, **fail-closed** protocol that proves a named 5.6 model is usable
*before* any book run. The default path makes **zero model calls**. This runbook
co-locates with the `generate-book` operator guide (WP-603); the probe is the
model-capability check `generate-book` fails closed on (WP-504).

> **Directive-1 (no 5.5):** the probe never substitutes a different model or
> route on failure. A failing check halts with `UNSUPPORTED_MODEL_CONFIG`; an
> alternate 5.6 candidate is reachable only by explicit operator config (WP-504),
> never silently.

---

## 1. What it checks, in order

The probe runs four checks per `(model, effort)` pair, **in this exact order**,
and **stops at the first `UNSUPPORTED`** (later checks are then `NOT_TESTED`):

| # | Check | Calls | How |
|---|-------|-------|-----|
| a | `existence` | 0 | The exact model slug + reasoning effort is advertised by the local Codex `models_cache.json`. A model absent from the cache is `UNSUPPORTED(existence)` — **never a guess** and never a network probe. |
| b | `auth-route` | 0 | The isolated CODEX_HOME auth material is ChatGPT-subscription OAuth with no usable API key (`assertChatgptSubscriptionAuth`). A metered-key or missing-token `auth.json` fails closed. |
| c | `output-schema` | live | `codex exec --output-schema` accepts the minimal strict-subset schema and returns schema-bound authoritative JSON. **LIVE-ONLY.** |
| d | `effort-flag` | live | `codex exec -c model_reasoning_effort=<effort>` is accepted and the call completes. **LIVE-ONLY.** |

Each check yields one record: `status ∈ SUPPORTED | UNSUPPORTED | NOT_TESTED`
plus a human reason. `NOT_TESTED` is honest — an untested live check is **never**
assumed to pass.

## 2. Call budget

- **Dry default (no `--execute-live`): 0 model calls.** Checks (a) and (b) are
  local filesystem reads; checks (c) and (d) report `NOT_TESTED`.
- **Live (`--execute-live`, Phase-6 only): ≤ 3 `codex exec` calls per model,
  total**, across checks (c)+(d). The happy path uses exactly **2** (one each).
  The hard cap is `MODEL_CAPABILITY_LIVE_CALL_BUDGET = 3`; a call that would
  exceed it fails closed (`LiveCallBudget.spend()` throws). Every live call is
  recorded in the WP-503 unified ledger (`state/run-ledger/…`).

## 3. Stop rules (fail-closed)

1. **First `UNSUPPORTED` wins.** existence fails ⇒ auth-route + both live checks
   are `NOT_TESTED`; auth fails ⇒ both live checks `NOT_TESTED`.
2. **No refusal is ever retried.** A provider refusal / invalid output / timeout
   on a live check is `UNSUPPORTED` — the probe does not re-run it.
3. **No route or model fallback.** The probe proves one `(model, effort)` and
   reports; it never tries a different model, effort, or auth route to "recover".
4. **Live only under an explicit flag.** The two live checks run only when
   `--execute-live` is literally passed. Absent it, they are `NOT_TESTED` and the
   run boundary is dry (the WP-502 STOP condition: if proving `--output-schema`
   strict-subset support requires a live call, stop at the dry boundary and mark
   `NOT_TESTED`).
5. **Forbidden provider env aborts the live path** before any call fires (a
   metered-key env var must not reach a spawn).

## 4. Exit codes

| Overall verdict | Meaning | Exit |
|-----------------|---------|------|
| `SUPPORTED` | all four checks `SUPPORTED` (fully proven, live) | 0 |
| `NOT_FULLY_TESTED` | no `UNSUPPORTED`; ≥1 live check `NOT_TESTED` (the dry default) | 0 |
| `UNSUPPORTED` | ≥1 check `UNSUPPORTED`; carries `UNSUPPORTED_MODEL_CONFIG` | 1 |
| usage / budget / policy error | bad effort, missing model arg, budget breach, forbidden env | 2 (usage) |

## 5. Usage

```
# Dry (default) — zero model calls. Local existence + auth; live checks NOT_TESTED.
capability-probe gpt-5.6-sol --effort high
capability-probe --model gpt-5.6-sol --effort xhigh --json

# Custom cache / auth locations (default: $CODEX_HOME or ~/.codex).
capability-probe gpt-5.6-sol --effort high --models-cache /path/models_cache.json --auth /path/auth.json

# LIVE — Phase-6 execution ONLY, under orchestrator custody. Never run during
# planning/implementation. ≤3 ledgered codex-exec calls/model; no retries.
capability-probe gpt-5.6-sol --effort high --execute-live
```

`--effort` accepts `minimal | low | medium | high | xhigh` — the repo-local
`EffortLevelV1` union, which has **no API-only `max`**.

## 6. Consuming the result (WP-504)

An `UNSUPPORTED` report carries `unsupportedConfig: UnsupportedModelConfigV1`
(`{ model, effort, failingCheck, reason }`). This is the exact
`UNSUPPORTED_MODEL_CONFIG` shape the `generate-book` run-start path (WP-504)
consumes to halt fail-closed with a truthful non-zero exit — no automatic
substitution, no 5.5 fallback. WP-502 exposes the shape; it does not rewire the
run-start halt itself.

## 7. Implementation invariant

**No live model call is made during planning or implementation of WP-502.** The
`--execute-live` code path is built and unit-tested through an *injected runner*
only (the model-free suite `tests/model-capability-probe.test.ts`: a runner that
throws if the dry path ever reaches it, and counting runners for the budget /
no-retry guards). Live execution happens later, under Phase-6 orchestrator
custody.
