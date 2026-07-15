# Pilot Role Readiness Live Result

- Status: **BLOCKED_ROLE_READINESS**
- Blocked reason: reader 0/2 ready; source 0/2 ready; quiz 0/1 ready
- Experiment: `s16-forward-pilot-role-readiness-v1`
- Exact implementation HEAD: `850fffaf155a49651ae31010eee7037c61ffe62e`
- Dedicated V25 workflow: **success** (run 29436634192)
- PR: **#401**, open=true, draft=false, merged=false
- Base calls attempted: **36** / 84
- Infrastructure replays: **0**
- Max-plan/provider-capacity events: **0**
- Total attempts: **36** / 168
- ChatGPT-authenticated codex exec invocations: **36**
- Cached receipts reused: **0**
- API calls: **0**
- Gate weakening: **none**. Thresholds, holdouts, labels, candidate order, stopping, budget, and replay policy remained frozen.

## Selected pilot roles

- Reader primary: `NOT_READY`
- Reader audit: `NOT_READY`
- Source primary: `NOT_READY`
- Source adjudicator: `NOT_READY`
- Quiz semantic adjudicator: `NOT_READY`
- Deterministic quiz checker: `quiz-answer-tell-checker-v1`

## Profile-role outcomes

- reader: `gpt-5.6-sol@high` -> **NOT_QUALIFIED_CANARY**
- reader: `gpt-5.5@high` -> **NOT_QUALIFIED_CANARY**
- reader: `gpt-5.6-sol@xhigh` -> **NOT_QUALIFIED_CANARY**
- reader: `gpt-5.5@xhigh` -> **NOT_QUALIFIED** (craftCategoryDetected(2/4<3))
- source: `gpt-5.6-sol@xhigh` -> **NOT_QUALIFIED_CANARY**
- source: `gpt-5.5@xhigh` -> **NOT_QUALIFIED_CANARY**
- source: `gpt-5.6-sol@high` -> **NOT_QUALIFIED_CANARY**
- source: `gpt-5.5@high` -> **NOT_QUALIFIED_CANARY**
- quiz: `gpt-5.6-sol@xhigh` -> **NOT_QUALIFIED_CANARY**
- quiz: `gpt-5.5@xhigh` -> **NOT_QUALIFIED_CANARY**
- quiz: `gpt-5.6-sol@high` -> **NOT_QUALIFIED_CANARY**
- quiz: `gpt-5.5@high` -> **NOT_QUALIFIED_CANARY**
