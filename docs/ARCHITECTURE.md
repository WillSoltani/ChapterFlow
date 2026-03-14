# Architecture

## Repository overview

The repo is a single Next.js application with two primary domains.

### `Cloud Portfolio`
A document workflow product for uploads, conversions, and PDF filling.

### `ChapterFlow`
A learning product for structured reading, quiz based review, reading analytics, badges, settings, profile, and subscription aware book access.

The two domains live in the same deployment but are organized separately in the `app/` tree.

## High level structure

```text
app/
  app/                     Cloud Portfolio routes and APIs
  book/                    ChapterFlow routes, UI, hooks, and client helpers
  auth/                    Shared auth routes
  _lib/                    Shared site and auth helpers
infra/                     CDK app, Lambda worker, and deployment assets
book-packages/             Source book package JSON files
docs/                      Maintained documentation
```

## Frontend structure

### Site and shell
- `app/` root pages and layouts provide the public site shell and shared auth entry points
- `app/app/*` contains the Cloud Portfolio authenticated application
- `app/book/*` contains the ChapterFlow application

### Cloud Portfolio frontend
- Project workspace logic lives under `app/app/projects/[projectId]/`
- PDF fill logic lives under `app/app/projects/[projectId]/fill/[fileId]/`
- Large feature clients own page composition while smaller components and hooks stay close to the feature

### ChapterFlow frontend
- Page clients live in feature folders such as `home`, `library`, `progress`, `profile`, `settings`, and `badges`
- Shared UI primitives live under `app/book/components/ui`
- Shared Book specific helpers live in `app/book/_lib`
- Domain hooks live in `app/book/hooks` and `app/book/library/hooks`
- Presentational components stay inside their feature folder unless reused across Book surfaces

## Backend structure

### Cloud Portfolio backend
Next.js route handlers under `app/app/api/*` coordinate:
- Cognito authenticated access
- project and file metadata in DynamoDB
- presigned S3 upload and download flows
- conversion job submission to Step Functions
- filled PDF artifact persistence

### ChapterFlow backend
Next.js route handlers under `app/app/api/book/*` provide:
- published book catalog and chapter content access
- per user profile, settings, progress, chapter state, reading session, quiz, saved list, badge, and entitlement endpoints
- admin only book ingestion, versioning, and publish paths
- Stripe checkout, portal, and webhook handlers

Book specific server code is organized under `app/app/api/book/_lib` by concern:
- `repo.ts` for DynamoDB persistence
- `content-service.ts` and `storage.ts` for content retrieval and storage
- `quiz-service.ts` for quiz scoring and persistence
- `validate-book-package.ts` and `ingestion.ts` for package validation and ingestion
- `env.ts` for Book specific configuration resolution

## Data flow

### Cloud Portfolio
1. Client requests an upload intent
2. File is uploaded directly to S3
3. API records metadata in DynamoDB
4. User requests conversion
5. API validates the conversion through the shared capability matrix
6. Step Functions invokes the worker
7. Worker writes output artifacts and updates metadata

### ChapterFlow
1. Client loads the published catalog from backend routes and local presentation metadata
2. User specific state loads from Book user state APIs
3. Chapter reading state and actual reading time are persisted incrementally
4. Quiz submissions post to server routes and update mastery data
5. Dashboard, progress, badges, and profile analytics derive from persisted state
6. Entitlement checks gate protected or future Pro content server side

## Content architecture for ChapterFlow

Source content starts as strict JSON packages in `book-packages/`.

At ingestion time:
1. Package JSON is validated against the contract
2. Metadata and versions are written into the Book DynamoDB records
3. Content payloads are stored in content storage for runtime retrieval
4. A published version is exposed through the public Book APIs

This separation lets the UI stay lightweight while keeping authored content versioned and admin controlled.

## State management approach

### Cloud Portfolio
- Feature local hooks own network and derived view state
- Shared capability rules live in `app/app/_lib/conversion-support.ts`
- API routes remain authoritative for permissions and supported actions

### ChapterFlow
- Server persisted state is fetched through Book APIs
- Client hooks keep a local cache for responsiveness and offline tolerant behavior
- Actual reading time is tracked in chapter sessions and posted to the backend
- Analytics and badge evaluation read from backend hydrated state rather than raw content estimates

## Storage and infrastructure

### Shared AWS services
- DynamoDB for metadata and user state
- S3 for uploads, outputs, and Book content artifacts
- Cognito for authentication
- SSM for server configuration lookup

### Cloud Portfolio infrastructure
- Step Functions orchestrates conversion work
- Lambda container worker performs conversion operations
- CDK definitions live under `infra/`

### ChapterFlow infrastructure
- Uses the shared table and buckets through Book specific namespaces and keys
- Stripe integration is isolated to Book billing routes and entitlement records

## Safe extension points

### Add a new Book page
- Create the route under `app/book/<feature>`
- Keep domain logic in a hook or Book `_lib` helper if reused
- Use server routes for persisted state rather than adding new raw local storage islands

### Add a new Book backend capability
- Add a route under `app/app/api/book`
- Keep request validation and persistence in `app/app/api/book/_lib`
- Reuse existing key helpers and response utilities

### Add a new book
- Author the package JSON in `book-packages/`
- validate it through the existing validator
- ingest and publish through the admin flow
- wire presentation metadata only where the runtime still needs it

## Current constraints
- Book presentation metadata still has some local catalog and chapter adapter usage while the backend content pipeline matures
- Some Book flows intentionally keep local caches to preserve responsiveness and cross surface UI updates
- Cloud Portfolio and ChapterFlow share a repo and deployment, so changes to shared auth or storage helpers should be reviewed against both domains
