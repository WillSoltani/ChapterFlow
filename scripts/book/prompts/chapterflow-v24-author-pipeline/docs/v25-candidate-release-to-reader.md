# Taking a v25 candidate release to a reader

What the publish chain does with a candidate-regime pair, what it verifies, and
which steps an operator still owns.

Re-pinned to the CURRENT released pair (R-247). The original text was written
against revision 3 of `the-autobiography-of-benjamin-franklin` and against a
`--v25-root` that was opt-in; both have moved. Where something was NOT verified,
that is said plainly.

The pair this document is pinned to, read off the files themselves:

| fact | value | where it was read |
| --- | --- | --- |
| pointer revision | **6** | `<v25-root>/books/the-autobiography-of-benjamin-franklin/current.json` |
| candidate | `repair-r7-candidate-88b631ed…` @ `436dcdaa…` | the same pointer, and the sidecar's `payload.candidateChapterSet` |
| review / QC round | `repair-r7-review-88b631ed…` / `repair-r7-qc-88b631ed…` | the sidecar's `payload.candidateQcEvidence` |
| recorded code fingerprint | **431 files** | the sidecar's `payload.versions.codeFingerprint.fileCount` |

## 1. What the released pair is

A candidate release produces two files:

| file | location |
| --- | --- |
| reader package | `book-packages/<id>.v21.json` |
| production-manifest sidecar | `state/books/<id>.production-manifest.json` |

The sidecar's `manifest.payload` carries `candidateChapterSet` +
`candidateQcEvidence` (the CANDIDATE regime) rather than `canonicalIndex` (the
legacy regime). The chapter-set authority is the candidate named by
`payload.candidateChapterSet.candidateId` / `.manifestDigest`, and the v25 CURRENT
pointer at `<v25-root>/books/<id>/current.json` names the candidate the release
actually published.

## 2. What the publish chain verifies, and how strongly

`publish-final`, `publish-to-live` and `register-web` all preflight through
`publishPreflightVerify` (`src/publish/candidatePreflight.ts`). It always prints
the STRENGTH it ran at:

- **`recorded-evidence replay`** — default for a candidate pair. The sidecar is
  loaded, the package is checked against the chapter set the manifest RECORDED,
  per-chapter reader-content hashes are checked, and the candidate's per-chapter
  evidence is replayed from what the manifest recorded. The candidate itself is
  **not re-read**.
- **`candidate-store re-verify`** — when `--v25-root <absolute>` is supplied. Adds:
  the CURRENT pointer is read; the sidecar's declared `candidateId@manifestDigest`
  must EQUAL the pointer's; the candidate is opened from the content-addressed
  store; its evidence is recomputed from its bytes; and the package's chapter set
  must equal the candidate's own `kind: "CHAPTER"` inventory.
- **`canonical-index (legacy regime)`** — a legacy pair, verified exactly as before.

`--v25-root` never silently falls back. A missing pointer, a mismatched pointer, a
legacy sidecar, or an unavailable candidate all REFUSE rather than quietly
downgrading to the replay.

**The strong path is now the DEFAULT for a candidate-declared pair (R-231).** The
replay used to be what you got by not typing a flag, which meant the weakest
verification was the normal one. `publish-final` now resolves the strength itself,
in a `preflight:verification-strength` step:

1. `--v25-root <absolute>` → strong, unchanged.
2. No flag → look for `CHAPTERFLOW_V25_ROOT`. It is accepted only when it is an
   absolute path that actually holds `books/<id>/current.json`, so a stale or wrong
   root is never silently used.
3. Neither → **REFUSE**. The step names both `--v25-root` and the escape hatch.
4. `--allow-weak-preflight` → proceed on the replay, with the residual printed as a
   warning on stderr and in the step line.

A LEGACY (canonical-index) pair has no candidate to re-read, so the gate does not
apply to it at all and its behaviour is unchanged.

### Why the inventory check is the one that matters

A wholesale re-authoring of BOTH files passes a two-file verify. Reproduced
against the real pair: drop ch04 from the package, drop it from `payload.chapters`
and `payload.candidateChapterSet.chapters`, re-derive the chapter-set
`semanticHash` and re-derive `payloadHash`/`contentId` — the resulting 3-chapter
pair verifies **PASS** with contentId `sha256:88e8c4ac…` (the honest pair is
`sha256:ba59a352…`), while still declaring the TRUE candidate identity.

