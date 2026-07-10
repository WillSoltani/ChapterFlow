# v24 Deploy Runbook — clearing pending-deploy debt

**Audience:** operator who has just run `publish-final` (or sees a `pending-deploy`
warning in `doctor` / `book-status`).

**Why this exists.** `publish-final` deliberately ends at `git push` (the pipeline has
**no AWS/deploy authority** — a standing constraint). Pushing the repo does **not**
serve the new content: the prod server grades/asks/streams from the package in **S3**,
served by a **separate web deploy**. So a book can be pipeline-"PUBLISHED" and still be
**stale or absent in the live app** until the three manual steps below run.

`publish-final` records that owed work in a tracked sentinel,
`book-packages/.pending-deploy.json` (committed **into** the publish commit so it can't
be silently forgotten). `doctor` and `book-status` read it back and warn — loudly, and
more loudly past 24h. Nothing in the pipeline auto-deploys; this is the human-gated chain.

> **Two repos.** All paths below are relative to the **outer checkout root**
> (`~/ChapterFlow-books` — the Next.js web app), **not** the pipeline dir
> (`scripts/book/prompts/chapterflow-v24-author-pipeline/`). `cd` to the outer root first.

## The three steps

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

# 3. Verify the app actually serves it — and clear the sentinel for satisfied books.
npm run verify:live
```

For a targeted origin/bucket, step 3 accepts env overrides:

```sh
BOOK_CONTENT_BUCKET=<bucket> AWS_REGION=us-east-1 \
  CHAPTERFLOW_LIVE_ORIGIN=https://chapterflow.ca npm run verify:live
```

## What `verify:live` checks (per pending book)

`scripts/book/verify-live-sync.ts` (outer repo) is **read-only** and runs three checks
per pending entry, each reported `OK` / `FAIL` / `SKIPPED(reason)`:

- **(a) repo** — `sha256(book-packages/<id>.v21.json)` matches the entry's
  `packageSha256`. A mismatch means a **newer** publish; it then checks S3/app against
  the *current* repo file and reports the drift.
- **(b) S3** — `GetObject book-content/packages/<id>.v21.json` and sha256-compare to the
  current repo file. **SKIPPED** without AWS creds / bucket.
- **(c) app** — `GET <origin>/api/health` `.commit`; assert the last commit that touched
  the repo package is an **ancestor** of the deployed commit. **SKIPPED** without a
  resolvable origin.

## What clears the sentinel

An entry with **all runnable checks OK and neither (b) nor (c) SKIPPED** is **SATISFIED**
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
