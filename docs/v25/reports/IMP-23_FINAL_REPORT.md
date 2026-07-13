# IMP-23 final report

Final decision: `BLOCKED`

IMP-23 reconstructed the intended V25 tree on a clean branch, installed dedicated GitHub CI, preserved the original checkpoint, corrected the five verified v1 calibration defects once under a new v2 identity, and obtained green local and dedicated-CI validation for that correction. The single corrected live calibration then failed closed. The prompt's explicit stop condition prohibits any further calibration revision or rerun.

## Final state

| Field | Result |
| --- | --- |
| Checkpoint preserved | `feat/v25-pipeline` at `96ba2817967885a27d4248888889e622ad81ec8d` |
| Clean branch | `feat/v25-pipeline-live` from `37cb0804e157758272e7ec06c2aaf96ebdec6724` |
| Calibration code head | `5642a803dec6c04c2f63e78f379edfe66fc14bd1` |
| Draft PR | `#401` — https://github.com/WillSoltani/ChapterFlow/pull/401 |
| Dedicated V25 CI | `SUCCESS` — run `29220367933` on the exact calibration code head |
| Production seal | `a2c03c294583ae605e2113523b499fd44c0583baa9cfe1cf3aff0bb966f7596f`, 428 files |
| Calibration | `BLOCKED_CALIBRATION_INVALID` |
| Qualification | Not run |
| Role assignment | Not run |
| Pilot | Not run |
| Gold | Not run |
| Local SOL activation | false |
| Publish / promote / deploy / upload | false / false / false / false |
| Checkpoint force-pushed | false |
| Main merged | false |

## Live-call accounting

| Calibration identity | Scheduled cases | Codex exec calls | Infrastructure replays | Max-plan events | API calls | Result |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| `s16-forward-role-qualification-v1` | 24 | 24 | 0 | 0 | 0 | Invalidated after inspection |
| `s16-forward-role-qualification-v2` | 24 | 25 | 1 | 1 | 0 | Invalid; terminal stop |
| Total | 48 | 49 | 1 | 1 | 0 | `BLOCKED` |

The v2 route was structurally correct: all 25 attempts were route-valid, ChatGPT-authenticated, and API-free. The failure is in calibration validity. Reader produced no exact-evidence-valid cases, source produced only three exact-evidence-valid cases and two protocol-invalid outputs, and quiz produced zero protocol-valid cases.

Independent artifact inspection found systemic instrument defects in the corrected run: all reader tasks failed to open their staged chapter files; source exact-span requirements were enforced by the scorer but not stated in the task; one supposedly clean source case contradicted its own forbidden-specificity plan; and all quiz outputs violated frozen identity/index checks or omitted the item. Route integrity is not the blocker.

## Stop rationale

The v1 run already consumed the one offline instrument correction allowed by IMP-23. The v2 result has `valid=false` and all three `roleProtocolValid` values are false. Continuing would require a second calibration revision and a third calibration identity, which the prompt forbids. No attestation or holdout authorization was written.

All v1 and v2 evidence is preserved without credentials. The branch remains a draft PR for review; nothing has been published, promoted, deployed, uploaded, merged, or activated.
