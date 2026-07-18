# infra/ — AWS CDK (its own package)

Global rules live in the root [CLAUDE.md](../CLAUDE.md).

## Not covered by root checks
Root `npm run typecheck` / `lint` / `test` all EXCLUDE `infra/**`
(root tsconfig + eslint config + test glob). Verify infra changes yourself:

```bash
npm --prefix infra run build     # tsc
npm --prefix infra run test      # infra's own 12-file suite (lib/ + lambda/lib/)
npm --prefix infra run cdk -- synth -c env=dev ChapterFlowBackend-dev
```

## Environment model — get the direction right
Three environments in ONE AWS account, distinguished only by a resource-name
suffix (`infra/lib/env-config.ts` — `resolveEnvConfig`):
**prod = EMPTY suffix** (the unsuffixed set is the live, data-bearing one);
dev/staging append `-dev` / `-staging`. Easy to state backwards — don't.
There is no per-env account variable anywhere in infra/.

## Source-of-truth files
- `infra/bin/app.ts` — CDK entrypoint; the canonical list of every
  app-injected secret/env var (the `serverEnv` block) + the prod-only
  required-secret assertion.
- `infra/lib/env-config.ts` — env → suffix/table-name/SSM-prefix/removal-policy.
- `infra/lib/chapterflow-backend-stack.ts` — DynamoDB, cron Lambdas, SES/SNS.

## Traps
- **Lambda bundles are pre-built and committed** (`infra/lambda/dist/`). The
  CI freshness gate (`.github/workflows/_deploy-infra.yml`, "Verify Lambda
  bundle freshness") rebuilds and git-diffs `reading-reminder-cron.js` and
  `suppression-handler.js` ONLY — `cognito-pre-signup.js` is NOT covered, so a
  stale cognito bundle ships silently. Rebuild it manually when touching its
  source (esbuild commands are documented in comments in
  `chapterflow-backend-stack.ts`).
- The freshness gate lives in CI, not in infra/ code — a local `cdk synth`
  will not catch a stale bundle.
