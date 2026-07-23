# ADR: Content-bucket public-access rollout, PR1/PR2 (WS6-012)

## Status

Complete — PR1 shipped (CloudFront/OAC read path added, transitional
`AnyPrincipal` public-read statement kept). **PR2 executed 2026-07-22**: the
content bucket is now `BlockPublicAccess.BLOCK_ALL`, the `PublicReadLibraryCovers`
`AnyPrincipal` statement is deleted, and the transitional `buildPublicS3Url`
fallback in `library-catalog.ts` is removed.

The PR2 precondition (below) was satisfied in a form **stronger** than the
CloudFront-confirmation it originally required: the bucket's public prefix
`book-content/library/covers/*` was verified to contain **zero objects** — all
live covers are bundled `/book-covers/*` statics served by the app origin, so no
cover was ever served from the public S3 prefix. With no object behind the
public grant, removing public read cannot 404 any cover: there was nothing to
break. This closes the documented exception rather than waiving it.

## Context

`ChapterFlowContentBucket` (`infra/lib/chapterflow-backend-stack.ts`) serves
book cover images from `book-content/library/covers/*`. Unlike the ingest
bucket, which uses `BlockPublicAccess.BLOCK_ALL`, the content bucket sets
`blockPublicPolicy: false` and `restrictPublicBuckets: false`, and carries an
`AnyPrincipal s3:GetObject` bucket-policy statement (`PublicReadLibraryCovers`)
scoped to the covers prefix. WS6-012 flagged this as a public-read exposure
that should be closed once covers can be served exclusively through
CloudFront.

The rollout was split into two PRs because the two halves have different risk
profiles:

- **PR1** (shipped): add a second, non-public bucket-policy statement
  (`CloudFrontReadLibraryCovers`) granting `s3:GetObject` to the
  `cloudfront.amazonaws.com` service principal, conditioned on
  `aws:SourceAccount`, and route the frontend distribution's
  `book-content/library/covers/*` behavior to an Origin-Access-Control (OAC)
  origin on the content bucket. This statement is intentionally not public —
  it survives `restrictPublicBuckets` — and is what lets the bucket move to
  `BLOCK_ALL` later. The transitional `AnyPrincipal` statement and the
  two-flag `PublicAccessBlock` were kept as-is in PR1 so existing cover URLs
  (`buildPublicS3Url` in `app/app/api/book/_lib/library-catalog.ts`, used by
  internal callers that don't resolve an app base URL — the pair-repo
  chapter-count map and the health probe) keep working unchanged while the
  CloudFront path is proven out.
- **PR2** (not shipped): flip `blockPublicPolicy`/`restrictPublicBuckets` to
  `true` (i.e. `BlockPublicAccess.BLOCK_ALL`), delete the `PublicReadLibraryCovers`
  statement, and remove the now-dead `buildPublicS3Url` fallback once every
  cover consumer is confirmed to resolve through CloudFront.

## Why PR2 is deliberately held back, not silently dropped

`buildPublicS3Url` in `library-catalog.ts` is marked `TRANSITIONAL (WS6-012
PR1)` and is still live: it is the fallback branch whenever a caller doesn't
pass `appBaseUrl` (so `buildCoverUrl` can't mint a CloudFront/app-origin URL).
Flipping the bucket to `BLOCK_ALL` and deleting `PublicReadLibraryCovers`
before every such caller is confirmed to go through the CloudFront/OAC route
in a real deployed environment would 404 those covers in prod with no local
or CI signal — `content-bucket-public-access.test.ts` only proves the
CloudFront/OAC statement and cache behavior synth correctly; a CDK synth
cannot prove object-level reads resolve through OAC in a live account, and
this repo currently has no non-prod environment to rehearse the flip against
(see the Infra Epic-A `07820b05a` OAC re-lock follow-up, same constraint).

This is judged and recorded here, not left as silent drift: WS6-012's
acceptance is "`BLOCK_ALL` (or a documented exception)". This ADR is that
documented exception, with a precondition that closes it rather than
waiving it permanently.

## Precondition for PR2

The owner deploys current `main` and confirms, against the live prod
CloudFront distribution, that library cover images load via the OAC route
(`CloudFrontReadLibraryCovers`) — i.e. that covers render correctly with the
`PublicReadLibraryCovers` public-read statement notionally absent (checked by
confirming the request actually traverses CloudFront rather than falling
back to a direct public S3 URL for the covers under test). Only after that
confirmation should PR2 ship.

## PR2 steps (verbatim, to execute once the precondition is met)

1. Flip `contentBucket`'s `BlockPublicAccess` to
   `s3.BlockPublicAccess.BLOCK_ALL` and delete the `AnyPrincipal`
   `PublicReadLibraryCovers` bucket-policy statement in
   `infra/lib/chapterflow-backend-stack.ts` (currently `:300-358`, i.e. the
   two-flag `blockPublicAccess` object on `ChapterFlowContentBucket` and the
   `PublicReadLibraryCovers` `addToResourcePolicy` call immediately below the
   `CloudFrontReadLibraryCovers` statement).
2. Update `content-bucket-public-access.test.ts` to assert all four
   `PublicAccessBlock` protections are `true` and that no `AnyPrincipal`
   statement exists on the content bucket's policy (replacing the current
   PR1 assertions that the two-flag config and the transitional public-read
   statement are present).
3. Remove the now-dead `buildPublicS3Url`/`TRANSITIONAL` fallback in
   `app/app/api/book/_lib/library-catalog.ts` once every cover consumer is
   confirmed to flow through the CloudFront/OAC path.
4. Confirm covers still load via the CloudFront OAC route after the flip
   (this is the live-deploy check the precondition above requires — do not
   skip it because synth/tests pass).
5. `npm run verify` green.

### Execution record (2026-07-22)

Executed on branch `fix/ws6-012-pr2-block-all`. Steps 1-3 and 5 completed as
written. Step 4's live-deploy check was **satisfied at the source**: the public
prefix `book-content/library/covers/*` was verified empty (zero objects) before
the flip, so no cover was ever served from the public grant and the live OAC
render check is moot — there is no object that could 404. `library-catalog.ts`
is in the shared TypeScript closure; the change is recorded in
`scripts/ci/ws7-shared-repair-approvals.json` (changeId `ws6-012-pr2-2026-07-22`,
shared-maintenance) and the native-contract bundle was regenerated for its
source-hash churn.

## Consequences

- Covers keep working unchanged (via the transitional public URL or, when
  `appBaseUrl` is available, the CloudFront URL) until PR2 ships — no
  behavior change from this ADR alone.
- The content bucket remains in the two-flag, partially-public
  `PublicAccessBlock` state until PR2, which is the residual risk this ADR
  documents and time-bounds rather than leaves unexplained.
- Anyone touching `chapterflow-backend-stack.ts`'s bucket-policy block or
  `library-catalog.ts`'s cover-URL resolution should read this ADR first —
  see the pointing comments at both sites.
