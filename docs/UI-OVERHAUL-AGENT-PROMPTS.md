# ChapterFlow UI Overhaul — Agent Prompt Pack

Source: 140-agent UI audit (2026-06-10), full findings in `docs/CHAPTERFLOW-UI-AUDIT.md`. Overall grade 5.5/10; target: exceptional (8+).

## How to run this

1. **Before anything:** commit the current working tree (158 modified files on `deploy/prod-readiness`), then cut an integration branch: `git checkout -b ui-overhaul/base`. Commit `docs/CHAPTERFLOW-UI-AUDIT.md` and this file to it — every agent reads the audit doc.
2. **Wave 0 first, alone:** run Prompt 1 (FOUNDATION). It owns `app/globals.css`, `next.config.ts`, the Tailwind-v4 codemod, and the shared primitives every other agent consumes. Merge it into `ui-overhaul/base` before starting Wave 1.
3. **Wave 1 in parallel:** Prompts 2–10. Territories are file-exclusive — no two agents edit the same file. Run each agent in its own git worktree branched from `ui-overhaul/base` (`git worktree add ../cf-<section> -b ui-overhaul/<section> ui-overhaul/base`). Suggested priority if you can't run all nine: READER → WORKSPACE → LIBRARY → BOOK-DETAIL → GAMIFICATION → PROGRESS → LANDING → ONBOARDING → AUTH.
4. **Wave 2 last, alone:** Prompt 11 (CONSOLIDATION & SWEEP) after Wave 1 branches merge. It deletes dead code and finishes cross-cutting cleanup, so it must see everyone's changes.
5. **Every agent prompt = SHARED CONTEXT block + its section block.** Paste both.

---

## SHARED CONTEXT (paste at the top of every agent's prompt)

You are a senior product engineer + designer working in `/Users/radinsoltani/ChapterFlow`, the ChapterFlow repo — a consumer book-learning web app (Next.js 16 App Router, React 19, Tailwind v4, framer-motion, lucide-react, CVA, recharts, TanStack Query). Your mission is part of a coordinated UI overhaul driven by the audit in `docs/CHAPTERFLOW-UI-AUDIT.md` (read your area's sections before starting — fix your territory's minor/polish findings too when cheap). The bar is exceptional consumer polish: Duolingo-crisp interactions, Headspace-warm visuals, Linear-tight consistency.

**Critical repo traps — internalize before editing anything:**
1. **Two component trees.** Live post-login screens render from the repo-root `components/` tree: `/dashboard` → `components/workspace/WorkspacePage.tsx`, `/book/library` → `components/library/LibraryPage.tsx`, `/book/progress` → `components/progress/ProgressPage.tsx`. The older `app/book/*Client.tsx` files (BookHomeClient, BookLibraryClient, BookProgressClient, BookOnboardingClient) are DEAD (`app/book/home/page.tsx` just redirects to `/dashboard`). BUT `app/book/home/components/` is partially LIVE — `TopNav.tsx`, `GlobalSearchPanel.tsx`, `InfoModal.tsx` are imported by live pages. Always trace the import chain from the route's `page.tsx` before editing; never style a dead file.
2. **Tailwind v4 syntax.** CSS-variable utilities must use parens: `bg-(--cf-accent)`, `text-(--cf-text-1)`, `font-(family-name:--font-mono)`. The v3 bracket form `bg-[--cf-accent]` compiles to INVALID CSS and is silently dropped. Never write `-[--`.
3. **Token system.** Design tokens live in `app/globals.css` (there is no tailwind.config). Canonical families after Wave 0: the `--cf-*` app tokens + the `--accent-cyan/amber/emerald/violet/rose` palette + `--bg-*`/`--text-*` semantics. The reader's `--cr-*` family is aliased onto brand tokens. RULES: no raw hex/rgba in components — use tokens; both themes must work (the DEFAULT for new users is LIGHT; always check your screens in light and dark); one brand accent (cyan) — amber for streaks/gold moments, emerald for success, rose for destructive, violet only where Wave 0 tokenized it.
4. **Truth rule (non-negotiable).** Never ship invented data: no fabricated reader counts, percentages, testimonials, "X people reading now", fake timers, or rewards the backend doesn't grant. Either wire real data, or delete/replace with honest editorial copy ("Staff pick", "67 books · 4-step loop"). Derive every catalog count from the shared catalog-stats module — never a literal.
5. **Overlay standard.** Every modal/drawer/popover you touch must use the shared `Dialog` primitive from Wave 0 (`components/ui/Dialog.tsx`): `role="dialog"`, `aria-modal`, `aria-labelledby`, focus trap, initial focus, focus restore on close, Escape closes, body scroll lock, conditional render (never an always-mounted aria-modal hidden by transform).
6. **Mobile standard.** Primary device is the phone. Touch targets ≥44px; no fixed pixel card widths inside fluid grids; respect `pb-safe` on fixed-bottom elements; no hover-only affordances (every hover reveal needs a tap/focus path); test your screens mentally at 390px.
7. **Motion standard.** Use the duration/easing tokens (`--duration-fast: 200ms`, `--duration-normal: 300ms`, `--ease-out`, `--ease-spring`) instead of magic numbers; respect `useReducedMotion()` from framer-motion AND the in-app reduce-motion preference; never animate height/width where transform works; one ambient/infinite animation per screen maximum.

**Workflow rules:**
- Work ONLY inside your TERRITORY file list. If a fix requires editing a file owned by another agent (see the ownership note in your section), do NOT edit it — write the exact requested change into a `HANDOFF` section of your final report instead.
- You may freely READ anything. You may add new files inside your territory directories.
- If you orphan a file (nothing imports it anymore), delete it in the same commit.
- Verify with `npm run verify` (typecheck + tests + build) before finishing; it must pass. Use `npm run dev` (localhost:3000, auth bypassed) to eyeball your screens — check BOTH themes.
- Commit in small logical units with clear messages. Do not push; do not merge other branches.
- Final report format: (1) what you fixed, finding by finding, with before→after; (2) what you intentionally did NOT do and why; (3) HANDOFF requests for other agents' territories; (4) verification evidence (verify output, what you checked manually in which theme/viewport).

---

## PROMPT 1 — FOUNDATION (Wave 0, runs alone, everything else depends on it)

**Branch:** `ui-overhaul/foundation` from `ui-overhaul/base`.

**Mission:** Repair the design-system substrate so every later agent builds on solid ground: fix the broken Tailwind-v4 classes, unify the token families, define the missing tokens, create the shared primitives (Dialog, ProgressRing, BookCover, Confetti, catalog-stats), and install CI guards so none of this regresses.

**TERRITORY (exclusive):** `app/globals.css`, `next.config.ts`, `app/layout.tsx`, `app/DocumentThemeRoot.tsx`, `app/_lib/document-theme.ts`, `components/ui/**`, `components/MotionProvider.tsx`, `lib/catalog-stats.ts` (or create `lib/catalog-stats.ts` if missing), new shared primitives under `components/ui/`, CI/lint config (`eslint` config, `.githooks`, `scripts/ci/**` — note: `scripts/ci/` doesn't exist yet even though package.json's `scan:secrets` references it; create the directory), plus a one-time mechanical codemod across the 10 files listed in task 1 (string-replacement only — no other edits to those files; their owners restyle later).

