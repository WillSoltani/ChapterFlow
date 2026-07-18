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

> The server Lambda's IAM is **scoped to read SSM only under `/chapterflow/<env>/*`**.
> Any new config the app resolves via `getServerEnv()` must therefore live at
> `/chapterflow/<env>/<KEY>` — a bare-name parameter (`/<KEY>`) is denied and
> skipped. Secrets normally arrive as Lambda env vars (see `infra/bin/app.ts`);
> SSM is the fallback for SSM-only config like `SES_SENDER_EMAIL` / `VAPID_*`.

## 3) Health checks

- **`GET /api/health`** — public, unauthenticated, dependency-free; returns
  `200 {status, env, commit, time}`. This is the deploy gate's primary probe.
- **`GET /api/health?deep=1`** — additionally probes the subsystems the app
  depends on and reports each in `checks{}`: **dynamo** (operational table
  reachable), **catalog** (the published library list builds), **content** (S3
  content bucket reachable), **billing** (Stripe secret/webhook + pricing config
  present), **auth** (Cognito OAuth config present). Non-throwing — always
  returns `200` with `status: "ok" | "degraded"`, so a transient dependency blip
  never false-fails a deploy. Use it for uptime monitors and manual diagnosis.
- The deploy pipeline asserts `/`, `/pricing`, `/api/health` return 2xx
  (**blocking** gate), then runs `?deep=1` as a **non-blocking** smoke step that
  tables the per-check results into the run summary.

## 4) Monitoring & alerting

CloudWatch alarms publish to one or both of two SNS topics (WS6-034):

- **`ChapterFlowOpsAlerts[-env]`** — the original ticket-grade topic. Every
  alarm in both stacks sends here; subscribe an inbox via the
  `CHAPTERFLOW_OPS_ALERT_EMAIL` secret at synth time, then confirm the
  subscription.
- **`ChapterFlowOpsCritical[-env]`** — the paging topic, added ADDITIVELY on
  top of the topic above. A small "needs a human NOW" subset of alarms (the
  severity table below) publishes to **both** topics — the existing inbox
  never loses visibility. Subscribe a pager by setting
  `CHAPTERFLOW_OPS_PAGER_URL` (an `https://` PagerDuty / Opsgenie / ntfy
  webhook) and/or `CHAPTERFLOW_OPS_CRITICAL_ALERT_EMAIL` at synth time.

The frontend stack references both topics **by ARN** (same convention as the
`ChapterFlow/Ops` custom metrics below), so alarms from both stacks route
through the same two topics.

For the reliability *targets* these alarms defend — the 99.9% edge-availability
SLO, its 43.2 min/month error budget, the multi-window burn-rate pages
(`ChapterFlowSloFastBurn` / `ChapterFlowSloSlowBurn`), and the error-budget
policy — see [SLOS.md](./SLOS.md).

**Backend stack** (`infra/lib/chapterflow-backend-stack.ts`):

- **App / analytics table throttling** — any throttled DynamoDB op in a 5-min
  window.
- **`ChapterFlow/Ops → OpsFailure`** — an operational failure was recorded
  (Stripe cancellation / customer delete, Cognito delete, or partial account
  erasure; the `kind` dimension says which). Follow up in the admin Ops dashboard
  (Operational failures panel) → `/app/api/book/admin/ops-failures`.

**Frontend stack** (`infra/lib/chapterflow-frontend-stack.ts`):

- **Server Lambda** — `Errors` (≥5 / 5 min), `Throttles` (≥1), `Duration` p99
  ≥20s (early warning below the 45s timeout).
- **ISR revalidation** — revalidation-fn `Errors`, **DLQ depth ≥1** (revalidation
  is failing; messages redrive after 5 receives), and oldest-message age >5 min.
- **CloudFront `5xxErrorRate` >1%** sustained ~15 min.
- **`ChapterFlow/Ops → StripeWebhookFailure`** — a Stripe webhook delivery failed
  to process *after* signature verification (Stripe will retry). Check the
  billing webhook logs and the reconciliation tool.

> **Custom `ChapterFlow/Ops` metrics are emitted with a dimensionless rollup**
> (what the alarms watch) **plus** a dimensioned copy for per-cause slicing — see
> `putOpsMetric` in `_lib/cloudwatch-metrics.ts`. Do **not** "simplify" it to a
> dimensions-only emit: CloudWatch does not roll dimensioned datapoints into the
> dimensionless series, so the alarms would silently stop firing.

The server Lambda and the three backend Lambdas (reminder / suppression /
pre-signup) run with X-Ray **ACTIVE** tracing so a slow request (e.g. the
`Duration` p99 alarm above) can be broken down by hop in the X-Ray service map;
cost is bounded by X-Ray's default sampling (1 req/s reservoir + 5% of the
overflow) with no custom sampling rule.

Signals worth watching in CloudWatch Logs / metrics: server-fn 5xx and duration
p95, DynamoDB throttles, and the per-day analytics EVENT volume.

### Alarm severity

CRITICAL alarms page both topics; WARNING alarms stay on the ticket-grade
topic only (async, retried, and/or DLQ-backed — no need to wake anyone).

