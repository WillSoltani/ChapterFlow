# IMP-02 — Centralized Model, Reasoning, Route, and Provider-Outcome Policy

**Status:** Implemented and verified (typecheck clean; full suite **2,109 pass / 0 fail**).
**Baseline:** `d2361b757` (IMP-01). **Findings:** F-002, F-003 (P1); F-024 inputs. **Gate:** G2.
**Machine-readable report:** `implementation-report.imp-02.json`.

## 1. What changed

`src/orchestrator/modelPolicy.ts` is now the ONE typed authority for model +
effort routing (the rolled-back campaign's `modelPolicy.ts` existed only in the
deleted branch; this is its plan-conformant successor):

- **Task taxonomy:** every role maps to one of the 17 frozen task classes
  (`route-result` v1 contract); the mapping is data, hashed into the policy
  version.
- **Named profiles:** `baseline-55` (NORMAL — pinned by test; activation is
  IMP-13's package), `sol-high-candidate` / `sol-xhigh-candidate` (evaluation
  matrices carrying the plan's hypothesis split as data), diagnostic /
  confirmatory / judge / `last-qualified-sol` / `experimental-explicit`
  (call-explicit tiers for IMP-11/13).
- **Baseline exactness:** the matrix encodes TODAY's efforts precisely; three
  roles (autopilot-repair high, compiler-polish medium, cli-adhoc high) carry
  role-level overrides where their shared task-class cell would have silently
  changed their cost — pinned test enumerates all 20 routes.
- **Precedence:** call-site explicit values (test injection, frozen bakeoff
  specs, operator pins) ride above the normal matrix, per-field, recorded as
  their tier. Invalid model ids and efforts — including API-only `max` — are
  `policy_preflight_failure` BEFORE any process.
- **Provider outcomes:** the frozen 7-value disjoint taxonomy classified at the
  spawn layer (timeout ≠ infrastructure ≠ content; rate markers; safeguard slot
  wired with a deliberately EMPTY marker list — no observed local samples exist
  to calibrate on, and a guessy matcher would conflate in both directions; the
  no-replay property holds structurally because no replay logic exists at this
  layer). IMP-11/13 calibrate from real events.
- **Route sidecar:** every manifested spawn now writes `<ts>-<session>.route.json`
  (RouteResultV1) next to its effective-context manifest — task class, profile,
  policy version, requested model/effort, execution-profile hash, CLI version,
  outcome, and the **drift fingerprint** (model+effort+task+policy+profile+CLI)
  that IMP-13's requalification triggers key on. Timed-out/died spawns get
  their sidecar too, then rethrow unchanged.
- **Literal hygiene:** `"gpt-5.5"` now appears in exactly two source files —
  the policy (owner) and the pricing table (data) — enforced by static test;
  `AUTHOR_WRITER_MODEL` and the bakeoff judge default route through
  `BASELINE_MODEL`. The IMP-00 no-silent-SOL-default scan still holds.
- Envelope profiles materialize their defaults FROM the policy (single decision
  table; the frozen ExecutionProfileV1 shape is unchanged — values stay
  explicit and hashed).

## 2. Honest gaps (recorded, not hidden)

- `effectiveModel`/token telemetry: the local codex text route exposes no
  resolved snapshot id or token counts — `aliasOrSnapshot` records the
  requested alias honestly; wall-clock lives in the result sidecar. Deferred:
  IMP-10 (evidence enrichment) / IMP-11 (telemetry where exposed).
- Per model-effort LIVE pair qualification (beyond CLI capability preflight and
  the bakeoff's existing `preflightModel` probe) is Stage-Q/IMP-11 work.
- Safeguard marker calibration pending observed events (see above).

## 3. Tests

`tests/model-policy.test.ts` (11): normal-profile pin, exact 20-route matrix,
precedence tiers, fail-closed validation (incl. `max`), disjoint outcomes,
fingerprint stability/sensitivity, schema-valid RouteResultV1, spawn sidecar on
success AND timeout, preflight-before-process, and the baseline-literal static
scan. Full suite: **2,109 / 0**.

## 4. Constraint compliance

Normal default remains `baseline-55` (pinned). No gate/threshold/cap changes;
no silent fallback anywhere (every invalid input throws); no publish/promote/
deploy; no production state in tests.
