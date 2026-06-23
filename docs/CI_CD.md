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
2. **Environment-scoped secrets** (per environment): `AWS_DEPLOY_ROLE_ARN`,
   `AWS_ACCOUNT_ID`, `CHAPTERFLOW_DOMAIN_NAME` (omit for dev/staging to serve on
   the CloudFront domain), `CHAPTERFLOW_APP_BASE_URL`, `CHAPTERFLOW_OPS_ALERT_EMAIL`,
   the `COGNITO_*`, `AUTH_*`, `BOOK_STRIPE_*`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`,
   `ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY`. prod uses today's live values.
3. **OIDC role** (`AWS_DEPLOY_ROLE_ARN`): an IAM role trusting GitHub OIDC
   (`token.actions.githubusercontent.com`, aud `sts.amazonaws.com`) scoped to
   `repo:WillSoltani/ChapterFlow:*`, with CDK-deploy permissions. One role per
   account is fine since all envs share the account.
4. **Bootstrap** is already done for the account. A brand-new env's **backend
   must deploy before its app** (the app reads bucket names the backend
   publishes to SSM): dispatch with `deploy_infra=true, seed=true` once, then
   normal app deploys.

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
