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
| `ANTHROPIC_API_KEY` | R (AI) | secret | Powers all three Claude features — "Ask the Book", reflection feedback, and community-scenario validation. **All degrade gracefully when unset:** Ask/feedback return `503 ai_unavailable`; scenario submissions skip validation and land in the human moderation queue (`queue_for_review`) rather than being auto-approved. See §6 for the model/tuning knobs. |
| `ELEVENLABS_API_KEY` | O | secret | Chapter audio / TTS narration. Audio routes 4xx without it. |
| `APPLE_ISSUER_ID` | R (SIWA) | secret | Apple Developer **Team ID** — the `iss` of the Apple client-secret JWT. Shared by B3 (Apple IAP) and B8 (revoke-on-delete). |
| `APPLE_BUNDLE_ID` | R (SIWA) | secret | Services ID / bundle id used as the Apple OAuth **client** (`sub`/`client_id`). |
| `APPLE_KEY_ID` | R (SIWA) | secret | Key id of the `.p8` private key (JWT header `kid`). |
| `APPLE_PRIVATE_KEY` | R (SIWA) | secret | PKCS#8 PEM of the `.p8` AuthKey. Literal `\n` is tolerated. Used to sign the revoke client-secret JWT. **When any `APPLE_*` is unset, delete silently skips the Apple revoke (`apple_revoke_skip reason=not_configured`).** See [ios/APPLE-AUTH.md](./ios/APPLE-AUTH.md). |

### C. Infra / CI secrets — used at deploy time only (not app runtime)

