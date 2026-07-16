# Pilot Role Readiness Live Result

- Status: **BLOCKED_ROLE_READINESS**
- Blocked reason: source 0/2 ready; quiz 0/1 ready; base budget exhausted before every candidate could be tested
- Experiment: `s16-forward-pilot-role-readiness-v3`
- Exact implementation HEAD: `df4a2888380a6e6cb1b80319a5c68021f6e58174`
- Dedicated V25 workflow: **success** (run 29478502585)
- PR: **#401**, open=true, draft=false, merged=false
- Base calls attempted: **72** / 84
- Infrastructure replays: **1**
- Max-plan/provider-capacity events: **1**
- Total attempts: **73** / 168
- ChatGPT-authenticated codex exec invocations: **73**
- Cached receipts reused: **0**
- API calls: **0**
- Gate weakening: **none**. Thresholds, holdouts, labels, candidate order, stopping, budget, and replay policy remained frozen.

## Selected pilot roles

- Reader primary: `gpt-5.5@high`
- Reader audit: `gpt-5.6-sol@xhigh`
- Source primary: `NOT_READY`
- Source adjudicator: `NOT_READY`
- Quiz semantic adjudicator: `NOT_READY`
- Deterministic quiz checker: `quiz-answer-tell-checker-v1`

## Profile-role outcomes

- reader: `gpt-5.6-sol@high` -> **NOT_QUALIFIED_PROTOCOL**
- reader: `gpt-5.5@high` -> **READY**
- reader: `gpt-5.6-sol@xhigh` -> **READY**
- reader: `gpt-5.5@xhigh` -> **NOT_TESTED_SEQUENTIAL_STOP**
- source: `gpt-5.6-sol@xhigh` -> **NOT_QUALIFIED** (highSeverityDefectSensitivity:underpowered(8/10), protocolValidity(10/12<12), requiredCasesResolved(10/12<12), supportRegisterAccuracy:underpowered(10/12))
- source: `gpt-5.5@xhigh` -> **NOT_QUALIFIED** (highSeverityDefectSensitivity(8/10<10), supportRegisterAccuracy(4/12<10))
- source: `gpt-5.6-sol@high` -> **NOT_QUALIFIED** (highSeverityDefectSensitivity:underpowered(9/10), protocolValidity(11/12<12), requiredCasesResolved(11/12<12), supportRegisterAccuracy:underpowered(11/12))
- source: `gpt-5.5@high` -> **NOT_TESTED_BUDGET_EXHAUSTED**
- quiz: `gpt-5.6-sol@xhigh` -> **NOT_TESTED_BUDGET_EXHAUSTED**
- quiz: `gpt-5.5@xhigh` -> **NOT_TESTED_BUDGET_EXHAUSTED**
- quiz: `gpt-5.6-sol@high` -> **NOT_TESTED_BUDGET_EXHAUSTED**
- quiz: `gpt-5.5@high` -> **NOT_TESTED_BUDGET_EXHAUSTED**