**Tasks:**

1. **Tailwind v4 codemod (CRITICAL).** 65 occurrences of the dead v3 syntax `-[--var]` across exactly these files: `components/sections/Pricing.tsx` (29!), `components/sections/HowItWorks.tsx`, `components/sections/InteractiveDemo.tsx`, `components/sections/SocialProof.tsx`, `components/sections/Library.tsx`, `components/landing/FinalCTALinks.tsx`, `components/landing/MobileStickyBar.tsx`, `components/website/BrowseLibraryPage.tsx`, `app/rewards/RewardsPageClient.tsx`, `app/legal/layout.tsx`. Convert every `-[--x]` → `-(--x)` and `font-[family-name:--x]` → `font-(family-name:--x)`. Acceptance: `rg '\-\[--' app components --glob '*.tsx'` returns zero; the Pro pricing CTA (`components/sections/Pricing.tsx:~360`) visibly renders its teal background in the built app.
2. **Reader joins the brand.** In `app/globals.css:~1559-1604`, re-point the `--cr-*` family at canonical tokens: `--cr-accent: var(--accent-cyan)`, `--cr-bg-root: var(--bg-base)`, `--cr-success: var(--accent-emerald)`, `--cr-error: var(--accent-rose)`, etc., for BOTH themes; replace hardcoded `border-radius:16px` in `.cr-glass-reading`/`.cr-glass-card` (~:1647,1661) with radius tokens. The reader must stop being a teal/purple (#4DB6AC/#0F0F1A) island inside a cyan/navy app.
3. **Missing/broken tokens (one-liners with outsized impact).**
   - Define `--cf-card` + `--cf-card-hover` in both theme blocks (currently referenced by gift/pair-accept/NotificationBell but never declared → transparent cards).
   - Fix the mono font: `--font-mono: var(--font-jetbrains)` (currently points at never-loaded `--font-geist-mono`, ~`globals.css:76`).
   - Contrast: bump `--cf-text-soft` (light `#A8A29E`→`#78716C`, dark `#5C6B7A`→`#7C8B9A`) and audit `--cr-text-disabled` to ≥4.5:1.
   - Fix the reduced-motion kill-block (~`globals.css:1872-1882`): selectors target `[class*="cr-float"]` but the animations are applied via inline `style` — change to `[style*="cr-float"]`, `[style*="cr-stepper-pulse"]`, and ADD `[style*="cr-pulse-glow"]`.
4. **Token-family rationalization in globals.css.** Delete the unused shadcn token block and the "backward compat" alias block (~:225-239) ONLY after `rg`-ing each alias for live consumers — alias-with-deprecation-comment anything still consumed; list survivors in your report. Deduplicate the duplicate blocks (~:560-566 vs 1371-1382) and dead rules (~:613-622, 759-768). Do NOT attempt the full extraction of page-scoped CSS (that's Wave 2) — just leave a `/* WAVE2: extract */` marker on the bd-*/premium-slider/cr-component sections.
5. **Color-blind filters everywhere.** Move the SVG `feColorMatrix` filter defs from `app/book/layout.tsx` into `app/layout.tsx` (leave a HANDOFF note for their removal from book layout — or since `app/book/layout.tsx` is unowned by Wave 1, you may edit that one file for this single change), and add `colorBlindMode` to the bootstrap restore in `app/_lib/document-theme.ts:~205` so /dashboard and onboarding don't lose the setting.
6. **Cover rendering unblocked (CRITICAL enabler for LIBRARY).** In `next.config.ts`, add `images.remotePatterns` for the S3 content bucket host used by `app/app/api/book/_lib/library-catalog.ts:~42-44` (cover URLs `https://<bucket>.s3...amazonaws.com`). Document in your report whether SVG covers additionally need `dangerouslyAllowSVG` and recommend the raster-conversion path (the LIBRARY agent executes the component side).
7. **Shared primitives (new files in `components/ui/`):**
   - `Dialog.tsx` — the overlay standard from SHARED CONTEXT, with `framer-motion` enter/exit, size variants, and a `Sheet` variant for bottom sheets (dvh-safe, body scroll lock, keyboard-safe on iOS). This is the single most consumed Wave-0 deliverable; make the API obvious: `<Dialog open onClose labelledBy initialFocusRef>`.
   - `ProgressRing.tsx` — promote `components/library/ProgressRing.tsx` (the best of four: `role="progressbar"` + aria, spring fill, reduced-motion aware); parameterize size/stroke/color-token; leave the original in place re-exporting the shared one (owners migrate in their waves).
   - `Confetti.tsx` — ONE canvas confetti with token-sourced colors, a `reducedMotion` no-op, and light-theme-visible particles (no `mixBlendMode:'screen'` on light — that's why onboarding confetti is invisible on the default theme).
   - `catalog-stats`: ensure `lib/catalog-stats.ts` exports `CATALOG_BOOK_COUNT`, `CATALOG_CATEGORY_COUNT`, `CATALOG_BOOK_COUNT_DISPLAY` derived from `app/book/data/booksCatalog` (67 books today — never hardcode), for every surface that currently says "95+" / "93 more" / "60+".
8. **CI guards (make drift impossible):** add to lint/CI: (a) fail on `\-\[--` in className; (b) fail on `var(--cf-…)`/`var(--cr-…)` usages with no declaration in globals.css; (c) fail on raw hex/rgba literals in `components/**` and `app/book/**` tsx (allowlist file for the genuinely intentional); (d) fail on literal catalog counts (`95\+|93 more|60\+ books`).

**Acceptance:** `npm run verify` green; zero `-[--` matches; gift/pair cards visibly have backgrounds; reader accent === app accent in both themes; the four CI guards demonstrably fire on a seeded violation (show output, then remove the seed).

---

## PROMPT 2 — READER CORE LOOP (Wave 1 — highest priority)

**Branch:** `ui-overhaul/reader`.

**Mission:** Make the product's heart mechanically flawless and emotionally coherent: fix the score-drops-after-retry bug, the silent mid-session eject, the celebration pile-up, and the reader's interaction gaps. Users forgive a missing feature; they never forgive a score that goes down after improving.

**TERRITORY (exclusive):** `app/book/library/[bookId]/chapter/**` (all components/hooks/lib/pages), `app/book/components/AskBookDrawer.tsx`, `app/book/components/ReviewSession.tsx`, `ReviewSessionFSRS.tsx`, `PrerequisiteRefresher.tsx`, `GoalPicker.tsx`, `StepperDots.tsx`, `app/book/hooks/useBookPreferences.ts` (quiz/reading prefs only), quiz API routes under `app/app/api/book/me/quiz/**` and `app/app/api/book/books/[bookId]/chapters/**`. NOT yours: `app/globals.css` (HANDOFF token requests), `components/**`.

**Tasks:**

1. **Quiz retake math (CRITICAL).** `retryIncorrectOnly` defaults true (`useBookPreferences.ts:~169`); the retake shows only previously-missed questions (`QuizPanel.tsx:~579-582`) but `submit()` posts ALL session questions with `null` for hidden ones (`useQuizSession.ts:~320-342`); the server 400s on null responses, the client falls back to local provisional scoring, and previously-CORRECT questions are counted wrong — a user who improves watches their score drop. Fix: in `retry()`, pre-seed the answers map with the prior attempt's correct selections (carry-forward machinery already exists at `useQuizSession.ts:~75-91`), or submit only the displayed subset and merge server-side. **Add a test**: fail a quiz, retake with default settings answering everything right, assert the final score is 100%.
2. **Never silently eject a reader.** On chapter-content fetch failure the reader `router.push`es to the library with no message (`ChapterReaderClient.tsx:~415-422`). Replace with an in-place error card (retry button, "back to book" secondary, honest copy) using reader tokens.
3. **One celebration arc.** Today one quiz pass fires: per-question banners → ResultsScreen confetti → full-screen QuizPassCelebration (IP total #1) → achievement toasts that mount BEHIND the z-50 ChapterCompleteModal and expire unseen (`ChapterReaderClient.tsx:~1164-1179`, `AchievementToastStack.tsx:~30` z-40 vs `ChapterCompleteModal.tsx:~42-48`) → modal with the SAME IP total again. Redesign as one choreographed beat: results screen → a single celebration surface that absorbs the IP breakdown, achievements row, streak, and the practice/next-chapter handoff. Use the Wave-0 `Confetti`. Delete the duplicated IP total and redundant emoji headers.
4. **ChapterCompleteModal is a navigation trap.** No close/X, no Escape, only "Open Next Chapter"/"Back to Library" (`ChapterCompleteModal.tsx:~41-53,125-163`). Rebuild on the Wave-0 `Dialog`: closable back to the chapter, Escape wired, focus trapped, scroll locked.
5. **Locked-phase feedback is dead code.** `PhaseStepper.tsx:~116` renders locked steps with `disabled`, so the entire lock tooltip/toast branch (~:69-88, 226-241) is unreachable — tapping "Quiz" early does nothing on mobile. Switch to `aria-disabled` + the existing onClick guard so the "complete X first" message actually shows.
6. **Audio survives the session.** AudioPlayer only renders on the Summary phase and unmounts (losing position, buffer, speed — full re-download per mount) when continuing (`ChapterReaderClient.tsx:~857-875`, `AudioPlayer.tsx:~55-124, 248-250`). Lift it above the phase conditional, persist position/speed for the chapter session, keep the fetched buffer.
7. **NotesDrawer.** Always-mounted `aria-modal` hidden by transform; its buttons + textarea stay in the tab order while invisible; styled in `--cf-*` inside the `--cr-*` reader (`NotesDrawer.tsx:~34-43`). Rebuild on `Dialog`/`Sheet`, conditional render, focus to textarea on open, restyle with reader tokens.
8. **Keyboard answering targets the wrong question.** `activeQuestionForKeys` derives from `session.questions` while rendering uses filtered/shuffled `displayQuestions` (`QuizPanel.tsx:~653-665` vs `574-593, 813-827`) — pressing 1-5 can answer an invisible question. Derive from `displayQuestions` everywhere.
9. **Show the cooldown.** `cooldownSeconds` ticks in `useQuizSession.ts:~263-274` and is passed to QuizPanel but never rendered; "Try Again" is always enabled (`QuizPanel.tsx:~519-525`); `formatDuration` sits dead (~:56-61). Disable retry during cooldown with "Try again in m:ss".
10. **In-reader type controls.** ReaderSettingsMenu has Mode/Tone/Difficulty/Focus but no font size/line-spacing/width — `FontSizeControls.tsx` is dead and `textScaleClass` is hardcoded `""` (`ChapterReaderClient.tsx:~691-693`). Add a Text section to ReaderSettingsMenu that patches `bookPrefs.reading` (the CSS-var pipeline already exists). Kindle parity is table stakes for a reading app.
11. **cf/cr seam inside the reader.** Port `SessionModeOverlay`, the chapter `error.tsx`, and the AskBook launcher (when rendered in-reader) to `--cr-*` tokens — the floating audio FAB (teal) currently sits 64px from the AskBook FAB (cyan). Also reduce bottom-edge congestion: audio panel, two FABs, sync pill, and toasts currently compete; stack/collapse deliberately at ≤390px.

**Acceptance:** `npm run verify` green including the new retake test; walk one full chapter (summary→examples→quiz fail→retake→pass→practice) on desktop + 390px mobile in both themes; count celebration surfaces (must be ≤2: results + one celebration); Escape closes every overlay; reduced-motion run shows no infinite animations.

---

## PROMPT 3 — WORKSPACE & NAVIGATION (Wave 1)

**Branch:** `ui-overhaul/workspace`.

**Mission:** The first screen after login and the app's chrome: kill the double mobile nav, make the numbers honest, fix the invisible progress tracks and wrong-weekday strip, and give the workspace one accent and one search model.

**TERRITORY (exclusive):** `components/workspace/**`, `app/dashboard/**`, `app/book/home/components/**` (TopNav, GlobalSearchPanel, InfoModal, etc. — the LIVE shell components), `app/book/_components/NotificationBell.tsx`, `app/book/hooks/useBookAnalytics.ts` (heatmap builder only). NOT yours: `components/progress/**`, `components/library/**`, `app/globals.css`.

**Tasks:**

1. **Delete the second bottom nav (CRITICAL, ~one line).** `WorkspacePage.tsx:~576-609` defines `MobileBottomNav` (4 tabs, no safe-area, active state hardcoded `true`) and renders it at ~:940 — on top of TopNav's own fixed bottom bar (5 tabs, `pb-safe`, `aria-current`, `app/book/home/components/TopNav.tsx:~412-463`). Delete `MobileBottomNav` entirely; keep TopNav's bar; size the bottom spacer to it.
2. **Honest numbers.** Replace literals with Wave-0 `catalog-stats`: `HeroSessionCard.tsx:~135,144` ("95+ … 21 categories"), `WorkspacePage.tsx:~534` ("Unlock 93 more books"), `DiscoveryRow.tsx:~119,148` ("95+", "Join 2,400+ Pro readers" — delete or substantiate the readers claim).
3. **Visible progress tracks.** Four bars use track `var(--cf-surface-muted)` on cards whose bg is the same token (`HeroSessionCard.tsx:~267-272`, `RewardsCard.tsx:~85-88`, `NextAchievementCard.tsx:~79-82`, `BookCardWorkspace.tsx:~144-147`). Swap all four to `var(--cf-progress-track)`.
4. **Weekday-true momentum strip.** `buildHeatmap` ends at today; `WeeklyMomentumStrip` renders `slice(-7)` under fixed M-T-W-T-F-S-S labels, so dots sit under wrong days six days out of seven (`useBookAnalytics.ts:~349-377`, `WeeklyMomentumStrip.tsx:~21,50-52`). Remap cells by actual weekday or switch to a rolling "7 days ago → Today" axis.
5. **One billing banner.** `app/dashboard/page.tsx` renders BillingStatusBanner AND WorkspacePage, both reacting to `?billing=success` with contradictory messages. Keep the in-page Pro banner (re-tokened to `--cf-success-*`), delete `BillingStatusBanner.tsx`.
6. **One accent.** HeroSessionCard hardcodes violet glows + a violet CTA gradient; Rewards diamond violet, Discovery amber, dots emerald, streak gold — four glowing accents on one screen, several breaking light mode (`HeroSessionCard.tsx:~188-206, 322-324`). Route everything through tokens; if the hero keeps a distinct glow, define it via a HANDOFF token request (`--cf-hero-glow`) rather than rgba literals; max one ambient animation on the screen.
7. **One search model.** The same header SearchBox opens GlobalSearchPanel on Library/Progress but silently replaces the whole dashboard with an inline results grid (`WorkspacePage.tsx:~720-723, 908-909`). Use GlobalSearchPanel everywhere; delete the bespoke dashboard results path. While in GlobalSearchPanel: add listbox/combobox semantics, arrow-key navigation, and Enter→`/book/library?q=` (LIBRARY agent is making that grid filter live).
8. **Notifications that go somewhere.** NotificationBell items are inert `<li>`s; no deep links, no per-item read, popover lacks `aria-haspopup`/Escape (`NotificationBell.tsx:~96-183`). Add type-derived hrefs, read-on-click, Escape, and distinct error vs empty states. Also fix its `--cf-card` usages now that Wave 0 defined the token.
9. **Journeys/Events reachable on mobile.** They're `desktopOnlyNavItems` in TopNav and the live workspace renders no banners for them — phone users have NO path to two product areas (`TopNav.tsx:~60-64`). Add them to the TopNav "More" affordance or surface event/journey entry points on the workspace.
10. **Settings nav handoff.** TopNav already has a `settings` tab id; the GAMIFICATION and PROGRESS agents are restoring TopNav on their pages — confirm TopNav renders correctly with `activeTab` values `badges|journeys|events|settings` and fix any TopNav-side issues.

**Acceptance:** `npm run verify` green; at 390px exactly ONE bottom nav with safe-area padding; no literal book counts (`rg '95\+|93 more|2,400' components/workspace` empty); tracks visible in light + dark; today's activity dot under today's weekday label; search behaves identically from all tabs.

---

## PROMPT 4 — LIBRARY & DISCOVERY (Wave 1)

**Branch:** `ui-overhaul/library`.

**Mission:** Turn the placeholder shelf into a real bookstore: actual cover art, honest signals instead of fabricated counts, keyboard-accessible cards, a working save affordance, and a mobile grid that doesn't overlap itself.

**TERRITORY (exclusive):** `components/library/**`, `app/book/library/page.tsx`, `app/book/library/components/**`, `app/book/library/hooks/**`, `app/book/saved/**`, `app/book/components/BookCard.tsx`, `BookSaveButton.tsx`, `BookCover.tsx`, `lib/book-covers.ts`, `public/book-covers/**`, `app/app/api/book/_lib/library-catalog.ts` (cover URL shape only). NOT yours: `app/book/library/[bookId]/**` (BOOK-DETAIL agent), TopNav (WORKSPACE agent).

**Tasks:**

1. **Real covers (CRITICAL; Wave 0 added `images.remotePatterns`).** `components/library/BookCover.tsx:~40-68` pipes remote S3 URLs into `next/image` with no loader config and local SVG fallbacks that `/_next/image` refuses — everything 400s into gradient + 10px uppercase text. Fix the component (follow `app/book/components/BookCover.tsx`'s candidate-fallback + external-loader pattern — it's the better implementation), and convert the 55MB of traced SVGs (`public/book-covers`, single files up to 2.2MB) to AVIF/WebP rasters served through `next/image` with proper `sizes`. Add a smoke test asserting a real `<img>` with `naturalWidth > 0` on the library.
2. **Honest social proof (CRITICAL).** Delete `inferReaderCount`/`inferCompletionRate` (hash-fakes, `components/library/libraryData.ts:~132-146`) and every rendering of "N readers · M% finish" (`BookCard.tsx:~185-193`), the literal "12 people reading now" (`ActiveReads.tsx:~150-164`), and the frozen "Ends in 4 days" 1/2-progress WeeklyChallenge (`WeeklyChallenge.tsx:~104-107` — compute from real data or cut the section). Replace with honest signals that exist: chapter count, est. time, difficulty, category, `staffPickReason` (real and good).
3. **Keyboard + SR access.** BookCard is a clickable `motion.article` with no href/button/tabIndex, and its collapsed expand panel (height-0, not display:none) keeps hidden buttons in the tab order (`BookCard.tsx:~42-58, 196-268`); ActiveReads/CompletedShelf cards same pattern. Make cover/title a real `<a href="/book/library/[id]">`, expand-details an explicit disclosure button with `aria-expanded`, collapsed panel `inert`/conditionally rendered.
4. **Working save.** "Add to List" only calls stopPropagation (`BookCard.tsx:~257-267`) while the real save system (`useSavedBooks` + `BookSaveButton` with `aria-pressed`) is unreachable from the library — and the Saved page's empty state says "Save books from the library." Wire BookSaveButton into BookCard + HeroRecommendation with optimistic toggle + toast.
5. **Correct Pro locks.** `isProLocked` ignores `entitlement.unlockedBookIds` and `isPro` defaults true, so free users see "Unlock with Pro" on their own unlocked/in-progress books (`BookCard.tsx:~38, 228-240`, `LibraryPage.tsx:~187`, `dashboardToLibraryUi.ts:~19-23`). Lock = `isFreeUser && book.isPro && !unlocked.has(id) && !userProgress`.
6. **Mobile grid.** BookCard hardcodes `w-[200px]` below md inside BrowseAll's `grid-cols-2` → columns overlap at 390px (`BookCard.tsx:~43`, `BrowseAll.tsx:~423`). Default fluid (`w-full`); fixed width only inside CuratedSection's horizontal scroll rows.
7. **Unify search.** BrowseAll's `?q=` text filter is live but nothing ever navigates to it; the TopNav panel has no "see all results" path (`LibraryPage.tsx:~215-223,380`). Make `/book/library?q=<query>` real (the WORKSPACE agent adds Enter-to-navigate from the panel; you make the grid filter + scroll behavior solid and visible).
8. **No "+0 IP" celebrations.** `xpEarned: 0` hardwired (`libraryData.ts:~1216`) feeds "+0 IP earned" toasts and CompletedShelf lines. Source real IP from the dashboard payload or hide the IP line when 0/unknown.
9. **Skeleton + heading.** Replace the bare "Loading your library…" card with skeleton hero + card rows matching final geometry (port the dead `SkeletonCard` from `app/book/library/BookLibraryClient.tsx:~25-35` before Wave 2 deletes it); add a visually-hidden `h1`.
10. **Live recommendations.** "Similar to:"/"Because you loved X" resolve via `getBookById` against the static MOCK_BOOKS catalog, not the API list (`BookCard.tsx:~39`, `CompletedShelf.tsx:~20-31`, `libraryData.ts:~1260-1314`). Resolve against the live `booksById` map from LibraryPage.
11. **Saved page joins the system.** `SavedBooksClient` is on the cf-shell with different container width/radii/cards one click from the library's glass system. Rebuild it on `components/library` primitives (BookCard + save state).

**Acceptance:** `npm run verify` green + cover smoke test; zero fabricated numbers (`rg 'inferReaderCount|readers ·|people reading' components/library` empty); full keyboard walk of the shelf (tab → card → enter opens detail; no focus lands on invisible controls); 390px grid clean; light + dark checked.

---

## PROMPT 5 — BOOK DETAIL (Wave 1)

**Branch:** `ui-overhaul/book-detail`.

**Mission:** Make the detail page sell the book honestly and start the reader frictionlessly.

**TERRITORY (exclusive):** `app/book/library/[bookId]/page.tsx`, `BookDetailClient.tsx`, `app/book/library/[bookId]/components/**`, new `app/book/library/[bookId]/loading.tsx`, `app/app/api/book/me/books/[bookId]/start/route.ts`. NOT yours: `chapter/**` (READER agent), `app/book/home/components/InfoModal.tsx` (WORKSPACE owns; you may swap to the Wave-0 Dialog instead).

**Tasks:**

1. **Honest hero.** Kill the hash-generated "{n} readers / {n} completed" chips (`BookHero.tsx:~39-47, 211-218`) and the fake 8% ring + "You've started your journey" on untouched books (`BookHero.tsx:~72-73, 221-225` — `aria-valuenow` even announces the lie). Zero-state: real 0% or no ring, forward-looking copy ("Chapter 1 takes ~8 minutes"), streak line from real data or gone.
2. **Sell the book above the fold.** Synopsis/tags/pace live in a default-closed accordion BELOW up to 40 chapter cards (`BookDetailClient.tsx:~488-512`, `BookDetails.tsx:~36`). Put a 1-2 line clamped synopsis in the hero with "More" expanding the full About; keep the accordion as the long-form home.
3. **Start ≠ browse.** Mount fires `POST /start` which claims a free-book slot for merely viewing (`BookDetailClient.tsx:~121-136`, start route `~:29-35`). Defer the start claim to first chapter open or an explicit Start click. When the free limit is hit, the banner must actually gate: disable/replace hero CTA, sticky CTA, and chapter cards; point upgrade at pricing/checkout, not `/book/settings` (~:310-329).
4. **Remove-from-library: implement or remove.** The "permanent and cannot be undone" flow ends in a modal with only a Close button (`BookDetails.tsx:~138-155`, `BookDetailClient.tsx:~545-561`). Wire a real confirm → delete endpoint → redirect, or delete the button.
5. **Honest step indicators.** `getStepsCompleted` hardcodes 1 for any current chapter, so "Summary complete, Scenarios pulsing" is fiction announced to screen readers; the granular props (`currentStepProgress`, `teaser`) are dead (`BookDetailClient.tsx:~175-183, 448-467`, `StepIndicators.tsx:~51-57`). Feed real step completion from `useBookProgress`, or render all dots hollow with only current pulsing.
6. **Loading skeleton.** No `loading.tsx`; client gate is bare text. Add a hero + chapter-row skeleton matching real geometry, reused for the hydration gate.
7. **Dialogs.** Swap InfoModal-based modals (ResetProgress, remove) to the Wave-0 `Dialog` (the current one has Escape only — no trap, no initial focus, no scroll lock).

**Acceptance:** `npm run verify` green; new-user view shows no invented numbers and a synopsis above the fold; free-limit state is coherent (every start affordance gated consistently); skeleton on cold load; both themes.

---

## PROMPT 6 — PROGRESS, PROFILE, SETTINGS, NOTEBOOK (Wave 1)

**Branch:** `ui-overhaul/progress-profile`.

**Mission:** Make the self-tracking surfaces truthful and light-theme-correct, and the settings page honest about what exists.

**TERRITORY (exclusive):** `components/progress/**`, `app/book/progress/page.tsx`, `app/book/profile/**`, `app/book/settings/**`, `app/book/notebook/**`, `app/app/api/book/me/export/route.ts` (only if wiring real formats). NOT yours: TopNav internals (WORKSPACE), `app/book/hooks/useBookAnalytics.ts` (WORKSPACE).

**Tasks:**

1. **Settings honesty (was flagged CRITICAL; verification showed TTS is REAL).** Nuance matters: TTS voices/speed/auto-advance controls exist (`BookSettingsClient.tsx:~697-757`) and TTS itself is a live Pro feature — but verify each control actually feeds the reader's AudioPlayer; wire `ttsSpeed`/`ttsVoice` through if dangling (coordinate via HANDOFF with READER if the consumer side needs changes). The unambiguous lies: ExportModal's "Sync to Notion/Obsidian" buttons call `handleExport('notion')` which the API 400-rejects (`ExportModal.tsx:~179-197`, export route `~:53-55`). Replace with an honest "coming soon" state or real integration. A Pro-gated control must never 400.
2. **Light theme on charts.** Default theme is LIGHT, but ChapterProgressBar tracks are `rgba(255,255,255,0.06)`, StepIndicator dots/lines white-alpha, current-step hardcoded dark-cyan `#22D3EE` (`ChapterProgressBar.tsx:~50,78`, `StepIndicator.tsx:~41,91,107`, `DailyGoalRing.tsx:~16-19`). Replace every hardcoded white-alpha/hex with tokens.
3. **Heatmap weekdays.** 84-day grid starts 83 days ago with no weekday alignment; labels hardcode Mon/Wed/Fri — wrong six days out of seven (`ReadingActivity.tsx:~98-117, 284-292`). Pad the first column GitHub-style so rows = fixed weekdays.
4. **No mock milestones.** `effectiveMilestones` silently falls back to `mockProgressData.nextMilestones` (`ProgressPage.tsx:~182-184`); ContinueLearningCard's teaser is a static lie ("+50 IP toward First Steps" forever, `ContinueLearningCard.tsx:~169-172`) and hardcodes "95+ books" (~:277). Drive from `useBadgeSystem`'s real `nextMilestones[0]` + catalog-stats; render nothing over mock data.
5. **Modals → Dialog.** EditProfileModal, both DangerZone modals, ExportModal, ProFeatureCard, RefreshPreferencesModal: no trap/initial focus/restore; several lack `role=dialog`; EditProfile's avatar input is a hover-only hidden label (`EditProfileModal.tsx:~128-189`, `DangerZone.tsx:~100-165`). Migrate all to the Wave-0 `Dialog`; associate labels via `htmlFor`; make the avatar overlay a focusable button.
6. **Settings shell.** Settings drops TopNav entirely and destructures away `isAdmin`/`userEmail`/`appVersion` (`BookSettingsClient.tsx:~92, 421-442`) — no account identity next to Sign out/Delete account. Render TopNav (`activeTab="settings"`), show the signed-in email + version, surface the admin link when isAdmin.
7. **Notebook: ship it or park it honestly.** It's unlinked (URL-only), read-only, swallows fetch errors into a fake empty state (`NotebookClient.tsx:~36-40, 145-152`). Minimum ship: real error state, entries link to their chapters, group by book, nav entry (HANDOFF to WORKSPACE for the TopNav item). If you can't ship that, gate the route behind a redirect and say so in the report.
8. **Dead "Not now".** `ProfilePrimitives.tsx:~1168` renders a non-interactive `<p>` styled as the secondary action. Make it a real dismiss (persisted) or remove.
9. **Soft-text contrast usage.** Wave 0 bumped `--cf-text-soft`, but audit your 10-11px uppercase labels (`ProfilePrimitives.tsx:~240,310,888,908`) and stop using soft below 12px.

**Acceptance:** `npm run verify` green; progress page fully legible in LIGHT; heatmap days truthful; zero mock/static milestone data; every modal passes the overlay standard; export modal contains no dead integrations.

---

## PROMPT 7 — GAMIFICATION COHERENCE (Wave 1)

**Branch:** `ui-overhaul/gamification`.

**Mission:** One badge catalog, server-truth earned state, honest rarity, and a motivation system that reads as one designed arc instead of six overlapping ones.

**TERRITORY (exclusive):** `app/book/badges/**`, `app/book/achievements/**`, `app/book/streak/**`, `app/book/tier/**`, `app/book/journeys/**`, `app/book/events/**`, `app/rewards/**`, achievement/badge API + repo files. NOT yours: `components/workspace/NextAchievementCard.tsx` (WORKSPACE — HANDOFF the catalog switch), TopNav.

**Tasks:**

1. **One badge catalog (CRITICAL).** The live dashboard evaluates `badge-ui-definitions.ts` (~60 badges) while /book/badges evaluates the `@deprecated` `badge-data.ts` (38 different badges) — "Next Achievement: X" can link to a page where X doesn't exist. Pick ONE source (`achievement-definitions.ts` per the deprecation note), point every surface at it, delete the others. HANDOFF to WORKSPACE: swap `WorkspacePage.tsx:~25`'s import to the canonical catalog.
2. **Kill fake rarity (CRITICAL).** `getBadgeRarity` is a charCode hash commented "Rarity (mock)" — and BadgeCard computes a *different* inline variant, so card and modal disagree about the same fake number (`badge-utils.ts:~276-283`, `BadgeCard.tsx:~83,135-137`, `BadgeDetailModal.tsx:~188-199`, `BadgeShowcase.tsx:~72-74`, `BadgeCelebration.tsx:~238-240`). Remove percentage claims everywhere; a qualitative tier label ("Rare") tied to actual tier is acceptable.
3. **Server-truth earned state.** Earned dates/pins/last-seen live only in localStorage; a new device re-stamps the whole history as "earned today" with NEW pills (`badge-utils.ts:~213-274`, `BookBadgesClient.tsx:~136-142`). Persist earned timestamps server-side via the existing achievement-repo; localStorage becomes cache.
4. **Unearnable badges.** Journey + secret badges hardcode `evaluate → current: 0` and `isEarned` ignores server awards (`badge-data.ts:~352-612`, `badge-utils.ts:~57`) while JourneyDetail promises "Badge awarded on completion". Honor `earnedHistory` in evaluation; wire journey completion to persist; implement or remove the secret badges.
5. **Honest monthly challenge.** The fallback feeds ALL-TIME chapters into "Complete 5 chapters this month" — permanently 5/5 for any active reader (`BookBadgesClient.tsx:~199-207`). Compute month-to-date or show the events empty state.
6. **One time-limited mechanic.** The badges-page SeasonalChallenge and /book/events consume the same `/events/active` API as two different products; Rewards is a separate page with its own meter and "pts" label vs "IP" elsewhere. Link the challenge card to events, standardize the currency label to IP, and re-skin `RewardsPageClient` from legacy tokens onto cf-* + TopNav (~:33-45, 253-284, hardcoded `#22c55e/#ef4444` → tokens).
7. **Dialog + announcements.** BadgeDetailModal: no role/trap; BadgeCelebration: no Escape, epic level undismissable; toasts have no `aria-live` (`BadgeDetailModal.tsx:~67-98`, `BadgeCelebration.tsx:~126-269`). Migrate to Wave-0 `Dialog`/`Confetti`; toasts in an `aria-live="polite"` region.
8. **Non-onboarded fix + guards.** Journeys/Events clients skeleton forever for non-onboarded users (badges redirects; they don't), and events pages skip `requireDashboardAccess` (`JourneysClient.tsx:~53-76`, `EventsClient.tsx:~59-82`, `app/book/events/page.tsx`). Share the redirect effect; add the guard.
9. **Browse before committing.** Journey cards only link to detail after progress exists (`JourneysClient.tsx:~189-204`). Always link; Start lives on detail.
10. **IA simplification proposal.** You own the pages: write a one-page consolidation proposal in your report (one progression currency, events as the only timed mechanic, Rewards folded into badges/progress, the unused level ladder either killed or made the spine) — implement the parts that don't require WORKSPACE/PROGRESS territory.

**Acceptance:** `npm run verify` green; dashboard "Next Achievement" name exists on /book/badges (after WORKSPACE applies your HANDOFF); zero "% of readers" strings; fresh-profile run shows no spurious "earned today"; phone path to journeys/events exists (with WORKSPACE's nav change); both themes.

---

## PROMPT 8 — LANDING & MARKETING (Wave 1)

**Branch:** `ui-overhaul/landing`.

**Mission:** A conversion page that's truthful, navigable, and worthy of the product demo it already has.

**TERRITORY (exclusive):** `app/page.tsx`, `components/sections/**`, `components/landing/**`, `components/website/**`, `app/pricing/**`, `app/books/page.tsx`, `app/coming-soon/**`, `app/chapterflow/page.tsx`, `app/og/route.tsx`, `app/legal/**`, plus a new API route for book requests (e.g. `app/api/book-requests/route.ts`). NOT yours: `app/signup` (AUTH agent), `next.config.ts`.

**Tasks:**

1. **Real book-request pipeline (CRITICAL).** `BookRequestForm.tsx:~63-70` awaits a 1.2s setTimeout, then `BookRequestSuccess` promises "We will email you when {title} is ready" — nothing is stored. Build a minimal real endpoint (DynamoDB put or SES-to-support) + honest success copy; real error state. Also: the zero-results "Request this book" is a non-interactive `<p>` styled as a link (`BrowseLibraryPage.tsx:~308-310`) — make it a button that scrolls to the form and pre-fills `initialTitle` (the prop exists, unused).
2. **Truth pass.** Delete the invented "Sarah K." hero testimonial (`Hero.tsx:~147-153`), the "We have added 12 books from user requests this month" (`BookRequestForm.tsx:~239`), and rename hardcoded "Trending Now / Most Read This Week" to editorial labels (`BrowseLibraryPage.tsx:~53-103`). Decide SocialProof.tsx (fully built, unplugged, fabricated personas): delete it, or rebuild the slot with verifiable proof (book count, methodology citations, founder note). All counts via Wave-0 catalog-stats — metadata/OG too (`app/page.tsx:~23-45`, `app/pricing/page.tsx:~7`).
3. **Navbar anchors off-home.** `#how-it-works`/`#demo`/`#library` do nothing on /pricing and /books (`Navbar.tsx:~41-46,195`). `usePathname` → `/#section` off-home.
4. **Intent-preserving funnel.** Public book cards link into the login wall and dump users on the generic dashboard afterward (`Library.tsx:~170`, `BrowseLibraryPage.tsx:~597` → `requireDashboardAccess` redirects with `returnTo=%2Fbook`). Make every card link carry `returnTo=/book/library/{bookId}` through `/auth/login`; fix JSON-LD to public URLs. (Full public detail pages are a later strategic bet — don't build them now.)
5. **Restyle freedom.** Wave 0 fixed your 65 broken `-[--var]` classes mechanically — now own the visual result: re-verify Pricing, HowItWorks, InteractiveDemo, SocialProof-slot rendering in both themes; tighten the hero (it's good — keep its restraint) and ensure section rhythm/CTA consistency (`PulseCTA` vs GreenCTA vs ad-hoc — converge on one primary CTA treatment).
6. **OG imagery.** Verify `app/og/route.tsx` output matches the current brand (one accent, real count claims).

**Acceptance:** `npm run verify` green; a submitted book request is retrievable server-side (show evidence); zero invented numbers/personas on the public surface; navbar works from /pricing; clicking a specific book → auth → lands on that book's detail.

---

## PROMPT 9 — ONBOARDING (Wave 1)

**Branch:** `ui-overhaul/onboarding`.

**Mission:** A first-run flow that demos real value, keeps its promises, and doesn't dead-end.

**TERRITORY (exclusive):** `app/onboarding/**`, `app/book/BookOnboardingClient.tsx` (decide live vs dead; delete if dead), `app/book/components/OnboardingShell.tsx`, onboarding API routes (`app/app/api/book/me/onboarding/**`), `starter-prescription.ts`/onboarding data files. NOT yours: `app/signup` (AUTH), document-theme (Wave 0).

**Tasks:**

1. **Fix the starter-shelf dead end (CRITICAL).** The swipe deck holds exactly 3 books with MAX_PICKS=3 — swipe left once and you strand on an empty state with NO continue button, despite copy promising "We'll fill your remaining slots" (`books.ts:~32-37`, `StepStarterShelf.tsx:~24, 507-511, 680-705`, `useOnboarding.ts:~175-177`). Seed the deck from the real 67-book catalog filtered by interests (or ≥10 curated); auto-fill + advance when the deck empties; add an explicit "Continue with these picks" to the empty state.
2. **Keep the celebration's promises.** UnlockCelebration congratulates "1 Day streak / 120 Insight Points" but the live completion route writes settings only — no IP, no streak (`UnlockCelebration.tsx:~21-48`, `complete/route.ts:~123-134`; the award lives unreached in `profile/route.ts:~365-375`). Award idempotently in the completion route, or show real post-completion stats.
3. **Await the save.** `handleFinish` fire-and-forgets the profile POST, clears local state, navigates after 400ms; the failure path writes a `chapterflow_onboarding_pending` key NOTHING reads (`OnboardingFlow.tsx:~56-109`). Await with a loading state + inline retry; add the completed-redirect guard to `/onboarding` (mirror `app/book/page.tsx:~11-23`).
4. **Visible keyboard focus.** Inline `outline:'none'` on essentially every control defeats the global focus-visible ring (`TappableCard.tsx:~69`, `StepInterests.tsx:~161,303,322`, `StepTone.tsx:~222`, `StepPace.tsx:~345`, `MiniQuiz.tsx:~219`). Delete them all; replace `onMouseEnter` style mutations with class-based hover/focus styles.
5. **Readable quiz feedback.** Wrong-answer explanations show for 1.5s then force-advance (`MiniQuiz.tsx:~50-62`). User-paced "Next" button; auto-advance (~4s) only for correct.
6. **Confetti visible on the default theme.** Swap CanvasConfetti usage to the Wave-0 shared `Confetti` (the old one's `mixBlendMode:'screen'` + white particles vanish on light, `CanvasConfetti.tsx:~153, 21-29`); fix the other light-mode breaks (`TappableCard.tsx:~60-62`, `MiniSummary.tsx:~188-190` hardcoded CTA colors).
7. **Honest interests step.** 21 topics feeding a 3-book deck, with skip fabricating 5 interests (`StepInterests.tsx:~46-68,116`, `useOnboarding.ts:~165-167`). Once task 1 wires the real catalog, make picks visibly shape the deck; trim topics to those that differentiate; skip = neutral defaults, not fake picks.
8. **Join the design system.** The flow is a 2,800-line inline-style island: per-component `<style>` hacks, `div[style*="grid-template-columns"]` responsive selectors, three different green CTAs, mixed token vocabularies (`StepMotivation.tsx:~196-202`, `StepPace.tsx:~202-204`, `UnlockCelebration.tsx:~254-269`). Port to Tailwind utilities + cf tokens: one shared CTA component, one card primitive, `grid-cols-1 sm:grid-cols-2` instead of selector hacks. Aim for a flow that visually belongs to the app users land in afterward.

**Acceptance:** `npm run verify` green; complete the flow swiping LEFT on books — no dead end; refresh-resume works; dashboard shows the IP/streak the celebration claimed; full keyboard run with visible focus; light-theme confetti visible.

---

## PROMPT 10 — AUTH & SECONDARY FLOWS (Wave 1)

**Branch:** `ui-overhaul/auth`.

**Mission:** An entry experience that doesn't lie, doesn't loop, and doesn't expire mid-chapter; gift/pair/referral moments that feel like the gifts they are.

**TERRITORY (exclusive):** `app/auth/**`, `components/auth/**`, `app/signup/**`, `app/pair/**`, `app/book/pair-accept/**`, `app/book/gift/**`, `app/ref/**`, related API routes (`gifts`, `pair`), new `app/account-deleted` page. NOT yours: marketing CTAs (LANDING), globals.css.

**Tasks:**

1. **Kill the fake signup (CRITICAL).** `/signup`'s Google/Apple/email buttons all just `router.push('/onboarding')` — no account, email discarded; an unauthenticated visitor then walks an onboarding whose completion POST will 401 (`app/signup/page.tsx:~32-40`). Decide: redirect `/signup` → `/auth/login?returnTo=%2Fbook` now (minimum), or resurrect this composition as the real branded login that initiates Cognito IdP flows via the `identity_provider` parameter (preferred — it's the only branded auth screen you have).
2. **Open redirect.** `sanitizeReturnTo` accepts `//evil.com` (`app/auth/_lib/return-to.ts:~56-58`; callback resolves it to an external origin). Require `/^\/(?!\/)/` or verify resolved origin ∈ allowlist.
3. **Deleted-account loop.** `reason=deleted` is read by nothing; deleted users with a live Cognito session loop login→callback→/book→login forever (`require-dashboard-access.ts:~52`, `login/route.ts:~26-91`). Build `/account-deleted` (explains state, kills the Cognito session via logout, recovery path if any).
4. **Session lifecycle.** Refresh token is never stored — sessions hard-die at ~1h, mid-chapter; TokenExpiryGuard's expiry redirect is dead code (cookie maxAge = its own deadline) and the warning banner has no dismiss/countdown (`callback/route.ts:~112-139`, `TokenExpiryGuard.tsx:~37-104`). Store refresh token httpOnly + silent `/auth/refresh` at T-5min; fix the cookie maxAge; banner gets countdown + dismiss.
5. **Gift moment.** Page shows "Redeem Gift / Code / [Claim]" — never says it's 30 days of Pro or who sent it until AFTER the irreversible claim (`gift/[code]/page.tsx:~43-56`). Add a GET preview endpoint; render "X sent you 30 days of ChapterFlow Pro" with brand art; expired/redeemed states pre-commit. Wave 0 fixed the invisible `--cf-card` backgrounds — re-verify.
6. **Pair/gift shell.** Both pages float a lone card with no logo/nav/way out (`pair-accept/page.tsx:~55`). Add the logo lockup + minimal header, `min-h-screen` centering, dashboard-consistent background.
7. **Referral acknowledgment.** `/ref/CODE` silently sets a cookie and dumps the friend at the login wall; the promised "free week of Pro" is never mentioned again (`ref/[code]/route.ts:~11-21`). Lightweight branded interstitial ("Your friend gave you a week of Pro") before auth; echo the claim on first dashboard visit (HANDOFF to WORKSPACE if the echo lives there).
8. **AuthErrorBanner / error pages.** Human copy, retry affordances, consistent tokens.

**Acceptance:** `npm run verify` green; `/signup` cannot fake an account; `returnTo=//evil.com` rejected (test it); deleted-account flow shows the page, no loop; gift page states value + sender before claim; a session crossing the 1h boundary silently refreshes (demonstrate or document the mechanism).

---

## PROMPT 11 — CONSOLIDATION & SWEEP (Wave 2, runs alone after Wave 1 merges)

**Branch:** `ui-overhaul/consolidation`.

**Mission:** Delete everything dead, finish the primitive migrations, and run the final consistency/a11y pass so the app reads as ONE product. You have repo-wide write access — Wave 1 is merged; you're the closer.

**Tasks:**

1. **Dead-code deletion (~6,000+ lines).** Work from the "Dead / legacy UI inventory" section of `docs/CHAPTERFLOW-UI-AUDIT.md` (106 entries). Headliners: `app/book/home/BookHomeClient.tsx` + dead siblings (`BookLibraryClient`, `BookProgressClient`, `BookOnboardingClient`), the components/ui shadcn graveyard (~12 of 16 files — verify each for consumers first), orphaned celebration systems under `app/book/tier`/`streak`/`achievements` (verify against GAMIFICATION's merge), `ConfirmModal`, dead CSS rules, `SocialProof.tsx` if LANDING deleted its usage, the old confetti implementations replaced by the shared one. RULE: `rg` for consumers before every deletion; delete in small commits (`git rm` + verify per batch).
2. **Finish primitive migrations.** Anything still importing the legacy `ProgressRing`s/`BookCover`s/`Chip`s/confettis after Wave 1 → migrate to the shared primitives and delete the legacy files. End state: exactly one of each family; `rg ProgressRing` shows one implementation + consumers.
3. **globals.css extraction.** Execute the `/* WAVE2: extract */` markers Wave 0 left: move page-scoped CSS (bd-*, premium-slider, cr-component kit) into co-located CSS modules; globals.css ends as tokens + cf layer + resets (~target <900 lines from 1,889).
4. **Raw-color sweep.** Eliminate remaining raw hex/rgba in `components/**` and `app/book/**` (audit counted 38 in workspace, 64+ elsewhere); flip the Wave-0 CI guard from warn to error.
5. **Final a11y pass.** Repo-wide: every overlay on the shared Dialog (rg for `aria-modal` outside Dialog.tsx should return nothing); every icon-only button has `aria-label`; toasts in `aria-live` regions; focus-visible ring never suppressed; heading hierarchy sane on the six core screens.
6. **Final consistency QA.** Walk landing → auth → onboarding → dashboard → library → detail → reader → progress → badges → settings in BOTH themes at 390px and 1280px. File and fix: radius/shadow/spacing drift, accent leaks, copy tone (sentence case; one name for the points currency everywhere — "Insight Points"/"IP"), icon sizing. Screenshot each screen for the report.
7. **Regression gate.** `npm run verify` green; the cover smoke test and quiz-retake test from Wave 1 still pass; Lighthouse (or equivalent) on landing + library + one chapter — report scores.

**Acceptance:** inventory of deleted files/lines; one implementation per component family; globals.css under target; CI guards at error level; the 10-screen walkthrough documented with screenshots in both themes.

---

## Ownership matrix (collision check)

| File/dir | Owner |
|---|---|
| `app/globals.css`, `next.config.ts`, `app/layout.tsx`, `components/ui/**`, CI config | 1 FOUNDATION |
| `app/book/library/[bookId]/chapter/**`, quiz hooks/routes, AskBookDrawer, ReviewSession* | 2 READER |
| `components/workspace/**`, `app/dashboard/**`, `app/book/home/components/**`, NotificationBell, useBookAnalytics | 3 WORKSPACE |
| `components/library/**`, `app/book/library/` (page/components/hooks), saved, BookCard/BookCover/BookSaveButton, book-covers assets | 4 LIBRARY |
| `app/book/library/[bookId]/` (non-chapter), start route | 5 BOOK-DETAIL |
| `components/progress/**`, profile, settings, notebook, export route | 6 PROGRESS |
| badges/achievements/streak/tier/journeys/events/rewards + their APIs | 7 GAMIFICATION |
| `app/page.tsx`, sections/landing/website, pricing, books, og, legal, book-request API | 8 LANDING |
| `app/onboarding/**`, OnboardingShell, onboarding APIs | 9 ONBOARDING |
| `app/auth/**`, signup, pair, gift, ref, account-deleted | 10 AUTH |
| Everything (post-merge) | 11 CONSOLIDATION |

Cross-agent needs are pre-routed as HANDOFF notes (workspace catalog-import swap ← gamification; TopNav notebook entry ← progress; hero-glow token ← workspace; referral echo ← auth). FOUNDATION's codemod touches 10 marketing files mechanically before LANDING branches — LANDING branches from the post-Wave-0 base, so no conflict.
