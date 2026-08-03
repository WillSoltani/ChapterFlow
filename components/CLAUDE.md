# components/ — route-level UIs (migrated routes)

Global rules live in the root [CLAUDE.md](../CLAUDE.md). The components/ ↔
app/book/ split is mid-upgrade (S-Tier campaign) — expect this file to be
revised as routes migrate.

## What is live where
- Migrated routes render from here: `app/book/library/page.tsx` →
  `library/LibraryPage`, `app/book/progress/page.tsx` → `progress/ProgressPage`,
  `app/dashboard/page.tsx` → `workspace/WorkspacePage`, `app/page.tsx` →
  `landing/*`, `app/books/page.tsx` → `website/BrowseLibraryPage`.
- **Most `app/book/**/*Client.tsx` pages are still the LIVE render path** for
  their routes (each is imported by its own sibling `page.tsx`) — the old
  "largely dead" claim is stale. The truly dead files are a small set inside
  `app/book/components/` (e.g. `BookCard.tsx`, `GoalPicker.tsx`,
  `StreakBadge.tsx` — zero importers).
- **Mount check before editing anything:** grep the component name across
  `app/**/page.tsx` and `app/**/layout.tsx`. No importer chain from a mounted
  page = dead.

## Primitives
- `components/ui/` is the canonical primitive set (shadcn — `components.json`
  `aliases.ui` → `@/components/ui`; cva + Radix). New components use it.
- A second, still-live set exists at `app/book/components/ui/` (Toast,
  ErrorBanner, …) — live pages here import from it (`LibraryPage`,
  `ProgressPage`, `WorkspacePage`). Never delete it as "legacy cleanup"
  without re-checking importers.

## Traps
- The boundary runs BOTH ways: components/* back-imports hooks/data/UI from
  `app/book/**` (TopNav, `useLibraryDashboard`, `booksCatalog`), and
  `app/book/**` imports `components/ui` (Dialog, BookCover). Treat the two
  trees as one intertwined layer, not a clean one-directional boundary.
- Onboarding UI is NOT here — it lives in `app/onboarding/components/`.

Subfolders: `ui/` (primitives) · `library/`, `progress/`, `workspace/` (app
routes) · `landing/`, `sections/`, `website/` (marketing) · `auth/`
(AuthScreen + token-expiry guard) · `applink/` (deep-link interstitial).