Measured, not assumed: neither `expectedChapterSetSource` nor `candidateEvidence`
catches that forgery. The first only string-compares the declaration (which the
forger left honest); the second resolves evidence per PACKAGED chapter, and
`compareCandidateChapters` iterates `pkg.chapters` only — a chapter the CANDIDATE
has and the package dropped is invisible to it. Comparing the package against the
candidate's own chapter inventory is what refuses it.

## 3. BLOCKER an operator must plan around: the code fingerprint

The v2 manifest binds `payload.versions.codeFingerprint` over the pipeline's whole
`src/**` tree plus `package.json` and `package-lock.json`
(`resolveCodeFingerprintFiles`). For the released Franklin pair the recorded
fingerprint covers **431 files**.

Consequence, observed directly: any file added under `src/` changes the file count
and the bundle hash, and turns the released pair's verification into

```
[PPKG.code_fingerprint_mismatch] Recomputed code fingerprint does not match the
manifest (first delta: <path> added).
```

As of this change `resolveCodeFingerprintFiles()` returns **433** files (two new
modules under `src/release/`), so the shipped revision-6 pair is already
un-verifiable against this checkout and needs one of the two orders of operation
below before it can be published from here.

**Any change to pipeline `src/` un-verifies an already-released pair, so
`publish-final` will refuse it.** This is not caused by the preflight work — the
preflight simply surfaces it. Two orders of operation work:

1. Publish the released pair **before** merging further pipeline `src/` changes; or
2. **Re-release** the pair from the same candidate after the code change lands, so
   the new manifest binds the new code fingerprint. The candidate is immutable and
   content-addressed, so the same candidate is still available to release from.
   NOT VERIFIED HERE: that a re-release off this candidate succeeds end to end, or
   that its reader content is byte-identical to the current package — neither was
   run, and both should be confirmed before relying on this route.

This checkout needs one of the two, because this change itself alters `src/`.

## 4. Registration — what each verb actually writes

Established by reading the writers and checking the paths on disk:

- **`register-web <bookId>`** targets `<pipelineRoot>/app/book/data/bookPackages.ts`.
  That file is **not present in the pipeline tree** (only an empty `app/book/data/`
  directory is), so from the pipeline sandbox the verb stops with
  `Web registry not found at …`. It is a local/dev convenience, not the route to
  production.
- **`publish-final <bookId>`** is the verb that makes a book live the way the
  existing v1 books are. Its REGISTER step writes into the **OUTER** checkout:
  - copies the package to `<outerRoot>/book-packages/<id>.v21.json`
  - appends one import + a `BOOK_PACKAGES.push(...)` block + a tone getter into
    `<outerRoot>/app/book/data/bookPackages.ts` (idempotent; skipped when already
    registered)
  - regenerates `<outerRoot>/app/book/data/booksCatalog.metadata.json` via
    `<outerRoot>/scripts/book/generate-catalog-metadata.ts`
  - then commits (pathspec), pushes with a merge loop, asserts `origin == 0 0`, and
    cleans debris.

Those writes land in the web-app tree at publish time; no file under `app/` is
changed by this pipeline change.

Registration itself is content-agnostic — it keys on `bookId` — so a
candidate-released package is registrable exactly like a legacy one. The preflight
was the only candidate-specific obstacle in the chain.

`publish-after-qc` is deliberately untouched: it promotes from `chapterSpecs()`,
which reads the canonical index and falls back to ambient `state/chapters`. A
candidate-only book root has neither, so that route cannot reach a
candidate-released pair — it fails at promotion, before its own verification.

## 5. Operator runbook

```bash
cd scripts/book/prompts/chapterflow-v24-author-pipeline

# ── Release a candidate to the reader package + sidecar ────────────────────────
# --categories/--tags are REQUIRED here and are validated against
# config/categories.json (R-239); an unlisted name refuses unless --new-category.
# The candidate's own book gate runs and a BLOCKER refuses the release (R-228).
npx tsx src/cli.ts promote-book <bookId> \
  --title "…" --author "…" \
  --categories "Self-Help,Psychology" --tags "focus,habits" \
  --v25-root /absolute/v25-root --attempt-root /absolute/attempt-root \
  --candidate-id <candidateId> --manifest-digest <digest> \
  --source-git-sha "$(git rev-parse HEAD)" \
  --review-id <reviewId> --qc-round-id <roundId> \
  --expected-book-revision <current revision>

# ── Ship it ───────────────────────────────────────────────────────────────────
# Strongest preflight — pin the pair to the CURRENT pointer and re-read the candidate.
npx tsx src/cli.ts publish-final <bookId> --dry-run --v25-root /absolute/v25-root

# Real ship (same flag; the strength is printed in the preflight steps).
npx tsx src/cli.ts publish-final <bookId> --v25-root /absolute/v25-root
```

