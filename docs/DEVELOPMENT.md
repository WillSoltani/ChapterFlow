# Development Guide

## Working style expected in this repo
- Prefer targeted changes over broad rewrites
- Keep behavior stable unless the task explicitly changes product behavior
- Move logic only when the new location is clearly better for ownership or reuse
- Favor feature local organization over large global utility buckets

## Code organization rules

### Frontend
- Keep page composition in the page client
- Move repeated rendering patterns into feature local components first
- Extract shared helpers into `app/book/_lib` or `app/app/_lib` only when used across multiple features
- Keep hooks focused on state, persistence, and orchestration. Avoid burying markup in hooks

### Backend
- Route handlers should stay thin
- Put persistence, validation, and integration logic in the relevant `_lib` module
- Do not duplicate entitlement, auth, or key generation logic across routes
- Validate inputs at the route boundary

## Naming conventions
- Components: `PascalCase`
- Hooks: `useSomething`
- Utilities and helpers: `camelCase`
- Types: `PascalCase`
- Route folders should reflect the user visible resource hierarchy

## Adding a new ChapterFlow feature
1. Identify the feature domain first
2. Add or extend backend routes if persistence is required
3. Add or extend a feature hook for client state and API calls
4. Keep presentational components in the feature folder unless reused elsewhere
5. Reuse Book UI primitives when possible, but do not force every feature into one shared component set
6. Update docs if the feature changes architecture, state flow, or content operations

## Adding a new book
1. Add the book package JSON under `book-packages/`
2. Validate the package against the existing strict package validator
3. Add or confirm the cover asset under `public/book-covers/`
4. Wire any required presentation metadata in `app/book/data/bookPackages.ts`
5. Run the admin ingestion and publish flow if you are testing the backend content path
6. Verify the library, detail page, reader, progress, and quizzes render correctly

## Extending ChapterFlow domains

### Profile
- Keep derived analytics in hooks and local selectors, not scattered inline across the page
- Use reusable cards for repeated information blocks

### Settings
- Keep control metadata declarative where possible
- Prefer extracting repeated control patterns and billing or persistence logic rather than splitting every section into a separate file

### Library
- Filters, sorting, pagination, and category reveal state should stay independent from rendering
- Treat saved books, engaged books, and catalog books as separate datasets

### Progress and analytics
- Estimated reading time is content metadata only
- Goal progress, streaks, and reading analytics must use actual tracked reading time

### Badges
- Badge definitions live in the data layer
- Badge evaluation should use persisted user activity, not purely visual state

## Book backend guidelines
- Keep Book route handlers under `app/app/api/book`
- Reuse `repo.ts`, key helpers, and response helpers before introducing new persistence utilities
- Treat admin ingestion and publish flows as privileged operations only
- Server side entitlement checks should remain authoritative

## Documentation expectations
Update docs when changes affect:
- repository structure
- developer workflow
- backend responsibilities
- book ingestion or content structure
- user state persistence

## Before merging or handing off work
Run the checks that match your change set:

```bash
npm run build
npm run lint
npm run test:pdf-fill
npm --prefix infra run build
npm --prefix infra run cdk -- synth
```

Not every task needs every command, but build verification is the minimum standard for UI and route changes.
