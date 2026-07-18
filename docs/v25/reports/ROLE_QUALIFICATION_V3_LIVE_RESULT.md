# IMP-24B V3 Role Qualification Terminal Result

Final decision: **BLOCKED**

The live sequence did not start. The exact Commit 1 implementation and its dedicated V25 CI are valid, but the frozen campaign's own zero-call implementation-CI collector fails closed before the first model call.

## Terminal blocker

`gh run view 29267830570` reports both:

- `name = ChapterFlow V25 Pipeline`
- `workflowName = .github/workflows/chapterflow-v25-pipeline.yml`

The frozen collector requests `workflowName` and compares it with the display name `ChapterFlow V25 Pipeline`. Its pure gate evaluation therefore returns `policy_preflight_failure` even though the exact-SHA workflow and required job both succeeded.

Correcting that collector requires a new implementation checkpoint and new exact-SHA V25 CI. Replacing Commit 1 would exceed the authorized three-commit lifecycle or require forbidden history rewriting, so this run stops with a truthful terminal blocker.

## Final attestation CI conflict

The required Commit 3 report must bind the exact Commit 1 and Commit 2 SHAs and retain the final `BLOCKED` decision. The dedicated V25 workflow currently runs `imp24-materialize-pre-live-freeze --write`, whose deterministic preliminary-report generator writes both commit fields as `null` and the decision as `INCONCLUSIVE`. Its final clean-worktree check therefore cannot pass with the required attestation bytes.

Fixing that conflict would require a new implementation/workflow checkpoint or a changed lifecycle contract. Neither is authorized inside this frozen three-commit run, so the conflict is retained as a second terminal blocker rather than bypassed.

## Zero-call evidence

- Implementation commit: `e9a90bc17cd997fe1707b5cd62d86ef7a4e743b8`
- Dedicated V25 run: `29267830570` — SUCCESS
- Model-free certification: `0870c20df24fbda8d5376723edc6a5c1a84a7fe8bce0e3095aa28ef46f01289e`
- Production seal: `8ee638990c927fd9c6e15be8754512c0774da0065ce793851927eecde88f4187`
- Independent route readiness: ChatGPT auth, no API key, no fallback, no direct SDK/HTTP, Codex CLI 0.144.1, all 12 candidate cells available
- Canary calls: 0
- Holdout calls: 0
- Infrastructure replays: 0
- Max-plan events: 0
- Codex exec invocations: 0
- API calls: 0
- Role set ready: false

No threshold was weakened, no holdout was relabeled or replaced, no output-informed resampling occurred, and no retries were added.

Pilot, gold, local activation, publication, promotion, deployment, upload, merge, and force-push did not occur.
