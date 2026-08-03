# v24 Deploy Runbook — clearing pending-deploy debt

**Audience:** operator who has just run `publish-final` (or sees a `pending-deploy`
warning in `doctor` / `book-status`).

**Why this exists.** `publish-final` deliberately ends at `git push` (the pipeline has
**no AWS/deploy authority** — a standing constraint). Pushing the repo does **not**
serve the new content: the prod server grades/asks/streams from the package in **S3**,
served by a **separate web deploy** — and the **API catalog the native iOS app reads is
a third surface again** (DynamoDB rows + per-version S3 artifacts, populated **only** by
`scripts/book/register-api-books.ts`, never by the web deploy). So a book can be
pipeline-"PUBLISHED" and still be **stale or absent in the live app** — or live on the
web yet **invisible to iOS** (37 books shipped that way before 2026-07-10) — until the
four manual steps below run.

`publish-final` records that owed work in a tracked sentinel,
`book-packages/.pending-deploy.json` (committed **into** the publish commit so it can't
be silently forgotten). `doctor` and `book-status` read it back and warn — loudly, and
more loudly past 24h. Nothing in the pipeline auto-deploys; this is the human-gated chain.

> **Two repos.** All paths below are relative to the **outer checkout root**
> (`~/ChapterFlow-books` — the Next.js web app), **not** the pipeline dir
> (`scripts/book/prompts/chapterflow-v24-author-pipeline/`). `cd` to the outer root first.

## The four steps

Run them in order, from the **outer checkout root**:

```sh
cd ~/ChapterFlow-books        # outer web-app repo, NOT the pipeline dir

# 1. Upload the package(s) to S3 (book-content/packages/<id>.v21.json).
#    Prod SERVER grading/ask/audio read from here.
BOOK_CONTENT_BUCKET=<bucket> AWS_REGION=us-east-1 \
  npx tsx scripts/book/upload-book-packages-to-s3.ts

# 2. Deploy the web app (bundles the tracked book-packages/*.v21.json and
#    re-points the app at the new catalog).
gh workflow run deploy.yml -f environment=prod -f deploy_app=true

# 3. Register the book in the API catalog — the surface the native iOS app reads.
#    Runs the PRODUCTION ingest path (validation, taxonomy gate, slug guard,
#    versioned S3 artifacts, DDB rows, publish) + covers + presentation/search
#    indexes. Idempotent (packageId); --dry-run to preview. SKIPPING THIS LEAVES
#    THE BOOK WEB-ONLY (invisible to iOS).
AWS_REGION=us-east-1 BOOK_TABLE_NAME=<table> \
  BOOK_CONTENT_BUCKET=<bucket> BOOK_INGEST_BUCKET=<ingest-bucket> \
  npm run register:api -- <bookId> [<bookId>…]

# 4. Verify every surface actually serves it — and clear the sentinel for
#    satisfied books.
npm run verify:live
```

For a targeted origin/bucket, step 4 accepts env overrides (the bucket also
enables the S3 + API-parity checks):

```sh
BOOK_CONTENT_BUCKET=<bucket> AWS_REGION=us-east-1 \
  CHAPTERFLOW_LIVE_ORIGIN=https://chapterflow.ca npm run verify:live
```

## What `verify:live` checks (per pending book)

`scripts/book/verify-live-sync.ts` (outer repo) is **read-only** and runs four checks
per pending entry, each reported `OK` / `FAIL` / `SKIPPED(reason)`:

- **(a) repo** — `sha256(book-packages/<id>.v21.json)` matches the entry's
  `packageSha256`. A mismatch means a **newer** publish; it then checks S3/app against
  the *current* repo file and reports the drift.
- **(b) S3** — `GetObject book-content/packages/<id>.v21.json` and sha256-compare to the
  current repo file. **SKIPPED** without AWS creds / bucket.
- **(c) app** — `GET <origin>/api/health` `.commit`; assert the last commit that touched
  the repo package is an **ancestor** of the deployed commit. **SKIPPED** without a
  resolvable origin.
- **(d) api** — `GET <origin>/app/api/book/books/<id>` is **200** (a `book_not_found`
  404 **FAILs**: the book is web-live but iOS-invisible — run `register-api-books`),
  and the served version's `manifest.json` `packageId` (read from S3, same creds as
  (b)) **matches the repo package's** — a mismatch FAILs: the API serves a **stale**
  version and needs a re-register. Parity is **SKIPPED** without AWS creds / bucket.

## What clears the sentinel

An entry with **all four checks OK — no FAIL, no SKIP —** is **SATISFIED**
— `verify:live` rewrites `book-packages/.pending-deploy.json` to drop it and prints a
suggested `git commit` line (**it never commits or pushes**). A skipped check leaves the
entry **pending** — `verify:live` never fakes success. When nothing pending remains it
exits 0; otherwise 1.

**Nothing else writes or clears the sentinel.** `publish-final` is the only writer;
`verify:live` is the only clearer. `doctor` / `book-status` are strictly read-only — they
surface the debt, they never touch it, deploy, or call `gh`/`aws`.

## Seeing the debt

- `npx tsx src/cli.ts doctor` (pipeline dir) — a `pending-deploy` warning per owed book,
  with age; escalated wording past 24h. A missing outer checkout reports **UNKNOWN**
  (still a warning — never a false "all clear"); a hand-mangled sentinel warns loudly
  rather than crashing.
- `npx tsx src/cli.ts book-status "<book>"` — prints the remaining steps for that one
  book if it appears in the sentinel; silent otherwise.
