# Environment & Configuration Reference

The complete environment-variable matrix for the ChapterFlow web app, across
**local / dev / staging / prod**. For *how* a deploy wires these up see
[CI_CD.md](./CI_CD.md); for the launch runbook see
[LAUNCH_CHECKLIST.md](./LAUNCH_CHECKLIST.md).

> Scope: the live Next.js web app (`app/`, `lib/`, `middleware.ts`) and its CDK
> infra (`infra/`). The offline v21 content pipeline (`scripts/**`) has its own
> config and is out of scope here.

---

## 1) How configuration resolves at runtime

The running app (the OpenNext **server Lambda**) reads config through
[`getServerEnv()` / `mustServerEnv()`](../app/app/api/_lib/server-env.ts), which
resolves each key in this order:

1. **`process.env[KEY]`** — set directly on the Lambda. Two sub-channels:
   - **CDK auto-injects** the data-plane names + app mode (always present, no
     secret needed) — see §3.A.
   - **The deploy workflow injects secrets** it forwards from GitHub
     environment secrets into `infra/bin/app.ts` → the frontend stack's
     `serverEnv` → the Lambda — see §3.B. **This list is the source of truth**
     for "secrets the app gets": [`infra/bin/app.ts`](../infra/bin/app.ts) lines
     81–141.
2. **SSM Parameter Store**, tried as `${SSM_PARAMETER_PREFIX}/<KEY>` (e.g.
   `/chapterflow/prod/VAPID_PRIVATE_KEY`) first, then bare-name fallbacks
   (denied by IAM scope, harmlessly skipped). The Lambda role is scoped to
   `${ssmPrefix}/*` only ([frontend stack](../infra/lib/chapterflow-frontend-stack.ts)).

**Consequence that bites:** anything **not** injected as Lambda env in §3.A/§3.B
*only* works if it exists as an SSM parameter under `/chapterflow/<env>/`. That
is the case for **`VAPID_*`, `SES_SENDER_EMAIL`**, and the optional tuning vars
(§3.D). A handful of vars are read via **raw `process.env` with no SSM
fallback** (`ADMIN_EMAILS`, `ADMIN_SUBS`, `APP_BASE_URL`, the `NEXT_PUBLIC_*`
build-time vars) — those only take effect if they are literally on the Lambda
env (or inlined at build), so since the pipeline doesn't inject them they are
effectively **local/dev-only today** (§3.E).

Locally, `npm run dev` sets the single-host + `DEV_AUTH_BYPASS=1` envs inline
(see `package.json`), so the UI loads with no AWS. To exercise **real data**
locally you still need the data vars + AWS credentials (§4).

---

## 2) Quick legend

| Mark | Meaning |
|------|---------|
| **R** | Required for that surface to work in a deployed env |
| **O** | Optional (has a safe default or only enables an extra feature) |
| **auto** | CDK injects automatically; you do not set it |
| **secret** | Supply as a GitHub **environment** secret (per env) |
| **ssm** | Supply as an SSM param `/chapterflow/<env>/<KEY>` (not injected by the workflow) |
| **local** | Only consulted in local/dev or at build time; not wired into deployed Lambdas |

---

## 3) The matrix

### A. Data plane & app mode — CDK auto-injected (§ `commonEnv`)

You never set these; the frontend stack derives them from the backend stack.

| Variable | Req | Source | Purpose |
|---|---|---|---|
| `BOOK_TABLE_NAME` | R | auto | Main single-table DynamoDB (`ChapterFlowApp[-env]`). |
| `BOOK_ANALYTICS_TABLE_NAME` | R | auto | Analytics/events table (`ChapterFlowInsights[-env]`). Missing → admin metrics silently degrade. |
| `BOOK_CONTENT_BUCKET` | R | auto | S3 bucket holding published book content (manifests, chapters, quizzes). |
| `BOOK_INGEST_BUCKET` | R | auto | S3 bucket for admin upload/ingest staging. |
| `SSM_PARAMETER_PREFIX` | R | auto | `/chapterflow/<env>` — the namespace `getServerEnv` reads SSM from. |
| `CHAPTERFLOW_ENV` | R | auto | `dev` \| `staging` \| `prod`. Surfaced in `/api/health`. |
| `CHAPTERFLOW_DEPLOYMENT_MODE` | R | auto | Hardcoded `standalone` (single-host mode). |
| `NODE_ENV` | R | auto | `production` in deployed envs. Gates dev bypass + base-URL fallbacks. |
| `CACHE_BUCKET_NAME`, `CACHE_BUCKET_KEY_PREFIX`, `CACHE_DYNAMO_TABLE`, `REVALIDATION_QUEUE_URL`, `REVALIDATION_QUEUE_REGION` | R | auto | OpenNext ISR/revalidation internals (not app config). |

