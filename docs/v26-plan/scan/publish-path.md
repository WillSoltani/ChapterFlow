# Publish-path scan: how a package reaches the app

Lens: the shortest safe path from "a folder of 19 v21 chapter JSON files written by a new writer" to "the book in the app", proven early.
Investigator run 2026-09-27, read-only, at origin/main 22e021d. Scratch proofs are in `/tmp/claude-0/-home-user-ChapterFlow/48916df7-45f9-50d8-ad9d-e43b21e61800/scratchpad/scan/publish-path/`: `assemble.py`, `checks.mts`, `preflight.mts`, `catalog-diff.mts`, `pf-dry.mts`, `pf-real.mts`, and a hermetic `outer/` and `origin.git`.

## keyFacts

- **The app never reads the production-manifest sidecar.** Only two files mention it: `app/book/data/bookPackages.slim-contract.test.ts`, which forbids it inside packages, and `scripts/book/slim-book-packages.ts` (checked with a grep over `app lib components scripts/book/*.ts .github`). The sidecar exists only for the pipeline's own tamper and provenance checks. VERIFIED
- **Neither pipeline release route suits a new writer.**
  - The v25 route (`promote-book --candidate-id`) needs a v25 root, a CURRENT pointer, a content-addressed candidate, a **PASS** canonical review, a **PASS** QC round and a book gate with no blockers.
  - The legacy route (`promote-book`) needs per-chapter `qc-attest-v1` PUBLISHABLE attestations, the ship gate, the key-judge, run source sidecars and a source-reality record.
  - `publish-final` refuses any package whose sidecar does not re-verify.
  - So either route puts the new book back through every released rule and grader. VERIFIED
- **Released pairs expire on the next pipeline commit.** The only released pair, Franklin rev 6, FAILS the publish preflight at HEAD today with `PPKG.prompt_/config_/code_fingerprint_mismatch` (I ran `publishPreflightVerify`). Any change to `src/**/*.ts`, `config/*.json` or `prompts/**/*.md` makes an already-released pair unshippable. VERIFIED
- **Catalog path drift.** WS3-007 (07-18, commit ac27796d) moved the static catalog to `lib/books-catalog.metadata.json`. The generator, publish-final and register-api-books still write or read `app/book/data/booksCatalog.metadata.json`, which no longer exists.
  - A publish-final run today would commit a stray new file and leave the real catalog without Franklin.
  - Regenerating from `BOOK_PACKAGES` reproduces the lib file **byte for byte** (135 of 135 rows; ran), so the fix is a one-line path change in 3 files and 2 tests. VERIFIED
- **The in-app library and reader read DynamoDB + S3, not the bundle.** That data is written only by `register-api-books`. Without it the web reader returns `notFound()`; the runbook describes this step as "the iOS surface" only.
  - A prototype can therefore reach the **dev** app with `npm run register:api` alone: no commit, no deploy.
  - VERIFIED in code; INFERRED end to end, because it was not run against AWS.
- **The shortest path is proven in this container, with no model calls and no AWS.** The inputs were the Opus-written ch01, a ~45-line assembler and the rev-6/radical-candor top-level fields. All of these PASS:
  - the app's `validateBookPackage`;
  - the pipeline's reader-content and machinery-tag checks;
  - the app's own CI package tests (slim-contract, title-quality, taxonomy; 17/17);
  - `register-api-books --dry-run`.

  `publishFinal()` also ran end to end in a hermetic outer repo, with its `verify` seam set to the app validator: bridge, register, sentinel, commit, push, sync `0 0`. VERIFIED
- **Franklin-specific traps.**
  - (a) The tracked rev-6 sidecar makes `publish-final` refuse any new Franklin package ("candidate pair refused: no v25 root"), and the CLI has no flag to point at a different package or sidecar.
  - (b) The pipeline's `config/categories.json` refuses "Memoir" and "Classics". The app's taxonomy (the real shelf) accepts both, and maps "Self-Help" to "Self Improvement". VERIFIED
- **The owner must run the AWS steps on the Mac.**
  - Deploy is `workflow_dispatch` only (dev or prod).
  - The S3 package upload is deliberately left out of the workflow, because the OIDC role has no `PutObject` permission.
  - The last completed deploy was 2026-07-10, per `book-packages/.pending-deploy.json`.
  - VERIFIED (files); HANDOFF (Mac-only credentials)

