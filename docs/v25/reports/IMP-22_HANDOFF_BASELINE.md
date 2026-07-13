# IMP-22 Handoff Baseline

**Recorded:** 2026-07-12  
**Prompt:** `IMP-22_FORWARD_ONLY_SOL_PRODUCTION_READINESS_AND_FRESH_CONTENT_VALIDATION.md`  
**Prompt SHA-256:** `98fc58265be8fc2ee5d62bc5ef6ea15a57e36d3c5bd53917654b5503670a5761`

## Repository identity

- Starting HEAD: `37cb0804e157758272e7ec06c2aaf96ebdec6724`
- Branch: `feat/v25-pipeline`
- `37cb0804e` exists and is the current HEAD.
- Current HEAD is the committed IMP-20 implementation.
- Tracked worktree changes at handoff: none.
- Pre-existing untracked paths at handoff: 1,668. They are user-owned and are excluded from IMP-22 unless an exact path is deliberately adopted and recorded.

## Fast integrity gate

| Check | Result |
|---|---|
| Git ancestry / branch | PASS |
| Unresolved merge markers in tracked non-doc source | PASS (none found) |
| TypeScript typecheck | PASS (`npx tsc -p . --noEmit`) |
| Frozen contract validation | PASS (14 live contracts; IMP-00..12 and IMP-20 worker reports valid) |
| IMP-20 focused baseline tests | PASS (194 pass, 0 fail) |
| Old campaign closure | PASS (`CLOSED_EXPERIMENT_IDS` and all three gated entrypoints tested) |
| Active legacy campaign | PASS (none found) |
| Tracked OAuth/auth material | PASS (no tracked `auth.json`, OAuth home, or token file found) |
| No-API split-lane route | PASS (static router choke and focused tests) |

One stale process from an earlier fake-provider test was visible:
`tests/.tmp/provider-contract/fake-claude-hang-child.cjs`. It is not a live
model or migration campaign. IMP-22 will not treat it as campaign evidence; it
will be handled only if it interferes with current verification.

## Verified IMP-20 starting architecture

The current tree contains and the focused suite exercises:

- source-blind `reader-experience-review-v1`;
- source-aware `source-integrity-review-v1`;
- two-phase `quiz-integrity-result-v1`;
- conductor-owned `aggregated-chapter-review-v1`;
- per-role `judge-capability-qualification-v1`;
- fixed judge assignment and frozen audit-subset selection;
- a soft-metric minimum denominator of 10;
- mechanical closure of the legacy Section 16 experiment;
- the prepared, unsealed `s16-reviewer-recovery-v1` identity.

## Known handoff gaps (expected IMP-22 work)

- Reader and quiz corpus specifications contain owner-authored mutation slots
  that are intentionally empty and therefore cannot yet materialize.
- All 40 source-corpus units are `OWNER_INPUT_PENDING`; no source qualification
  corpus is currently materialized.
- No per-role live qualification conductor exists yet.
- Split-lane review is implemented beside, but is not yet the default real
  future-authoring review path.
- The recovery experiment is at `seal-prep.json`, not a live seal.
- No fresh forward pilot, fresh gold book, or local SOL activation exists.

These are implementation prerequisites, not permission to reopen or reinterpret
the archived historical campaign.

## Actions not performed in this handoff gate

No model call, API call, old-campaign resume, historical-book repair, publish,
promotion, deployment, upload, push, or local SOL activation occurred.