| Variable | Req | Source | Purpose |
|---|---|---|---|
| `AWS_DEPLOY_ROLE_ARN` | R | secret | OIDC role the workflows assume. Set it in every deployable GitHub Environment; one shared role may be reused only with the finite `dev`/`staging`/`prod` environment-subject trust documented in [CI_CD.md](./CI_CD.md). |
| `AWS_ACCOUNT_ID` | R | secret | `CDK_DEFAULT_ACCOUNT` for synth. |
| `CHAPTERFLOW_DOMAIN_NAME` | O (R for prod custom domain) | secret | Apex/custom domain → ACM cert + Route53. **Must be a per-env secret** — a repo-level value would let dev/staging overwrite prod DNS (env-config has a hard guard that throws if a non-prod env resolves to the prod apex). |
| `CHAPTERFLOW_OPS_ALERT_EMAIL` | R (ops) | secret | Email subscribed to the `ChapterFlowOpsAlerts` SNS topic (backend: table-throttle + `OpsFailure`; frontend: server-fn errors/throttles/duration, ISR DLQ, CloudFront 5xx, `StripeWebhookFailure` — see [OPERATIONS.md §4](./OPERATIONS.md)). **Confirm the SNS subscription after first deploy or alerts never fire.** |
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
| `APNS_KEY_ID` | R (iOS push) | ssm | Apple Push (APNs) token-auth `.p8` **Key ID** (10 chars) → provider-JWT `kid`. |
| `APNS_TEAM_ID` | R (iOS push) | ssm | Apple Developer **Team ID** (10 chars) → provider-JWT `iss`. |
| `APNS_AUTH_KEY` | R (iOS push) | ssm (SecureString) | The APNs `.p8` private key **PEM** (PKCS#8). Literal `\n` escapes are accepted and unescaped at load. Signs the ES256 provider JWT (`jose`). All four `APNS_*` must be set or iOS push is a best-effort no-op (`sendApnsNotification` returns `apns_not_configured`); web-push + registration keep working. |
| `APNS_BUNDLE_ID` | R (iOS push) | ssm | The iOS app bundle id → APNs `apns-topic` header. |
| `APNS_HOST` | O | ssm | APNs host override. Default `api.push.apple.com` (production); set `api.sandbox.push.apple.com` for debug/TestFlight builds signed with a sandbox APS entitlement. |
| `SES_SENDER_EMAIL` | R (email) | ssm | From-address for transactional/notification email — **honored only by the app server Lambda** (`notifications-repo.ts`, via SSM). ⚠ The backend **reminder-cron Lambda ignores this param** and sends from a hardcoded `info@chapterflow.ca` (`chapterflow-backend-stack.ts`); the SES IAM identity is scoped to the `chapterflow.ca` domain. The real launch action is to **verify the sender's domain identity in SES**, not just set this param. |
| `BOOK_ADMIN_GROUP` | O | ssm | Cognito group that grants admin (default `admin`). |
| `BOOK_FREE_SLOTS_DEFAULT` | O | ssm | Free-tier book slots (default `2`). |
| `BOOK_PAYWALL_PRICE` | O | ssm | Display price string; falls back to `lib/pricing` `MONTHLY_PRICE_PER_MONTH`. |
| `BOOK_ENABLE_SOFT_DECAY` | O | ssm | Feature flag for points/engagement soft-decay. |
| `COGNITO_CUSTOM_DOMAIN` | O | ssm | Custom Hosted-UI domain; preferred over `COGNITO_DOMAIN` when set. |
| `BOOK_AI_VALIDATION_MODEL` | O | ssm | Claude model for community-scenario moderation. Default `claude-haiku-4-5`. |
| `BOOK_AI_FEEDBACK_MODEL` | O | ssm | Claude model for reflection feedback. Default `claude-sonnet-4-6` (replaces the now-deprecated `claude-sonnet-4-20250514`). |
| `BOOK_AI_ASK_MODEL` | O | ssm | Claude model for "Ask the Book". Default `claude-haiku-4-5`. |
| `BOOK_AI_TIMEOUT_MS` | O | ssm | Anthropic client request timeout in ms (default `30000`). |
| `BOOK_AI_MAX_RETRIES` | O | ssm | Anthropic client retry count on 429/5xx/connection errors (default `2`; `0` disables). Does **not** resume a stream that drops mid-response. |

### E. Local / build-time only — raw `process.env`, no SSM fallback

| Variable | Req | Source | Purpose |
|---|---|---|---|
| `DEV_AUTH_BYPASS` | local | local | `=1` (non-prod only) short-circuits all auth with a synthetic user. Set by `npm run dev`. |
| `APP_BASE_URL` | O (recommended) | local | Explicit override for the origin used by `getServerOrigin()` (share cards, OAuth return-to, `app/_lib/site-url.ts`, `app/auth/_lib/return-to.ts`). **Read via raw `process.env` — not in `serverEnv`, no SSM fallback — so the current pipeline cannot inject it into a deployed Lambda** (same trap as `ADMIN_EMAILS`). When unset, the origin is **derived from the request `x-forwarded-host`** (correct behind CloudFront); `resolvePublicOrigin()` only throws `Unable to resolve public origin. Set APP_BASE_URL for production.` in a context with no host header. Loopback values are ignored in prod. Distinct from `CHAPTERFLOW_APP_BASE_URL` (the book-API helper, which **is** injected and hard-required in prod). To pin it in prod, add it to `serverEnv` in `infra/bin/app.ts`. |
| `ALLOW_APP_BASE_URL_IN_DEV` | local | local | `=1` lets a non-prod build honor a loopback `APP_BASE_URL`. |
| `CSRF_ORIGIN_ENFORCE` | O | local | Same-origin / CSRF guard on cookie-authed unsafe-method routes (`requireSameOrigin` in `app/app/api/book/_lib/http.ts`, auto-wired into `withBookApiErrors`). **Defaults ON** — unset enforces, so prod is protected with no injection needed. Set to `0`/`false`/`off`/`no` for **observe-only** mode (logs `csrf_origin_observe_only` with the offending origin + path, but lets the request through) — use as a brief confirmation window after first deploy to verify no legitimate host/alias trips a `403 forbidden_origin`, then unset to re-enforce. **Read via raw `process.env`, so to flip a deployed Lambda to observe-only it must be added to `serverEnv` in `infra/bin/app.ts`** (same injection caveat as `APP_BASE_URL`); the Stripe webhook and the one-click unsubscribe route are exempt regardless of the flag. |
| `NEXT_PUBLIC_ANALYTICS_ID` | O | local/build | Enables the lightweight client analytics shim (`lib/analytics.ts`); the shim no-ops when unset. |
| `NEXT_DIST_DIR` | local | local | Build output dir (`.next-chapterflow` in dev). |
| `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_CHAPTERFLOW_SITE_URL`, `NEXT_PUBLIC_CHAPTERFLOW_APP_URL`, `NEXT_PUBLIC_CHAPTERFLOW_AUTH_URL` | O | local/build | Public origins inlined at **build** time. In standalone single-host mode they collapse to one origin; set them at build if you need client-side absolute URLs. |
| `CHAPTERFLOW_SITE_BASE_URL`, `CHAPTERFLOW_AUTH_BASE_URL` | O | local | Server site/auth origins. In standalone mode they default to the app origin via `app/_lib/chapterflow-brand.ts`. |
| `ADMIN_EMAILS`, `ADMIN_SUBS` | O | local | A **secondary** admin gate on `app/book/settings/page.tsx` only, read via raw `process.env` (no SSM fallback). **Not injected into the Lambda** → effectively inert in deployed envs. The **real** admin gate is the Cognito group (`BOOK_ADMIN_GROUP`). |
| `SECURE_DOC_TABLE` | n/a | — | **Legacy / removed.** Belonged to the former "Cloud Portfolio" document product, which was deleted from HEAD. **Not used by ChapterFlow** — the dead reader was removed from `app/app/api/_lib/aws.ts`. Do not set; `scripts/book/render-apprunner-update.mjs` strips it from deploy env. |

### F. Email compliance (CASL / CAN-SPAM) — used by BOTH the app and the reminder cron

These power the legally-required footer + one-click unsubscribe on commercial
(engagement) email. **Set each as a single SSM param `/chapterflow/<env>/<KEY>`**
(same pattern as `VAPID_*`). Both consumers read that one source:
- the **app server Lambda** via `getServerEnv` (`email-compliance.ts`), and
- the **reminder-cron Lambda** via `resolveEmailConfig()`, which reads the same
  SSM params at runtime (`email-compliance.ts`; the cron role has scoped
  `ssm:GetParameter` + `kms:Decrypt`-via-SSM). The CDK `process.env` values are
  deploy-time fallbacks only — you don't need to set anything in the workflow.

| Variable | Req | Source | Purpose |
|---|---|---|---|
| `EMAIL_UNSUBSCRIBE_SECRET` | **R (launch blocker)** | secret + ssm | HMAC key that signs one-click unsubscribe tokens. **Must be the SAME value on the app runtime and the cron Lambda**, or cron-minted unsubscribe links won't verify (the `mailto:` fallback still works). Use a random 32+ byte string. Token format is pinned by `email-compliance-core.test.ts`. |
| `EMAIL_POSTAL_ADDRESS` | **R for engagement email** | secret + ssm | Physical mailing address printed in every commercial-email footer (**CASL §6 / CAN-SPAM 16 CFR 316.4 require it**; a P.O. box works). Acts as a kill-switch: when unset, `sendCompliantEmail` (cron) and `createNotification` (app) **skip all commercial email** automatically. Transactional email (trial-ending, receipts) is exempt and unaffected. |
| `EMAIL_SENDER_NAME` | O | secret + ssm | Friendly From display name (default `ChapterFlow`) → `ChapterFlow <info@chapterflow.ca>`. |
| `EMAIL_SUPPORT_ADDRESS` | O | secret + ssm | `Reply-To` + the `List-Unsubscribe` `mailto:` (default `support@chapterflow.ca`). Confirm the mailbox is monitored. |
| `SES_CONFIGURATION_SET` | auto | auto (CDK) | Name of the SES configuration set applied to every send so bounce/complaint events flow to the suppression handler. **CDK-managed** — the backend stack creates the config set, injects it into the cron Lambda, and writes it to `${ssmPrefix}/SES_CONFIGURATION_SET` for the app. No owner action. |

> **Bounce/complaint suppression (auto):** the backend stack provisions an SES
> configuration set → SNS topic → `ChapterFlowSuppressionHandler` Lambda that
> writes hard-bounced/complained addresses to DynamoDB (`BOOKSUPPRESS#<email>`).
> Commercial **and** transactional sends check this before emailing. This is on
> top of SES's built-in account-level suppression — no setup beyond deploying
> the backend stack.

> **SES domain authentication (deliverability, not in code):** before enabling
> the cron in prod, add **SPF**, **DKIM**, and **DMARC** DNS records for the
> sender domain (`chapterflow.ca`) and confirm SES is out of the sandbox. See
> [LAUNCH_CHECKLIST.md](./LAUNCH_CHECKLIST.md). The `CHAPTERFLOW_APP_BASE_URL`
> origin (§3.B) is reused to build absolute unsubscribe links; the cron receives
> it as `APP_BASE_URL`.

### G. iOS Universal Links / shared web credentials (AASA)

Consumed by the App Site Association route
[`app/.well-known/apple-app-site-association/route.ts`](../app/.well-known/apple-app-site-association/route.ts)
(via the pure core
[`app/_lib/apple-app-site-association.ts`](../app/_lib/apple-app-site-association.ts)),
which serves `GET /.well-known/apple-app-site-association` as pure
`application/json` (no redirect, cacheable). Apple fetches it from the prod apex
to enable **Universal Links** (deep-link `/book/*`, `/pair/accept/*`, `/gift/*`,
`/ref/*`, `/review` into the app, with the web pages as fallback) and **shared
web credentials** (password autofill/save for the app).

The route builds the app identifier `"<Team ID>.<bundle id>"`. Both values are
read from **raw `process.env` at request time** — injected into the server
Lambda via a conditional spread in
[`infra/bin/app.ts`](../infra/bin/app.ts) `serverEnv` (§3.B pattern). Both are
**optional**: when unset the route still serves a structurally-valid document
using the placeholder Team ID `TEAMID` and the default bundle id
`com.chapterflow.ios`, so the shape is testable/deployable before the real Team
ID is known. iOS only matches a real signed app against the real Team ID, so
shipping the placeholder is harmless.

| Variable | Req | Source | Purpose |
|---|---|---|---|
| `IOS_APP_TEAM_ID` | **R (for live Universal Links)** | secret (env → `serverEnv`) | The 10-char Apple Developer **Team ID** / App ID Prefix (e.g. `ABCDE12345`). Until set, the AASA file carries the placeholder `TEAMID` and no device will associate — set it before shipping the iOS app. Not secret, but supply it as a per-env value so staging/prod can differ. |
| `IOS_APP_BUNDLE_ID` | O | env → `serverEnv` | iOS bundle identifier. Defaults to `com.chapterflow.ios`; only set to override (e.g. a beta/enterprise bundle). |
| `NEXT_PUBLIC_IOS_APP_STORE_URL` | O | local/build | App Store URL rendered as an "Open in the App Store" CTA on the web fallback interstitials (`/pair/accept/*`, `/gift/*`, `/review`). Inlined at build (`NEXT_PUBLIC_*`); when unset the interstitials show a quiet "coming soon" line instead. |

---

### H. Apple StoreKit / In-App Purchase (App Store subscriptions → Pro entitlement)

Consumed by the Apple IAP entitlement path — the verify endpoint
[`app/app/api/book/me/billing/apple/verify/route.ts`](../app/app/api/book/me/billing/apple/verify/route.ts)
and the App Store Server Notifications V2 webhook
[`app/app/api/book/me/billing/apple/notifications/route.ts`](../app/app/api/book/me/billing/apple/notifications/route.ts),
via `apple-jws-verify-core.ts` (Apple's official App Store Server Library,
**pinned Apple Root CA - G3**, and Production OCSP),
`apple-notification-core.ts` (the notification
state machine), and `apple-entitlement-write-core.ts` (the DynamoDB write with
the `lastAppleSignedDate` ordering guard). Config is read via
[`apple-env.ts`](../app/app/api/book/_lib/apple-env.ts).

Production verification uses Apple's official online certificate-revocation
checks; OCSP transport failures return retryable
`503 apple_verification_unavailable` so the client/Apple retries. Sandbox uses
the official offline `signedDate` mode. Granting additionally requires exact
native bundle, numeric App Apple ID, product allowlist, subscription group,
environment, direct ownership, and account binding. `APPLE_BUNDLE_ID` remains
the Sign-in-with-Apple Services ID and is never an IAP fallback.

| Variable | Req | Source | Purpose |
|---|---|---|---|
| `APPLE_IAP_BUNDLE_ID` | **R (prod)** | GitHub environment variable → `serverEnv` | Exact native app bundle identifier. Distinct from the SIWA Services ID. |
| `APPLE_IAP_APP_APPLE_ID` | **R (every frontend deploy)** | GitHub environment variable → `serverEnv` | Numeric App Store app ID. Production notification `data.appAppleId` and the final `/id<number>` in `IOS_APP_STORE_URL` must both equal it. |
| `APPLE_IAP_SUBSCRIPTION_GROUP_ID` | **R (prod)** | GitHub environment variable → `serverEnv` | Exact App Store Connect subscription-group identifier required in every signed transaction. |
| `IOS_STOREKIT_PRODUCT_IDS` | **R (prod)** | GitHub environment variable → `serverEnv` | Comma-separated exact allowlist shared by `/config/ios`, direct verification, and notifications. Duplicate/malformed IDs and `annual_upfront` are rejected. |
| `IOS_APP_STORE_URL` | **R (prod)** | GitHub environment variable → `serverEnv` | Exact product-specific HTTPS `apps.apple.com/.../id<number>` URL returned to native clients. Search/publisher URLs, query strings, and foreign hosts are rejected. |
| `APPLE_IAP_TESTFLIGHT_SANDBOX_ENABLED` | O (prod only) | GitHub environment variable → `serverEnv` | Exact `1` opt-in for the isolated Production TestFlight Sandbox lane; unset/`0` is off. Any other value fails deployment/runtime validation. Never enable outside `prod`. |
| `APPLE_IAP_TESTFLIGHT_QA_USER_IDS` | R only when the TestFlight lane is enabled | **protected GitHub Environment secret → CI hash boundary only** | Comma-separated, lowercase canonical Cognito `sub` UUID allowlist. The workflow validates and hashes it in-memory; raw IDs never enter CDK, CloudFormation, Lambda configuration, build artifacts, or logs. Never store it as a GitHub variable or include it in release evidence. |
| `APPLE_IAP_TESTFLIGHT_QA_USER_HASHES` | generated; do not configure manually | CI-derived GitHub job env → `serverEnv` | Comma-separated lowercase SHA-256 digests used for runtime membership. Only this one-way representation crosses CDK. Missing/malformed/duplicate hashes fail closed when the lane is enabled; the workflow omits them when disabled. |
| `APPLE_ISSUER_ID` | O (R for App Store Server API) | secret (env → `serverEnv`) | App Store Connect API **Issuer ID** (a UUID, from *Users and Access → Integrations → App Store Connect API*). Signs outbound App Store Server API requests. Not needed for local JWS verification, so the verify/notifications endpoints work without it. |
| `APPLE_KEY_ID` | O (R for App Store Server API) | secret (env → `serverEnv`) | App Store Connect API **Key ID**. **Shared with Sign-in-with-Apple (B8) — defined there; reused here.** |
| `APPLE_PRIVATE_KEY` | O (R for App Store Server API) | secret (env → `serverEnv`) | App Store Connect API private key (PKCS#8 `.p8`). **Shared with Sign-in-with-Apple (B8) — defined there; reused here.** |

**App Store Connect setup**

1. **Create the auto-renewable subscription.** In App Store Connect → your app →
   *Subscriptions*, create a subscription group and the Pro product(s). Note each
   **Product ID** (e.g. `chapterflow.pro.monthly`) — the native app buys these,
   and the `productId` is persisted on the entitlement (`appleProductId`).
2. **App Store Server Notifications V2.** In *App Information → App Store Server
   Notifications*, set the **Production V2** URL to
   `https://<prod-apex>/app/api/book/me/billing/apple/notifications` and the
   **Sandbox V2** URL to
   `https://<staging-host>/app/api/book/me/billing/apple/notifications`. Never
   point Sandbox notifications at Production: the Production webhook remains
   strictly Production-only even when the TestFlight direct-verification lane
   is enabled, so Sandbox envelopes receive `transaction_environment_mismatch`.
   Staging uses its own table and Primary map namespace; it cannot mutate the
   isolated Production QA/TestFlight rows. Production TestFlight QA state is
   therefore refreshed by authenticated StoreKit transaction verification and
   fails closed at signed expiry, not by Sandbox notifications. Apple posts
   `{ signedPayload }`; each deployment's webhook uses Apple's official verifier
   and applies subscription, renewal, billing retry/grace, extension,
   expiration, refund, and refund-reversal transitions. Out-of-order deliveries
   are rejected by the `signedDate` high-water mark.
3. **App Store Connect API key (optional here).** *Users and Access →
   Integrations → App Store Connect API* → generate an **In-App Purchase** key.
   Download the `.p8` once → `APPLE_PRIVATE_KEY`; record the **Key ID** →
   `APPLE_KEY_ID` and the **Issuer ID** → `APPLE_ISSUER_ID`.
4. **Set the environment-bound IAP policy.** Configure
   `APPLE_IAP_BUNDLE_ID`, `APPLE_IAP_APP_APPLE_ID`,
   `APPLE_IAP_SUBSCRIPTION_GROUP_ID`,
   `IOS_STOREKIT_PRODUCT_IDS`, and `IOS_APP_STORE_URL` in each GitHub
   Environment. `prod` accepts signed `Production` transactions by default;
   `dev`/`staging` accept signed `Sandbox` transactions on their ordinary
   Primary storage keys. The narrow Production TestFlight exception below is
   direct-verification-only and uses separately namespaced rows.
5. **Bind purchases to the initiating account.** The authenticated Cognito
   `sub` must be an RFC UUID and the native app must pass it through StoreKit's
   `.appAccountToken` purchase option. First claims without an exact signed
   match fail closed. Tokenless transactions (including offer-code events) are
   accepted only for a reverse map already owned by that same account.

The native app calls `POST /app/api/book/me/billing/apple/verify` with
`{ transactionJWS }` (the StoreKit 2 signed transaction) after purchase to grant
the shared Pro entitlement (`proSource: "apple"`); the web billing surfaces then
show "Managed via the App Store on your iPhone" instead of the Stripe portal, and
never offer Stripe checkout while the Apple subscription is active.

An authenticated, policy-valid transaction receives an additive acknowledgement:
`{ ok: true, processed: true, transactionState, entitlement }`. `processed`
means StoreKit may finish the transaction. Access always follows the returned
authoritative `entitlement`; an active promotional/admin entitlement is not
overwritten merely because an Apple transaction was processed. Expired/revoked
transactions use a same-lineage `apple_only` mutation, so they cannot revoke a
different Apple lineage or Stripe, gift, promotional, or admin access.

**Fail-closed Production TestFlight Sandbox lane.** Leave
`APPLE_IAP_TESTFLIGHT_SANDBOX_ENABLED=0` and the allowlist absent for normal
operation. Only after the App Store catalog and backend are release-ready:

1. Save the exact lowercase Cognito UUIDs as the protected prod Environment
   secret `APPLE_IAP_TESTFLIGHT_QA_USER_IDS`; do not echo or copy them into
   workflow output, docs, issues, or release evidence. The deploy workflow
   validates the secret in one process, emits only SHA-256 digests, and passes
   `APPLE_IAP_TESTFLIGHT_QA_USER_HASHES` into CDK/Lambda.
2. Set the prod Environment variable
   `APPLE_IAP_TESTFLIGHT_SANDBOX_ENABLED=1` and run an approved app-only prod
   deploy. Synth fails before mutation for a missing/malformed/duplicate
   allowlist, a non-exact flag, or enablement outside prod.
3. A direct Sandbox JWS still must pass Apple's official verifier, exact bundle,
   product, subscription group, purchased ownership, and signed
   `appAccountToken == authenticated Cognito sub`. Fallback occurs only after
   the Production verifier returns authenticated `invalid_environment`; bad
   signatures, profiles, identifiers, and OCSP failures never fall back.
4. Only the exact allowlisted account can claim
   `TestFlightSandbox` map/entitlement rows. Normal Production keys remain
   byte-for-byte unchanged. Default `/me/entitlements` and every server-side Pro
   gate overlay an active TestFlight row only for an enabled, allowlisted user;
   an effective Production Pro row always wins.

The hash boundary addresses CloudFormation/artifact disclosure without adding a
new runtime secret dependency. Cognito-generated UUIDs carry roughly 122 bits of
randomness, so SHA-256 preimage search is infeasible. A digest is still linkable
and can be tested by someone who already knows a subject UUID, so hashes remain
operational configuration and must not be logged or published. They are not an
authentication factor: official JWS verification and exact signed
`appAccountToken` binding remain mandatory before the membership lookup.

One operator command disables the flag and starts the app-only rollback deploy
(replace `<release-ref>` with the approved backend release ref). The workflow
then omits hashes even if the protected raw secret remains stored for a later QA
window:

```bash
gh variable set APPLE_IAP_TESTFLIGHT_SANDBOX_ENABLED --env prod --body 0 && gh workflow run deploy.yml --ref <release-ref> -f environment=prod -f deploy_infra=false -f deploy_app=true -f seed=false
```

As soon as that deploy is live, all default reads ignore the isolated Sandbox
row, so QA access disappears without deleting or rewriting Production state.
The namespaced rows remain inert for audit/re-enable and are removed by the
normal account-erasure partition/pointer sweep. Never populate this prod secret
or enable the flag while the catalog blockers recorded below remain open.

**Paid-source arbitration and duplicate-billing limitation.** The checkout
guard prevents a new Stripe session for effective Apple Pro, but a session
created earlier can complete after a StoreKit purchase (and the reverse can be
delivered late). Apple and Stripe activations stamp a shared
`activePaidIntentAtMs` and compare it, with legacy source-specific high-water
marks as fallback, so a delayed older event cannot displace the newer paid
intent. Terminal events remain source/lineage-only. This protects access but
cannot cancel an external subscription automatically: both Apple and Stripe may
briefly remain billable. Run the admin billing reconciliation after QA and
release billing tests; `prosource_mismatch` identifies a live Stripe
subscription while Apple is authoritative. For the reverse direction, inspect
the retained Apple lineage in App Store Connect/customer support. Confirm the
customer's intended channel, cancel the duplicate, and refund/compensate under
the published billing policy.

**Ownership-map rollout and rollback.** New transaction claims persist
`accountBindingVersion: "cognito_sub_v1"` and atomically add a user-partition
erasure pointer. Existing maps remain readable: a tokenless JWS is accepted only
when that map already belongs to the authenticated user;
re-verification also backfills its erasure pointer. There is no table migration.
Pre-existing maps that are never re-verified remain an account-erasure residual
and require operator reconciliation. Rolling back application code is data-safe:
older readers ignore the additive version/pointer fields, while the reverse map
and entitlement shapes remain unchanged.

Stable verification failures use the standard Book API error envelope. Policy
codes are `bundle_mismatch`, `app_apple_id_mismatch`,
`transaction_environment_mismatch`,
`product_not_allowed`, `subscription_group_mismatch`,
`unsupported_transaction_type`, `unsupported_ownership_type`, and
`family_shared_not_supported` (HTTP 400). Account binding uses
`account_token_required` / `account_token_malformed` (400) and
`account_token_mismatch` / `account_identifier_unsupported` /
`transaction_already_claimed` (409). A transient strongly-consistent read miss
returns `entitlement_confirmation_unavailable` (503) and must not finish the
StoreKit transaction. Invalid deployment policy returns
`apple_iap_configuration_unavailable` (503). OCSP/revocation transport failures
return `apple_verification_unavailable` (503) and must remain unfinished/unacked.

**Confirmed nonsecret release identity (read-only evidence, 2026-07-11).** App
Store Connect currently reports Team ID `ZG3C9QBA8Z`, bundle
`com.chapterflow.ios`, App Apple ID `6787864558`, subscription group `22211821`,
with `com.chapterflow.pro.annual` (ASC product id `6787866553`, one year) and
`com.chapterflow.pro.monthly` (ASC product id `6789951571`, one month). Both are
**Missing Metadata** and Family Sharing is off. Annual currently has 175 saved
price rows (US `$44.99`, Canada `$59.99`) plus English (Canada) localization;
monthly has a saved US base price of `$7.99` with Apple's automatic territory
equivalents, but its localization/review metadata remain unset. Availability is
unset for both products. App Store Connect assigns both subscriptions to level
`1`, matching their equivalent ChapterFlow Pro access with different billing
durations. Production/Sandbox notification URLs are unset. These facts are
evidence, **not authorization to populate the prod allowlist or deploy**.

**Frontend deployment checklist (record in release evidence).** Before CDK
mutation, record `CHAPTERFLOW_COMMIT_SHA`, `CHAPTERFLOW_ENV`, Team ID, exact
bundle, numeric App Apple ID, subscription group, exact recurring product IDs,
and the product-specific listing URL. Confirm the URL's final id equals
`APPLE_IAP_APP_APPLE_ID`; every allowlisted product is complete, priced,
available, localized, review-ready, recurring, and in the recorded group;
subscription levels reflect the intended upgrade order; and both notification
URLs are set. Then run synth validation and the uncached `/config/ios` health
gate.

**Compatibility, sequencing, and rollback.** Deploy the additive backend
`processed`/`transactionState` response and official verifier first, validate it
in dev/staging Sandbox, then ship the iOS verify-then-finish client. Do not ship
the client against an older backend that lacks the acknowledgement. On backend
failure, roll the frontend stack back to the previous known-good commit; the iOS
client must keep the StoreKit transaction unfinished and retry on every 503.
After the new client ships, retain this additive response contract through any
server rollback. Roll back configuration and code together; never weaken bundle,
appAppleId, group, ownership, product, or account-binding checks to restore
availability.

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

---

## 6) AI / LLM configuration

The app calls Claude (Anthropic) in three places. All three resolve their model,
timeout, and retry policy through `app/app/api/book/_lib/ai-config.ts`, so models
can be retargeted per environment via the `BOOK_AI_*` SSM params (§3.D) **without
a code change or redeploy**.

| Feature | Route | Default model | Fallback when `ANTHROPIC_API_KEY` is absent / call fails |
|---|---|---|---|
| Scenario validation | `…/me/books/[id]/chapters/[n]/scenarios` | `claude-haiku-4-5` | `queue_for_review` → human moderation queue (**never auto-approved**) |
| Reflection feedback | `…/me/reflections/[id]/[n]/feedback` | `claude-sonnet-4-6` | `503 ai_unavailable` |
| Ask the Book | `…/books/[id]/ask` | `claude-haiku-4-5` | `503 ai_unavailable` |

**Why these models.** Validation and Ask are cheap, high-volume tasks → Haiku 4.5
(\$1/\$5 per 1M in/out). Reflection feedback is user-facing prose → Sonnet 4.6
(\$3/\$15). The feedback default **replaced `claude-sonnet-4-20250514` (Sonnet 4),
which is deprecated and retires 2026-06-15** — pinning the old id via
`BOOK_AI_FEEDBACK_MODEL` would 404 after that date.

**Resilience.** `BOOK_AI_TIMEOUT_MS` (default 30s) and `BOOK_AI_MAX_RETRIES`
(default 2) are applied to every client. Retries cover request establishment
(429/5xx/connection) only — they do **not** resume a stream that drops after
tokens start flowing, so the two streaming features still surface a mid-stream
error to the client.

**Observability** (CloudWatch namespace `ChapterFlow/Ops`, emitted via
`putOpsMetric` — see [OPERATIONS.md](./OPERATIONS.md)). Every Claude call records,
dimensioned by `feature`/`model`/`outcome`:
`AiRequest`, `AiInputTokens`, `AiOutputTokens`, `AiCostUsd` (estimated from the
per-model price table in `ai-config.ts`), `AiLatencyMs`, and `AiError` (on
failure). Scenario submissions that land in the moderation queue additionally
emit `ScenarioModerationQueued` (dimensioned by a coarse `reason` bucket) — an
**inflow-rate** signal that complements the on-demand backlog *depth* gauge in
`app/app/api/book/admin/metrics/moderation`. All metric emits are fire-and-forget
and require only the existing `cloudwatch:PutMetricData` grant scoped to the
`ChapterFlow/Ops` namespace (frontend `ServerFn` Lambda) — no IAM change.