### B. Secrets injected by the deploy workflow (`serverEnv` in `app.ts`)

Set each as a **per-environment GitHub secret**. The frontend deploy job
(`_deploy-app.yml`) passes them on the `cdk deploy` step; `app.ts` forwards only
the ones that are present.

| Variable | Req | Source | Purpose |
|---|---|---|---|
| `CHAPTERFLOW_APP_BASE_URL` | **R (prod)** | secret | Canonical app origin. **In prod, `getAppBaseUrl()` throws if unset** (refuses to fall back to the request host — Stripe redirects depend on it). |
| `CHAPTERFLOW_COMMIT_SHA` | O | secret (`github.sha`) | Build stamp shown by `/api/health`. |
| `COGNITO_DOMAIN` | R | secret | Cognito Hosted UI origin (authorize/token/logout). |
| `COGNITO_CLIENT_ID` | R | secret | OAuth app-client id; also the **JWT `aud`** verified per request. |
| `COGNITO_USER_POOL_ID` | R | secret | Issuer/JWKS resolution + admin user-erasure (`AdminDeleteUser`). Also needed at **synth** to scope the erasure IAM policy (§ LAUNCH_CHECKLIST). |
| `COGNITO_REGION` | R | secret | Region for the Cognito issuer/JWKS. |
| `COGNITO_REDIRECT_URI` | R | secret | OAuth callback URL (`…/auth/callback`). Must be allow-listed in Cognito. |
| `COGNITO_LOGOUT_REDIRECT_URI` | R | secret | Post-logout redirect. Must be allow-listed in Cognito. |
| `AUTH_STATE_SECRET` | R | secret | HKDF key for AES-256-GCM OAuth-state encryption. **Must be ≥ 32 chars** or login state crypto throws. |
| `AUTH_COOKIE_DOMAIN` | R | secret | Cookie `Domain` for the session cookies (e.g. `.chapterflow.ca`). The cookie helper also honors the alias `CHAPTERFLOW_COOKIE_DOMAIN`, but that alias is **not** injected by the workflow — it would have to come from SSM (§3.D), so prefer `AUTH_COOKIE_DOMAIN`. |
| `BOOK_STRIPE_SECRET_KEY` | R (billing) | secret | Stripe API key. Without it, billing routes are inert. |
| `BOOK_STRIPE_WEBHOOK_SECRET` | R (billing) | secret | Verifies the unauthenticated `billing/webhook` signature — the only writer of Stripe-sourced entitlements. |
| `BOOK_STRIPE_PRICE_ID` | R (billing) | secret | Monthly Pro price id used by checkout. |
| `BOOK_STRIPE_PRICE_ID_ANNUAL` | O | secret | Annual price id (if offered). |
| `BOOK_STRIPE_PRICE_ID_ANNUAL_UPFRONT` | O | secret | Annual-upfront price id (if offered). |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | O | secret | Client publishable key. **Caveat:** as a `NEXT_PUBLIC_*` var it is inlined at **build**; it is currently passed on the `cdk deploy` step (after `open-next build`), so confirm it is present during the build if you rely on client-side inlining. |
| `ANTHROPIC_API_KEY` | R (AI) | secret | Powers the in-reader "Ask" feature (Claude). |
| `ELEVENLABS_API_KEY` | O | secret | Chapter audio / TTS narration. Audio routes 4xx without it. |

### C. Infra / CI secrets — used at deploy time only (not app runtime)

