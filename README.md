# ChapterFlow

ChapterFlow is a standalone guided reading product built with Next.js, AWS services, and structured book package content. This repo is the SiliconX deployment copy and is intended to power:

- `https://siliconx.ca`
- `https://chapterflow.siliconx.ca`
- `https://auth.siliconx.ca`

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
- AWS DynamoDB, S3, Step Functions, Lambda, Cognito, SSM
- Stripe
- CDK for infrastructure

## Important routes
- `/` ChapterFlow product home
- `/book` onboarding entry
- `/book/workspace` dashboard
- `/book/library` library
- `/book/profile` profile
- `/book/progress` progress
- `/book/settings` settings
- `/book/badges` badges
- `/book/saved` saved queue
- `/auth/login`
- `/auth/callback`
- `/auth/logout`

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
npm run verify
npm run test:pdf-fill
```

## Required environment
At minimum configure:

```text
CHAPTERFLOW_DEPLOYMENT_MODE=standalone
NEXT_PUBLIC_CHAPTERFLOW_SITE_URL=https://siliconx.ca
NEXT_PUBLIC_CHAPTERFLOW_APP_URL=https://chapterflow.siliconx.ca
NEXT_PUBLIC_CHAPTERFLOW_AUTH_URL=https://auth.siliconx.ca
CHAPTERFLOW_SITE_BASE_URL=https://siliconx.ca
CHAPTERFLOW_APP_BASE_URL=https://chapterflow.siliconx.ca
CHAPTERFLOW_AUTH_BASE_URL=https://auth.siliconx.ca
AUTH_COOKIE_DOMAIN=.siliconx.ca
CHAPTERFLOW_COOKIE_DOMAIN=.siliconx.ca
```

Recommended Cognito shape:

```text
COGNITO_DOMAIN=https://login.siliconx.ca
COGNITO_CUSTOM_DOMAIN=https://login.siliconx.ca
COGNITO_REDIRECT_URI=https://siliconx.ca/auth/callback
COGNITO_LOGOUT_REDIRECT_URI=https://siliconx.ca/
```

## Deployment model
- `siliconx.ca` serves the ChapterFlow front page
- `chapterflow.siliconx.ca` serves the app workspace
- `auth.siliconx.ca` serves the auth shell
- `login.siliconx.ca` is reserved for Cognito Hosted UI if you use a custom domain

## Notes
- Book JSON package contents under `book-packages/` are source content and should not be refactored casually
- Estimated reading time is content metadata only. Goal tracking uses actual tracked reading time
- This repo defaults to the standalone ChapterFlow deployment mode
