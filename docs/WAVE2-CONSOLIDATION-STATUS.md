# Wave 2 (Consolidation) — Status & Remaining Map

Branch: `ui-overhaul/integration`. Wave 0 + all 9 Wave-1 streams are merged, reviewed, fixed, and verified green (typecheck 0 · tests 103/103 · scan:style · `next build`).

## ✅ Done (committed, verified)

**Dead-code deletion** (`b25b035a1`, −3,334 lines, 32 files). Removed only files with zero importers on the integrated tree, verified by import-graph scan + per-file reference check + typecheck + build:
- Legacy dead clients: `BookHomeClient`, `BookLibraryClient`, `BookProgressClient`
- shadcn/ui graveyard: `ui/badge`, `ui/card`, `CircularProgress`, `DashboardBookCover`, `FlameIcon`, `GlassCard`, `GreenCTA`, `SessionDots`, `SparkLine`
- Zero-consumer React-Query scaffold: `book/queries/{book-fetcher,query-keys}`, `providers/BookSessionProvider`, `components/QueryBoundary`
- Superseded: `DocumentThemeRoot` (layout uses `buildDocumentThemeBootstrapScript`)
- Unused widgets/hooks: `DepthNudge`, `PrerequisiteRefresher`, `ReviewBanner`, `ReviewQueueWidget`, `StepperDots`, `ui/ConfirmModal`, `ChapterTabs`, `ReadingDepthSelector`, `usePushNotifications`, `useReflectionFeedback`, `auth/LoginButton`, `auth/LogoutButton`, `onboarding/chapterData`, `lib/book-search` (+test)

## ⏳ Remaining — needs visual QA (NOT done; do with eyes-on or Playwright)

All remaining duplicate primitive families are **divergent implementations** (verified: every pair differs by 24–323 lines), so consolidating them changes rendered output and must be visually regression-checked. Recommended canonical per family (from `docs/CHAPTERFLOW-UI-AUDIT.md`):

| Family | Files (consumers) | Recommended canonical | Risk |
|---|---|---|---|
| **BookCover** | `app/book/components/BookCover` (12), `components/library/BookCover` (12) | `app/book/components/BookCover` (candidate-fallback + external loader) | HIGH — 24 consumers |
| **ProgressRing** ×4 | `components/ui/ProgressRing` (Wave-0 canonical), `components/library/ProgressRing`, `app/book/badges/components/ProgressRing`, `app/book/library/[bookId]/components/ProgressRing` | `components/ui/ProgressRing` (a11y + motion + tokens) | MED — differing color/size APIs |
| **BookCard** | `app/book/components/BookCard` (3), `components/library/BookCard` (3) | `components/library/BookCard` (live library) | MED |
| **DailyGoalRing** | `components/progress/` (252L), `components/workspace/` (60L) | reconcile into one (progress one is richer) | MED |
| **BookRow** | `components/progress/` (229L), `components/workspace/` (156L) | context-specific — may justify keeping both renamed | LOW |
| **Chip** | `components/Chip` (24L), `app/book/components/ui/Chip` (53L) | `app/book/components/ui/Chip` | LOW |
| **ProBadge** | `components/workspace/`, `app/book/settings/components/` | one shared | LOW |
| **StreakBadge** | `app/book/components/`, `components/workspace/` | one shared | LOW |
| **EmptyState** ×3 | `components/ui/`, `components/progress/`, `app/book/admin/_components/` | `components/ui/EmptyState` (admin may stay separate) | LOW |

**Method when doing these:** pick canonical → add any props the other consumers need → migrate consumers → delete dupe → `npm run build` → **visually diff each affected screen in light + dark at 390px and 1280px** (the step that needs a human or screenshot tooling).

## ⏳ Also remaining (per prompt-pack CONSOLIDATION / prompt 11)
- `globals.css` page-scoped CSS extraction (the `/* WAVE2: extract */` markers) into co-located CSS modules — target <900 lines.
- Raw-color sweep in components → tokens (then flip the CI guard from warn to error for the newly-scoped dirs).
- Final a11y pass (every overlay on the shared `Dialog`; icon-button aria-labels) and the 10-screen consistency walkthrough in both themes.
- Backend dead-code pass (the `app/app/api/**/_lib/*` and `email-templates/*` orphans deliberately left out of this UI-scoped deletion — verify dynamic-invocation before removing).
