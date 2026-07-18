# IMP-23 Clean Branch Reconciliation

**Checkpoint preserved:** `feat/v25-pipeline` at `96ba2817967885a27d4248888889e622ad81ec8d`  
**Clean branch:** `feat/v25-pipeline-live`  
**Clean base:** `37cb0804e157758272e7ec06c2aaf96ebdec6724`  
**Reconstruction status:** `PASS`

## Byte-level reconstruction

The clean branch was created from the required IMP-20 base, not from the broad checkpoint. The checkpoint production-instrument seal was parsed as the primary allowlist, then the explicit IMP-22 report, contract, source, test, and frozen experiment-input surfaces named by IMP-23 were restored from the checkpoint.

| Field | Result |
| --- | ---: |
| `checkpointHead` | `96ba2817967885a27d4248888889e622ad81ec8d` |
| `cleanBranchBase` | `37cb0804e157758272e7ec06c2aaf96ebdec6724` |
| `sealedFileCount` | 426 |
| `sealedFilesMatched` | 426 |
| `intendedFilesRestored` | 332 |
| `checkpointChangedFiles` | 1,921 |
| `checkpointFilesExcluded` | 1,589 |
| `secretFindings` | 0 |
| `missingRequiredFiles` | 0 |
| `unexpectedIncludedFiles` | 0 |

All 426 sealed files matched both the checkpoint byte length and SHA-256. The initial reconstructed seal was `133f3deb430c5ee0541d8720d44442092186e816a27cbd706d6648dc54839c12`.

Three raw Stage-Q owner drivers were subsequently restored with exact checkpoint bytes after `closed-registry-sync.test.ts` proved that their permanent closure guards are required dependencies. This changes the final allowlist counts from the initial 329/1,592 split to 332 intended files restored and 1,589 checkpoint files excluded.

## Exclusions

The clean branch does not transplant the checkpoint's unrelated `.codex` policy change, unrelated agent skill, score summary, V24 reports, prompt packs, v21 runtime state, broad V24 logs, scratch output, blocked-fixture reports, caches, locks, or unrelated historical book state. Those remain preserved on the checkpoint branch.

Import, contract, and test validation is the proof that an excluded checkpoint artifact is not a production dependency. The dedicated V25 workflow repeats that proof from a fresh GitHub checkout without reading ChatGPT authentication or invoking a model route.

## Sanitation finding

The initial exact reconstruction exposed a pre-existing active CLI tripwire containing an owner-specific absolute path. IMP-23 replaces it with the optional `CHAPTERFLOW_CANONICAL_WORKSPACE_ROOT` contract before CI and reseals the production instrument. Historical scripts under `src/scratch/` also contain old paths; they are standalone, non-imported utilities retained only because they are in the checkpoint seal and are excluded from the active-code path scan.

The checkpoint package lock also contained 40 `resolved` URLs for an internal OpenAI artifact gateway. They were normalized to the public npm registry without changing package versions or integrity hashes. A fresh `npm ci --include=optional` then completed with zero vulnerabilities.

The clean-checkout regression showed that the forward-input materializer depended on uncommitted canonical `state/books` packets and private `.chapterflow` sidecars. It now prefers those archives when present and otherwise reads the already-committed frozen experiment copies. The portable packet semantics, source hashes, chapter selection, and strata are unchanged; only archive-byte hashes that previously included a private absolute path changed. The rematerialized portable input freeze is `be0cbdc1874d853ab7698b2de42721910c3abdaeb67a985c5401d4b271972f0c`.

After sanitation, the 426-file production seal is `7cba899125fd7fefe5eed1d41eb7e92016ee1fea5ffabc8d926e4f2fd849d6de` with every capability still structurally false.

## Validation attempts

Every full-suite attempt is retained in this report:

| Attempt | Pass | Fail | Xenv | Skip | Disposition |
| --- | ---: | ---: | ---: | ---: | --- |
| 1 | 2,670 | 12 | 7 | 39 | Failed: omitted closure dependencies, host npm-cache permission failures, absent-corpus harness failures, and an empty shadow-directory leak. |
| 2 | 2,678 | 3 | 8 | 39 | Failed: three clean-checkout harness/input-materialization failures plus the empty shadow-directory leak. |
| 3 | 2,678 | 3 | 8 | 39 | Diagnostic failure-only rerun identifying the exact remaining tests. |
| 4 | — | — | — | — | Environment interrupted: the host filesystem reached `ENOSPC` during late QC tests. The affected QC transaction, repair verification, quarantine, and causal-quiz cases passed in isolation after space recovery. |
| 5 | 2,679 | 0 | 10 | 39 | PASS from the final disposable clean-checkout snapshot; no live route evidence and no tracked diff. |

Focused reconciliation regressions pass: 31 pass, 0 fail, 2 machine-checked environment absences. The final full suite passes with 2,679 pass, 0 fail, 10 machine-checked environment absences, and 39 skips. Attempt 4 remains recorded as an environmental interruption, not represented as a code result.

## Frozen historical state

- Old campaign: `ARCHIVED_INCONCLUSIVE_REVIEW_INSTRUMENT_MISMATCH`
- Fourteen legacy SOL source-register cases: `NOT_ADJUDICABLE_FOR_SOURCE_TRUTH_UNDER_LEGACY_CONTEXT`
- Old campaign resumable: `false`
- Checkpoint force-pushed: `false`

No live model call has been made during reconciliation.
