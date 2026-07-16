# Pilot Role Readiness Live Result

- Status: **PILOT_ROLE_SET_READY**
- Experiment: `s16-forward-pilot-role-readiness-v6`
- Exact implementation HEAD: `97b78bf710e3ac434ff78acb2eee655051d433b4`
- Dedicated V25 workflow: **success** (run 29488270662)
- PR: **#401**, open=true, draft=false, merged=false
- Base calls attempted: **84** / 84
- Infrastructure replays: **0**
- Max-plan/provider-capacity events: **0**
- Total attempts: **84** / 168
- ChatGPT-authenticated codex exec invocations: **84**
- Cached receipts reused: **0**
- API calls: **0**
- Gate weakening: **none**. Thresholds, holdouts, labels, candidate order, stopping, budget, and replay policy remained frozen.

## Selected pilot roles

- Reader primary: `gpt-5.6-sol@high`
- Reader audit: `gpt-5.6-sol@xhigh`
- Source primary: `gpt-5.6-sol@xhigh`
- Source adjudicator: `gpt-5.5@xhigh`
- Quiz semantic adjudicator: `gpt-5.6-sol@xhigh`
- Deterministic quiz checker: `quiz-answer-tell-checker-v1`

## Profile-role outcomes

- quiz: `gpt-5.6-sol@xhigh` -> **READY**
- quiz: `gpt-5.5@xhigh` -> **NOT_TESTED_SEQUENTIAL_STOP**
- quiz: `gpt-5.6-sol@high` -> **NOT_TESTED_SEQUENTIAL_STOP**
- quiz: `gpt-5.5@high` -> **NOT_TESTED_SEQUENTIAL_STOP**
- source: `gpt-5.6-sol@xhigh` -> **READY**
- source: `gpt-5.5@xhigh` -> **READY**
- source: `gpt-5.6-sol@high` -> **NOT_TESTED_SEQUENTIAL_STOP**
- source: `gpt-5.5@high` -> **NOT_TESTED_SEQUENTIAL_STOP**
- reader: `gpt-5.6-sol@high` -> **READY**
- reader: `gpt-5.5@high` -> **NOT_QUALIFIED** (craftCategoryDetected(1/4<3))
- reader: `gpt-5.6-sol@xhigh` -> **READY**
- reader: `gpt-5.5@xhigh` -> **NOT_TESTED_SEQUENTIAL_STOP**