## 1. The surfaces a book must reach, and who writes each

| Surface | What reads it | Written by | Needed for |
|---|---|---|---|
| `book-packages/<id>.v21.json` (tracked) | client bundle (via registry), S3 upload, register-api | publish-final BRIDGE (`publishFinal.ts:617-622`) or `cp` | everything below |
| `app/book/data/bookPackages.ts` import + 6-line block | `BOOK_PACKAGES` → catalog/chapter-meta generators | `registerInOuterRegistry` (`publishFinal.ts:404-431`) | static catalog regen |
| `lib/books-catalog.metadata.json` | `lib/books-catalog.ts:1` → browse/marketing/onboarding pages (`docs/architecture/shared-code-layers.md:78-84`) | **nothing today**: the generator writes the old path (`scripts/book/generate-catalog-metadata.ts:25-28`) | static browse pages |
| `app/book/data/book-chapter-meta.json` | `bookChapters.ts:13,861` (profile, badges, library-state) | `scripts/book/generate-chapter-meta.ts` (publish-final never runs it) | optional; already stale: 105 of 135 books, no v24 book |
| `book-packages/.pending-deploy.json` | `verify:live`, doctor, book-status | publish-final (`publishFinal.ts:659-674`) | deploy bookkeeping |
| S3 `book-content/packages/<id>.v21.json` | `app/app/api/book/_lib/book-package-source.ts` (quiz, ask, audio) | `scripts/book/upload-book-packages-to-s3.ts` (owner, AWS) | quiz/ask/audio |
| DDB rows + versioned S3 artifacts + presentation/search index | `/api/book/me/dashboard` (in-app library, `hooks/book/useLibraryDashboard.ts:36`); book detail and **chapter reader** (`app/book/library/[bookId]/page.tsx:9`, `.../chapter/[chapterId]/page.tsx:10-35`, `notFound()` at :60) | `npm run register:api` (`scripts/book/register-api-books.ts`; ingest + `publishNow:true`) | **the reader itself** |
| deployed web app | static catalog pages; `verify:live` check (c) | `gh workflow run deploy.yml -f environment=<dev|prod> -f deploy_app=true` | browse pages, parity proof |

## 2. What each existing route demands (with evidence)

**A. v25 candidate release, then publish-final** (the route Franklin rev 6 used):

- `promote-book` requires:
  - `--candidate-id --manifest-digest --v25-root --review-id --qc-round-id --expected-book-revision --source-git-sha --categories --tags` (`cli.ts:2421-2467`);
  - a book gate with no blockers (`cli.ts:2478-2484`, `release/candidateReleaseGate.ts`);
  - canonical review `outcome === "PASS"` with no blocker, and QC round `PASS` with no blocker (`release/promotionService.ts:417-424, 493-500`);
  - categories in `config/categories.json` (`release/categoryPolicy.ts:101`).
- It writes the package and a sidecar. publish-final then re-verifies the sidecar:
  - it recomputes `payload.versions.{prompt,config,code}` fingerprints from disk (`verifyProductionPackage.ts:1029-1031, 717-738`);
  - the fingerprints cover every `agent-prompts/**.md`, `prompts/**.md`, `config/*.json` and `src/**/*.ts` (`lib/pipelineFingerprint.ts:26-37`).
- To reach this point the book needs the full v25 compile → panel → QC → rubric run: $700-1,100 and 1.5-3 days (HANDOFF).

