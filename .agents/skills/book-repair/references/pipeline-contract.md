# ChapterFlow repair and publication contract

Use this contract only after reading the live authority files completely. The repository may evolve; live rules override this summary.

## Runtime authorities

From the repository root, read:

1. `AGENTS.md`
2. `CLAUDE.md`
3. `scripts/book/prompts/chapterflow-v24-author-pipeline/AGENTS.md`
4. `scripts/book/prompts/chapterflow-v24-author-pipeline/agent-prompts/STEP-2-WRITE-CHAPTERS.md`
5. `scripts/book/prompts/chapterflow-v24-author-pipeline/src/qc/orchestrator/repairBrief.ts`
6. `scripts/book/prompts/chapterflow-v24-author-pipeline/src/lib/readerContent.ts`
7. `scripts/book/prompts/chapterflow-v24-author-pipeline/src/critics/machineryPhrases.ts`
8. `scripts/book/prompts/chapterflow-v24-author-pipeline/src/critics/qcAttestation.ts`

The active v25 implementation is physically located at `scripts/book/prompts/chapterflow-v24-author-pipeline`. Before the first pipeline operation, enter that directory and verify no state override can redirect production work into a shadow tree:

```text
cd "$(git rev-parse --show-toplevel)/scripts/book/prompts/chapterflow-v24-author-pipeline"
test -z "${CHAPTERFLOW_STATE_DIR:-}"
```

Run every command below from that directory and use its relative `src/cli.ts`, `.chapterflow/**`, `state/**`, and `book-packages/**` paths. Never run the pipeline from the outer repository root or use its outer `state/` or `.chapterflow/` directories. If live instructions disagree about the active directory, branch, gate, or role, stop and resolve the conflict instead of guessing.

## Roles and mutable scope

- Use one role per task/session. A writer/repairer must not perform QC or publication.
- Repair only `state/chapters/<book-id>-chNN.v21-native.chapter.json` unless a live authority expressly names another content artifact.
- Never edit source code, configs, prompts, thresholds, gates, attestations, QC records, or evaluation/report artifacts to make content pass.
- Preserve unrelated worktree changes. Record the exact files changed by this run.
- Treat both the portfolio remediation prompt and pipeline repair prompt as defect hypotheses. Confirm each defect against the current package, chapter, sidecar, and live rule before editing.
- Do not claim a score change from the writer role.

## Repair loop

Set `CLI="npx tsx src/cli.ts"` conceptually; invoke it without a shell alias when traceability matters.

Before editing, inspect the latest failed round and generate its repair instructions:

```text
npx tsx src/cli.ts qc-diagnose <book-id> --round <round-id>
npx tsx src/cli.ts qc-repair-prompt <book-id> --round <round-id>
```

After changing each chapter, run all three checks until clean:

```text
npx tsx src/cli.ts author-check state/chapters/<chapter-file>.json
npx tsx src/cli.ts gate-chapter state/chapters/<chapter-file>.json
npx tsx src/cli.ts evidence-audit state/chapters/<chapter-file>.json
```

Then run book-wide deterministic checks:

```text
npx tsx src/cli.ts book-gate <book-id>
npx tsx src/cli.ts major-status <book-id>
npx tsx src/cli.ts qc-converge <book-id>
```

Do not hand off until `qc-converge` reports `DETERMINISTIC-CLEAN`. No more than one repair loop may run without a new `qc-diagnose`.

## Fresh QC

Every content edit makes prior QC stale. A fresh, independent QC task/session that did not write or repair the book must run after the final edit:

```text
CHAPTERFLOW_NO_API_CODEX_QC=1 CHAPTERFLOW_ENFORCE_SESSION_INDEPENDENCE=1 npx tsx src/cli.ts qc-auto "<book-id>" --pass
```

Do not infer PASS from partial output or a failed command. The pipeline publication bar is an overall score of at least 85, no axis below 0.6, and no corruption veto. The updated Content Design Score strictly above 80 is an additional gate, never a substitute.

After fresh QC passes, use a fresh packaging/publish-after-QC role to assemble the non-published candidate:

Retain the canonical matrix at `state/qc-orchestrator/<book-id>/<round-id>/evidence-matrix.json` and record that exact file in the `fresh_qc_passed` transition. Acceptance requires schema `qc-evidence-matrix-v1`, matching book/round, an empty `errors` array, exact coverage of the canonical loose-state index, and `PUBLISHABLE` for every final verdict. Its v2 `contentHash` values are recomputed from the loose chapters, never from the stripped package. The independent candidate binding is exact equality between each package chapter and the live v24 reader-content projection of its indexed loose chapter.

```text
npx tsx src/cli.ts promote-book <book-id>
```

