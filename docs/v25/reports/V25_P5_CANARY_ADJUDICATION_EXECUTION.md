# P5 canary-gold adjudication — execution record (2026-07-15)

Owner directive: **"Proceed with A"** (against the options in
`V25_P5_READINESS_CAMPAIGN_RESULT_AND_CANARY_ADJUDICATION.md`). This record
executes that directive and nothing more.

## Rulings (frozen as `READINESS_CANARY_GOLD_ADJUDICATIONS_V1`)

- **R1 reader canary** (`…hard-blocker-make-it-stick-ch02`): detection accepts
  blocking category ∈ {`unusable`, `internal_contradiction`}. The planted
  `/tryThisNow` mutation is simultaneously operationally vacuous and a direct
  contradiction of the chapter's retrieval-with-feedback teaching; both labels
  identify the one planted defect (cross-campaign unanimity on the latter; one
  profile emitted both).
- **R2 source canary** (`…fact-1-defect`): `supportStatus` →
  `PARTIALLY_SUPPORTED` (the unit holds one source-backed claim plus one
  invented claim); `visibleRegister` → `clearly_sourced` (the unit's own words
  attribute explicitly; production treats both registers as source-bound
  compatible); primary category accepts {`unsupported_attribution`,
  `invented_detail`} — the instrument's own written precedence makes
  `unsupported_attribution` the controlling label, so the bundle's single
  `invented_detail` violated its own precedence rule.
- **R3 quiz key-mismatch cases**: `keyedMechanismSupported` is excluded from
  semantic-correctness comparison (the rule's two prongs collide exactly on
  wrong-key items; 5/5 cross-campaign consensus resolved it opposite to the
  bundle value). The key-mismatch construct is BLOCK + `keyCorrect: wrong`.
  Mechanism-item gold is untouched; no holdout metric reads this field on
  key-mismatch cases.

## Mechanics

- The imp24 bundle is byte-untouched; corrections live in a readiness-level
  overlay applied to the EFFECTIVE gold, hash-bound into `goldSha256` and
  therefore into every live request.
- Fresh identity: `s16-forward-pilot-role-readiness-v2` (corpus
  `3b9701d1…` = the byte-stable v1 selection + the embedded adjudication
  record; plan `48cdc6ae…` minted bind-once AFTER the final candidate re-mint,
  seal `ffcfd417…` / cert `ffd593a2…`). The closed v1 identity and its
  evidence (evidence branch `2af264d43`, PR #406) are immutable; the retained
  v1 plan now fail-closes against the re-minted candidate by design.
- Scope limits honored: craft weakness→category map UNCHANGED; semantic-rules
  text UNCHANGED; holdout hard-blocker gold UNCHANGED (Option B was not
  exercised). Residual risk noted: the quiz rule text still contains the
  colliding prongs (prospective clarification remains available under B).
- Tests: the runner suite's happy-path fixtures now replay the OBSERVED
  consensus answers (`internal_contradiction`; `PARTIALLY_SUPPORTED` +
  `clearly_sourced` + `unsupported_attribution`; `keyedMechanismSupported:
  false`) and reach `PILOT_ROLE_SET_READY` — a direct proof the adjudication
  converts the observed failures into passes without weakening any verdict,
  threshold, order, budget, or replay rule.

## Budget interpretation (recorded)

"Proceed with A" is executed as a fresh ≤84 base / 168 hard envelope for the
corrected v2 identity: the 48-call remainder of the v1 envelope cannot
complete any qualifying path (happy path = 70), so partial-coverage reuse is
self-defeating by arithmetic the owner had in hand when directing A.
Cumulative P5 live spend across both identities is therefore bounded by
36 + 84 = 120 base calls.
