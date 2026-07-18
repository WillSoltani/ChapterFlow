# IMP-24D model-free verification ledger

Status: **OBSERVABILITY_COMMIT_LOCALLY_READY**

Starting head: `3b060fb0a7f6e64e04386b84ff6b5a10e42868ec`

Model calls: **0**
API calls: **0**

The decisive complete suite passed `2893 / 0` with `10` machine-checked environment absences and `39` skips. The production seal covers `463` files, all `116` fixed certification cases returned `CERTIFIED_MODEL_FREE`, and the IMP-24D observability freeze reproduced byte-identically.

## Adverse attempts retained

- The first complete suite passed `2885` tests and failed one stale fail-closed assertion after process diagnostics moved the rejection earlier.
- One correction-cycle test fixture initially failed TypeScript because its availability entry retained an inferred `AVAILABLE` literal while modeling `UNAVAILABLE`.
- One broad focused run exposed a host-load-sensitive 100 ms child-startup assumption in the descendant-pipe timeout test; the isolated runner reproduction retained both streams correctly, and the test now measures the post-kill bound with realistic startup headroom.
- An independent pre-call audit rejected the initial correction allowlist because it admitted the smoke PASS oracle and qualification-live evidence logic. The one-correction surface is now only the pure low-level Codex argv/required-flag module.
- The first complete suite after that audit passed `2891` tests and failed two stale final-attestation fixtures that still modeled `codexAgent.ts` as the correction surface. The narrowed proof rejected them as designed; the fixtures were corrected, and the exact complete rerun passed `2893 / 0`.

No failed verification was treated as a pass. No live smoke call or r2 qualification call has run. The smoke and r2 roots remain absent until the observability commit has exact dedicated V25 CI success.