The active CLI treats the nested pipeline directory as its repository root. Therefore this command writes the candidate to `scripts/book/prompts/chapterflow-v24-author-pipeline/book-packages/<book-id>.v21.json`. It does **not** replace the shipped outer `book-packages/<book-id>.v21.json`; `publish-final` performs that copy later. Bind independent evaluation, the report update, and the acceptance receipt to the nested candidate hash. Do not evaluate the unchanged outer baseline.

### Missing nested state

Many shipped outer packages have no complete active-v24 loose state. A slim shipped package is insufficient because authoring fields were deliberately stripped. Never seed loose state from it directly.

Use `bootstrap_v24_state_from_history.py` only when a richer package can be proven as a blob in an ancestor Git commit. Preflight first, then `--apply` only after review. The helper calls the live v24 `stripInternalFields`, requires every recovered chapter to roundtrip exactly to the current outer chapter, requires exact ordered index equality, refuses any target collision, preserves both package files, writes chapters/index transactionally, and emits a hash manifest. It never imports source sidecars, plans, or QC as canonical:

```text
python3 .agents/skills/book-repair/scripts/bootstrap_v24_state_from_history.py \
  --repo-root <repo> --book-id <book-id> \
  --recovered-commit <ancestor-commit> --recovered-repo-path <rich-package-path-at-that-commit> \
  --manifest <run-dir>/bootstrap-manifest.json
```

If preflight passes, repeat with a new manifest path and `--apply`. Source-v2 evidence and independent source verification must then be genuinely regenerated, and all gates/QC rerun. If no exact rich historical roundtrip exists, mark the run blocked and request a pipeline bootstrap/migration decision. Absence of state is not permission to invent an import path.

## Publication

Publication requires all of the following:

- a fresh pipeline QC PASS;
- a passing `acceptance-receipt.json` from `verify_repair_outcome.py`;
- proof that the outer shipped package still equals the frozen baseline before acceptance;
- byte-for-byte parity between the validated user-facing report artifacts and the canonical repo snapshot;
- explicit current user authority to commit and push;
- a fresh publisher role/task that did not author, repair, or evaluate the book.

Before any publication command, the publisher must re-read live authority files, inspect the current branch, upstream, remote, and worktree, and construct an exact allowlist. Never use `git add -A`, a force push, a bypass environment variable, or a command that includes unrelated dirty files.

The context loader normally freezes the branch's existing upstream. If and only if the current branch has no upstream and the user currently authorized push, initialize the run with both `--publication-remote <configured-remote>` and `--publication-ref refs/heads/<target>`. The remote must be configured, non-`.` and reachable; the target ref may be absent only because the authorized normal push will create it. If it exists, fetch it first so the loader can freeze a locally available commit and publication can prove fast-forward ancestry. Partial overrides, tags, unsafe refs, missing remotes, tracked-branch overrides, and overrides without current push authority fail closed. Publication ultimately proves the commit by querying that exact sealed remote URL/ref with `ls-remote`; a local tracking ref is not sufficient.

For the author architecture, preflight first:

```text
npx tsx src/cli.ts publish-final <book-id> --dry-run
```

Do not run real `publish-final` in this combined-report workflow because its auto-commit shape cannot produce the required five-file commit. The legacy path is:

```text
CHAPTERFLOW_NO_API_CODEX_QC=1 npx tsx src/cli.ts publish-after-qc "<book-id>" --round <round-id> --dry-run
```

The legacy command refuses to publish off `main`; do not bypass that safeguard. Stop on a detached HEAD, missing/unexpected upstream, authentication error, non-fast-forward, unexpected generated file, or any live-rule conflict.

This repair workflow requires one scoped commit whose changed-path set is exactly the outer book package plus the four canonical repo report snapshot files. For an already registered book, run `publish-final <book-id> --dry-run`, verify the live registry already contains the book, then use the supported copy/hash bridge without auto-commit:

```text
npx tsx src/cli.ts publish-to-live <book-id> --outer-root <repo-root>
```

Do not pass `--commit`. Verify the copied outer hash, stage exactly the five paths, commit once, and push normally. If the book is not already registered, the bridge or branch policy is unavailable, or the command proposes any other mutation, stop for a pipeline publication decision; do not amend/rewrite a pushed commit or invent a bypass.

After the scoped bridge/commit/push, advance the run to `published` with `advance_repair_state.py`. That transition first validates the one-time Git-anchored acceptance receipt/seal/manifest and original pre-acceptance history tail, then rehashes both packages. It fails unless the outer shipped package is byte-identical to the candidate hash recorded in the immutable acceptance proof.

The transition also requires the commit to exist at current `HEAD`, contain the exact outer book path with the accepted blob hash, remain on the frozen branch/upstream, and exist at the exact frozen remote URL and branch ref after a normal non-force push. A changed remote-tracking cache is not remote proof. The original state-recorded acceptance receipt/seal and acceptance-time updater/report hashes must still match byte-for-byte; alternate receipts or post-acceptance candidate/report changes fail.
