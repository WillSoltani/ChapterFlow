# Pilot Role Readiness Live Result

- Status: **BLOCKED_ROLE_READINESS**
- Blocked reason: reader 1/2 ready; source 0/2 ready; quiz 0/1 ready; base budget exhausted before every candidate could be tested
- Experiment: `s16-forward-pilot-role-readiness-v2`
- Exact implementation HEAD: `90de3e46265698ba469b74c865a755b03511db39`
- Dedicated V25 workflow: **success** (run 29462796041)
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

- Reader primary: `gpt-5.6-sol@xhigh`
- Reader audit: `NOT_READY`
- Source primary: `NOT_READY`
- Source adjudicator: `NOT_READY`
- Quiz semantic adjudicator: `NOT_READY`
- Deterministic quiz checker: `quiz-answer-tell-checker-v1`

## Profile-role outcomes

- reader: `gpt-5.6-sol@high` -> **NOT_QUALIFIED** (acceptableControlSuccess:underpowered(3/4), falseReaderBlockersOnAcceptableAndCraft:underpowered(7/8), protocolValidity(11/12<12), requiredCasesResolved(11/12<12))
- reader: `gpt-5.5@high` -> **NOT_QUALIFIED** (craftCategoryDetected(2/4<3))
- reader: `gpt-5.6-sol@xhigh` -> **READY**
- reader: `gpt-5.5@xhigh` -> **NOT_QUALIFIED** (craftCategoryDetected(2/4<3))
- source: `gpt-5.6-sol@xhigh` -> **NOT_QUALIFIED** (highSeverityDefectSensitivity:underpowered(9/10), protocolValidity(11/12<12), requiredCasesResolved(11/12<12), supportRegisterAccuracy:underpowered(11/12))
- source: `gpt-5.5@xhigh` -> **NOT_QUALIFIED** (highSeverityDefectSensitivity:underpowered(8/10), protocolValidity(10/12<12), requiredCasesResolved(10/12<12), supportRegisterAccuracy:underpowered(10/12))
- source: `gpt-5.6-sol@high` -> **NOT_TESTED_BUDGET_EXHAUSTED**
- source: `gpt-5.5@high` -> **NOT_TESTED_BUDGET_EXHAUSTED**
- quiz: `gpt-5.6-sol@xhigh` -> **NOT_TESTED_BUDGET_EXHAUSTED**
- quiz: `gpt-5.5@xhigh` -> **NOT_TESTED_BUDGET_EXHAUSTED**
- quiz: `gpt-5.6-sol@high` -> **NOT_TESTED_BUDGET_EXHAUSTED**
- quiz: `gpt-5.5@high` -> **NOT_TESTED_BUDGET_EXHAUSTED**
