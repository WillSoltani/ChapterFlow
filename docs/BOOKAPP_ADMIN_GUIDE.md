Author: Will Soltani

# ChapterFlow Admin Guide

This note covers two things:
1) how to upload/publish a JSON book package so it is available through Book API endpoints, and
2) how to upload book cover images so they appear across the ChapterFlow app UI.

## 1) Upload A JSON Book Package

### Prerequisites
- You are signed in as a Cognito user in the admin group (`BOOK_ADMIN_GROUP`, defaults to `admin`).
- Book API env vars are configured in runtime:
  - `BOOK_TABLE_NAME`
  - `BOOK_INGEST_BUCKET`
  - `BOOK_CONTENT_BUCKET`
- Your package JSON follows the backend validator format.

### Accepted JSON shapes (important)
The backend validator now accepts all of these:
- `chapters` at top-level (recommended) OR `book.chapters`
- chapter variants using either:
  - `summaryBullets` + `takeaways`, OR
  - `importantSummary` + `keyTakeaways`
- optional variant practice arrays:
  - `practice`
- quiz answer index using either:
  - `correctAnswerIndex`, OR
  - `correctIndex`
- `book.edition` as string OR object like:
  - `{ "name": "Reference", "publishedYear": 2018 }`

### Fast upload method (script)
Use the helper script from repo root:

```bash
node scripts/book/upload-book-package.mjs \
  --origin https://your-app-domain \
  --token "<COGNITO_ID_TOKEN>" \
  --file book-packages/friends-and-influence-student-edition.student.json \
  --publish
```

Notes:
- `--publish` is optional; without it, version is ingested as draft.
- You can also set `BOOK_ADMIN_TOKEN` and omit `--token`.

### Manual API method (if needed)
1. `POST /app/api/book/admin/books/upload-request`
2. PUT JSON to returned `uploadUrl`
3. `POST /app/api/book/admin/ingest/run` with `{ jobId, publishNow }`
4. Poll `GET /app/api/book/admin/ingestions/{jobId}`

### Verify published catalog
- `GET /app/api/book/books`
- `GET /app/api/book/books/{bookId}`

If status fails:
- Check `errorReportKey` from ingestion job.
- Review CloudWatch logs for `book_api_unhandled_error` or validation details.

---

## 2) Upload Book Cover Images For UI

Use this folder:

- `public/book-covers/`

### Naming convention
Use the exact `bookId` with one of these extensions:
- `.svg`
- `.png`
- `.jpg`
- `.jpeg`
- `.webp`
- `.avif`

Example:
- `public/book-covers/friends-and-influence-student-edition.svg`

### Where covers automatically appear
- onboarding book cards
- home dashboard cards
- library cards
- book detail overview panel

If no image file exists, the app falls back to the existing emoji icon.

### Custom filename (optional)
Set `coverImage` on the book entry in:
- `app/book/data/booksCatalog.ts`

Example:
```ts
{
  id: "atomic-habits",
  coverImage: "/book-covers/atomic-habits-special-edition.png",
  // ...
}
```

---

## 3) Production Release Checklist (ChapterFlow app)

- `npm run build` passes.
- Book API admin endpoints respond (auth + group check).
- Ingestion succeeds and at least one book version is `PUBLISHED`.
- `GET /app/api/book/books` returns expected catalog.
- Cover images resolve from `public/book-covers` with no broken assets.
