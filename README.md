# ChapterFlow

ChapterFlow is a standalone guided reading product built with Next.js, AWS services, and structured book package content. This is the ChapterFlow product repo and powers:

- `https://chapterflow.ca` (marketing)
- `https://app.chapterflow.ca` (app)

The app focuses on chapter based learning with summaries, examples, quizzes, notes, progress, saved reads, settings, profile analytics, and subscription aware access.

## Core product areas
- Book library and discovery
- Chapter reader with summary, examples, and quiz modes
- Actual reading time tracking
- Progress, streaks, badges, and profile analytics
- Saved books and Read Next flow
- Admin ingestion path for validated book package uploads
- Stripe ready entitlement model for Free and Pro access

## Tech stack
- Next.js App Router
- React 19
- TypeScript
- Tailwind CSS 4
- AWS DynamoDB, S3, Lambda, Cognito, SSM
- Stripe
- CDK for infrastructure

## Important routes
- `/` ChapterFlow product home (public marketing)
- `/pricing` plans & pricing (public)
- `/books` public catalog browse (public, ISR)
- `/onboarding` onboarding entry (also `/book` when signed in, then redirects)
- `/dashboard` authenticated home / workspace (the real post-login landing)
- `/book/library` library
- `/book/library/[bookId]/chapter/[chapterId]` chapter reader (Summary → Examples → Quiz)
- `/book/progress` progress
- `/book/profile` profile
- `/book/settings` settings
- `/book/badges` badges
- `/book/saved` saved queue
- `/book/admin` admin console (Cognito admin group only)
- `/auth/login`, `/auth/callback`, `/auth/logout` OAuth route handlers

> Permanent redirects (`next.config.ts`): `/book/workspace`, `/book/workspace/*`,
> and `/book/home` → `/dashboard`. The old `/book/workspace` route no longer
> renders a page.

## Local development

### Install
```bash
npm install
npm --prefix infra install
```

### Run locally
```bash
npm run dev
```

Default local URL:
- `http://localhost:3000`

Optional alternate port:
```bash
npm run dev:3001
```

### Verification
```bash
npm run verify   # typecheck + unit tests + style-drift scan (scan:style) + next build (the CI hard gate)
npm test         # unit tests only (node test runner via tsx)
npm run lint     # advisory — known in-scope debt, not a blocking gate
```

The full script catalogue (test tiers, scanners, native-contract generator,
live-sync tools, pipeline scripts) is documented in
[docs/SCRIPTS.md](docs/SCRIPTS.md).

## Deployment & environments
Three environments run in one AWS account, suffixed `dev` / `staging` / `prod`
(prod is the unsuffixed, data-bearing set). Push to `main` auto-deploys **dev**;
`staging`/`prod` are manual and prod is approval-gated. See:

- [docs/CI_CD.md](docs/CI_CD.md) — pipeline mechanics & one-time setup
- [docs/OPERATIONS.md](docs/OPERATIONS.md) — runbook, health checks, rollback
- [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md) — **the complete env-var matrix** (what's required, and whether it's CDK-injected, a deploy secret, or an SSM param)
- [docs/LAUNCH_CHECKLIST.md](docs/LAUNCH_CHECKLIST.md) — production launch checklist

## Required environment
Configuration is **not** a single flat `.env` — see
[docs/ENVIRONMENT.md](docs/ENVIRONMENT.md) for the full matrix and resolution
order. In short:

- **Local dev:** `npm run dev` injects the standalone single-host URLs and
  `DEV_AUTH_BYPASS=1`, so the UI loads with no AWS and no login. To hit real
  data locally, add AWS credentials + either the `BOOK_*` table/bucket names or
  `SSM_PARAMETER_PREFIX=/chapterflow/dev` to a gitignored `.env.local`.
- **Deployed envs:** the data-plane names (`BOOK_TABLE_NAME`,
  `BOOK_CONTENT_BUCKET`, …) are auto-injected by CDK; secrets (Cognito, Stripe,
  `AUTH_STATE_SECRET`, `ANTHROPIC_API_KEY`, …) come from per-environment GitHub
  secrets; and SSM-only config (`VAPID_*`, `SES_SENDER_EMAIL`, optional tuning)
  must be set as `/chapterflow/<env>/<KEY>` parameters. The canonical list of
  app-injected secrets is `infra/bin/app.ts`.

> **Deployment model:** the app runs **standalone single-host** today — the
> `site` / `app` / `auth` URL helpers all resolve to one origin
> (`app/_lib/chapterflow-brand.ts`); `middleware.ts` / `next.config.ts` do no
> host routing. The multi-subdomain shape in older docs is config-only. Note the
> legacy-default domain inconsistency called out in
> [docs/ENVIRONMENT.md §5](docs/ENVIRONMENT.md) — pin the real origin with
> `CHAPTERFLOW_APP_BASE_URL` rather than relying on a default.

## Notes
- Book JSON package contents under `book-packages/` are source content and should not be refactored casually
- Estimated reading time is content metadata only. Goal tracking uses actual tracked reading time
- This repo defaults to the standalone ChapterFlow deployment mode
