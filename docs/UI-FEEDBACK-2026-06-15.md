# ChapterFlow Front-End Quality Audit — 2026-06-15

> Experience/quality audit of the ChapterFlow **Next.js front-end** (App Router · React 19 · Tailwind v4). Scope is the **experience layer** — visual design, design-system consistency, accessibility (WCAG 2.2 AA), responsive behavior, UX/flows, perceived performance & architecture, and content/polish. It deliberately does **not** cover correctness/logic/security bugs — those are owned by [docs/BUG-HUNT-2026-06-15.md](BUG-HUNT-2026-06-15.md) (36 confirmed defects, issues #64–#99). Findings are deduped against the 2026-06-10 prior UI audit; only **new / still-open / regressed** items are reported (resolved prior findings are noted as `prior-fixed` for context).
>
> **Method.** 7-dimension `frontend-developer` review → per-finding adversarial verification (each finding re-read against worktree source; dev-env artifacts, correctness/bug-hunt items, and already-fixed or stale claims refuted; WCAG ratios recomputed) → synthesis. A live **Playwright** pass on **Node 20** drove 13 routes at desktop (1440) + mobile (390) against a local dev server and screenshotted each. ≈98 candidate findings → adversarial verification (2 refuted) → dedup/merge of cross-dimension duplicates → **85 distinct findings reported (0 critical · 8 high · 33 medium · 44 low)**, plus 10 resolved prior-audit issues noted as `prior-fixed`. Run in an isolated git worktree on branch `audit/ui-feedback-2026-06-15`.

## Overall assessment

The ChapterFlow front-end is in materially better shape than the 2026-06-10 prior audit found it, and the most embarrassing defects are genuinely gone. The Tailwind v4 broken-utility bug (`-[--var]`) that left the Pro pricing CTA near-invisible no longer reproduces — there are zero occurrences of the dead arbitrary-property form, the correct `-(--var)` form is used ~3,400 times, and a CI gate (`scripts/ci/scan-style-drift.mjs` + the `style-drift-scan` job) now bans `[--` in className so it cannot regress silently. The reader is API-backed off the published manifest, the `[bookId]` detail route got a geometry-matching skeleton, the double mobile bottom-nav is collapsed to one bar, the teal-reader / cyan-shell brand seam is closed at the token level (`--cr-accent`, `--accent-teal`, and `--cf-accent` all resolve to one cyan per theme), `ChapterCompleteModal` now uses the shared `Dialog` primitive, and several first-run dead-ends (starter-shelf left-swipe trap, fake-OAuth signup, quiz cooldown) are resolved. The core reading loop works, the reduced-motion discipline is thorough, and the marketing surface renders cleanly.

What is genuinely strong: the reduced-motion coverage, the shared overlay/Dialog a11y contract (focus trap, restore, scroll-lock), the new loading skeletons on the detail route, and a real design-token vocabulary that — where it is followed — produces a coherent dark-glass aesthetic. The reader's segmented controls expose their own sr-only live region for tab state, showing the team knows the patterns.

The through-lines of weakness are now subtler but real, and they cluster in three places. **Accessibility contrast and announcements**: the most-used primary button paints white text on cyan (~1.8–2.4:1), the keyboard focus ring on every button is a ~1.3–1.5:1 box-shadow, the legacy `--text-tertiary`/`--text-muted` family sits below 4.5:1 in dark mode, and the core quiz/reader surfaces never announce answer results, scores, or action confirmations to screen readers. None of these block a sighted mouse user, but together they are a substantial WCAG 2.2 AA gap on exactly the surfaces users spend the most time on — and a shipped colorblind-remap feature silently fails on the review/quiz self-grade buttons because they use raw Tailwind palette classes the remap never touches. **Design-system fragmentation**: four overlapping token families (~292 custom properties), a fifth raw-palette channel, two BookCover/EmptyState/DailyGoalRing implementations, fragmented radius/shadow/font/motion scales, and dead shadcn infrastructure. Most of this is now alias-managed (so it rarely breaks the rendered UI), but it is unmistakable maintainability debt and a steady source of visual drift. **Architecture & content honesty**: no `loading.tsx` for the gated app-shell routes, a no-op `<Suspense>` and a server-then-client double-fetch on the dashboard, an eagerly-bundled reader demo on the landing critical path, error states answered four different ways across four screens, and content that promises more than it delivers (tone personalization the reader flattens to one voice, two reader-level vocabularies, "Achievement" vs "Badge" vs "Premium" naming).

On **responsive/mobile** the picture is the same shape: the prior audit's two headline mobile blockers are fixed (the dual overlapping bottom-nav is gone; the library card grid no longer overlaps, and Dialog/Sheet were rebuilt with scroll-lock + `dvh` + `pb-safe`), but two unfixed root causes linger — `overflow-x:hidden` on the app shell silently kills the sticky top bar on three authed tabs, and `viewport-fit=cover` is missing so all the `env(safe-area-inset-*)` work the team already wired up is inert on notched iPhones — alongside a spread of sub-44px touch targets in the reader header, audio controls, and the pricing toggle.

The net delta since 2026-06-10 is clearly positive: every prior CRITICAL we could re-check is fixed. But the audit surface shifted from "broken-looking" to "not-quite-exceptional" — the remaining work is the difference between a product that functions and one that feels deliberate, inclusive, and trustworthy end to end. The highest-value items are a handful of one-line token contrast fixes and a small set of a11y announcements that, for very little effort, would lift the most-traveled surfaces across the AA bar.

## Top 10 highest-impact improvements

1. **Fix primary-button text contrast in dark mode** — [Accessibility / high] — `app/globals.css:350`. The app's most-used primary button (signup, workspace, every default `<Button>`) paints white text on a cyan gradient at ~1.8–2.4:1, failing AA on every primary CTA. Set `--cf-accent-contrast` to a dark value (`#0B0E14` / `var(--primary-foreground)`) in the dark `:root` and replace `WorkspacePage.tsx:703`'s hardcoded `text-white` with `text-(--cf-accent-contrast)` → 10.69:1, one-line fix with app-wide reach.

2. **Make the keyboard focus ring visible** — [Accessibility / high] — `app/globals.css:368,989-992`. `.cf-btn:focus-visible` removes the outline and substitutes a 20%-alpha box-shadow (~1.3–1.5:1), so keyboard users get a near-invisible focus indicator on every button. Raise `--cf-focus-ring` to a ≥3:1 solid/high-opacity ring, or drop `outline:none` so the global solid 2px outline applies.

3. **Stop raw palette classes from defeating colorblind mode** — [Accessibility / high] — `components/sections/Pricing.tsx:387` (+22 files). `ring-cyan-400` (×46), `bg-amber-500`, `text-red-400`, `bg-emerald-500` etc. compile to literal hex the colorblind/high-contrast remaps never touch — so the review/quiz self-grade buttons (`ReviewSession.tsx`, `ReviewCardsPanel.tsx`) keep their red/green-confusable pair even when colorblind mode is on. Codemod raw palette utilities to the remappable `--accent-*`/`--ring` tokens and add a lint rule banning `color-N` palette utilities.

4. **Announce quiz results and reader actions to screen readers** — [Accessibility / high] — `app/book/library/[bookId]/chapter/[chapterId]/components/QuizPanel.tsx:269-301,454-476` and `ChapterReaderClient.tsx:1297-1301`. On the flagship learning loop, answer feedback ("Correct! / N retries left / the answer is X"), the pass/fail score, and the reader's mode/tone/bookmark/sync toasts render with no `aria-live` region, so blind/low-vision users get zero confirmation. Add a persistent polite live region for results and wrap the reader toast (and the "saved locally" sync pill) in `role="status" aria-live="polite"`.

5. **Add a skip-link to the authenticated app shell** — [Accessibility / high] — `components/workspace/WorkspacePage.tsx:969-982`. Marketing has a proper skip link; the authenticated app (where users live) has none, so keyboard/SR users tab through TopNav's ~12 controls on every page (WCAG 2.4.1 Level A). Emit the sr-only-until-focus skip link before TopNav's header and make `<main>` a focusable `id="main" tabIndex={-1}` target, ideally in a shared shell.

6. **Raise the legacy muted-text tokens above AA** — [Accessibility / high] — `app/globals.css:220-221`. Dark `--text-tertiary`/`--text-muted` (`#5C6B7A`) computes 2.9–3.5:1 on the surfaces it's used on and feeds ~100 microcopy/placeholder consumers (BookRequestForm, Hero trust line, Footer, Pricing). The canonical `--cf-text-soft` was already bumped for exactly this; align the legacy family to `#7C8B9A` (≥4.5:1) so secondary text clears AA site-wide.

7. **Restore the sticky top bar on Progress / Badges / Book-detail (mobile)** — [Responsive / high] — `app/globals.css:823-833`. `overflow-x:hidden` on `.cf-app-shell` turns it into a scroll container and silently disables `position:sticky`, so TopNav scrolls away on those three authed tabs while sticking everywhere else — an inconsistent, janky header on every phone. Change `overflow-x:hidden` to `overflow-x:clip` (clip doesn't establish a scroll container, so sticky keeps working), or move the decorative orbs into their own `overflow:clip` box.

8. **Add `loading.tsx` to the gated app-shell routes** — [Perceived performance / medium] — `app/dashboard/page.tsx:5-12`. Dashboard, `/book/library`, `/book/progress`, `/book/saved`, `/book/notebook` block on a two-await server auth round-trip with no route fallback (only the reader got skeletons), so cold loads show a blank screen. Add a `loading.tsx` per route rendering the TopNav shell + the existing Dashboard/Library/Progress skeletons so chrome streams immediately.

9. **Unify error states behind the shared `ErrorBanner`** — [UX flows / live-visual / medium] — `LibraryPage.tsx:264-274`, `RewardsPageClient.tsx:240-247`, `ProgressPage.tsx:637-677` vs `WorkspacePage.tsx:983-988`. The same "data failed to load" condition renders four unrelated designs — from a one-tap soft retry to "please refresh the page," to a raw server string with no recovery. Route all four through the existing `ErrorBanner` (title + icon + message + `onRetry`), give Library/Rewards an in-app refetch, and never surface a raw server message.

10. **Make onboarding's tone promise honest** — [Content & polish / medium] — `app/onboarding/components/StepTone.tsx:107-119` + `chapterFromApi.ts:88-92`. "This sets how every chapter talks to you" shows three dramatically different sample voices, but the API mapper flattens all three tone keys to one canonical string — the choice changes nothing in the delivered prose (and the reader's own tone switcher toasts a no-op). Soften the copy to what's true today (framing/encouragement only) or gate the step until per-tone content exists; remove the divergent sample paragraphs. *(The landing-demo eager-bundle + dashboard data-waterfall fix — formerly #10 — is in the Perceived performance section below.)*

## Findings by dimension

### Design system & visual

- **[high] Raw Tailwind palette classes bypass all four token families AND break colorblind/high-contrast remapping** — `components/sections/Pricing.tsx:387` (22 files) — *spans design-visual + accessibility*
  - Issue: A fifth color channel leaks past every token system. `ring-cyan-400` (×46, the focus ring on most CTAs), `bg-amber-500` (×7), `text-red-400` (×5), `bg-emerald-500` (×4), etc. compile to literal hex. The colorblind/high-contrast remaps in `globals.css:1749-1854` only redefine `--accent-*`/`--cf-*` variables, so raw palette classes are never remapped — and they're used semantically on live core-loop surfaces (`ReviewSession.tsx`, `ReviewCardsPanel.tsx` emerald/amber/rose self-grade; `QuizPanel.tsx:479`; `PartnerProgressCard.tsx` errors), so the shipped colorblind feature silently fails on the most-traveled review/quiz loop.
  - Fix: Codemod palette classes to token equivalents (`ring-cyan-400/60`→global `:focus-visible`/`ring-(--ring)`; `bg-amber-500`→`bg-(--accent-amber)`; `text-red-400`→`text-(--accent-rose)`; emerald→`--accent-emerald`). Add an ESLint/stylelint rule banning raw `color-N` palette utilities.

- **[medium] Four competing token families (~292 custom properties) split the design language** — `app/globals.css:82-394,1570-1616` — *still-open*
  - Issue: shadcn (`--background`/`--primary`/`--card`…), the semantic family (`--bg-surface-*`/`--text-*`/`--accent-*`), `--cf-*`, and `--cr-*` all describe the same surfaces (a muted panel = `--muted` = `--bg-surface-2` = `--cf-surface-muted` = `--cr-bg-surface-2`); 22 live components mix two vocabularies in one file. Much is now alias-managed (so surfaces still resolve consistently — no user-facing breakage), but it remains migration debt and visual-drift risk.
  - Fix: Pick `--cf-*` as canonical, finish codemodding direct `--bg-surface-*`/`--text-*` component utilities onto it, and document the chosen vocabulary so new screens don't re-fork.

- **[medium] Two BookCover implementations diverge in fallback, alt-text and aspect handling** — `components/library/BookCover.tsx:34-96` vs `app/book/components/BookCover.tsx:18-94` — *still-open*
  - Issue: One renders a gradient + white-title fallback in a fill box (decorative `alt=""`); the other an `aspect-2/3` rounded box with emoji-icon radial fallback, hover sheen, and `alt="${title} cover"`. `/books` uses the app/book variant, the library route uses the other, so the same book shows two cover styles. (Note: the app/book wrapper is `aria-hidden`, so the alt is inert — both are effectively decorative.)
  - Fix: Merge into one BookCover with props (`fallbackStyle: gradient|icon`, `interactive`, fill/fixed), pick one alt policy, delete the duplicate (and the dead `components/ui` DashboardBookCover).

- **[medium] Radius scale is fragmented across four uncoordinated systems** — `app/globals.css:151-157,292-296` (+components)
  - Issue: Tailwind's `--radius` scale, a separate fixed-px `--radius-*-val` set (10 files + `.glass-card`/`.cr-*`), standard `rounded-{sm..3xl}` utilities, and ~49 hardcoded `rounded-[Npx]` across 14 distinct off-scale values (`[26px]`×12, `[22px]`×10, `[30px]`×5…) produce visibly mismatched corners on adjacent cards/pills/buttons.
  - Fix: Collapse to one scale — codemod arbitrary `rounded-[Npx]` to the nearest token and migrate `--radius-*-val` consumers onto the Tailwind `--radius` scale, deleting one duplicate token set.

- **[low] Two divergent DailyGoalRing implementations off different accent tokens** — `components/workspace/DailyGoalRing.tsx:1-60` vs `components/progress/DailyGoalRing.tsx:1-252` — *still-open*
  - Issue: Both hand-roll SVG instead of the shared `components/ui/ProgressRing`; workspace strokes `--cf-accent`, progress strokes `--accent-cyan`/`--accent-violet`. (Tokens alias to the same hex in the two primary themes, so visually near-equal today; the gap is duplication + a third/fourth live ring code path.)
  - Fix: Rebuild both on `components/ui/ProgressRing` (the progress one composes two rings); standardize the stroke on `--accent-cyan`.

- **[low] Three EmptyState components diverge in markup, sizing and CTA color** — `components/ui/EmptyState.tsx:15-70` vs `components/progress/EmptyState.tsx:15-68` vs `app/book/admin/_components/EmptyState.tsx` — *still-open; spans design-visual + ux-flows*
  - Issue: `ReactNode` vs string icon; default size 48 vs 64; title `<h3>` vs `<p>` (heading-semantics inconsistency); CTA text `#FFFFFF` vs `var(--bg-base)`; CTAs are hand-rolled (bypass `Button`/`.cf-btn-primary`, miss shared hover/focus/disabled). The `ui` variant is dead code and the `progress` variant's only consumer is an unreachable branch, so live divergence is minimal — code-health cleanup.
  - Fix: Promote one to `components/ui`, default to a heading element, route the CTA through the shared `Button` with a token color, delete the duplicates.

- **[low] Display font applied three inconsistent ways; redundant `--font-sora`/`--font-dm-sans` aliases still in use** — `app/globals.css:310-315`
  - Issue: `font-(family-name:--font-display)` (20 files), inline `fontFamily` (25 files), and legacy aliases `--font-sora`/`--font-dm-sans` (8 + 11 onboarding-era consumers) all coexist; the aliases are pure indirection duplicating `--font-display`/`--font-body`.
  - Fix: Standardize on the Tailwind utility, codemod inline uses, migrate the 8+11 alias consumers, delete the two aliases.

- **[low] Shadow tokens split between two families with overlapping roles** — `app/globals.css:147-150,272-279,340-342,498-505,535-537`
  - Issue: `--shadow-card/-elevated/-book/-modal` (exposed as the doubled `shadow-shadow-card` utility, 19 files) and `--cf-shadow-sm/md/lg` (29 files + `.cf-panel`) express the same elevation ladder with different values, so a `.cf-panel` next to a `shadow-shadow-card` element gets different drop shadows at the same intent.
  - Fix: Define one elevation ladder, alias one scheme onto it, and rename the doubled `shadow-shadow-*` utilities to remove the seam.

- **[low] Gold accent has two inconsistent values** — `app/globals.css:255,481` vs `app/book/badges/components/BadgeCard.tsx:21`
  - Issue: Completion/celebration gold is `--accent-gold #E8B931` (11 components, ring glows) but badges hardcode `#FFD700→#FFF0A0` (also duplicated in `badge-utils.ts:380`); the same reward "gold" reads brassier on rings vs brighter on badges. `--accent-gold` is also the one accent identical across light/dark, so it can fail contrast on light surfaces.
  - Fix: Define a single per-theme gold token pair and point both the ring glow and badge gradient (`BadgeCard.tsx:21` + `badge-utils.ts:380`) at it.

- **[low] Motion-timing token scale largely unused against ~69 files of hardcoded durations** — `app/globals.css:299-307` — *still-open*
  - Issue: A full `--duration-*`/`--ease-*` scale is declared but only 9 files consume it (and it sits outside `@theme inline`, so no `duration-fast/normal/slow` utilities are minted), while ~69 files hardcode `duration-200/300/500` and inline `NNNms`/`Ns` timings — no shared rhythm, no single point of control.
  - Fix: Move/alias the tokens into `@theme inline` to mint utilities and codemod common durations, or delete the unused scale.

- **[low] Deprecated accent aliases still live in components and a shipping CTA** — `app/globals.css:243-255,472-481`
  - Issue: The file labels `--accent-teal/-green/-red/-blue/-flame` "DEPRECATED; migrate", yet 40+ live consumers remain — including the Pro pricing CTA (`Pricing.tsx:387` `bg-(--accent-teal)`), `.prose-legal a`, and a keyframe. Same color reachable under two names widens the seam.
  - Fix: Codemod teal→cyan, green→emerald, red→rose, blue→cyan, flame→amber; delete the alias block; switch the Pricing CTA to `bg-(--accent-cyan)`.

- **[low] shadcn token block is near-dead infrastructure** — `app/globals.css:83-117,166-197,401-432`
  - Issue: ~50 properties declared twice (dark + light) and exposed via `@theme inline`, but `--chart-1..5`, all `--sidebar*`, and `bg-card/popover/muted` have zero consumers; only `text-primary-foreground` (6 sites) survives. `@theme` mints phantom utilities (`bg-card`, `bg-sidebar`) that look real but point at a dead family.
  - Fix: Delete the unused shadcn tokens + their `@theme` aliases; keep only `--primary`/`--primary-foreground` or migrate those 6 sites to `--accent-cyan`/`--cf-accent-contrast`.

- **[low] Dead/brittle `[style*=]`/`[class*=]` selectors and reduced-motion blocks duplicated ~8 times** — `app/globals.css:1146-1176,1240-1251,1980-2002`
  - Issue: Reader animations applied via inline `style="animation: cr-…"` are killed by substring selectors tightly coupled to exact strings (the file admits the old `[class*="cr-float"]` selectors "never matched anything"); the reduced-motion kill-list is maintained as ~8 `@media` + `[data-motion]` mirror pairs, so a new animation needs edits in 2-3 places. (The universal `*` clamp at 1146-1154 is a backstop, so a stale selector degrades rather than fully breaks.)
  - Fix: Apply animations via dedicated `.cr-anim-*` classes and consolidate the kill-list into one `:where()`-grouped selector shared by `@media` and `[data-motion="reduced"]`.

- **[prior-fixed] Reader brand-seam resolved** — `app/globals.css:1591-1595` — `--cr-accent`/-hover/-muted/-glow now alias `--accent-cyan` (teal `#4DB6AC` gone; high-contrast reader glass switched to brand navy). The teal-reader island no longer reproduces. No action; optional `--cr-*` alias fold-in per the fragmentation finding.
- **[prior-fixed] Tailwind v4 `-[--var]` and `--font-mono` token both fixed** — `app/globals.css:86-88` — 0 occurrences of the broken arbitrary-property form (3,400+ correct `-(--var)`); `--font-mono` resolves to a loaded JetBrains_Mono. No action.

### Accessibility

- **[high] Primary CTA buttons fail text contrast in dark mode (white on cyan ~1.8:1)** — `app/globals.css:350,1001-1005`
  - Issue: `--cf-accent-contrast` is `#ffffff` and `.cf-btn-primary` paints it over the `#22D3EE→#06B6D4` gradient (1.81:1 / 2.43:1) — below AA 4.5:1 on the app's most-used button (signup, workspace, every default `<Button>`, `TokenExpiryGuard`, ref/gift/pair-accept). The DS already has the fix: `--primary-foreground #0B0E14` (10.69:1), which `Hero.tsx:114` already uses.
  - Fix: Set dark `--cf-accent-contrast` to `#0B0E14`/`var(--primary-foreground)`; replace `WorkspacePage.tsx:703` `text-white` with `text-(--cf-accent-contrast)`.

- **[high] `cf-btn` focus indicator is ~1.3-1.5:1 — effectively invisible** — `app/globals.css:368,989-992`
  - Issue: `.cf-btn:focus-visible` drops the outline for `box-shadow: var(--cf-focus-ring)` at only 20% alpha (~1.5:1 dark / ~1.3:1 light) — below the 3:1 SC 1.4.11/2.4.13 minimum on the app's most prominent buttons, overriding the global solid outline.
  - Fix: Raise `--cf-focus-ring` to a ≥3:1 solid/high-opacity ring, or drop `outline:none` so the global solid 2px outline applies.

- **[high] Quiz answer feedback and score not announced to screen readers** — `app/book/library/[bookId]/chapter/[chapterId]/components/QuizPanel.tsx:269-301,454-476`
  - Issue: Per-question banners ("Correct!" / "N retries left" / "the answer is X") and the pass/fail headline + score render with no `aria-live`; the only live region (`:499`) announces the cooldown timer, not results. The 1-5 keyboard shortcuts give no SR feedback path (WCAG 4.1.3).
  - Fix: Add a polite live region announcing each answer result and an announcement of the final score on submit (reuse the `ProgressRing` ariaLabel string).

- **[high] No skip-link in the authenticated app shell** — `components/workspace/WorkspacePage.tsx:969-982`
  - Issue: Marketing has skip + `<main id="main">`; the authenticated app (WorkspacePage/Library/Progress/reader) renders TopNav (~12 controls) with no bypass, so keyboard/SR users tab through it on every load (WCAG 2.4.1 Level A). The root layout provides no app-wide target either.
  - Fix: Emit the sr-only-until-focus skip link before TopNav's header and make `<main>` a focusable `id="main" tabIndex={-1}` target in a shared shell.

- **[high] `--text-tertiary`/`--text-muted` dark value fails body contrast (2.9-3.5:1)** — `app/globals.css:220-221`
  - Issue: Dark `--text-tertiary #5C6B7A` (aliased by `--text-muted`) is 3.53:1 on page-bg, 3.24:1 on surface, 2.89:1 on surface-muted — below AA. It feeds ~100 consumers (BookRequestForm placeholders/microcopy, Hero trust line, Footer, Pricing). The canonical `--cf-text-soft` was already bumped for this; the legacy family was missed.
  - Fix: Raise dark `--text-tertiary` to `#7C8B9A` (or `#8899AA`); verify against `#1A2332`.

- **[medium] No Windows High Contrast / `forced-colors` or `prefers-contrast` support** — `app/globals.css:n/a`
  - Issue: Thorough `prefers-reduced-motion` coverage but zero `@media (forced-colors: active)` / `@media (prefers-contrast: more)`. Box-shadow focus rings, low-alpha borders (`--cf-border` 6% white), and `color-mix()` tints disappear in Windows High Contrast, making focus/selected/active cues indistinguishable.
  - Fix: Add a `forced-colors:active` block restoring `forced-color-adjust` + visible outlines on focus and system-color borders; add a `prefers-contrast:more` block swapping low-alpha borders for solid ones.

- **[medium] TopNav header/nav landmarks nested inside `<main>` in Library and Progress** — `components/progress/ProgressPage.tsx:681-692` and `components/library/LibraryPage.tsx:246-252`
  - Issue: Both wrap everything (including TopNav's `<header>`/`<nav>`) inside a single `<main>`, nesting banner + navigation landmarks in main (WCAG 1.3.1 / landmark practice). WorkspacePage gets it right (siblings).
  - Fix: Wrap each branch in a plain container holding `<TopNav/>` then `<main>`, matching WorkspacePage (all three ProgressPage branches + LibraryPage).

- **[medium] BookRequestForm relies on JS for the focus ring; no live error announcement** — `components/website/BookRequestForm.tsx:93-94,122-132,195-199`
  - Issue: Inputs set `focus:outline-none focus:ring-0` and draw focus only via imperative `onFocus`/`onBlurCapture` style mutations (no `:focus-visible` fallback — a JS regression leaves no ring), and on-blur validation errors have `aria-describedby`+`aria-invalid` but no `role="alert"`/`aria-live`, so they aren't announced when they appear. The form's own submit button uses `focus-visible:ring-2`, so the inputs are internally inconsistent.
  - Fix: Replace the JS handlers with a token-based `:focus-visible` ring; add `aria-live="polite"`/`role="alert"` to the field error `<p>`s.

- **[medium] PhaseStepper lock explanation not announced; progress bar lacks role/aria-valuenow** — `app/book/library/[bookId]/chapter/[chapterId]/components/PhaseStepper.tsx:229-244,217-227`
  - Issue: The locked-step tooltip/toast explaining why it's locked is a plain div (no live region); locked steps are `tabIndex={-1}` so the `title` fallback isn't reachable. The continuous progress bar is a plain `<div>` with no `role="progressbar"`/`aria-valuenow`.
  - Fix: Put the lock reason into a polite live region (or the button's accessible name); add `role="progressbar" aria-valuenow/min/max aria-label="Chapter progress"` to the bar.

- **[medium] Reader toast has no aria-live region** — `app/book/library/[bookId]/chapter/[chapterId]/ChapterReaderClient.tsx:1297-1301`
  - Issue: The primary feedback toast (mode/tone switch, bookmark, notes exported, step saved, daily-goal, quiz-fail motivation) and the "Changes saved locally only" sync pill are plain `<div>`s with no `role="status"`/`aria-live` — even though the file uses that pattern at `:853` for tab state.
  - Fix: Wrap the toast container (and sync pill) in a persistent `role="status" aria-live="polite" aria-atomic="true"` wrapper the text flows into.

- **[medium] Light-mode muted text dips below 4.5:1; reader disabled text fails on surface-3** — `app/globals.css:532,1626,1588`
  - Issue: `--cf-text-3 #78716C` passes on page-bg (4.59:1) but drops to 4.40:1 on `--cf-surface-muted` (and 3.82:1 on surface-strong) for secondary labels (`.cf-muted`, `.cf-kicker`, ThemeModeToggle); dark `--cr-text-disabled #8A97A6` is 4.46:1 on `--cr-bg-surface-3` and used for informational (not just disabled) labels (ChapterCompleteModal, ChapterHeader, ReaderSettingsMenu).
  - Fix: Nudge light `--cf-text-3` to ~`#6B6560` (5.27:1); verify informational uses of `--cr-text-disabled` meet 4.5:1 on surface-3 or step the token.

- **[low] TopNav profile dropdown is not a menu (no aria-haspopup/role, no focus return)** — `app/book/home/components/TopNav.tsx:378-449` — *still-open*
  - Issue: The toggle has `aria-expanded` but no `aria-haspopup`; the dropdown is a plain `<div>` of links + a sign-out button with no `role="menu"`/menuitem, no focus move on open, and no focus return to the trigger on close/Escape (a shared global Escape closes it). The mobile More Sheet correctly uses the Dialog primitive. (A disclosure-of-links pattern is a legitimate alternative, so the real gap is just focus-return.)
  - Fix: Either render a real menu (`aria-haspopup="menu"`, `role="menu"`/menuitem, roving tabindex, focus first item on open, return focus on close), or at minimum restore focus to the trigger on Escape/close.

- **[low] Inconsistent focus-ring systems (three competing patterns)** — `app/globals.css:61-64` — *still-open*
  - Issue: (a) global solid 2px `var(--accent-cyan)` outline; (b) the weak 20%-alpha `--cf-focus-ring` box-shadow on cf-btn/cf-input; (c) per-component Tailwind rings — landing/forms use the literal `ring-cyan-400/60` (doesn't track the token across themes) while the reader uses `ring-(--cr-accent-glow)`/`color-mix(...)`. Widths/offsets/alpha vary.
  - Fix: Standardize on one token-driven ring (the global outline or a single `--cf-focus-ring` at ≥3:1) and remove the `ring-cyan-400` literals.

- **[low] Low-contrast non-text state cues on the locked phase connector** — `app/book/library/[bookId]/chapter/[chapterId]/components/PhaseStepper.tsx:183-189`
  - Issue: The locked dashed connector underlay uses `--cr-glass-border` (~0.08 white) at 50% opacity — well under the 3:1 SC 1.4.11 threshold and the sole cue distinguishing locked vs completed connectors. (Step state is also conveyed redundantly by high-contrast node icons/labels, so it's a secondary cue.)
  - Fix: Use a ≥3:1 token for the state-bearing connector; reserve glass-border for purely decorative dividers.

- **[low] library/BookCover meaningful alt suppressed by an aria-hidden wrapper** — `app/book/components/BookCover.tsx:47,53`
  - Issue: The wrapper is `aria-hidden="true"` but the inner image still sets `alt="${title} cover"` — dead/contradictory; it works only because callers supply the name via adjacent titles. The sibling `components/library/BookCover` deliberately uses `alt=""`. A refactor that removes the title would silently leave covers unlabeled.
  - Fix: Set `alt=""` on the image in `app/book/components/BookCover` so the decorative-by-design intent is explicit.

- **[low, no-JS robustness] Below-the-fold landing content starts at `opacity:0`, depends on JS + IntersectionObserver** — `components/ui/SectionReveal.tsx:34-52` — *spans accessibility + design-visual + perf-arch*
  - Issue: SectionReveal SSRs `style="opacity:0"` and only reveals via `useInView`; every below-the-fold landing block (Problem, HowItWorks, InteractiveDemo, Library, Pricing, SocialProof, FinalCTA) and `/books` hero/CTA depend on it. With JS disabled / IO unsupported / hydration stall, conversion-critical content stays invisible (content is in the DOM/a11y tree, so SEO/AT unaffected). Only `prefers-reduced-motion` renders plain. (Calibration-sanctioned no-JS concern, not the capture-harness blank-section artifact.)
  - Fix: Render base-visible by default and treat reveal as additive (gate `opacity:0` behind a `js-enabled` class, or add a `@media (scripting: none)`/noscript `opacity:1` fallback).

- **[prior-fixed] ChapterCompleteModal navigation-trap resolved** — `…/components/ChapterCompleteModal.tsx:5,88` — now uses the shared `Dialog` primitive (role=dialog, aria-modal, focus trap/restore, Escape, scroll-lock, initial focus). No action; continue migrating the TopNav profile dropdown.

### Responsive & layout

- **[high] overflow-x:hidden on .cf-app-shell breaks the sticky TopNav header on Progress/Badges/BookDetail** — `app/globals.css:823-833` — *still-open*
  - Issue: `.cf-app-shell` sets `overflow-x: hidden`, which makes it the scroll container and disables `position: sticky` for any descendant. TopNav's header is `sticky top-0 z-30`, and Progress, Badges and BookDetail all wrap TopNav inside `<main className="cf-app-shell">`, so on those tabs the top bar scrolls away. LibraryPage and WorkspacePage use a plain `min-h-screen` wrapper (no cf-app-shell), so the SAME TopNav DOES stick there. The result is an inconsistent top bar that sticks on some authed tabs and scrolls off on others — visible on every phone.
  - Fix: Change `overflow-x: hidden` to `overflow-x: clip` on .cf-app-shell (clip does not establish a scroll container, so sticky keeps working) — or remove it and wrap the decorative background orbs in their own `overflow:clip` container. Then confirm TopNav sticks on Progress/Badges/BookDetail on a device.

- **[high] AskBookDrawer bottom sheet: no body scroll lock, vh (not dvh) height, and keyboard-blind on mobile** — `app/book/components/AskBookDrawer.tsx:306` — *still-open*
  - Issue: Unlike NotesDrawer (now migrated to the shared Sheet with scroll-lock/dvh/pb-safe), AskBookDrawer still hand-rolls its overlay. Its mobile panel is `inset-x-0 bottom-0 h-[70vh] rounded-t-3xl`: (1) it never locks body scroll, so the page behind the sheet scrolls under the user's fingers; (2) it sizes with `vh`, which on mobile uses the largest viewport and ignores the browser toolbar; (3) the input is auto-focused on open (line 165), raising the iOS keyboard, but with vh sizing and no visualViewport handling the chat input row gets covered by the keyboard — the user can't see what they type. It also lacks a focus trap.
  - Fix: Migrate AskBookDrawer to the shared `Sheet` component (mobile) / desktop side-panel variant, the same way NotesDrawer was. At minimum: switch `h-[70vh]` to `h-[70dvh] max-h-[90dvh]`, add the body-scroll-lock effect, add `pb-safe` to the input row, and offset the panel/input with visualViewport on keyboard open so the composer stays visible.

- **[medium] viewport-fit=cover still missing — all env(safe-area-inset-bottom) usage resolves to 0 on notched iPhones** — `app/layout.tsx:36-43` — *still-open*
  - Issue: The root `viewport` export sets only width/initialScale/themeColor. Without `viewportFit: 'cover'`, iOS Safari does not extend the layout under the home-indicator/Dynamic-Island insets, so `env(safe-area-inset-*)` always evaluates to 0px. Code across the app now correctly references safe-area (TopNav bottom bar `pb-safe`, dashboard spacer `calc(4.5rem + env(safe-area-inset-bottom))`, AudioPlayer mini-bar `pb-[calc(0.5rem+env(safe-area-inset-bottom))]`, AskBookDrawer FAB `bottom-[calc(env(safe-area-inset-bottom)+1rem)]`, reader sync pill/toast offsets), but every one of these reductions to 0 — so the safe-area engineering is wired up yet completely inert on the exact devices it targets.
  - Fix: Add `viewportFit: 'cover'` to the viewport export in app/layout.tsx. This single line activates every pb-safe/env() offset already shipped across the nav, audio bar, FABs, sheets and dashboard spacer. Verify on a real notched iPhone after.

- **[medium] Reader header icon buttons are ~28-32px touch targets (back, settings, notes)** — `app/book/library/[bookId]/chapter/[chapterId]/components/ChapterHeader.tsx:234,258,293` — *still-open*
  - Issue: The reader's sticky-chrome controls are the primary in-reading navigation on a phone, yet they are well under the 44x44px minimum. The Back link is `p-1.5` around a `h-4 w-4` icon (~28px) and its 'Back' text label is `hidden sm:inline`, so on a phone it is a 28px icon-only target. The settings and notes buttons are `p-2` around `h-4 w-4` icons (~32px). These are easy to miss-tap mid-chapter.
  - Fix: Give these header buttons a 44px hit area: e.g. `min-h-11 min-w-11 inline-flex items-center justify-center` (keep the small icon, enlarge the padding/box). Apply the same to the shortcuts button.

- **[medium] Audio player minimize/close/expand controls are ~22-26px touch targets** — `app/book/library/[bookId]/chapter/[chapterId]/components/AudioPlayer.tsx:323-324,344-345` — *still-open*
  - Issue: The audio panel's secondary controls are far below 44px. In the minimized full-width bar the Expand and Close buttons are `p-1.5` around `h-3.5 w-3.5` icons (~26px). In the expanded card the Minimize and Close are `p-1` around `h-3.5 w-3.5` (~22px). These sit at the very bottom edge of the screen (hardest zone to tap accurately on a phone).
  - Fix: Bump these to a 44px hit box (`min-h-11 min-w-11` with centered icon, or larger padding). They are the controls a user reaches for most on a phone while listening.

- **[medium] Audio seek bar: 4-8px track, and the scrub thumb is hover-only (invisible/untappable on touch)** — `app/book/library/[bookId]/chapter/[chapterId]/components/AudioPlayer.tsx:316,365,367` — *still-open*
  - Issue: The seek affordance is too small for touch. The minimized bar's progress track is `h-1` (4px) and the expanded one `h-2` (8px) with no enlarged hit area. The scrub thumb is rendered `opacity-0 group-hover:opacity-100` — on a touch device there is no hover, so the thumb is permanently invisible and there is no visible grab handle to drag; users get a 4-8px line they must tap precisely.
  - Fix: Give the seek bar a ~44px tall transparent hit area (padding or a ::before), and always render the thumb on touch via `@media (hover: none) { opacity: 1 }` (or just render it unconditionally). Increase visible track thickness on touch.

- **[low] Landing mobile sticky CTA bar has no safe-area padding and a 32px dismiss button** — `components/landing/MobileStickyBar.tsx:52,72-81` — *still-open*
  - Issue: The landing's mobile sticky CTA (`fixed bottom-0 inset-x-0`) never references safe-area at all (no pb-safe, no env()), so even once viewport-fit=cover is added the bar still sits in the iPhone home-indicator gesture zone — the primary 'Start reading free' CTA overlaps the system gesture bar. Separately, the dismiss (X) button is `w-8 h-8` (32px), under the 44px minimum.
  - Fix: Add `pb-safe` (or `padding-bottom: max(0.75rem, env(safe-area-inset-bottom))`) to the bar, and enlarge the dismiss button to `min-h-11 min-w-11`.

- **[low] Pricing Monthly/Annual toggle is a 24px-tall switch with non-clickable labels** — `components/sections/Pricing.tsx:198-219` — *new*
  - Issue: The billing-period control on the pricing page (a key conversion surface) is a `w-12 h-6` (48x24px) switch — only 24px tall, well under 44px, so it is fiddly to toggle on a phone. The 'Monthly' and 'Annual' words beside it are plain `<span>`s, not part of the hit target, so tapping the label does nothing — the user must hit the small 24px track.
  - Fix: Increase the switch hit area to 44px tall (wrap in a `min-h-11` flex row or add a transparent ::before), and either make the Monthly/Annual labels clickable (set the corresponding state) or wrap the whole label+switch+label in a single `min-h-11` tappable control.

- **[low] TopNav top-bar icon cluster (theme toggle / bell / settings / profile chevron) is 36px tall** — `app/book/home/components/TopNav.tsx:337,342,378` — *still-open*
  - Issue: Every icon control in the authed top bar is ~36px (h-9), below the 44px guideline — on a phone these are the visible header controls. ThemeModeToggle outer button is `p-1` around an `h-8` slider (~36px tall); the Settings link, profile-menu chevron button and NotificationBell are all `h-9 w-9` (36px). The bottom tab bar got proper 44px+ targets (`py-3` + `h-7` icon + label) but the top bar cluster was not given the same treatment.
  - Fix: Raise the top-bar icon buttons to `h-11 w-11` (or add invisible padding to a 44px hit box) on touch viewports; keep the visual icon size. Lower priority since the primary mobile nav is the bottom bar, but these are the only header controls on a phone.

- **[low] App uses min-h-screen (100vh), not dvh, on full-height roots — toolbar-driven height jumps on mobile** — `app/onboarding/components/OnboardingFlow.tsx:125,258` — *new*
  - Issue: The onboarding root and main use `min-h-screen` (100vh), and the reader/state screens use `min-h-screen` too. On mobile browsers 100vh is the *largest* viewport (toolbar collapsed), so when the address bar is visible the layout is taller than the visible area and the bottom of centered onboarding content (and the reader's centered state screens) can sit under the toolbar / require scroll. dvh is the correct unit and is already used elsewhere in the codebase (Dialog max-h-[90dvh], ReaderSettingsMenu max-h-[85dvh]), so the inconsistency is the smell.
  - Fix: Replace `min-h-screen` with `min-h-dvh` (Tailwind v4 `min-h-dvh`) on the onboarding root/main and the reader full-height roots, so the layout tracks the dynamic viewport on mobile.

- **[low] Hero (and several marketing blocks) jump straight from 1-column to lg: with no tablet treatment** — `components/sections/Hero.tsx:39` — *new*
  - Issue: The landing hero is `grid-cols-1 lg:grid-cols-[60%_40%]`, so from 768px up to 1024px (the entire tablet range and large landscape phones) it renders as a single stacked column with the phone mockup pushed far below the fold and a lot of dead horizontal whitespace — the two-column layout only appears at lg. BrowseLibraryPage's hero similarly jumps `grid-cols-1 lg:grid-cols-[55%_45%]`. There's no md: intermediate, so tablets get the phone layout stretched wide.
  - Fix: Introduce an md: two-column variant (e.g. `md:grid-cols-2 lg:grid-cols-[60%_40%]`) or cap the single-column measure with `max-w-2xl mx-auto` below lg so tablet hero text doesn't span the full width with the mockup orphaned below.

- **[low] Desktop onboarding step floats dead-center with a large empty band above the heading** — `app/onboarding/components/OnboardingFlow.tsx:258`
  - Issue: The step container is `min-h-screen items-center justify-center` at all breakpoints, so the short motivation step (~4 cards) sits in the vertical middle on tall desktop windows, leaving the top third empty — reads as unbalanced/unfinished.
  - Fix: On `md+` use `justify-start` with sensible top padding (or cap content height and center only short content); keep vertical centering on mobile.

- **[prior-fixed] Dual overlapping mobile bottom-nav resolved** — `components/workspace/WorkspacePage.tsx:998-1003` — WorkspacePage no longer renders its own MobileBottomNav; only TopNav’s single shared bottom bar remains, with an aria-hidden safe-area spacer. The prior CRITICAL no longer reproduces.

- **[prior-fixed] Library 2-col grid overlap + Dialog/Sheet mobile behavior resolved** — `components/library/*`, `components/ui/Dialog.tsx` — fixed-200px library cards are now `w-full` in a `grid-cols-2` gap layout (carousels use `w-[150px] shrink-0`); Dialog/Sheet were rebuilt with body scroll-lock + `max-h-[90dvh]` + `pb-safe`, and NotesDrawer now uses that shared Sheet. (AskBookDrawer is the one drawer not yet migrated — see the high above.)

### UX / flows / interaction

- **[medium] "Skip" on the Starter Shelf step leaves the user with an empty shelf** — `app/onboarding/hooks/useOnboarding.ts:178-181`, `OnboardingFlow.tsx:247-254`, `complete/route.ts:111-137` — *still-open*
  - Issue: The header Skip's `case 5` is a no-op ("handled by the shelf component") but the shelf's `getTopPicks` fill only fires on the shelf's own continue/swipe — so a header-skip user finishes with `starterShelf:[]` and the dashboard personalized strip doesn't render. (Mitigated: `starterPrescription` still recommends a next book.)
  - Fix: On step-5 skip, run the same `getTopPicks` fill and persist; at minimum, backfill an empty shelf from `starterPrescription` in the complete route.

- **[medium] Reader silently serves stale local-fallback content with no offline indicator** — `ChapterReaderClient.tsx:206-208` + `hooks/useChapterContent.ts:116-133`
  - Issue: On API failure the hook falls back to locally-bundled content and exposes `error`/`status`/`source`, but the reader destructures only `{ chapter, hydrated }` — so a stale fallback is indistinguishable from a fresh render, with no offline notice. Inconsistent with the honest quiz "saved locally" provisional banner.
  - Fix: Surface a non-blocking "Showing an offline copy — reconnect for the latest" notice when `source === 'local' && error`, mirroring the quiz banner; optional quiet retry via the refetch key.

- **[medium] Reader toast auto-dismisses in 1.8s — too transient for substantive feedback** — `ChapterReaderClient.tsx:488-491,1297-1301`
  - Issue: The single toast channel auto-clears at 1800ms and carries both trivial confirmations and multi-sentence, decision-relevant messages (quiz-fail coaching + score, scenario-submission reward, "Unable to submit quiz right now"). 1.8s is below the readable threshold for a sentence + score; no dismiss, no pause-on-hover, no role/aria-live.
  - Fix: Content-aware duration (≥4-5s for long/error messages), manual dismiss, pause-on-hover, `role="status"`/`alert` + aria-live; route true errors (quiz submit failure) to the inline error surface.

- **[medium] Four divergent error-state patterns across the four data-backed screens** — `WorkspacePage.tsx:983-988`, `ProgressPage.tsx:637-677`, `LibraryPage.tsx:264-274`, `RewardsPageClient.tsx:240-247` — *still-open; spans ux-flows + live-visual*
  - Issue: Dashboard uses the shared `ErrorBanner` (amber, soft `refetch` retry); Progress a custom 😵 card with a hard `window.location.reload()`; Library `LibraryStateMessage` with no button ("Please refresh the page"); Rewards a bare `<p>` of the raw server string. Recovery ranges from one-tap to "you figure it out." (Each is functional/recoverable; it's a consistency gap.)
  - Fix: Route all four through `ErrorBanner` (title + icon + message + soft `onRetry`); standardize copy; never surface a raw server string.

- **[medium] Library error state strands the user with no in-app recovery** — `components/library/LibraryPage.tsx:75-92,264-268` — *still-open*
  - Issue: `LibraryStateMessage` renders only title + body ("Please refresh the page") — no Try-again, no link home, no refetch — while the dashboard offers one-tap retry. (`useLibraryDashboard` has an internal `revision` counter, so a retry is feasible.)
  - Fix: Pass an `onRetry` that re-runs the fetch (`setRevision(v=>v+1)`) and a secondary "Back to Home" link; reuse the shared error component.

- **[medium] Rewards error surfaces a raw technical string with zero recovery** — `app/rewards/RewardsPageClient.tsx:240-247` — *spans ux-flows + live-visual*
  - Issue: The error branch renders the raw `error` value ("An unexpected server error occurred.") inside a bare danger `<div>` — no title, no icon, no retry, blank page below — and doesn't reuse the shared `ErrorBanner` the rest of the app uses. The hook exposes `refresh`, but the client never wires it.
  - Fix: Render through `ErrorBanner` (title "We couldn't load Rewards", icon, `onRetry={refresh}`); map raw server strings to user-safe copy.

- **[low] Onboarding header logo is a non-functional affordance; no exit from the flow** — `app/onboarding/components/OnboardingFlow.tsx:207-243`
  - Issue: The logo/wordmark reads as a clickable home link but is an inert `<div>/<svg>/<span>`; the only ways out are completing 6 steps or repeatedly tapping Skip (which advances, not exits). A user who entered by mistake has no one-tap escape. (Logo has no `cursor:pointer`, so it doesn't strongly signal clickability; Skip's tap target is 48px.)
  - Fix: Add an explicit small "Exit setup" control (or make the logo a real link with a confirm), or render the logo with `cursor:default` so it reads as decoration.

- **[low] MiniQuiz correct-answer 4s auto-advance fights the explicit "Next" button** — `app/onboarding/components/MiniQuiz.tsx:72-78,311-323`
  - Issue: On a correct answer the quiz both renders a "Next" button AND starts a 4s auto-advance, yanking the screen out from under a user reading the feedback — contradictory affordances during the product's first impression. (Double-fire is already guarded.)
  - Fix: Pick one model — remove the correct-answer auto-advance (rely on Next, like the wrong-answer path) or hide Next and show a subtle countdown; pause the timer on interaction.

- **[low] Reader route-level loading.tsx is plain text while the in-app fallback is a rich skeleton** — `app/book/library/[bookId]/chapter/[chapterId]/loading.tsx:1-9`
  - Issue: The chapter route shows a bare "Loading chapter…" string, then the client mounts the polished `ChapterSkeleton` (`ChapterReaderClient.tsx:668-673`), then content — a jarring double-jump on the most-trafficked deep page. (Spans perf-arch; see also CLS finding below.)
  - Fix: Render `ChapterBackgroundOrbs` + `ChapterSkeleton` from `loading.tsx` so cold load and hydration share one geometry.

- **[low] OnboardingProgress shows "Almost there" on the celebration step; SR/visual progress mismatch** — `app/onboarding/components/OnboardingProgress.tsx:43,54-58`
  - Issue: On step 6 (the success/confetti "Chapter 1 Complete" screen) the label reads "Almost there" while `aria-label` says "step 6 of 6" — contradictory signals between the celebration UI and the progress copy, and between SR and visual. (The title's "aria-valuenow past max" clause is not reachable.)
  - Fix: Use distinct terminal copy ("Setup complete") or hide the bar on the celebration sub-step, and keep `aria-label` in sync with the visible label.

- **[low] Two divergent EmptyState components with conflicting CTA token usage** — `components/ui/EmptyState.tsx:30-35` vs `components/progress/EmptyState.tsx:62-66` — *still-open* (see Design system & visual entry; consolidate to one, token-based CTA contrast, union icon prop, delete the duplicate/dead code).

- **[prior-fixed] Starter-shelf dead-end, quiz cooldown, fake-OAuth all resolved** — `StepStarterShelf.tsx:620-640,864-876`, `QuizPanel.tsx:444,496-508`, `app/signup/page.tsx:51-67` — the 24-card ranked deck + "Continue with these picks" button removes the left-swipe trap; the "Try Again" cooldown is honored; `/signup` initiates real Cognito OAuth with consent gating. No action.

### Perceived performance & architecture

- **[medium] Landing eagerly bundles the entire real reader (no code-splitting) into first paint** — `components/sections/InteractiveDemo.tsx:5,36`
  - Issue: InteractiveDemo statically imports `DesktopReaderShell`, which statically pulls the 5 real reader components + DesktopQuizPanel (~2,544 lines), all shipped in the landing client bundle on first paint despite living below the fold; there's zero `next/dynamic` anywhere in `components/`/`app/`. Inflates TBT/hydration on the top-of-funnel page.
  - Fix: `dynamic(() => import('…/DesktopReaderShell'), { ssr: false, loading: <DemoSkeleton/> })` gated on viewport.

- **[medium] No loading.tsx for the gated app-shell routes** — `app/dashboard/page.tsx:5-12`
  - Issue: Dashboard, `/book/library`, `/book/progress`, `/book/saved`, `/book/notebook` `await requireDashboardAccess()` (token verify + DynamoDB read, two sequential awaits) before any HTML streams, with no `loading.tsx` — so cold loads blank until hydration. The reader routes got skeletons; these didn't. (`/books` is public, not gated; client components do render their own skeletons once mounted.)
  - Fix: Add a `loading.tsx` per gated route rendering the TopNav shell + the existing Dashboard/Library/Progress skeletons (note `app/book/layout.tsx`/`app/dashboard/layout.tsx` don't render TopNav, so include the chrome in the fallback).

- **[medium] Dashboard `<Suspense>` has no fallback and wraps a client component — zero streaming benefit** — `app/dashboard/page.tsx:7-11`
  - Issue: `<Suspense>` (no fallback) wraps `'use client'` WorkspacePage, which fetches in `useEffect` and never suspends server-side, and the blocking `requireDashboardAccess()` runs *before* the boundary — so it catches nothing and reads as a no-op optimization; first paint is blank until hydration shows the in-component skeleton.
  - Fix: Give Suspense a real dashboard-shell fallback, or fetch the payload in the RSC and pass it as initial data.

- **[medium] Authenticated app double-fetches (server auth gate, then client fetch for same-session data)** — `app/book/hooks/useBookAnalytics.ts:447-452`
  - Issue: The dashboard already does a server round-trip (token verify + DynamoDB account-status), then the client fires a second fetch to `/app/api/book/me/dashboard` (and a third to `/reviews`) in `useEffect` — a server-then-client waterfall with an empty→skeleton→content flash; the authenticated `userId` the server already had is thrown away. (The "Dashboard API failed" console flash is the calibrated local-data-plane artifact.)
  - Fix: Fetch the dashboard payload (and reviews) in the RSC and pass as `initialData` (or React Query dehydrate/hydrate); keep the client refetch only for focus/storage revalidation.

- **[medium] Full React Query + offline-persister stack wraps every /book route with zero consumers** — `app/book/providers.tsx:85-101` — *still-open*
  - Issue: `PersistQueryClientProvider` with a localStorage persister (JSON.stringify + while-loop trim + 512KB cap on every cache write) and 3 `@tanstack` packages ship in the bundle, but grep finds zero `useQuery`/`useMutation`/`useSuspenseQuery` anywhere — nothing reads the cache. Meanwhile real hooks hand-roll `useEffect`+fetch, so loading/error semantics drift.
  - Fix: Either route the top data hooks through `useQuery` so the persister pays for itself, or delete the React Query + persister stack and its 3 deps.

- **[low] Landing demo auto-advance timers run while off-screen** — `components/landing/reader-demo/DesktopReaderShell.tsx:66-96`
  - Issue: The phase auto-advance loop (12-14s/phase) starts on mount gated only by `prefers-reduced-motion`, not viewport visibility; since the demo mounts at page load, it cycles and AnimatePresence-swaps the heavy reader subtree for content nobody is viewing. (Periodic ~250ms swaps, not a tight loop, so modest off-screen cost.)
  - Fix: Gate the auto-advance on `useInView` so it runs only while visible (ideally with the `next/dynamic` deferral above).

- **[low] Onboarding RSC throws transient data errors to the generic error boundary** — `app/onboarding/page.tsx:25-34`
  - Issue: A non-Auth error from the settings lookup re-throws to the route boundary (`app/error.tsx`), replacing the whole flow with a generic "Something went wrong" at the most fragile first-run moment, even though the lookup is only an optimization to skip already-onboarded users. (A reset() retry button exists, so not a hard dead-end; the local env-var 500 is the calibrated artifact.)
  - Fix: Catch transient data errors and render OnboardingFlow anyway, or show an onboarding-specific retry rather than re-throwing.

- **[low] Reader chapter loading.tsx is bare text, not a reader skeleton (CLS on cold load)** — `app/book/library/[bookId]/chapter/[chapterId]/loading.tsx:1-10`
  - Issue: Centered "Loading chapter…" then a jump to the full reader chrome — a layout shift on the most-trafficked deep page, while the sibling detail route got a geometry-matching skeleton. A reusable `ChapterSkeleton` already exists (and is used by the client gate), so the route-level fallback renders a *different* layout for the same loading state.
  - Fix: Render `ChapterBackgroundOrbs` + `ChapterSkeleton` from `loading.tsx` so cold load → hydration → content share one geometry (nearly free).

- **[low] Every book cover is rendered `unoptimized` — the Next image optimizer is bypassed** — `components/library/BookCover.tsx:49-61`
  - Issue: Both BookCover variants pass `unoptimized` + a passthrough loader, so no width-appropriate resizing per `sizes`. (Mitigated: covers are already pre-baked 600×900 AVIF/WebP ~50KB with in-browser format negotiation, and the opt-out is a documented choice because the SVG-origin assets are refused by `next/image` by default — so the win is small per-context-width shaving.)
  - Fix: Resolve local rasters through the optimizer for per-context downscaling (e.g. small thumbnail variants), or accept the documented opt-out.

- **[low] Book covers probe a fallback chain → 404 burst + a re-render per affected cover** — `lib/book-covers.ts` (`getBookCoverCandidates`)
  - Issue: The visible symptom (≈11 image 404s on `/books`, gradient-placeholder cards in a merchandising grid) is real, but the cause is 4 catalog books with *no committed cover asset* (rich-dad-poor-dad, stillness-is-the-key, the-4-hour-workweek, think-and-grow-rich) — each walks avif→webp→jpg→png (4 × 404 + 4 onError re-renders) then renders the fallback. It is not an AVIF-first / URL-encoding storm across all covers.
  - Fix: Add the 4 missing cover rasters (or alias/skip-probe them) and add a catalog-vs-disk cover-coverage smoke check; don't rely on the map-first rewrite, which wouldn't fix unmapped/missing assets.

- **[low] Dashboard runs three large infinitely-animating blurred orbs continuously** — `components/workspace/AnimatedBackground.module.css:17-141`
  - Issue: Three fixed 500-700px elements with `filter: blur(60px)`, `will-change: transform`, and 50-60s `linear infinite` transforms force continuous GPU compositing for the entire dashboard session (battery/thermal cost on mobile/low-end); the reduced-motion guard only removes the animation, leaving `will-change` layer promotion for everyone else.
  - Fix: Drop `will-change`, reduce blur/size, and pause on `visibilitychange` so the dashboard isn't compositing 24/7.

- **[low, no-JS robustness] Below-the-fold landing ships `opacity:0`, JS/IO-gated** — `components/ui/SectionReveal.tsx:34-52` — see the Accessibility entry (same root cause; render base-visible / add a noscript fallback).

- **[low] Landing sections below the hero are `'use client'` purely to host scroll-reveal** — `components/sections/Pricing.tsx:1-6`
  - Issue: 8 sections are client (only FinalCTA/Footer stay RSC, and they already prove the leaf-isolation pattern works); largely-static marketing copy (Pricing/HowItWorks/Library/SocialProof) hydrates a large client tree mainly for the SectionReveal wrapper; framer-motion is imported in 111 files with zero `next/dynamic`.
  - Fix: Keep static bodies as Server Components and isolate motion into a thin client `RevealWrapper` (children passed as RSC), pushing `'use client'` to the leaf that needs it.

- **[prior-fixed] `[bookId]` book-detail route now has a geometry-matching skeleton loading.tsx** — `app/book/library/[bookId]/loading.tsx:1-12` — renders `BookDetailLoading` (app shell + topbar + hero + chapter-row skeleton) shared with the client gate. No action; verify the chapter route's existing loading.tsx quality (see CLS finding).

### Content & polish

- **[medium] Onboarding promises tone personalization the reader can't deliver** — `app/onboarding/components/StepTone.tsx:107-119,53-77` + `chapterFromApi.ts:88-92`
  - Issue: "Choose your tone… this sets how every chapter talks to you" shows three radically different sample voices, but the API mapper (and `v21-adapter.ts:18,32-34`, `bookPackages.ts:358`) flatten all three tone keys to one canonical string for the entire v21 catalog — body prose, review cards, plans, and quiz explanations are identical regardless of tone. The picked tone is persisted and seeds the reader, and the reader's own switcher toasts a no-op ("Competitive tone. Edge-focused…").
  - Fix: Soften StepTone + reader copy to what's true today (tone affects framing/encouragement only — or remove the divergent sample paragraphs), or gate the step until per-tone content exists.

- **[medium] Two contradictory reader-level systems (numeric "Level N Reader" vs named tiers)** — `dashboardToLibraryUi.ts:35-39,68`, `LibraryPage.tsx:66`, `ProgressPage.tsx:72-76`
  - Issue: Library shows "Level {N} Reader" (insight-points/500, with a TODO admitting "no backend level source yet"); Progress shows named tiers (Curious Reader → Thought Leader, by chapters completed). Different vocabularies AND inputs. (Mitigated: the numeric label only appears in a transient post-completion CelebrationToast; the named tier is the persistent identity — so exposure is one fleeting string, not a structural dual-identity.)
  - Fix: Speak the named-tier vocabulary in the toast too (or define one progression model in a shared module) and render it identically on both surfaces.

- **[medium] Empty-state warmth is inconsistent within one component** — `components/progress/YourBooks.tsx:93,126,134`
  - Issue: "Your library is empty" and "No active books" (cold/flat) sit beside the warm "No completed books yet — finish your first book to see it here!" The barest state is actually "No active books" (no warmth, no CTA); the primary empty state does have a "Browse Library →" CTA.
  - Fix: Warm up "No active books" and give it a "pick up a book" / Browse action; standardize the warmth and keep the existing CTAs.

- **[medium] "Insight Points" abbreviation "IP" used before/without introduction** — `RewardsCard.tsx:24-25,65,99`, `RewardsPageClient.tsx:63,104,132`, `FlowPointsIndicator.tsx:67,73`
  - Issue: The currency is "Insight Points" in headers but values are written as bare "IP" ("80–230 IP", "900 more IP needed", "+25 IP") with no inline expansion; both forms co-occur in one card, reading as two units. ("IP" commonly parses as intellectual property / internet protocol.) (The rewards page subtitle/header does establish the term; the dashboard RewardsCard and FlowPointsIndicator are the un-introduced surfaces.)
  - Fix: Spell "Insight Points (IP)" once on first-encounter surfaces then use "IP" consistently; don't mix full + bare forms in one card.

- **[medium] Annual-plan pricing: three numbers, toggle exposes two** — `components/sections/Pricing.tsx:331-340,369-371` + `lib/pricing.ts:36-44`
  - Issue: `pricing.ts` defines `$5.99/mo` ($71.88/yr) AND a cheaper `$59.99` upfront annual; the landing toggle only shows the $71.88 path, while the in-app paywall surfaces `annual_upfront` as "Best value" — so a prospect can see a cheaper annual number in checkout than on the marketing page. (Conditional on a configured Stripe price ID; the $59.99 is publicly disclosed on the terms page.)
  - Fix: Surface the upfront option on the landing card so public best price matches checkout, or relabel/remove the unused display tier.

- **[low] The four-step learning loop is named multiple ways across surfaces** — `HowItWorks.tsx:11,25,39,54`, `SocialProof.tsx:46`, `LearningLoopIndicator.tsx:11-14`, `Hero.tsx:157`
  - Issue: HowItWorks uses the aspirational gloss UNDERSTAND/APPLY/PROVE/PROGRESS while the in-app loop (and SocialProof/Hero) use the literal Summary/Scenarios/Quiz/Unlock — and the literal set is duplicated as inline `STEP_LABELS` arrays in 4 files. Weakens the "one consistent structure" value prop. (HowItWorks card titles partly bridge it; the divergent surface is really just HowItWorks.)
  - Fix: Define the canonical step vocabulary once (the literal set is product truth) in a shared constant; if the gloss is kept, pair each with its literal step name.

- **[low] "Achievements" / "Badges" used interchangeably for one feature** — `NextAchievementCard.tsx:64,112,116`, `NextAchievements.tsx:73`, `PersonalizedGreeting.tsx:58`, `PhoneTabBar.tsx:78`
  - Issue: The workspace card says "Next Achievement" / "View All Achievements" but links to `/book/badges` and comments call the icon a "badge"; the greeting says "earn the X badge"; the landing tab is "Badges". (The badges page H1 is "Achievements", so the card-to-page transition matches; "Milestone" is internal-only. Drift is Achievement vs Badge.)
  - Fix: Pick one user-facing noun and use it across the greeting line, the landing tab, the card label, and the page H1.

- **[low] App CTA/label capitalization is Title Case while marketing uses sentence case** — `HeroSessionCard.tsx:99-128`, `YourBooks.tsx:50,103`
  - Issue: Dashboard hero CTAs/titles are Title Case ("Pick Your First Book", "Take the Quiz", "Unlock Your Full Library") and progress labels are "Your Books"/"Browse Library", while marketing/pricing use sentence case ("Browse the library", "Get 2 free books"); the hero even mixes ALL-CAPS status badges beside Title Case CTAs — signalling no style rule.
  - Fix: Adopt sentence case app-wide for buttons/titles; reserve ALL-CAPS only for a deliberate, consistently-applied eyebrow/badge token.

- **[low] Reader unlock-gating copy is mechanical: "Read for {N}s or scroll to {pct}% to continue."** — `ChapterReaderClient.tsx:990` — *still-open*
  - Issue: The above-the-fold hint exposes the raw dwell/scroll quota (60s / 90%), framing reading as a timer/scroll task to game and inviting scroll-to-bottom cheating — at odds with the honest-learning thesis. Repeats in `ContinueButton.tsx:38-44`.
  - Fix: Replace with comprehension-framed copy ("Take a moment with this section — Continue unlocks once you've read it"); keep the gate, hide the number, and reword the locked button labels too.

- **["Premium" / "Pro"] [medium→noted] "Premium" badge category collides with the "Pro" subscription tier** — `badge-utils.ts:168-171,186`, `useBadgeSystem.ts:90`, `badge-ui-definitions.ts:838,852,1029`
  - Issue: The badges UI presents a category titled/filtered "Premium" while the only paid tier is "Pro", implying a plan the product doesn't sell. (Mitigated: the two Premium badges are hidden-until-discovered.)
  - Fix: Rename the category to a non-billing term ("Dedication"/"Power Reader") or "Pro" — touching `badge-utils.ts`, `useBadgeSystem.ts`, the category assignments, and the filter label.

- **[low] Free-tier offer phrased three ways** — `Hero.tsx:128`, `SocialProof.tsx:54`, `Pricing.tsx:289`, `BrowseLibraryPage.tsx:1048`
  - Issue: "2 full books free" / "Get 2 free books" / "2 books free" across surfaces a prospect crosses in one visit (plus more inline variants). The central offer should read identically to feel deliberate.
  - Fix: Add a canonical `FREE_OFFER_LABEL` to `lib/pricing.ts` and reuse it on every CTA/trust line.

- **[low] Two free-access models presented without reconciliation** — `Pricing.tsx:97-99,365-373`, `Hero.tsx:128`, `lib/pricing.ts:117-118`
  - Issue: Hero/SocialProof push "No credit card · 2 full books free" (permanent free tier) while the Pro card/FAQ push "14-day free trial — card required"; no surface frames the two as one coherent choice, so the card-required button can feel like a change of terms. (Pricing-page cards reconcile it visually; the seam bites only a user carrying the hero line over to the trial button.)
  - Fix: Add one clarifying line near the toggle / free-card subhead ("Read 2 books free with no card — or start a 14-day Pro trial for unlimited access").

- **[low] Internal naming drift: "FlowPoints" components/files for the "Insight Points" feature** — `components/progress/FlowPointsIndicator.tsx`, `app/book/_lib/flow-points-economy.ts` — *still-open*
  - Issue: The currency was renamed to "Insight Points" but the component (`FlowPointsIndicator`), its props, and the economy module remain `FlowPoints`/`flow-points` (exporting `INSIGHT_POINTS_*` from a flow-points file; the icon helper is already `InsightPointsIcon`) — latent risk of "Flow Points" leaking back to users. Not user-visible today.
  - Fix: Rename component/props/module to `InsightPoints*` and migrate residual `FlowPoints*` types/consts.

### Live rendered-UI

- **[medium] Signup form renders fully disabled-looking on first load** — `app/signup/page.tsx:142-195`
  - Issue: On first paint (consent unchecked), all three CTAs are `opacity-50` — the email primary is a washed-out pale teal with white text that reads as a styling bug, with no visual link to the 16px consent checkbox up top. A damaging first impression on a conversion-critical surface. (The `consentHint` `role="alert"` pattern already exists and fires on click.)
  - Fix: Keep buttons enabled and surface the consent requirement on click via the existing `consentHint`, or add a default "Agree to the Terms to continue" helper near the buttons; avoid a near-invisible disabled primary.

- **[medium] Three different error-state designs; the shared ErrorBanner primitive is used by one** — `LibraryPage.tsx:265-268`, `RewardsPageClient.tsx:240-247`, `WorkspacePage.tsx:983-988` — *still-open* (merged with the four-pattern UX-flows finding; route all through `ErrorBanner` with retry, friendly title, icon).

- **[medium] Amber carries three contradictory meanings (error, reward, nav primary)** — `app/book/components/ui/ErrorBanner.tsx:24-49`, `components/workspace/RewardsCard.tsx:51-53`, `app/not-found.tsx:51`
  - Issue: `--accent-amber` is the error/warning color (ErrorBanner), the reward/celebration/Pro color (RewardsCard, ProBadge, NextAchievementCard, streak strips — 50+ files), AND the 404 primary action — so the same hue signals "failed", "earned", and "navigate". Color stops being a semantic signal. (Disambiguated by AlertTriangle + copy in the error case.)
  - Fix: Reserve amber for reward/gamification; repoint ErrorBanner to the existing `--cf-danger-*` (rose) family and switch the 404 primary to brand cyan.

- **[low] Amber is the 404 "Back to home" primary — an off-brand warning-colored CTA** — `app/not-found.tsx:46-55`
  - Issue: The page's only filled primary (`background: var(--accent-amber)`) sits beside an amber "404" and amber AlertTriangle, reading as an error surface rather than a calm recovery action and inconsistent with every cyan/teal primary — including the same file's "Contact us" link (`var(--accent-teal)`).
  - Fix: Switch line-50 background to `var(--accent-teal)`/`--accent-cyan`; keep amber only on the small glyph; optionally neutral-tint the "404".

- **[low] Data-screen error/empty states leave a vast empty page below a small top-anchored card** — `LibraryPage.tsx:265`, `WorkspacePage.tsx:983`, `RewardsPageClient.tsx:240` — *still-open*
  - Issue: All three error states pin a small card/banner near the top with ~70% of the tall viewport blank below, so they read as half-rendered rather than deliberate states. The 404 page's centered treatment reads well by contrast.
  - Fix: Vertically center error/empty states within the content height (`min-h` + `place-content-center`), constraining width — reuse the 404's centered layout.

- **[low] A subset of catalog covers 404 → gradient placeholders in a merchandising grid** — `lib/book-covers.ts` — *see the cover-coverage finding in Perceived performance & architecture* (root cause is 4 missing cover assets, not filename encoding; add the rasters + a coverage smoke check).

- **[low] Contact page is a left-aligned wall of plain text with no visual structure** — `app/contact/page.tsx:31-73`
  - Issue: Four `<h2>`+`<p>` sections stack as undifferentiated paragraphs with no cards/icons/grid and no contact form. (Correction: the column is centered `max-w-3xl`, not left-hugging, and headings are typographically differentiated; a mailto+policy "Contact & Support" page is an acceptable pattern.)
  - Fix (optional polish): Group the topics into icon + heading + body cards in an `md+` 2-col grid and add a prominent "Email support" button.

- **[prior-fixed] Pricing CTA Tailwind v4 regression resolved** — `components/sections/Pricing.tsx:352-391` — the Pro CTA uses correct v4 `bg-(--accent-teal)`; the CI `style-drift-scan` gate banning `[--` is in place. No action.
- **[prior-fixed] Single mobile bottom-nav on the post-login home** — `WorkspacePage.tsx:998-1003`. No action.
- **[prior-fixed] Teal-reader / cyan-shell brand seam collapsed at the token level** — `app/globals.css:247,1592,344`; muted-text contrast tokens bumped. No action; a raw-hex-in-components lint rule would prevent re-drift.

## Method

7-dimension frontend-developer review (visual/design-system, accessibility, responsive/layout, UX flows, perceived performance & architecture, content/polish, live rendered-UI) → per-finding adversarial verification against worktree source (refuting dev-artifacts and correctness/bug-hunt items, recomputing WCAG ratios, confirming file:line) → synthesis; live pass via Playwright on Node 20 against a local dev server; deduped against the 2026-06-10 prior audit and the 2026-06-15 bug hunt.