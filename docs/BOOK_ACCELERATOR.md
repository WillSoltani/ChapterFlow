# ChapterFlow

## Purpose
ChapterFlow is the reading and learning product inside this repo. It combines curated book content with chapter level reading modes, examples, quizzes, tracked reading time, progress analytics, badges, saved reading paths, and subscription aware access.

## Frontend structure

```text
app/book/
  _lib/                    Book specific client helpers
  badges/                  Achievement hub
  components/              Shared Book UI and shells
  data/                    Local catalog adapters and authored metadata
  home/                    Dashboard
  hooks/                   Shared Book hooks
  library/                 Library, book detail, reader, and reading hooks
  profile/                 Profile hub
  progress/                Analytics and progress surface
  settings/                Settings control center
```

## Backend structure

```text
app/app/api/book/
  _lib/                    Persistence, content, validation, and billing helpers
  admin/                   Admin upload, ingest, version, and publish routes
  billing/                 Stripe checkout, portal, and webhook routes
  books/                   Published catalog and chapter content routes
  me/                      User state, reading sessions, badges, settings, and quiz routes
```

## Content model

### Source packages
- Source book packages live under `book-packages/`
- Each package follows the strict Book Package contract used by the validator
- Packages include book metadata, chapter metadata, reading variants, examples, and quiz content

### Runtime content
- Packages are validated by `validate-book-package.ts`
- Ingestion writes metadata and versions into Book persistence records
- Published content is served through Book API routes rather than loaded directly from package files at runtime

## User state model
ChapterFlow separates catalog content from user activity.

### Persisted user state includes
- profile
- settings
- entitlement state
- saved books
- per book progress
- per chapter reader state
- reading session aggregates
- quiz attempts and scores
- badge awards

### Important distinction
Estimated chapter reading time is content metadata only.

Actual reading time is tracked from active chapter sessions and is the source of truth for:
- daily goals
- streaks
- reading time analytics
- progress summaries based on time

## Major hooks and responsibilities
- `useBookAnalytics` hydrates reading and progress analytics from the backend
- `useBookProfile` persists profile state
- `useBookPreferences` persists settings state
- `useBookEntitlements` loads plan details and launches billing flows
- `useBadgeSystem` evaluates badges from persisted activity and stored awards
- `useBookProgress` manages per book progress state
- `useChapterState` manages reader state for a single chapter
- `useReadingSessionTracker` tracks active reading time and posts deltas to the backend

## Library and reading flow
1. Load catalog and presentation metadata
2. Filter, sort, paginate, and render the library
3. Open a book detail page for chapter structure and progress
4. Open a chapter reader
5. Track active reading time while the reader is visible and the user is active
6. Submit quizzes and persist scores
7. Reflect changes in progress, badges, profile, and dashboard analytics

## Badges and achievements
- Badge definitions currently live in the Book data layer
- Evaluation uses persisted user progress and chapter activity
- Earned badge history is persisted so profile and dashboard views stay stable
- New badge work should keep evaluation logic centralized rather than duplicating thresholds in UI components

## Saved books and reading path
- Saved books are a dedicated user dataset and should stay separate from active or completed books
- The same saved state should be reflected consistently in library, dashboard, and future post completion recommendations

## Subscription and entitlements
- Entitlement state is read from Book backend routes
- Stripe checkout and billing portal routes are already wired
- Server side checks should remain authoritative for protected content
- UI placeholders may still exist for deeper billing details such as invoice history, but plan state should come from the backend

## Admin ingestion flow
1. Admin requests an upload target
2. Package is uploaded to the ingest bucket
3. Admin triggers ingestion
4. Package is validated and versioned
5. A version is published
6. Published content becomes available through Book content routes

## Safe extension guidance
- Add new persisted user state through Book `me` routes and repo helpers
- Add new content validation rules in the validator, not only in the UI
- Keep client side caches synchronized with backend routes, but do not treat local storage as the system of record
- When a Book page becomes too large, extract repeated logic or reusable sections first before introducing new abstraction layers