**B. Legacy canonical-index promote, then publish-final** (the route the six v24 books used, e.g. radical-candor's commit 44c311e0 of 2026-07-10, which touched `bookPackages.ts`, `app/book/data/booksCatalog.metadata.json`, `.pending-deploy.json` and the package):

- Per chapter it needs:
  - `.chapterflow/runs/<id>/<run>/sidecars/source/chNN.source.json`;
  - `state/chapters/<id>-chNN.v21-native.chapter.json`;
  - `state/qc/<id>-chNN.qc.json` with `qc-attest-v1`, verdict `PUBLISHABLE`, a roundId, an approved reviewer and a fresh content hash (`productionManifest.ts:902-1037`).
- It also needs `state/indexes/<id>.json` and a source-reality record or exemption (`productionManifest.ts:1082-1162`).
- `promoteBook` then runs:
  - the per-chapter ship gate, intra-book and book gates, and the source-v2 gate;
  - the QC-attestation gate and the answer-key judge gate;
  - the forced no-API sweep, source-verify and key-judge stack (`promoteBook.ts:655-1060`; `cli.ts:2411-2414` forces `CHAPTERFLOW_NO_API_CODEX_QC=1`).
- None of these artifacts exists for a new writer's chapters. Producing them means running the rulebook again or fabricating attestations. Fabrication must not be done.

**C. `register-web`** is dead from the pipeline. It writes `<PIPE>/app/book/data/bookPackages.ts` (`cli.ts:3526, 3559`), and `PIPE/app` does not exist (`ls`). It also demands the sidecar verify first (`cli.ts:3545-3557`). The pipeline's own doc says the same (`docs/v25-candidate-release-to-reader.md` §4).

**D. publish-final's mechanical tail is sound and reusable.** The steps are: bridge with sha256 compare, append-register, catalog regen, pending-deploy sentinel, pathspec commit, merge-loop push, and the `0 0` sync assert (`publishFinal.ts:616-728`). Only its preflight ties it to A or B.

The CLI exposes only `--dry-run --keep-debris --strict-cleanup --allow-weak-preflight --outer-root --v25-root` (`cli.ts:2761-2777`). There is no `--package` or `--manifest-path` flag, but the library function accepts `localPackagePath`, `manifestPath` and a `verify` seam (`publishFinal.ts:276-333`).

## 3. Traps a Wave 1/2 session will hit (each checked here)

1. **Released pair expired (VERIFIED, ran).** `preflight.mts` against the tracked rev-6 pair gives `verifyProductionPackage FAIL — strength: recorded-evidence replay` with five findings. They include:
   - `PPKG.prompt_fingerprint_mismatch (prompts/researcher-bibliography.system.md changed)`;
   - `PPKG.config_fingerprint_mismatch (config/author-voice-profiles.json changed)`;
   - `PPKG.code_fingerprint_mismatch (src/agents/researcher-bibliography.ts changed)`.

   The pipeline doc already predicted this (`docs/v25-candidate-release-to-reader.md` §3). The release and the publish must run on the same pipeline bytes, and every Q-wave PR breaks that.
2. **The stale sidecar blocks any new Franklin package (VERIFIED, ran `pf-dry.mts default-sidecar`).** Result: `✗ preflight:verification-strength: the pair at …/state/books/the-autobiography-of-benjamin-franklin.production-manifest.json declares candidate repair-r7-candidate-88b631ed…@436dcdaaa3b8…, but no v25 root was given`.
   - The check runs **before** the `verify` seam (`publishFinal.ts:514-539`).
   - Both the rev-6 package and its sidecar are git-tracked (`git ls-files`).
   - A new-writer ship must pass a `manifestPath` that does not exist (the library option) or delete or replace the sidecar.
   - Also, `localPackagePath` defaults to the tracked rev-6 package at `PIPE/book-packages/` (`publishFinal.ts:502`).
3. **Catalog path drift (VERIFIED).**
   - `lib/books-catalog.ts:1` imports `./books-catalog.metadata.json`.
   - `generate-catalog-metadata.ts:27`, `publishToLive.ts:70` (`OUTER_CATALOG_METADATA_REL`) and `register-api-books.ts:251` all use the retired `app/book/data/booksCatalog.metadata.json`.
   - publish-final would regenerate it as an untracked file, which `dirtyPaths` (`publishFinal.ts:455-462, 679-680`) then stages and commits. `lib/` never gains Franklin.
   - register-api-books Phase 3 hits ENOENT and swallows it as "presentation-index refresh failed (non-fatal)" (`register-api-books.ts:290-291`), so no new book has received API presentation data since 07-18.
   - The pipeline tests use a fake outer tree with the old path, which hides the drift (`tests/publish-final.test.ts:52,76`).
   - `catalog-diff.mts` shows the generator logic reproduces `lib/books-catalog.metadata.json` byte for byte. Fix: point the three references and the two test fixtures at `lib/books-catalog.metadata.json`.
4. **Two taxonomies (VERIFIED, ran `checks.mts`).**
   - Pipeline `validateReleaseCategoriesAndTags(["Memoir","Classics","Self-Help"])` returns `V25_RELEASE_METADATA_INVALID: 2 category value(s) are not in the canonical taxonomy ("Memoir", "Classics")`.
   - Its message says the reader's filter is built from `config/categories.json` (`categoryPolicy.ts:101`). That is false: the app's filter uses `lib/category-taxonomy.ts` (`app/book/library/hooks/useLibraryFilters.ts`).
   - The app's `CANONICAL_CATEGORIES` (`lib/category-taxonomy.ts:38-63`) include Memoir and Classics. `enforceCanonicalCategories` returns `[Memoir, Classics, Self Improvement]`.
   - The app taxonomy is the authority. The CI test "every authored on-disk package category is in the taxonomy" (`lib/category-taxonomy.test.ts:91`) guards it.
5. **Cleanup deletes the inputs.** Without `--keep-debris`, a successful publish sweeps the book's state, `.chapterflow` runs (the source freeze and research), plans and the sandbox package (`publish/cleanupBookDebris.ts:1-30`). An iterating writer loses its source and brief copies. Always pass `keepDebris`. VERIFIED (code)
6. **Pushing to main.** publish-final pushes the checked-out branch (`publishFinal.ts:577, 704`). `.github/rulesets/main-branch.json` requires a PR and 7 status checks, but its own comment says it is "not applied by this commit". Run the ship on a branch and open a PR; the sync assert works on any branch. VERIFIED (files); whether the ruleset is live is UNKNOWN (no `gh`)
7. **The new writer's chapter JSON lacks `chapterId`, `number` and `readingTimeMinutes`.** The Opus ch01 has exactly the other 11 radical-candor chapter keys; the assembler must add these three. Its fullRead has 10 `\n\n`-separated paragraphs and no single newlines, so the server adapter's `/\n\n+/` split works (`v21-adapter.ts:76`). A one-paragraph check is a cheap, useful warning (rr21 had 8/19 single-paragraph fullReads, HANDOFF). VERIFIED
8. **Minor issues.**
   - The sentinel merge rewrites `.pending-deploy.json` and drops `lastCompletedAt` and `lastCompletedNote` (`publishFinal.ts:147`; seen in the hermetic commit).
   - There is no Franklin cover in `public/book-covers/`, and the presentation falls back to "A modern reading of … with concise summaries, scenarios, quizzes, and gated chapter progression." (`bookPackages.ts:1582`). A curated `BOOK_PACKAGE_PRESENTATION` entry is a one-block edit.

   VERIFIED

## 4. Shortest safe path

What makes it safe is the checks the **app** enforces, plus a human read, and nothing more.

Artifacts that must exist:

| Artifact | Produced by | Notes |
|---|---|---|
| 19 chapter JSONs in v21 chapter shape | the new writer | same shape as `docs/v26-plan/evidence/probe/ch01.opus5.chapter.json` |
| book-level fields | a 45-line assembler (scratch `assemble.py`) | top-level fields copied from `book-packages/radical-candor.v21.json`: `schemaVersion:"chapterflow-v21-authored"`, `packageId:"<id>-v21-<epochMs>"`, `createdAt` ISO, `contentOwner:"chapterflow"`, `book{bookId,title,author,categories,tags}`; per chapter `chapterId:"<id>-chNN"`, `number`, `readingTimeMinutes` |
| `book-packages/<id>.v21.json` | assembler + publishFinal bridge | must pass the app validator, slim-contract, title-quality and taxonomy tests, and `register-api-books --dry-run` |
| registry block, catalog row, sentinel | publishFinal tail (`registerInOuterRegistry`, generator with fixed path, `mergePendingDeploy`) | 4 files in one commit |
| production-manifest sidecar | **not needed** | nothing in the app reads it; do not forge one |
| canonical index, QC attestations, candidate/pointer | **not needed** | only the pipeline's own verifier reads them |
| (optional) `book-chapter-meta.json` refresh, cover, curated presentation | `npx tsx scripts/book/generate-chapter-meta.ts`; `public/book-covers/<id>.webp` | non-blocking |

Proven in this container (VERIFIED; 0 model calls, no AWS):
```
$ python3 assemble.py the-autobiography-of-benjamin-franklin "The Autobiography of Benjamin Franklin" "Benjamin Franklin" \
    "Memoir,Classics,Self-Help" "virtue,habit formation,self-education,civic projects,American history,writing" \
    work/book-packages/the-autobiography-of-benjamin-franklin.v21.json docs/v26-plan/evidence/probe/ch01.opus5.chapter.json
APP validateBookPackage OK chapters= 1 | PIPE readerContent ch01: internal=none machineryTag=none
APP taxonomy OK -> [Memoir, Classics, Self Improvement] | APP publish guard: publish
(cwd=work) tsx --test slim-contract + title-quality + category-taxonomy  ->  # tests 17 # pass 17 # fail 0
(cwd=work) register-api-books.ts --dry-run the-autobiography-of-benjamin-franklin -> ✓ VALID (1 chapters ...) exit 0
publishFinal({dryRun:false, keepDebris:true, outerRoot:<hermetic clone>, localPackagePath, manifestPath:<absent>, verify:appValidator})
  -> bridge sha MATCH, register:append, deploy-sentinel, commit 3 files, push, sync 0 0, cleanup SKIPPED
```

## 5. Command recipe (Wave 1 or 2 can run steps 1-4 in the cloud container)

```bash
REPO=/home/user/ChapterFlow; B=the-autobiography-of-benjamin-franklin; OUT=$SCRATCH/franklin   # SCRATCH = session scratch dir
export TSX_TSCONFIG_PATH=$REPO/tsconfig.json; TSX=$REPO/node_modules/.bin/tsx
# 1. assemble (writer output: $OUT/chapters/ch01..ch19.chapter.json)
python3 assemble.py $B "The Autobiography of Benjamin Franklin" "Benjamin Franklin" "Memoir,Classics,Self-Help" \
  "virtue,habit formation,self-education,civic projects,American history,writing" $OUT/book-packages/$B.v21.json $OUT/chapters/ch*.chapter.json
# 2. app-side smoke alarms (no model, no AWS)
$TSX checks.mts $OUT/book-packages/$B.v21.json        # app validator + reader-content + taxonomy + publish guard
(cd $OUT && $TSX --test $REPO/app/book/data/bookPackages.slim-contract.test.ts \
   $REPO/app/app/api/book/_lib/book-packages-title-quality.test.ts $REPO/lib/category-taxonomy.test.ts)
(cd $OUT && $TSX $REPO/scripts/book/register-api-books.ts --dry-run $B)     # the exact API ingest gates, AWS-free
# 3. publish chain, DRY RUN, against the real checkout (git fetch + plan only; mutates nothing)
$TSX ship-direct.mts --dry-run      # = publishFinal($B,{dryRun, keepDebris:true, localPackagePath:$OUT/book-packages/$B.v21.json,
                                    #   manifestPath:"<absent>", verify: app validateBookPackage}); expect "PUBLISH-FINAL PLAN"
# 4. real ship ON A BRANCH (after the catalog-path fix lands; see §6)
git switch -c books/franklin-v26 && $TSX ship-direct.mts   # commits package + registry + lib catalog + sentinel, pushes the branch
npx tsx scripts/book/generate-chapter-meta.ts               # optional; then open the PR; CI re-runs the package tests
# 5. OWNER MAC (AWS). Dev first: the reader shows the book after register:api alone, before any merge or deploy
AWS_REGION=us-east-1 BOOK_TABLE_NAME=<dev> BOOK_CONTENT_BUCKET=<dev> BOOK_INGEST_BUCKET=<dev> npm run register:api -- --dry-run $B
AWS_REGION=us-east-1 BOOK_TABLE_NAME=<dev> BOOK_CONTENT_BUCKET=<dev> BOOK_INGEST_BUCKET=<dev> npm run register:api -- $B
BOOK_CONTENT_BUCKET=<dev> AWS_REGION=us-east-1 npx tsx scripts/book/upload-book-packages-to-s3.ts --dry-run   # then without --dry-run
# 6. OWNER, after the PR merges: prod
BOOK_CONTENT_BUCKET=<prod> AWS_REGION=us-east-1 npx tsx scripts/book/upload-book-packages-to-s3.ts
gh workflow run deploy.yml -f environment=prod -f deploy_app=true
AWS_REGION=us-east-1 BOOK_TABLE_NAME=<prod> BOOK_CONTENT_BUCKET=<prod> BOOK_INGEST_BUCKET=<prod> npm run register:api -- $B
BOOK_CONTENT_BUCKET=<prod> AWS_REGION=us-east-1 npm run verify:live   # clears the sentinel; commit that change
```
`ship-direct.mts` is the scratch `pf-dry.mts`/`pf-real.mts`: about 20 lines importing `publishFinal` and `validateBookPackage`. Step 5 makes the book **published** in whichever table it targets (`publishNow:true`, `register-api-books.ts:170-177`), so prod before the owner has read it is a publish decision.

## 6. Minimal code changes worth one Wave 1 PR (no model calls; each can be tested hermetically)

1. **Catalog path.** Change `scripts/book/generate-catalog-metadata.ts:27`, `publish/publishToLive.ts:70` and `scripts/book/register-api-books.ts:251` to `lib/books-catalog.metadata.json`, and update the two test fixtures. Proven byte-identical output.
2. **A direct-ship verb**, e.g. `publish-final --direct --package <path>` or `scripts/book/ship-direct.ts`. It would:
   - run the assembler and the app checks;
   - call `publishFinal` with `verify` set to the app validator, `manifestPath` pointing nowhere, `keepDebris:true`, and the current branch;
   - write a small human-readable provenance note (writer model, brief hash, source slice hash, fact-check result) beside the package or into the PR body, in place of the sidecar.
3. **Remove or re-point the tracked Franklin rev-6 pair** (`PIPE/book-packages/…v21.json` plus `state/books/…production-manifest.json`) once the direct path exists, or it will keep capturing Franklin publishes.
4. **Stop gating release categories on `config/categories.json`,** or sync it to `lib/category-taxonomy.ts`.

Total delivery code the app actually needs: the package JSON, a 7-line registry edit and one catalog regeneration. Compare that with the 9,341 lines of `publish/`, `release/`, `verifyProductionPackage.ts`, `productionManifest.ts`, `promoteBook.ts` and categories config (`wc -l`).

## 7. Diagnosis, through this lens

- (1) Assembled, not written: **refined.** Delivery does not care how a chapter was written. The whole-chapter Opus output fits the app's v21 shape unchanged apart from 3 id fields.
- (2) The rules create the problems: **confirmed** in the release chain. Each hardening step (fingerprints, CURRENT pointer, inventory, the weak-preflight refusal) was individually justified. Together they left the one released pair unshippable at HEAD and able to expire on every later commit.
- (3) The format fights a memoir: **neutral here.** The app validator is lenient and accepted 3 examples, 6 quiz questions and 5 cards. The template's size and shape are pipeline choices, not app requirements.
- (4) Broken compass: **confirmed.** The v25 release requires grader PASS verdicts (review and QC round), so the noisy graders are literally the gate to the app.
- (5) Accuracy baked upstream: outside this lens.
- (6) Over-engineered around the writing: **strongly confirmed.** The last mile needs almost none of the machinery that guards it.

## 8. Open questions

- Is `.github/rulesets/main-branch.json` applied on GitHub? If it is, the ship must go through a PR (the recipe assumes it does).
- Does a provisioned **dev** stack exist with a book table and buckets, and what are its names? The owner's Mac has the credentials.
- The app validator's questionId-uniqueness scope (per chapter or per package) was not checked; a tool call was denied. A 19-chapter assembled package plus `register-api-books --dry-run` answers it in seconds.
- Should the prototype go to prod (published to every user) or stay in dev until the owner has read it?
- Franklin cover image and a curated synopsis: owner choice.

## Adversarial verification

Verifier run 2026-09-27 at 22e021d, read-only, 0 model calls. Re-runs are in `/tmp/claude-0/-home-user-ChapterFlow/48916df7-45f9-50d8-ad9d-e43b21e61800/scratchpad/scan/verify-publish-path/`.

| id | verdict | evidence (one line) |
|---|---|---|
| PP1 | CONFIRMED | The grep over `app lib components scripts/book/*.ts scripts/book/*.mjs .github hooks infra/lib` hits only `bookPackages.slim-contract.test.ts` and `slim-book-packages.ts`. `ingestion.ts` "manifest" is the app's own `BookManifest`. CI's `pipeline:doctor` (`src/lifecycle/doctor.ts`) never touches the sidecar. `register-api-books.ts:125-135` gates exactly as cited. |
| PP2 | CONFIRMED | `promotionService.ts:417-424,493-500` (PASS and no BLOCKER for the review and the QC round). `cli.ts:2411-2414` forces `CHAPTERFLOW_NO_API_CODEX_QC=1`; `cli.ts:2478-2484` refuses on a book-gate blocker. `productionManifest.ts:979-994` requires `qc-attest-v1`/`PUBLISHABLE`. `promoteBook.ts:659-698` runs the ship, book and source-v2 gates. |
| PP3 | CONFIRMED | Re-ran `publishPreflightVerify` on the tracked rev-6 pair and got `FAIL — recorded-evidence replay` with 5 findings, including the prompt, config and code fingerprint mismatches quoted in the report. The scope in `lib/pipelineFingerprint.ts:26-37` and the compare in `src/verifyProductionPackage.ts:717-738` match (note: the path is `src/`, not `src/publish/`). Without a v25 root, `publishFinal.ts:514-539` refuses even earlier. It is the only tracked sidecar in the repo. |
| PP4 | CONFIRMED | `lib/books-catalog.ts:1`; old path at `generate-catalog-metadata.ts:27`, `publishToLive.ts:70` and `register-api-books.ts:251`. `app/book/data/booksCatalog.metadata.json` is absent. GitHub `ac27796d` (2026-07-18) renamed it to `lib/`; `44c311e0` (2026-07-10) wrote the old path. Re-ran catalog-diff: `135/135 byte-identical true`, which matches the generator logic line for line. Nuance: Phase 3 logs a `console.warn`, so the failure is not silent. `src/qc/publishAfterQc.ts:334,455` and `src/qc/auto/resolveBook.ts:26` also name the old path, but they resolve under PIPE's `REPO_ROOT` (always a dead path), so they are not part of this drift. |
| PP5 | PARTIAL | The reader and detail pages are DDB+S3 only, and `notFound()` is confirmed (`chapter/[chapterId]/page.tsx:10-60`, `[bookId]/page.tsx:9-37`, `bookChapters.ts:868-876`). But `register:api` alone is not enough for a full prototype. `ask` returns 404 without the S3 package `book-content/packages/<id>.v21.json` (`ask/route.ts:120-123`), and so does `audio`. The quiz falls back to ingest S3 questions with the non-strict count table (`quiz/route.ts:96-113`, `book-package-source.ts:37-50`). The DEV prototype needs `register:api` plus `upload-book-packages-to-s3`; neither needs a commit or deploy. |
| PP6 | PARTIAL | Reproduced here: the assembler output passes `validateBookPackage`, the reader-content check, taxonomy and the publish guard. The `tsx --test` trio gives 17/17, and `register-api-books --dry-run` prints `VALID`, exit 0. However, the hermetic `outer/` has no `scripts/book/generate-catalog-metadata.ts`, so the `register:catalog` step was a no-op ("generator not found"). The commit held 3 files, not the 4 promised in §4, and catalog regeneration (the step PP4 breaks) was never exercised. The proof also covers a 1-chapter package, not 19. |

**Missed (most important within the lens):** with PP4 unfixed, a new book in the DDB-served **in-app library** gets the canned boilerplate synopsis and no icon or cover. `library-catalog.ts:89` falls back to `boilerplateSynopsis(title)` ("…taught through chapter summaries, real-world scenarios, and quizzes you can apply right away."), because register-api-books Phase 3 (`register-api-books.ts:249-291`) is the only writer of `book-content/library/catalog.json` presentation entries, and it reads the retired path. So the curated `BOOK_PACKAGE_PRESENTATION` entry that §3.8 calls optional has **no effect** on the in-app surface until the path fix lands. Land the path fix before the first `register:api` for Franklin, or re-run `register:api` after it lands. Phase 3 only adds entries it does not already hold (`register-api-books.ts:263-265`), and a failed run adds none. The canned line is exactly what the DETAIL-BOILERPLATE-SYNOPSIS audit (`lib/library-catalog-stub.ts:110-135`) exists to catch.