| Variable | Req | Source | Purpose |
|---|---|---|---|
| `AWS_DEPLOY_ROLE_ARN` | R | secret | OIDC role the workflows assume. |
| `AWS_ACCOUNT_ID` | R | secret | `CDK_DEFAULT_ACCOUNT` for synth. |
| `CHAPTERFLOW_DOMAIN_NAME` | O (R for prod custom domain) | secret | Apex/custom domain → ACM cert + Route53. **Must be a per-env secret** — a repo-level value would let dev/staging overwrite prod DNS (env-config has a hard guard that throws if a non-prod env resolves to the prod apex). |
| `CHAPTERFLOW_OPS_ALERT_EMAIL` | R (ops) | secret | Email subscribed to the `ChapterFlowOpsAlerts` SNS topic (table-throttle + Stripe-cancellation-failure alarms). **Confirm the SNS subscription after first deploy or alerts never fire.** |
| `WEB_ALLOWED_ORIGINS` | O | secret | Allowed origins consumed by the backend stack. |
| `AWS_REGION` / `AWS_DEFAULT_REGION` | O | auto/runtime | Region, defaults to `us-east-1`. |

### D. App runtime config read from **SSM only** (workflow does NOT inject)

These are consumed by the app via `getServerEnv` but are **not** in
`serverEnv`. To enable them in a deployed env, create the SSM parameter
`/chapterflow/<env>/<KEY>` (SecureString for secrets).

| Variable | Req | Source | Purpose |
|---|---|---|---|
| `VAPID_PUBLIC_KEY` | R (web push) | ssm | Web-push public VAPID key. Push routes throw "VAPID keys not configured" without it. |
| `VAPID_PRIVATE_KEY` | R (web push) | ssm (SecureString) | Web-push private VAPID key. |
| `SES_SENDER_EMAIL` | R (email) | ssm | From-address for transactional/notification email — **honored only by the app server Lambda** (`notifications-repo.ts`, via SSM). ⚠ The backend **reminder-cron Lambda ignores this param** and sends from a hardcoded `info@chapterflow.ca` (`chapterflow-backend-stack.ts`); the SES IAM identity is scoped to the `chapterflow.ca` domain. The real launch action is to **verify the sender's domain identity in SES**, not just set this param. |
| `BOOK_ADMIN_GROUP` | O | ssm | Cognito group that grants admin (default `admin`). |
| `BOOK_FREE_SLOTS_DEFAULT` | O | ssm | Free-tier book slots (default `2`). |
| `BOOK_PAYWALL_PRICE` | O | ssm | Display price string; falls back to `lib/pricing` `MONTHLY_PRICE_PER_MONTH`. |
| `BOOK_ENABLE_SOFT_DECAY` | O | ssm | Feature flag for points/engagement soft-decay. |
| `COGNITO_CUSTOM_DOMAIN` | O | ssm | Custom Hosted-UI domain; preferred over `COGNITO_DOMAIN` when set. |

### E. Local / build-time only — raw `process.env`, no SSM fallback

| Variable | Req | Source | Purpose |
|---|---|---|---|
| `DEV_AUTH_BYPASS` | local | local | `=1` (non-prod only) short-circuits all auth with a synthetic user. Set by `npm run dev`. |
| `APP_BASE_URL` | O (recommended) | local | Explicit override for the origin used by `getServerOrigin()` (share cards, OAuth return-to, `app/_lib/site-url.ts`, `app/auth/_lib/return-to.ts`). **Read via raw `process.env` — not in `serverEnv`, no SSM fallback — so the current pipeline cannot inject it into a deployed Lambda** (same trap as `ADMIN_EMAILS`). When unset, the origin is **derived from the request `x-forwarded-host`** (correct behind CloudFront); `resolvePublicOrigin()` only throws `Unable to resolve public origin. Set APP_BASE_URL for production.` in a context with no host header. Loopback values are ignored in prod. Distinct from `CHAPTERFLOW_APP_BASE_URL` (the book-API helper, which **is** injected and hard-required in prod). To pin it in prod, add it to `serverEnv` in `infra/bin/app.ts`. |
| `ALLOW_APP_BASE_URL_IN_DEV` | local | local | `=1` lets a non-prod build honor a loopback `APP_BASE_URL`. |
| `NEXT_PUBLIC_ANALYTICS_ID` | O | local/build | Enables the lightweight client analytics shim (`lib/analytics.ts`); the shim no-ops when unset. |
| `NEXT_DIST_DIR` | local | local | Build output dir (`.next-chapterflow` in dev). |
| `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_CHAPTERFLOW_SITE_URL`, `NEXT_PUBLIC_CHAPTERFLOW_APP_URL`, `NEXT_PUBLIC_CHAPTERFLOW_AUTH_URL` | O | local/build | Public origins inlined at **build** time. In standalone single-host mode they collapse to one origin; set them at build if you need client-side absolute URLs. |
| `CHAPTERFLOW_SITE_BASE_URL`, `CHAPTERFLOW_AUTH_BASE_URL` | O | local | Server site/auth origins. In standalone mode they default to the app origin via `app/_lib/chapterflow-brand.ts`. |
| `ADMIN_EMAILS`, `ADMIN_SUBS` | O | local | A **secondary** admin gate on `app/book/settings/page.tsx` only, read via raw `process.env` (no SSM fallback). **Not injected into the Lambda** → effectively inert in deployed envs. The **real** admin gate is the Cognito group (`BOOK_ADMIN_GROUP`). |
| `SECURE_DOC_TABLE` | n/a | — | Belongs to the sibling "Cloud Portfolio" product (`app/app/api/_lib/aws.ts`); **not used by ChapterFlow**. |

