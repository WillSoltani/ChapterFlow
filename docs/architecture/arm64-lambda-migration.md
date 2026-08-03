# ADR: arm64 Lambda migration (WS6-013)

## Status

Partial — backend crons migrated; frontend (server/image) tracked, not yet migrated.

## Context

AWS Graviton (`arm64`) Lambdas are cheaper per GB-second and generally
equal-or-faster than `x86_64` for Node.js workloads. ChapterFlow's Lambdas
split into two build paths with different portability:

- **Backend crons** (`infra/lib/chapterflow-backend-stack.ts`):
  `ReadingReminderCron`, `EmailSuppressionHandler`, `CognitoPreSignUpLinker`.
  These deploy the committed pure-JS bundles under `infra/lambda/dist`,
  built locally with `esbuild --platform=node --target=node20` and
  `@aws-sdk/*` marked external (resolved from the Node 20 runtime layer).
  Plain JS with no native/arch-specific dependencies is
  architecture-agnostic — the same bundle runs identically on `x86_64` or
  `arm64`.
- **Frontend server/image functions** (`infra/lib/chapterflow-frontend-stack.ts`):
  `ServerFn`, `ImageFn`, and the auxiliary OpenNext functions
  (`RevalidationFn`, `DynamoProviderFn`, `WarmerFn`) deploy artifacts
  produced by the OpenNext build (`.open-next/`), not our own esbuild step.
  `ImageFn` in particular bundles the `sharp` native image library, which
  ships architecture-specific prebuilt binaries — an `x86_64`-built `sharp`
  binary cannot run on an `arm64` Lambda runtime (and vice versa).

## Decision

1. Set `architecture: lambda.Architecture.ARM_64` on the three backend
   cron Lambdas (`ReadingReminderCron`, `EmailSuppressionHandler`,
   `CognitoPreSignUpLinker`). No rebundle is required — the committed
   `infra/lambda/dist` assets are already architecture-agnostic.
2. Leave `ServerFn`, `ImageFn`, and the OpenNext auxiliary functions
   (`RevalidationFn`, `DynamoProviderFn`, `WarmerFn`) pinned to `x86_64`
   for now, with an inline comment at each call site tracking the reason
   and the unblock condition.

## Path to migrating the frontend functions

Before flipping `ServerFn`/`ImageFn`/the OpenNext auxiliary functions to
`arm64`:

- Confirm OpenNext's build supports emitting `arm64` artifacts for the
  Node.js server function and for `sharp` in the image-optimization
  function (e.g. via an `open-next.config.ts` option such as
  `imageOptimization: { arch: "arm64" }`, if/when OpenNext exposes one).
- Verify the CI build step that produces `.open-next/` targets the same
  architecture the Lambda will run on (a mismatched `sharp` binary fails
  at cold start, not at synth/build time).
- Re-run the deploy-gated proof (`aws lambda get-function-configuration
  --query Architectures`) against a non-prod environment before touching
  prod.

## Consequences

- Backend crons get the Graviton cost/perf benefit today with zero
  bundle changes.
- Frontend functions stay on the well-understood `x86_64` OpenNext build
  path until the arm64 artifact question above is explicitly evaluated —
  this finding is tracked here and in code comments, not silently
  dropped.