| Alarm | Severity |
|---|---|
| `ChapterFlowAppTableThrottlesAlarm` | CRITICAL |
| `ChapterFlowAnalyticsTableThrottlesAlarm` | CRITICAL |
| `ChapterFlowOpsFailureAlarm` | CRITICAL |
| `ChapterFlowCognitoPreSignUpErrorsAlarm` | CRITICAL — blocks Sign in with Apple, fails closed |
| `ChapterFlowReminderErrorsAlarm` | WARNING — async, DLQ-backed |
| `ChapterFlowReminderDurationAlarm` | WARNING — async, DLQ-backed |
| `ChapterFlowSuppressionErrorsAlarm` | WARNING — async, DLQ-backed |
| `ServerFnErrorsAlarm` | CRITICAL |
| `ServerFnThrottlesAlarm` | CRITICAL |
| `ServerFnDurationAlarm` | WARNING — early-warning threshold, below the hard timeout |
| `RevalidationFnErrorsAlarm` | WARNING — async, DLQ-backed |
| `RevalidationDlqDepthAlarm` | CRITICAL |
| `RevalidationQueueAgeAlarm` | WARNING — async, DLQ-backed |
| `CloudFront5xxAlarm` | CRITICAL |
| `StripeWebhookFailureAlarm` | CRITICAL |
| `ChapterFlowSloFastBurn` (composite) | CRITICAL — budget exhausted in ~50h |
| `ChapterFlowSloSlowBurn` (composite) | WARNING — budget exhausted in ~5 days |

### On-call & escalation

ChapterFlow is solo-operated — the owner is the only on-call. Ack
expectations:

- **CRITICAL** — act within 15 minutes of the page.
- **WARNING** — triage at the next working session; no off-hours expectation.

**Escalation:** a CRITICAL page that goes unacked re-pages through the pager
service's own escalation policy (configure repeat/escalate rules in
PagerDuty/Opsgenie/ntfy itself — SNS just delivers the initial webhook). The
pager integration is wired at deploy by setting `CHAPTERFLOW_OPS_PAGER_URL`;
with it unset, CRITICAL alarms still page the ticket-grade email topic, but
nothing pages off-hours.

## 5) Deploy & rollback runbook

**Deploy:** see [CI_CD.md §3](./CI_CD.md). prod requires approval. Deploy
**through GitHub Actions**, not a local `cdk deploy` — the CI infra job injects
synth-time secrets the stacks depend on. In particular, each of these
subscriptions is created only when its var is set at synth — an unset var
**deletes that subscription and silences that channel**:

- `CHAPTERFLOW_OPS_ALERT_EMAIL` — the ticket-grade topic's email subscription.
- `CHAPTERFLOW_OPS_CRITICAL_ALERT_EMAIL` — the paging topic's email subscription.
- `CHAPTERFLOW_OPS_PAGER_URL` — the paging topic's webhook (PagerDuty/Opsgenie/ntfy)
  subscription.

So a local backend deploy without these exported **deletes those subscriptions
and silences those channels**. (A local `cdk diff` is read-only — it will
*show* a subscription as a delete when its var is unset, but applies nothing.)

**Before a prod deploy**, confirm no stateful resource will be replaced. The
**backend** (data-bearing) stack synthesizes standalone:

```bash
cd infra
# The frontend stack is skipped when .open-next/ is absent. If you have a stale
# local .open-next/ build, pass -c skipFrontend=true so the backend diffs alone
# without demanding bucket names (the deploy workflow never sets this flag):
npx cdk diff -c env=prod -c skipFrontend=true ChapterFlowBackend
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
| OpsFailure alarm fired | Admin Ops dashboard → Operational failures → retry or resolve (the `kind` dimension says which subsystem). |
| Revalidation DLQ alarm fired | ISR revalidation is failing — check the `ChapterFlowRevalidation[-env]` DLQ + revalidation-fn logs; messages redrive after 5 receives. |
| StripeWebhookFailure alarm fired | A delivery failed post-signature; Stripe retries. Check billing webhook logs + `/app/api/book/admin/reconciliation`. |
| Table throttling alarm | Inspect hot partitions / unbounded scans (admin metrics, soft-decay); the table is on-demand so this usually self-heals. |

## 7) Security checklist

- Keep all buckets private (covers prefix is the only public read); enforce SSL.
- Secrets are injected as Lambda env at deploy from environment-scoped GitHub
  secrets — never commit them. Editor swap files (`*.swp`) are gitignored.
- Runtime IAM is least-privilege: the server Lambda's SSM read is scoped to
  `/chapterflow/<env>/*` and SES send is scoped to the verified domain identity
  (prod). `dynamodb:Scan` is retained only because admin metrics / economy-health
  / soft-decay run in the same Lambda — scope it to the two table ARNs and revisit
  if those move to a dedicated function.
- Every new API route must call `requireUser()` / `requireAdminUser()` — auth is
  per-route, not global.
- Quizzes are graded server-side; never trust client-supplied scores/ids.
