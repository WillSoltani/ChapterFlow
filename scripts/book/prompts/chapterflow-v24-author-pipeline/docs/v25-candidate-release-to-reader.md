# Taking a v25 candidate release to a reader

What the publish chain does with a candidate-regime pair, what it verifies, and
which steps an operator still owns. Every claim below was established by running
the code against the first released pair (`the-autobiography-of-benjamin-franklin`,
revision 3) — where something was NOT verified, that is said plainly.

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
fingerprint covers **430 files**.

Consequence, observed directly: adding a single new file under `src/` made the
current tree 431 files, changed the bundle hash, and turned the released pair's
verification into

```
[PPKG.code_fingerprint_mismatch] Recomputed code fingerprint does not match the
manifest (first delta: src/publish/candidatePreflight.ts added).
```

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

# Strongest preflight — pin the pair to the CURRENT pointer and re-read the candidate.
npx tsx src/cli.ts publish-final <bookId> --dry-run --v25-root /absolute/path/to/v25-root

# Real ship (same flag; the strength is printed in the preflight:verify step).
npx tsx src/cli.ts publish-final <bookId> --v25-root /absolute/path/to/v25-root
```

`publish-final` ends at `git push`. The four steps it records in
`book-packages/.pending-deploy.json` and prints as DEPLOY REQUIRED are still owed:

1. `upload-book-packages-to-s3`
2. `deploy-workflow`
3. `register-api-books` (the iOS/API surface — skipping it leaves the book web-only)
4. `verify-live-sync` (`npm run verify:live`, which clears the sentinel)