Export `CHAPTERFLOW_V25_ROOT=/absolute/v25-root` once and the `--v25-root` flag
becomes optional — the strong preflight is then what you get by default.

### `publish-final` flags and exit codes

| flag | what it does |
| --- | --- |
| `--dry-run` | prints the whole plan, including the cleanup manifest, and mutates nothing. Its `plan:cleanup` step now carries the verdict the REAL run would reach, so a plan that would abort reports **BLOCKED** (R-240). |
| `--v25-root <absolute>` | candidate-store re-verify (see §2). |
| `--allow-weak-preflight` | ship a candidate pair on the recorded-evidence replay, with the residual printed. |
| `--keep-debris` | skip the debris sweep entirely. |
| `--strict-cleanup` | make a shipped-but-uncleaned publish a hard failure (exit 1). |

| exit | meaning |
| --- | --- |
| `0` | shipped and swept. |
| `3` | **SHIPPED, cleanup blocked.** The package is committed, pushed and `origin == 0 0`. Do NOT re-publish. (R-241) |
| `1` | the publish failed and the book is NOT live. |
| `2` | usage / argument refusal. |

### The two terminal states an operator must recognise

**a. Shipped, not cleaned (exit 3).** The debris sweep aborts when a matched path
is git-tracked, or when git cannot answer which paths are tracked at all (R-230 —
that used to resolve to "nothing is tracked" and delete). The publish itself has
already landed, so re-running `publish-final` will neither unship the book nor
clean it: resolve the tracked path, or re-run with `--keep-debris`, and sweep
separately.

The pipeline's OWN released pair — `book-packages/<id>.v21.json` and
`state/books/<id>.production-manifest.json` — is git-tracked *by design*. Those two
paths are now classified as expected release outputs and SKIPPED with a named
reason rather than aborting the sweep (R-088), so they no longer produce this state
on their own; `--keep-debris` is no longer needed just to get past them.

**b. Pushed, not deployed.** `publish-final` ends at `git push`. The four steps it
records in `book-packages/.pending-deploy.json` and prints as DEPLOY REQUIRED are
still owed:

1. `upload-book-packages-to-s3`
2. `deploy-workflow`
3. `register-api-books` (the iOS/API surface — skipping it leaves the book web-only)
4. `verify-live-sync` (`npm run verify:live`, which clears the sentinel)

The sentinel is the only thing keeping this debt visible. If it cannot be read,
`publish-final` now REFUSES before the commit rather than rewriting it with the
other books' entries dropped (R-255).

## 6. What the released sidecar records about itself

A candidate release writes a `provenance` block on the sidecar (R-234 / R-252):
the `sourceGitSha` the release was invoked with, the candidate id + manifest
digest, the run that staged that candidate and when, the review id, the QC round
id, the pointer revision committed, the release instant, and — when the candidate
carries `inputs/research/research-run.manifest.json` — that run's id, provider and
model. `verifyProductionPackage` refuses a provenance block that contradicts the
manifest beside it; a pair with no block still verifies, because every pair
released before the block existed carries none.

NOT recorded, and why: the reader-panel composites. They exist only in flight
(`laneOrchestrator` → `semanticPanelReviewEvaluator`, which folds them into a
review issue MESSAGE). The persisted review record is
`{reviewId, candidate, outcome, issues, completedAt}` and the QC round record
carries no scores either, so there is nothing structural for the release to read.

### `--promote-local` and the follow-up command

`--promote-local` advances the local CURRENT pointer and produces no reader
package. It now files a `pointer-committed` release-journal record under its own
`--v25-root`, and the `promote-book …` command it prints names the revision the
promotion started FROM plus `--resume-unfinished-release` — which finishes that
release at the SAME revision. Before R-233 it printed the revision just committed,
which minted a second revision for byte-identical content.
