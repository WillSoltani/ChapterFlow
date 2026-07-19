# CI/CD Guide

How ChapterFlow is tested and deployed. The web app (Next.js via OpenNext) and
its AWS infrastructure (CDK) run **three environments in one AWS account**,
separated by a resource-name suffix: `dev`, `staging`, `prod`.

## 1) Workflows

| File | Trigger | What it does |
|------|---------|--------------|
| `.github/workflows/ci.yml` | PRs + push to `main` | **Hard gate:** app typecheck/unit tests/`next build`/OpenNext bundle, the v21 pipeline workspace typecheck/tests/doctor/build, and CDK backend synth. **Advisory:** an ESLint job that reports problems but never blocks. |
| `.github/workflows/deploy.yml` | push to `main` (auto → **dev**); `workflow_dispatch` (pick env) | Orchestrates a deploy. Push keeps **dev** in sync. Manual dispatch chooses `dev`/`staging`/`prod` and what to run. |
| `.github/workflows/_deploy-infra.yml` | reusable (`workflow_call`) | Deploys the CDK **backend** stack for one env, then optionally seeds book data (names resolved from SSM — never hardcoded). |
| `.github/workflows/_deploy-app.yml` | reusable (`workflow_call`) | Builds OpenNext, deploys the CDK **frontend** stack, invalidates CloudFront, runs a **blocking health gate**, and opens a failure issue on prod. |

The reusable workflows bind to the GitHub **Environment** of the same name, so
`prod` inherits its required-reviewer approval gate and environment-scoped
secrets automatically.

## 2) The environment model

One AWS account; `-c env=<env>` (or `CHAPTERFLOW_ENV`) selects names via
`infra/lib/env-config.ts`:

| | prod | dev | staging |
|---|---|---|---|
| Stacks | `ChapterFlowBackend` / `ChapterFlowFrontend` | `…-dev` | `…-staging` |
| Tables | `ChapterFlowApp` / `ChapterFlowInsights` | `…-dev` | `…-staging` |
| SSM prefix | `/chapterflow/prod` | `/chapterflow/dev` | `/chapterflow/staging` |
| Data lifecycle | RETAIN + deletion-protected | disposable (DESTROY) | RETAIN |

**prod uses an empty suffix**, so its stack ids and every physical resource name
are byte-identical to what is already deployed — `cdk deploy -c env=prod` is a
zero-diff on the live data. dev/staging stand up as fresh, independent stacks.

Default env is **`dev`**: a bare `cdk deploy` / `cdk synth` never touches prod.

## 3) Day-to-day

- **PR:** open a PR → `ci.yml` runs. The required checks (`App Build + Tests`,
  `Infra Build + CDK Synth`) must pass; the `Lint (advisory)` job is *not*
  required (see §6).
- **Ship to dev:** merge to `main` → `deploy.yml` auto-deploys dev (infra sync +
  app; no re-seed).
- **Ship to staging/prod:** `Actions → Deploy → Run workflow`, choose the
  environment and toggles (`deploy_infra`, `deploy_app`, `seed`). A **prod** run
  pauses for approval before anything is applied.

## 4) One-time AWS / GitHub setup

1. **GitHub Environments** (repo Settings → Environments): create `dev`,
   `staging`, `prod`. On `prod`, add yourself as a **required reviewer** (this is
   the manual-approval gate) and optionally restrict deployments to `main`/tags.
   For each environment with `CHAPTERFLOW_DOMAIN_NAME`, set the non-secret
   environment variable `CHAPTERFLOW_HOSTED_ZONE_ID` to the matching Route53
   zone id. The frontend fails closed unless domain and zone id are paired.
