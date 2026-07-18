# Scripts reference

Every non-trivial script in the root `package.json`, grouped by purpose, with
when-to-run notes. `infra/` is a separate package with its own scripts — see
[the infra section](#infra-separate-package) at the bottom.

> **Live-sync scripts:** `register:api` and `verify:live` talk to deployed AWS
> resources. They are **not** casual local commands — see
> [Live-sync scripts](#live-sync-scripts-touch-deployed-aws) before running either.

## Day-to-day

| Script | What it does | When to run |
|--------|--------------|-------------|
| `dev` | `next dev` on `127.0.0.1:3000` with `DEV_AUTH_BYPASS=1` and all localhost URL/Cognito env baked in (separate `.next-chapterflow` dist dir). Works with zero AWS config. | Daily local development. |
| `dev:3001` | Same as `dev` on port 3001. | Second local instance alongside another. |
| `build` | `next build` (production build). | Build validation; also runs inside `verify`. |
| `build:open-next` | `npx open-next build` — the OpenNext/Lambda bundle for AWS. | Before an infra/CDK deploy of the app. |
| `start` | `next start` — serve a production build locally. | Smoke-testing a local prod build. |
| `prepare` | Sets `core.hooksPath .githooks` (repo git hooks). | Automatic on `npm install`; never run by hand. |

## Quality gates

| Script | What it does | When to run |
|--------|--------------|-------------|
| `verify` | Composite gate: `typecheck && test && scan:style && build`. | Before every push/PR — the canonical pre-push gate. |
| `typecheck` | `tsc --noEmit` (excludes `infra/**`). | Part of `verify`; run alone for a fast check. |
| `lint` | `eslint .` (excludes `infra/**`). | Advisory — known in-scope debt, not a blocking gate. |
| `scan:secrets` | Blocks committed build artifacts, secret-shaped tokens (Stripe/AWS/Anthropic/… keys, PEM), and transient QC files. Runs `--all` + `--selftest`. | CI and pre-commit hook; run manually before large imports. |
| `scan:style` | Design-system drift gate: dead Tailwind arbitrary CSS-var syntax, undeclared `--cf-`/`--cr-` tokens, raw color literals in TSX, catalog-size literals bypassing `lib/catalog-stats`. Baselined via `scripts/ci/style-drift-allowlist.txt` — only NEW drift fails. | Part of `verify`; CI + pre-commit. |

## Test tiers

| Script | What it does | When to run |
|--------|--------------|-------------|
| `test` | Unit suite: `tsx --test` over `*.test.ts` / `*.test.tsx` in `app/`, `lib/`, `components/`, `tests/`. Fails if discovery finds < 137 files (glob-regression guard, WS7-011). | Standard suite; part of `verify`. |
| `test:integration` | `*.itest.ts` under `app/`, `lib/`, `tests/` — a thin tier (currently 2 files: `audio-plan.itest.ts`, `journey.itest.ts`). Not part of `verify`. | When touching those flows. |
| `test:e2e` | `playwright test` (testDir `e2e/`); default config greps OUT `@visual`/`@prod` tags, so this runs the smoke spec. | End-to-end smoke coverage. |
| `test:visual` | `RUN_VISUAL=1 playwright test` — only `@visual`-tagged specs. A LOCAL opt-in gate; snapshots are not reliable on the Linux CI runner. | Local visual-regression check. |
| `test:visual:update` | Same plus `--update-snapshots`. | Refresh visual baselines after an approved UI change. |

## Native iOS contract

| Script | What it does | When to run |
|--------|--------------|-------------|
| `contract:native:generate` | Regenerates the checked-in native-contract bundle (`contracts/native-ios/v1/contract-bundle.json`) from the contract registry. | After changing any type/route the native contract covers (repo/streak-repo/types edits). |
| `contract:native:check` | Same generator with `--check` (no write) + the two contract test files. A real CI gate (WP-CONTRACT-01). | Before pushing backend changes that touch the native surface. |

## Live-sync scripts (touch deployed AWS)

| Script | What it does | When to run |
|--------|--------------|-------------|
| `register:api` | **WRITES to the live book table + content/ingest buckets.** Runs the exact production ingestion path (`ingestBookPackageFromS3`) per book slug, then rebuilds the search/presentation indexes. `--dry-run` validates without touching AWS. Needs `AWS_PROFILE` + `BOOK_*` env. | Manually, per book, after a bundle-only book publish — never as a routine local command. |
| `verify:live` | **Read-only, but hits deployed AWS + the live origin**: compares repo package hashes against S3 and the served API (`/api/health`, `/app/api/book/books/<id>`), and rewrites `book-packages/.pending-deploy.json` locally (never commits, never writes to S3, never deploys). | After a book publish/deploy, to confirm live surfaces caught up. |

## Book pipeline (background tooling, not the web app)

All delegate to the `@chapterflow/v21-authored` workspace
(`scripts/book/prompts/chapterflow-v21-authored/`):

| Script | What it does |
|--------|--------------|
| `pipeline:typecheck` / `pipeline:build` | Workspace `tsc --noEmit` (build is also just the typecheck). |
| `pipeline:test` | Full pipeline suite in no-API mode (`CHAPTERFLOW_NO_API_CODEX_QC=1`). |
| `pipeline:test:focused` | Named fast subset (package/provider contracts, gold corpus, publish gates). |
| `pipeline:doctor` | Local preflight for known workspace traps (shadow state dir, dual brief shapes). Run before starting pipeline work on a book. |

## Infra (separate package)

`infra/` has its own `package.json` and is **excluded from root
`typecheck`/`lint`/`test`** — root `verify` never touches it. For CDK work:

```bash
npm --prefix infra run build                                  # tsc
npm --prefix infra run test                                   # infra's own 12-file test suite
npm --prefix infra run cdk -- synth -c env=dev ChapterFlowBackend-dev
```
