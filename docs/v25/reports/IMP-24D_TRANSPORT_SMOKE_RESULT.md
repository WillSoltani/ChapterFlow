# IMP-24D Transport Smoke Result

- Status: **FAIL**
- Observability implementation commit: `649235cc138ad88795b86a62e39e36d0068f8b7f`
- Mechanical correction used: **no**
- Effective implementation commit: `649235cc138ad88795b86a62e39e36d0068f8b7f`
- Calls: **2** (1 fixed two-call cycle)
- API calls: **0**
- Qualification metrics: **excluded**
- Qualification artifacts created: **false**

## Bounded mechanical correction

- Defect class: `deterministic_transport_configuration`
- Diagnosis: Both retained smoke diagnostics show Codex rejected the canonical V2 output schemas because uniqueItems is unsupported. The bounded correction projects only that transport keyword into an ephemeral private schema, keeps canonical schemas and post-parse uniqueness validation unchanged, and verifies the actual projected argv path in retained provenance while preserving verification of the closed pre-correction attempts.
- Regression tests: `scripts/book/prompts/chapterflow-v24-author-pipeline/tests/codex-transport-schema-projection.test.ts`, `scripts/book/prompts/chapterflow-v24-author-pipeline/tests/imp24-local-activation-v2.test.ts`, `scripts/book/prompts/chapterflow-v24-author-pipeline/tests/imp24-pre-live-freeze.test.ts`, `scripts/book/prompts/chapterflow-v24-author-pipeline/tests/imp24-role-qualification-live-v3.test.ts`, `scripts/book/prompts/chapterflow-v24-author-pipeline/tests/imp24-transport-smoke-v3.test.ts`, `scripts/book/prompts/chapterflow-v24-author-pipeline/tests/imp24d-final-attestation.test.ts`
- Correction record: `559c4a40ee5b66a5c607719412d19d56f95901f130a0632fbd1af57bf97cbba0`

## Cycle 1: FAIL

- Execution identity: `s16-forward-role-qualification-v3-envelope-transport-smoke`
- Exact implementation CI: run **29326638928**, commit `649235cc138ad88795b86a62e39e36d0068f8b7f`
- Reader: **FAIL** — `gpt-5.6-sol@high`
- Source: **FAIL** — `gpt-5.6-sol@xhigh`
- reader diagnostics: `scripts/book/prompts/chapterflow-v24-author-pipeline/state/migration-experiments/s16-forward-role-qualification-v3-envelope-transport-smoke/live/attempts/s16-forward-role-qualification-v3-envelope-transport-smoke-reader-canary-a1/process-diagnostics.json` — forward reviewer: codex exec failed (ok=false, exitCode=1, outcome=infrastructure_failure)
- source diagnostics: `scripts/book/prompts/chapterflow-v24-author-pipeline/state/migration-experiments/s16-forward-role-qualification-v3-envelope-transport-smoke/live/attempts/s16-forward-role-qualification-v3-envelope-transport-smoke-source-canary-a1/process-diagnostics.json` — forward reviewer: codex exec failed (ok=false, exitCode=1, outcome=infrastructure_failure)