2. **Environment-scoped deploy values** (per environment): `AWS_DEPLOY_ROLE_ARN`,
   `AWS_ACCOUNT_ID`, `CHAPTERFLOW_DOMAIN_NAME` (omit for dev/staging to serve on
   the CloudFront domain), `CHAPTERFLOW_APP_BASE_URL`, `CHAPTERFLOW_OPS_ALERT_EMAIL`,
   the `COGNITO_*`, `AUTH_COOKIE_DOMAIN`, the `BOOK_STRIPE_PRICE_ID*` values,
   and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`. The runtime-only secrets
   `AUTH_STATE_SECRET`, `BOOK_STRIPE_SECRET_KEY`, `BOOK_STRIPE_WEBHOOK_SECRET`,
   `ANTHROPIC_API_KEY`, and `ELEVENLABS_API_KEY` are SecureStrings under
   `/chapterflow/<env>/`, not GitHub-to-Lambda environment values. prod uses
   today's live values. The current workflows read `AWS_ACCOUNT_ID` from the
   GitHub environment-secret channel for compatibility, but the account id is
   an identifier, not an authentication secret.
3. **OIDC role** (`AWS_DEPLOY_ROLE_ARN`): configure the role ARN in every GitHub
   Environment that can deploy. A single shared role is valid because all three
   environments use one account, but its GitHub OIDC trust must use
   `StringEquals` for aud `sts.amazonaws.com` and the explicit subject list
   `repo:WillSoltani/ChapterFlow:environment:dev`,
   `repo:WillSoltani/ChapterFlow:environment:staging`, and
   `repo:WillSoltani/ChapterFlow:environment:prod`. Do not use a repo-wide
   wildcard. Generate valid account/environment-bound trust and permission JSON
   from `CDK_DEFAULT_ACCOUNT` using the
   [IAM artifact contract](../infra/iam/README.md); generated files are ignored.
   Updating the live role and proving positive/negative assumptions are
   owner-run gates.
4. **Bootstrap** is already done for the account. A brand-new env's **backend
   must deploy before its app** (the app reads bucket names the backend
   publishes to SSM): dispatch with `deploy_infra=true, seed=true` once, then
   normal app deploys.

AWS account ids and Route53 hosted-zone ids are low-sensitivity portability
configuration, not authentication secrets. Keep them environment-scoped to
avoid cross-environment deployment drift; never substitute an invalid JSON
placeholder for either value.

For the hosted-zone context migration, the owner obtains the already-known
zone id through the normal AWS console/administrative process and sets
`CHAPTERFLOW_HOSTED_ZONE_ID` beside `CHAPTERFLOW_DOMAIN_NAME`. First synth and
deploy the frontend in a safe non-production environment, confirm its ACM/DNS
records, then promote the same pairing to production. This repository no
longer consumes or tracks `infra/cdk.context.json`, so an owner rolling back to
an older commit must regenerate that older commit's lookup context with
authorized AWS credentials before its synth/deploy. Live lookup, deployment,
DNS verification, and rollback remain owner-run actions.

## 5) Health gate & rollback

`_deploy-app.yml` curls `/`, `/pricing`, and `/api/health` on the CloudFront
domain after every deploy and **fails the job on any non-2xx**. On failure it
writes rollback steps to the run summary and (for prod) opens a `deploy-failure`
issue. **Rollback** = re-run `Deploy` on the last good commit/tag (OpenNext
bundles are immutable per-commit, so this restores the prior Lambda + assets).
Stateful RETAIN resources are not rolled back by an app redeploy.

## 6) Lint policy (advisory)

`npm run verify` = `typecheck && test && build` (the enforced gate). ESLint is
run separately and is **advisory** — the web-app lint surface (`app/`,
`components/`, `lib/`) carries pre-existing debt, so the CI lint job reports it
without blocking. Pay it down, then promote `Lint (advisory)` to a required
check. The offline v21 pipeline (`scripts/book/prompts/chapterflow-v21-authored`)
has its own npm workspace package and CI job; the CDK package (`infra/**`) is
excluded from the app lint surface.

## 7) Troubleshooting

- **"Could not assume role"** — check `AWS_DEPLOY_ROLE_ARN` (environment-scoped),
  the OIDC trust policy `sub`, and that the OIDC provider exists.
- **Frontend deploy throws "requires BOOK_INGEST_BUCKET/BOOK_CONTENT_BUCKET"** —
  the backend stack for that env hasn't been deployed yet (no SSM params).
  Deploy infra first.
- **Reproduce CI locally:**
  ```bash
  npm ci && npm run verify          # typecheck + test + build
  npm run pipeline:typecheck
  npm run pipeline:test
  npm run pipeline:doctor
  npx open-next build
  npm --prefix infra ci && npm --prefix infra run build
  cd infra && npx cdk synth -c env=dev ChapterFlowBackend-dev
  ```
