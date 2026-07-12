# IMP-22 Role Qualification Report

**Recorded:** 2026-07-12  
**Experiment:** `s16-forward-role-qualification-v1`  
**Status:** `NOT_RUN_AUTHORIZATION_REQUIRED`

## Prepared and verified

- Reader corpus: 6 calibration cases and 30 holdout cases (10 clean, 10 hard-blocker, 10 craft/learning weakness).
- Source corpus: 10 calibration cases and 40 holdout cases across the five required clean/controlled-defect families.
- Quiz corpus: 8 calibration items and 40 holdout items.
- Candidate order, candidate-availability policy, thresholds, prompts, schemas, schedule, and replay policy are frozen before any live output.
- Calibration budget: 24 expected calls; no more than one typed infrastructure replay per attempted call.
- Holdout budget: 180 expected calls; unavailable frozen ordinals remain zero-call evidence and cannot reorder the schedule.
- Holdout execution is blocked until a hash-bound calibration inspection is present.

Corpus hashes:

| Corpus | Raw bytes SHA-256 | Substantive SHA-256 |
|---|---|---|
| Reader | `081bd230c47d4853b9e66656123c1a65a611ecc9424f6931f5d50d717eac55bd` | `492222ffc2d896e6dfade40cf21045ab96edab8e1c930db1b96a4f58de48c7c3` |
| Source | `0e3791580c0b2461622033e9369047f5752b7de70537e276af45794f4c2b6435` | `f706bcf03e7d81bf2c435d52626f4e03632fa66e1b155c73b606b503ad4d0b91` |
| Quiz | `9d59ac17cdc79df71eac763a78450f32faea4b535136cf8ef944c63d9d470c4b` | `bc7a9ede537e85394d7a794d09a62462bbfda2684df8426072b8a38ac25aadad` |

## Zero-call live preflight

The current environment passed a model-free preflight:

- authentication mode: `chatgpt`;
- API key present: `false`;
- forbidden provider environment keys: none;
- CLI/profile/schema/spec bindings: valid;
- candidate availability SHA-256: `c8e4ee858af0f3e1693a4b4e7b7a276734171777a0d1088791e29eda6dcaa650`;
- qualification spec bytes SHA-256: `7b3769003183f5d20fa87bebd7df5d4c502e09fbae7c06d59410b80e5531ebc7`.

This preflight made zero model calls and zero API calls. Local cache visibility is not qualification evidence and does not guarantee later provider capacity.

## Live result

No calibration or holdout call was authorized. Therefore:

- qualified profiles: none;
- reader primary/audit: not selected;
- source primary/adjudicator: not selected;
- quiz semantic adjudicator: not selected;
- qualification verdict: `NOT_RUN`;
- live calls: 0;
- API calls: 0;
- Max-plan capacity events: 0.

The required authorization is:

`I approve sending the frozen qualification corpus and the fresh pilot/gold content to ChatGPT through codex exec; proceed with the live calls.`