---

## 4) Per-environment guidance

### Local (`npm run dev`)
- `npm run dev` injects standalone single-host localhost URLs + `DEV_AUTH_BYPASS=1`,
  so the UI loads with **no AWS and no login**.
- To hit **real data locally**, create a `.env.local` (gitignored) with AWS
  credentials + region and *either* the explicit data names
  (`BOOK_TABLE_NAME`, `BOOK_CONTENT_BUCKET`, `BOOK_INGEST_BUCKET`,
  `BOOK_ANALYTICS_TABLE_NAME`) *or* `SSM_PARAMETER_PREFIX=/chapterflow/dev` to
  resolve them from the dev env's SSM. Without these, data routes throw
  `Missing env var: BOOK_TABLE_NAME`. The catalog must also be **seeded +
  published** or the library returns 404 (no fallback to bundled packages on the
  live reader path).

### dev
- Auto-deployed on every push to `main`. Disposable (DynamoDB `DESTROY`, no
  deletion protection). Serves on the CloudFront domain unless a per-env
  `CHAPTERFLOW_DOMAIN_NAME` is set. Omit `CHAPTERFLOW_DOMAIN_NAME` to avoid DNS.

### staging
- Manual dispatch. Data **RETAINed** + PITR. Mirror prod's secrets with staging
  values (separate Stripe test keys, separate Cognito pool/app-client).

### prod
- Manual dispatch, **approval-gated** by the `prod` GitHub Environment's required
  reviewer. Empty resource suffix (byte-identical to live names → zero-diff).
  Every secret in §3.B/§3.C/§3.D must be the live value. See
  [LAUNCH_CHECKLIST.md](./LAUNCH_CHECKLIST.md).

---

## 5) Known inconsistencies (read before debugging config)

- **Three different default domains float through the code:** `siliconx.ca`
  (README examples + `app/_lib/chapterflow-brand.ts` default), `chapterflow.ca`
  (`infra/lib/env-config.ts` `PROD_APEX_DOMAIN`), and a `soltani.org`-style
  fallback in the site-URL helper. Pin the real origin explicitly:
  `CHAPTERFLOW_APP_BASE_URL` (book-API helper) is injected and **hard-required in
  prod** — it throws rather than guess — and `CHAPTERFLOW_DOMAIN_NAME` sets the
  served domain. The separate `APP_BASE_URL` (server-origin helper) is only an
  override; when unset the origin is derived from the request host, and it is
  **not injectable via the current pipeline** (§3.E), so deployed envs rely on
  that forwarded-host derivation today.
- **`VAPID_*` and `SES_SENDER_EMAIL` are not deploy-workflow secrets** (§3.D) —
  if web-push or email "silently does nothing" in a deployed env, the SSM params
  are missing.
- **`ADMIN_EMAILS` / `ADMIN_SUBS` don't work in deployed envs** (§3.E); use the
  Cognito admin group.
- **`BOOK_ANALYTICS_TABLE_NAME` is required for admin metrics**, but analytics
  *writes* are fire-and-forget — a missing table degrades dashboards without
  erroring user requests.
