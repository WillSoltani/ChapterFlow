# Operations Guide

Operating the ChapterFlow web app. For how it gets deployed, see
[CI_CD.md](./CI_CD.md); for the system layout, see [ARCHITECTURE.md](./ARCHITECTURE.md).

## 1) Production topology

```
Browser
  → CloudFront (custom domain or *.cloudfront.net)
  → Lambda Function URL (OpenNext server fn, RESPONSE_STREAM)
  → Next.js route handlers (app/app/api/book/**)
      → DynamoDB  (main table + analytics table)
      → S3        (book content / ingest buckets)
      → Stripe · Cognito · Anthropic · ElevenLabs
```

- **Compute:** OpenNext on AWS Lambda (server, image, revalidation, warmer fns)
  behind CloudFront. No servers, no Step Functions.
- **State:** single-table DynamoDB (`ChapterFlowApp`) + analytics table
  (`ChapterFlowInsights`, GSIs); book prose in S3; config in SSM.
- **Auth:** Cognito Hosted UI (OAuth2 + PKCE); `requireUser()` verifies the
  ID-token JWT per route.

## 2) Environments

Three environments in one account, suffixed (`dev` / `staging` / `prod`). prod is
the unsuffixed, data-bearing set (`ChapterFlowApp`, `ChapterFlowServer`, …) and
is RETAIN + deletion-protected + PITR. See [CI_CD.md §2](./CI_CD.md). Each env's
config lives at `/chapterflow/<env>/*` in SSM and is read by the running Lambda.

## 3) Health checks

- **`GET /api/health`** — public, unauthenticated, dependency-free; returns
  `200 {status, env, commit, time}`. This is the deploy gate's primary probe.
- **`GET /api/health?deep=1`** — additionally probes DynamoDB reachability and
  reports it in the body, but still returns 200 (never false-fails on a blip).
- The deploy pipeline also asserts `/` and `/pricing` return 2xx.

## 4) Monitoring & alerting

CloudWatch alarms defined in `infra/lib/chapterflow-backend-stack.ts` publish to
the `ChapterFlowOpsAlerts` SNS topic (subscribe an inbox via the
`CHAPTERFLOW_OPS_ALERT_EMAIL` secret, then confirm the subscription):

- **App / analytics table throttling** — any throttled DynamoDB op in a 5-min
  window.
- **`ChapterFlow/Ops StripeCancellationFailure`** — a Stripe cancellation failed
  during account delete/deactivate. Follow up in the admin Ops dashboard
  (Operational failures panel) → `/app/api/book/admin/ops-failures`.

Signals worth watching in CloudWatch Logs / metrics: server-fn 5xx and duration
p95, DynamoDB throttles, and the per-day analytics EVENT volume.

## 5) Deploy & rollback runbook

**Deploy:** see [CI_CD.md §3](./CI_CD.md). prod requires approval.

**Before a prod deploy**, confirm no stateful resource will be replaced. The
**backend** (data-bearing) stack synthesizes standalone:

```bash
cd infra
# Backend synthesizes without an OpenNext build (frontend is skipped when
# .open-next/ is absent), so run this in a clean checkout:
npx cdk diff -c env=prod ChapterFlowBackend
# Expect: NO replace/delete on DynamoDB tables or S3 buckets.

# The FRONTEND stack additionally needs the OpenNext build + bucket names:
npx open-next build   # from the repo root
export BOOK_INGEST_BUCKET=$(aws ssm get-parameter --name /chapterflow/prod/BOOK_INGEST_BUCKET --query Parameter.Value --output text)
export BOOK_CONTENT_BUCKET=$(aws ssm get-parameter --name /chapterflow/prod/BOOK_CONTENT_BUCKET --query Parameter.Value --output text)
npx cdk diff -c env=prod ChapterFlowFrontend
```

**Rollback:** OpenNext bundles are immutable per commit, so:

1. `Actions → Deploy → Run workflow`, set `environment` and run it on the **last
   known-good commit/tag** → redeploys the prior Lambda + assets.
2. CloudFront is invalidated automatically by the deploy.
3. **Stateful resources (DynamoDB/S3) are RETAINed and are NOT rolled back** by
   an app redeploy — a data migration needs its own forward-fix.

## 6) Common failure modes

| Symptom | Check |
|---|---|
| Deploy fails the health gate | Run summary lists the failing path; check the `ChapterFlowServer[-env]` Lambda logs in CloudWatch. |
| 401 HTML redirect on an API call | Caller hit a `/app/**` route without a session — middleware redirects to login (APIs should send the auth cookie). |
| Frontend deploy throws "requires BOOK_INGEST_BUCKET…" | Backend stack for that env not deployed yet (no SSM params). Deploy infra first. |
| Stripe cancellation alarm fired | Admin Ops dashboard → Operational failures → retry or resolve. |
| Table throttling alarm | Inspect hot partitions / unbounded scans (admin metrics, soft-decay); the table is on-demand so this usually self-heals. |

## 7) Security checklist

- Keep all buckets private (covers prefix is the only public read); enforce SSL.
- Secrets are injected as Lambda env at deploy from environment-scoped GitHub
  secrets — never commit them. Editor swap files (`*.swp`) are gitignored.
- Every new API route must call `requireUser()` / `requireAdminUser()` — auth is
  per-route, not global.
- Quizzes are graded server-side; never trust client-supplied scores/ids.
