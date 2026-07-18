# IMP-22 Post-push Reconciliation

Captured: `2026-07-13T01:25:21Z`

## GitHub checkpoint

| Field | Value |
| --- | --- |
| checkpoint branch | `feat/v25-pipeline` |
| checkpoint HEAD | `96ba2817967885a27d4248888889e622ad81ec8d` |
| clean branch | `feat/v25-pipeline-live` |
| clean branch base | `37cb0804e157758272e7ec06c2aaf96ebdec6724` |
| clean branch HEAD | `b1e859ef6c433c9bc366143a46181f56e0ec31ee` |
| draft PR | [#401](https://github.com/WillSoltani/ChapterFlow/pull/401) |
| dedicated CI | [run 29217143338](https://github.com/WillSoltani/ChapterFlow/actions/runs/29217143338) |
| dedicated CI status | `SUCCESS` |

The dedicated workflow validated the exact pull-request head required by IMP-23. Root `CI` continues to validate GitHub's synthetic merge state separately. An earlier synthetic-merge V25 run found a post-IMP-20 `main` change that added a forbidden provider-storage token to `publishFinal.ts`; the reconstruction did not alter that checkpoint-sealed file or weaken its static no-provider guard.

## Model-free pre-live refresh

The production seal was rebuilt in dry mode and matched the committed artifact exactly:

| Seal field | Value |
| --- | --- |
| production seal SHA-256 | `7cba899125fd7fefe5eed1d41eb7e92016ee1fea5ffabc8d926e4f2fd849d6de` |
| canonical artifact bytes SHA-256 | `6a22b25edf801f3e2529b44b3b4a58b9804d5b707f4c3fd3dea0b0e1a7f756f1` |
| sealed file count | `426` |
| API capability | `false` |
| publish capability | `false` |
| promote capability | `false` |
| deploy capability | `false` |
| upload capability | `false` |

Reader, source, and quiz corpora were rebuilt model-free. Each rebuilt byte hash and substantive hash matched its committed provenance:

| Corpus | Corpus bytes SHA-256 | Substantive SHA-256 | Match |
| --- | --- | --- | --- |
| reader | `081bd230c47d4853b9e66656123c1a65a611ecc9424f6931f5d50d717eac55bd` | `492222ffc2d896e6dfade40cf21045ab96edab8e1c930db1b96a4f58de48c7c3` | byte-identical |
| source | `0e3791580c0b2461622033e9369047f5752b7de70537e276af45794f4c2b6435` | `f706bcf03e7d81bf2c435d52626f4e03632fa66e1b155c73b606b503ad4d0b91` | byte-identical |
| quiz | `9d59ac17cdc79df71eac763a78450f32faea4b535136cf8ef944c63d9d470c4b` | `bc7a9ede537e85394d7a794d09a62462bbfda2684df8426072b8a38ac25aadad` | byte-identical |

The source corpus remains the accepted controlled development corpus: one byte-preserved source snapshot, five valid facts, paired calibration/holdout families, protected projections, disjoint facts, and no overlap with the pilot or gold books. It is not evidence of broad publication accuracy. Generalization remains gated on the fresh two-book pilot and separate fresh gold book.

## Frozen qualification state

- Spec status: `FROZEN_PRE_CALIBRATION`.
- Calibration plan: exactly 24 scheduled calls, `maxParallel = 2`.
- Calibration hard maximum: 48 attempts, including at most one infrastructure replay per scheduled call.
- Holdout candidate order matches IMP-23 exactly for reader, source, and quiz.
- Unavailable candidates are skipped without reordering and receive zero calls.
- Sequential stopping is implemented at reader/source/quiz qualifier counts `2/2/1`.
- Output-informed bonus calls, holdout relabeling, output-informed replacement, and threshold changes after output are disabled.
- Holdout has not started for any role.
- The old Section 16 campaign remains `ARCHIVED_INCONCLUSIVE_REVIEW_INSTRUMENT_MISMATCH`, `canResume = false`, with an intact closed-ID freeze.

## Call accounting at handoff

| Route | Calls |
| --- | ---: |
| ChatGPT-authenticated `codex exec` live calls | 0 |
| OpenAI Platform API calls | 0 |
| Other provider API calls | 0 |

This report is additive. The original IMP-22 reports remain unchanged.
