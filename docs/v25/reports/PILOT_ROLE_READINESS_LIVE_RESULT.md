# Pilot Role Readiness Live Result

- Status: **BLOCKED_ROLE_READINESS**
- Blocked reason: source 1/2 ready; reader 1/2 ready; base budget exhausted before every candidate could be tested
- Experiment: `s16-forward-pilot-role-readiness-v5`
- Exact implementation HEAD: `c88f8c8dddb0d95ccaa9089744100ededc29feaa`
- Dedicated V25 workflow: **success** (run 29485189731)
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
- Reader audit: `NOT_READY`
- Source primary: `gpt-5.6-sol@xhigh`
- Source adjudicator: `NOT_READY`
- Quiz semantic adjudicator: `gpt-5.6-sol@xhigh`
- Deterministic quiz checker: `quiz-answer-tell-checker-v1`

## Profile-role outcomes

- quiz: `gpt-5.6-sol@xhigh` -> **READY**
- quiz: `gpt-5.5@xhigh` -> **NOT_TESTED_SEQUENTIAL_STOP**
- quiz: `gpt-5.6-sol@high` -> **NOT_TESTED_SEQUENTIAL_STOP**
- quiz: `gpt-5.5@high` -> **NOT_TESTED_SEQUENTIAL_STOP**
- source: `gpt-5.6-sol@xhigh` -> **READY**
- source: `gpt-5.5@xhigh` -> **NOT_QUALIFIED** (highSeverityDefectSensitivity:underpowered(7/10), protocolValidity(9/12<12), requiredCasesResolved(9/12<12), supportRegisterAccuracy:underpowered(9/12))
- source: `gpt-5.6-sol@high` -> **NOT_QUALIFIED** (highSeverityDefectSensitivity:underpowered(8/10), protocolValidity(10/12<12), requiredCasesResolved(10/12<12), supportRegisterAccuracy:underpowered(10/12))
- source: `gpt-5.5@high` -> **NOT_QUALIFIED** (highSeverityDefectSensitivity:underpowered(8/10), protocolValidity(10/12<12), requiredCasesResolved(10/12<12), supportRegisterAccuracy:underpowered(10/12))
- reader: `gpt-5.6-sol@high` -> **READY**
- reader: `gpt-5.5@high` -> **NOT_TESTED_BUDGET_EXHAUSTED**
- reader: `gpt-5.6-sol@xhigh` -> **NOT_TESTED_BUDGET_EXHAUSTED**
- reader: `gpt-5.5@xhigh` -> **NOT_TESTED_BUDGET_EXHAUSTED**
