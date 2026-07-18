# Shared-code layers

This documents the target boundary between the web app's shared-code
locations, established by WS3-007 (the lint-enforced `lib/` boundary) and
WS3-005 (catalog-source consolidation). It is a map of *where things live and
why*, not a style guide.

## The layers

### `lib/` — isomorphic shared base

`lib/` is the base layer. It may be imported by anything (`app/`,
`components/`), but it must never import upward from either — no `@/app/*`,
no `@/components/*`. This is enforced by an ESLint `no-restricted-imports`
override in `eslint.config.mjs` scoped to `lib/**/*.{ts,tsx}` (WS3-007).

Code belongs in `lib/` when it is genuinely shared across layers (types,
pure data transforms, constants, cross-cutting utilities) and can be kept
free of `app/`/`components/`-owned dependencies. When a module in `lib/`
needs data or a type that currently lives higher up, the fix is to **move the
data/type down into `lib/`**, not to import upward — the original location
becomes a thin re-export shim so existing importers are untouched (see
`app/book/data/booksCatalog.ts` → `lib/books-catalog.ts`, and
`components/progress/progressTypes.ts`'s `ReaderLevel` → `lib/reader-levels.ts`).

Test files under `lib/` follow the same rule: a test that needs to import a
`components/`-owned module belongs *next to that module* (e.g.
`components/landing/recall/book-filter.test.ts`), not under `lib/` — the test
runner globs `app/`, `lib/`, `components/`, and `tests/`, so colocating a test
with its subject no longer costs it test-runner coverage.

### `app/app/api/**/_lib` — server-only route helpers

Route handlers under `app/app/api/**/route.ts` do not talk to DynamoDB or S3
directly (enforced by a separate `no-restricted-imports` override, WS3-002);
that logic lives in `app/app/api/book/_lib/`, guarded by `import "server-only"`
where applicable. Within `_lib/`, naming signals role:

- `*-repo.ts` — a single entity's DynamoDB CRUD (e.g. `book-catalog-repo.ts`,
  `progress-repo.ts`). Split out per-entity from a former monolithic `repo.ts`
  (WS3-004).
- `*-service.ts` — orchestration across repos/external calls for one use case
  (e.g. `quiz-submit-service.ts`).
- `*-core.ts` — a pure, server-only-*free* seam factored out of a `server-only`
  module specifically so it can be unit-tested without the guard (e.g.
  `library-catalog-index-core.ts`, `quiz-submit-core.ts`). This is the
  pattern to reach for when a `server-only` module's pure decision logic needs
  direct test coverage: extract and export the pure function from a `*-core`
  sibling, rather than hand-reproducing it in a test (WS3-005 did this for
  `resolveListChapterCount`, previously copy-pasted into a test because the
  real function was unexported inside `library-catalog.ts`).

### `app/book/_lib` — client-side legacy layer

`app/book/_lib` and the broader `app/book/*` client tree predate the current
`lib/` vs. `components/` split and still hold client-side logic that
structurally belongs in `lib/` (or should fold into the live `components/*`
tree). This consolidation is **out of scope here** — it is owned by the
frontend-ui lane under **WS3-001** (components/app-book consolidation).
This doc references that boundary so nothing in `app/book/_lib` is mistaken
for the `lib/` base layer; do not treat it as lint-enforced the way `lib/` is.

### `app/app/api` — the double-nested API path

API routes live at `app/app/api/**`, not `app/api/**` — this is intentional,
not a typo, so it is left as a one-line pointer here. The full rationale is
its own finding, **WS3-015**; this doc does not duplicate it.

## Catalog sources: what "catalog definition" means here

Three locations were audited as candidate catalog-logic duplication. They
turned out to be **two distinct catalog definitions serving different data
sources**, plus one QA/guard module that is not a catalog definition at all —
not three copies of the same thing. "Catalog definition" below means: the
list of a book's presentational fields (title, author, category, difficulty,
chapter count, synopsis, cover) as an authoritative source, as opposed to
code that merely *consumes* or *validates* one.

1. **`lib/books-catalog.ts`** (moved from `app/book/data/booksCatalog.ts` by
   WS3-007; `app/book/data/booksCatalog.ts` is now a re-export shim) — the
   **static, build-time catalog**, sourced from the committed
   `lib/books-catalog.metadata.json` snapshot. Used by client-rendered pages
   (marketing/browse/onboarding) that need catalog data without a live
   DynamoDB round trip. Canonical types: `BookCatalogItem`,
   `BookCatalogMetadata`.

2. **`app/app/api/book/_lib/library-catalog.ts`** (+ its pure seam,
   `library-catalog-index-core.ts`) — the **live, server-only catalog**,
   authoritative from DynamoDB (`book-catalog-repo.ts`) and enriched at
   read-time with the S3 presentation-index overlay
   (`book-content/library/catalog.json`, parsed by
   `library-catalog-index-core.ts`). Backs the `/api/book/library` list and
   detail endpoints. Canonical type: `LibraryCatalogBook`
   (`app/book/_lib/library-data.ts`), a different shape from
   `BookCatalogItem` above by design — it carries live fields (`pages`,
   `publishedVersion`, resolved cover URLs) that the static snapshot doesn't
   have and the live DB doesn't need to fake.

   These two were **not force-merged**: they read from genuinely different
   sources (a committed JSON file vs. DynamoDB + S3) with genuinely different
   runtime constraints (isomorphic/client-safe vs. `server-only`). Merging
   their types would mean threading a live-only shape through static
   marketing pages, or vice versa. What *was* shared and is now explicit:
   both delegate to the same `boilerplateSynopsis` template (in
   `lib/library-catalog-stub.ts`, see below) so the two surfaces can never
   show divergent fallback copy.

3. **`lib/library-catalog-stub.ts`** — **not a catalog definition**. It is a
   QA/invariant-guard module: stub-chapter-count detection (DI-4) and the
   canonical boilerplate-synopsis template + detector
   (DETAIL-BOILERPLATE-SYNOPSIS). `library-catalog.ts`'s `fallbackSynopsis`
   already delegated to `boilerplateSynopsis` here before this pass — that
   was already correct, single-sourced sharing, not duplication.

### What was actually deduplicated

The one genuine duplication found: `library-catalog.ts`'s list-path
chapter-count floor (`Math.max(1, Math.round(...))` over the
presentation-index count vs. a fallback count) was hand-reproduced, by
necessity, inside `lib/library-catalog-stub.test.ts` as a local
`resolveListChapterCount`, because the real logic lived inline in
`server-only`, unexported `buildLibraryCatalogBook`. WS3-005 extracted it as
an exported `resolveListChapterCount` in `library-catalog-index-core.ts`
(already the pure, testable seam for this exact domain), wired
`library-catalog.ts` to call it, and moved its tests to
`app/app/api/book/_lib/library-catalog-index-core.test.ts` — next to the real
function, exercising the real function, instead of a hand-copied mirror
living under `lib/`.

### Acceptance

- One canonical module per data source: `lib/books-catalog.ts` (static) and
  `app/app/api/book/_lib/library-catalog.ts` (live), each documented above
  with why they stay separate.
- `app/book/data/booksCatalog.ts` is a re-export shim, not a second
  definition.
- `lib/library-catalog-stub.ts` remains the single source for the
  boilerplate-synopsis template and the DI-4 stub guard; it is not, and was
  never, a catalog definition.
- The one duplicated computation (`resolveListChapterCount`) now has exactly
  one implementation and one test file.
