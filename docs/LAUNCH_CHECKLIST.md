# Production Launch Checklist

A pre-flight checklist for standing up (or re-verifying) a ChapterFlow
environment, matched to the **actual** CI/CD pipeline. Companion docs:
[CI_CD.md](./CI_CD.md) (pipeline mechanics), [ENVIRONMENT.md](./ENVIRONMENT.md)
(every variable + where it's supplied), [OPERATIONS.md](./OPERATIONS.md)
(runbook), [ACCOUNT_LIFECYCLE.md](./ACCOUNT_LIFECYCLE.md) (erasure/privacy).

Work top to bottom for a fresh env; for an existing env, treat it as an audit.
Items marked **⚠ launch-blocking** block or materially degrade launch as
described; required production boot configuration may fail closed immediately.

---

## 0) Mental model (don't skip)

- Three envs share **one AWS account**, separated by a name suffix
  (`infra/lib/env-config.ts`). **prod = empty suffix** → byte-identical to live
  names → `cdk deploy -c env=prod` is a zero-diff on live data. Default env is
  `dev`, so a bare deploy can never touch prod.
- **Backend must deploy before frontend** for a new env: the app reads bucket
  names the backend publishes to SSM. App-only deploys are fine afterward.
- The deploy ends in a **blocking health gate** (`/`, `/pricing`, `/api/health`
  must be 2xx) — a bad deploy fails the job rather than going live.

---

## 1) GitHub setup (one-time)

- [ ] Create GitHub **Environments** `dev`, `staging`, `prod`
      (Settings → Environments).
- [ ] On **`prod`**, add a **required reviewer** (this *is* the manual approval
      gate) and optionally restrict deployments to `main`/tags.
- [ ] Create the **OIDC deploy role** and store its ARN as the `AWS_DEPLOY_ROLE_ARN`
      env secret: trusts `token.actions.githubusercontent.com` (aud
      `sts.amazonaws.com`), with `sub` equal to the finite `dev`, `staging`, and
      `prod` GitHub Environment subjects. Generate the account/environment-bound
      trust and additive-policy JSON via
      [infra/iam/README.md](../infra/iam/README.md), then owner-review it with
      the companion workflow permissions documented there. Store
      `AWS_ACCOUNT_ID` too; it is a low-sensitivity identifier that the current
      workflows read from the environment-secret channel for compatibility,
      not an authentication secret.

## 2) Per-environment GitHub deploy configuration

Set these as **environment-scoped** GitHub secrets for each env (prod uses live
values), except entries explicitly labeled as GitHub Environment variables.
Runtime secrets sourced only from SSM belong in §3, not here. Full purpose
table: [ENVIRONMENT.md §3.B/§3.C](./ENVIRONMENT.md).

**Infra / domain**
- [ ] `AWS_DEPLOY_ROLE_ARN`, `AWS_ACCOUNT_ID`
- [ ] `CHAPTERFLOW_APP_BASE_URL` — **⚠ launch-blocking**: prod throws
      `CHAPTERFLOW_APP_BASE_URL is not set` if unset (no request-host fallback;
      Stripe redirects break). Use the same origin as the cookie domain. *(The
      separate `APP_BASE_URL` is **not** pipeline-injectable today — see
      [ENVIRONMENT.md §3.E](./ENVIRONMENT.md) — so don't bother adding it as a
      secret; deployed share/return-to URLs derive the origin from the request
      host.)*
- [ ] `CHAPTERFLOW_DOMAIN_NAME` — set **per-env** for a custom domain; **omit for
      dev/staging** to serve on the CloudFront domain. Never set repo-wide (DNS
      hijack guard will throw).
- [ ] `CHAPTERFLOW_HOSTED_ZONE_ID` — non-secret **environment variable** paired
      with every `CHAPTERFLOW_DOMAIN_NAME`; the frontend fails closed if only
      one is set.
- [ ] `CHAPTERFLOW_OPS_ALERT_EMAIL` — see §6.

**Auth (Cognito)**
- [ ] `COGNITO_DOMAIN`, `COGNITO_CLIENT_ID`, `COGNITO_USER_POOL_ID`,
      `COGNITO_REGION`, `COGNITO_REDIRECT_URI`, `COGNITO_LOGOUT_REDIRECT_URI`
- [ ] `AUTH_COOKIE_DOMAIN` — e.g. `.chapterflow.ca`.

**Billing (Stripe)**
- [ ] `BOOK_STRIPE_PRICE_ID`
- [ ] `BOOK_STRIPE_PRICE_ID_ANNUAL`, `BOOK_STRIPE_PRICE_ID_ANNUAL_UPFRONT` (if offered)
- [ ] `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

## 3) SSM-only app config (the workflow does NOT inject these)

Create these as parameters under **`/chapterflow/<env>/`** (SecureString for
secrets). The deploy workflow does not pass them. Required production boot
secrets fail closed when missing, denied, or undecryptable; optional capability
secrets fail only their documented feature path. See
[ENVIRONMENT.md §3.D](./ENVIRONMENT.md).

- [ ] `AUTH_STATE_SECRET` — **required at production boot**; SecureString with
      at least 32 characters.
- [ ] `BOOK_STRIPE_SECRET_KEY`, `BOOK_STRIPE_WEBHOOK_SECRET` — **required at
      production boot and for billing readiness**; provision both as
      SecureStrings.
- [ ] `ANTHROPIC_API_KEY` — **required at production boot** for the production
      AI paths; provision as a SecureString.
- [ ] `ELEVENLABS_API_KEY` — optional SecureString for audio/TTS; audio routes
      fail locally when it is absent.

- [ ] `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` — **⚠ launch-blocking for web push**.
- [ ] `SES_SENDER_EMAIL` — **⚠ launch-blocking for email** (the app server reads
      it from SSM). Note the reminder-cron Lambda **ignores** this param and
      sends from a hardcoded `info@chapterflow.ca`, so the real blocking action
      is to **verify the sender's domain identity in SES** (the IAM identity is
      scoped to the `chapterflow.ca` domain).
- [ ] **Email compliance (CASL/CAN-SPAM)** — see [ENVIRONMENT.md §3.F](./ENVIRONMENT.md).
      Set each as **one** SSM param `/chapterflow/<env>/<KEY>` (both the app and
      the cron read SSM):
  - [ ] `EMAIL_UNSUBSCRIBE_SECRET` — **⚠ launch-blocking.** Random 32+ byte
        string. One param, read by both app + cron, so the one-click unsubscribe
        links verify.
  - [ ] `EMAIL_POSTAL_ADDRESS` — Physical mailing address printed in every
        commercial-email footer (CASL/CAN-SPAM require it; a **P.O. box works**).
        **Until it is set, the reminder/digest cron automatically skips ALL
        commercial email** (a built-in kill-switch — no manual disable needed).
        Transactional email (trial-ending, receipts) is exempt and still sends.
        Set this to turn on engagement email.
  - [ ] `EMAIL_SENDER_NAME` (default `ChapterFlow`), `EMAIL_SUPPORT_ADDRESS`
        (default `support@chapterflow.ca` — confirm the mailbox is monitored).
- [ ] Optional tuning: `BOOK_ADMIN_GROUP` (default `admin`),
      `BOOK_FREE_SLOTS_DEFAULT` (default `2`), `BOOK_PAYWALL_PRICE`,
      `BOOK_ENABLE_SOFT_DECAY`, `COGNITO_CUSTOM_DOMAIN`.

## 4) Cognito provisioning

- [ ] User pool + app client exist; Hosted UI enabled with the Authorization
      Code + PKCE flow.
- [ ] **Callback URL** = `COGNITO_REDIRECT_URI`, **sign-out URL** =
      `COGNITO_LOGOUT_REDIRECT_URI`, both allow-listed on the app client.
- [ ] An **admin group** (matching `BOOK_ADMIN_GROUP`, default `admin`) exists;
      add the operator. This is the *only* working admin gate in deployed envs.
- [ ] `COGNITO_USER_POOL_ID` is available **at CDK synth** — the frontend stack
      scopes the GDPR erasure IAM (`cognito-idp:AdminDeleteUser`) to that pool;
      unset → it falls back to `*` (works but unscoped).

## 5) Stripe provisioning

- [ ] Products + recurring **Prices** created; their ids match the
      `BOOK_STRIPE_PRICE_ID*` secrets (live vs test keys per env).
- [ ] **Webhook endpoint** points at `<app>/app/api/book/billing/webhook`; its
      signing secret is the §3 SSM SecureString
      `BOOK_STRIPE_WEBHOOK_SECRET`. **⚠ launch-blocking** — the webhook is the
      sole writer of Stripe-sourced entitlements.
- [ ] Subscribe the event types the handler expects (checkout/subscription/
      invoice/refund/dispute). Send a test event and confirm a 2xx + an idempotent
      ledger write.

## 6) Ops alerting & account lifecycle (⚠ commonly missed)

- [ ] Set `CHAPTERFLOW_OPS_ALERT_EMAIL`, deploy the **backend** stack, then
      **confirm the SNS subscription email** — until confirmed, every ops alarm
      publishes to nobody. The topic carries the backend alarms (table throttling,
      `OpsFailure`) **and** the frontend alarms (server-fn errors/throttles/
      duration, ISR DLQ depth, CloudFront 5xx, `StripeWebhookFailure`). See
      [OPERATIONS.md §4](./OPERATIONS.md).
- [ ] **⚠ Never `cdk deploy` the backend *locally*.** The email subscription is
      created at synth time *only* when `CHAPTERFLOW_OPS_ALERT_EMAIL` is set
      (`backend-stack.ts`); the CI infra job injects it from the env secret, but
      a local deploy without it exported **deletes the subscription and silences
      every ops alarm**. Deploy the backend through GitHub Actions. (Local
      `cdk diff` is read-only and safe — it will *show* the subscription as a
      delete when the var is unset, but applies nothing.)
- [ ] Confirm `COGNITO_USER_POOL_ID` was present at synth (see §4) so **hard
      erasure actually deletes the Cognito user** — otherwise erasure cascades
      DynamoDB/S3/Stripe but **silently skips Cognito** (GDPR gap). See
      [ACCOUNT_LIFECYCLE.md](./ACCOUNT_LIFECYCLE.md).

## 7) Deploy (in order)

For a **new env** (backend has never deployed):
- [ ] `Actions → Deploy → Run workflow`: env = target, `deploy_infra=true`,
      `deploy_app=true`, `seed=true` (one time). Backend publishes bucket/table
      names to SSM; the app job resolves them.

For **prod specifically**, before applying:
- [ ] Dry-run the data-plane diff from a clean checkout and confirm **no
      replace/delete** on DynamoDB tables or S3 buckets:
      `cd infra && npx cdk diff -c env=prod ChapterFlowBackend`
      (see [OPERATIONS.md §5](./OPERATIONS.md) for the frontend diff too).
- [ ] Run the dispatch; **approve** the prod gate.

Ongoing: merging to `main` auto-syncs **dev** only.

## 8) Post-deploy verification

- [ ] CI **health gate** passed (the blocking job curls `/`, `/pricing`,
      `/api/health`), and the **non-blocking deep smoke** step tabled its results
      in the run summary.
- [ ] `GET /api/health` → `200 {status, env, commit, time}` with the right
      `env`/`commit`; `GET /api/health?deep=1` reports `status: "ok"` with every
      check `true` — `dynamo`, `catalog`, `content`, `billing`, `auth`. A
      `degraded` here means a dependency is mis-wired (catalog not seeded, SES/
      content bucket, or Stripe/Cognito config) even though the deploy passed.
- [ ] Smoke: log in via Cognito → land on `/dashboard`; open a book → reader
      renders Summary/Examples/Quiz; submit a quiz → points/streak update; run a
      Stripe **test** checkout → entitlement flips to Pro via the webhook.
- [ ] Web push registers (VAPID) and a test notification email sends (SES) — only
      if §3 was completed.
- [ ] **Email compliance:** a commercial email (e.g. a reading reminder) shows the
      postal-address footer; its `List-Unsubscribe` header is present; clicking
      the footer **Unsubscribe** link (logged out) lands on the public confirm
      page and flips the matching notification preference off. If the link says
      "invalid or expired," the app and cron `EMAIL_UNSUBSCRIBE_SECRET` differ.
- [ ] **Bounce/complaint suppression** is provisioned (auto, no owner action):
      the backend stack created the SES config set, the `ChapterFlowEmailEvents`
      SNS topic, and the `ChapterFlowSuppressionHandler` Lambda. Sanity-check that
      a SES test bounce (e.g. to `bounce@simulator.amazonses.com`) writes a
      `BOOKSUPPRESS#…` item and that the address is then skipped. The committed
      Lambda bundles (`infra/lambda/dist/{reading-reminder-cron,suppression-handler}.js`)
      must be rebuilt with esbuild when their sources change — CI does not rebuild them.

## 9) Domain / DNS

- [ ] **Email sender-domain authentication (required before enabling the cron):**
      publish **SPF**, **DKIM**, and **DMARC** DNS records for `chapterflow.ca`,
      verify the SES domain identity, and confirm SES is **out of the sandbox**
      in the prod region. Without these, reminder/digest mail lands in spam or is
      rejected.
- [ ] **Custom app domain only:** `CHAPTERFLOW_DOMAIN_NAME` set as a **per-env**
      secret; ACM cert + Route53 records created by the frontend stack. Verify the
      apex + app host resolve to CloudFront and the health gate passed on the real
      domain.
- [ ] Cognito callback/logout URLs and `CHAPTERFLOW_APP_BASE_URL` use the **same**
      origin as the cookie domain.

## 10) Pre-launch correctness (recommended)

- [ ] **Privacy policy is reconciled with behavior** — location is now disclosed
      and collected only when "Share Usage Analytics" is on (opt-in, default off),
      and ip-api.com + Anthropic are listed as processors. Re-verify if the
      analytics/location code changes.
- [ ] Confirm there is no stale generated build output committed (the
      `.next*`/`.open-next/` dirs are gitignored; nothing under them should be
      tracked).
- [ ] `npm run verify` (typecheck + tests + build) is green on the deploy commit.

---

### Fast reference — "it deployed but X doesn't work"

| Symptom | Likely cause |
|---|---|
| Login redirect loop / `invalid_redirect` | `COGNITO_REDIRECT_URI` not allow-listed, or origin ≠ `CHAPTERFLOW_APP_BASE_URL`. |
| Prod boot error `CHAPTERFLOW_APP_BASE_URL is not set` | Missing the §2 app-base secret (the hard-required, throwing one). |
| Web push throws "VAPID keys not configured" | `VAPID_*` SSM params missing (§3). |
| App emails never arrive | `SES_SENDER_EMAIL` SSM param missing (§3). |
| Reminder/digest cron emails never arrive | The `chapterflow.ca` SES domain identity isn't verified — the cron sender is hardcoded to `info@chapterflow.ca`. |
| Cron unsubscribe links say "invalid or expired" | `EMAIL_UNSUBSCRIBE_SECRET` differs between the app runtime and the cron Lambda (or is unset on one). Must be identical (§3). |
| Commercial emails missing the postal address | `EMAIL_POSTAL_ADDRESS` unset (§3) — footer omits the legally-required address. |
| Reminder/digest mail lands in spam | SPF/DKIM/DMARC records for `chapterflow.ca` not published (§9). |
| Pro never activates after payment | Stripe webhook endpoint/secret wrong (§5). |
| Admin console 403 for the operator | Operator not in the Cognito admin group (§4); `ADMIN_EMAILS` does **not** work in deployed envs. |
| Ops alarms never email | SNS subscription not confirmed (§6). |
| Hard-erase leaves a Cognito user | `COGNITO_USER_POOL_ID` absent at synth (§4/§6). |
