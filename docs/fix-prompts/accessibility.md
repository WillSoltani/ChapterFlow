# Fix prompts — Accessibility

_5 items (1 high, 1 medium, 2 low, 1 polish). ChapterFlow production-readiness remediation. Fixes land on branch `audit/prod-readiness-2026-06-14`. See [DISPATCH.md](DISPATCH.md)._

## Shared context (every prompt below assumes this)

**App:** ChapterFlow — Next.js 16 (App Router, React 19) "book learning" web app. Backend = DynamoDB single-table (`app/app/api/book/_lib/repo.ts`) behind Cognito JWT auth (`requireUser`/`requireActiveBookUser`/`requireAdminUser`), Stripe billing, S3 content, CDK infra (`infra/`). API routes live under `app/app/api/book/**` (URL `/app/api/book/**`). Error envelope = `withBookApiErrors`+`BookApiError`.

**BRANCH — read this first:** all fixes land on **`audit/prod-readiness-2026-06-14`**. Each prompt tells the agent to confirm it's on that branch (or a `fix/<ID>` worktree branched off it) before editing, and to commit its single fix when done. See [DISPATCH.md](DISPATCH.md) for how to run agents in parallel safely.

**Rules for every fix agent:**
1. Change ONLY the cited files + direct deps. Do NOT touch `scripts/`, `book-packages/`, `content/`, `state/`, `graphify-out/`.
2. Match surrounding code style; reuse existing helpers (auth guards, `BookApiError`, repo functions, `keys.ts`, `lib/catalog-stats.ts`, `lib/pricing.ts`).
3. Never make a security/economy/paywall decision from client-supplied data — the server is the source of truth.
4. Verify, then commit ONLY your changed files (never `docs/`, `scripts/`, lockfiles you didn't intend). Do not push.
5. Line numbers were accurate at audit time — re-read each file and confirm before editing.

---

### H17 — Reduced-motion users get the mobile sticky CTA bar pinned over content from first paint, with all scroll/visibility gating bypassed
`severity: high` · `effort: trivial` · `files: components/landing/MobileStickyBar.tsx:45-51`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app
(Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

BRANCH: Work on "audit/prod-readiness-2026-06-14". First run:
  git rev-parse --abbrev-ref HEAD
If it is not "audit/prod-readiness-2026-06-14" and not a "fix/H17" worktree branched off it, run:
  git checkout audit/prod-readiness-2026-06-14
Do NOT create unrelated branches and do NOT switch away mid-task.

FILES: components/landing/MobileStickyBar.tsx:45-51

PROBLEM:
Line 50: animate y = `prefersReducedMotion ? 0 : (visible && !dismissed && !pricingInView ? 0 : 100)`. When prefersReducedMotion is true the bar y is unconditionally 0 (shown), so the visible(scrollY>600), pricingInView, and dismissed predicates are entirely skipped. Line 49 also sets initial y=0 for reduced-motion so it is shown on first paint. The only escape is line 45 `if (prefersReducedMotion && dismissed) return null;` which requires the user to first manually dismiss. Net: reduced-motion users see the fixed bottom CTA bar from page load (before any scroll), it never auto-hides over the pricing section, and it overlaps the footer/content until dismissed.

WHY IT MATTERS:
Users with reduced-motion enabled see a persistent CTA bar covering the bottom of every mobile screen from load, obscuring content/footer and ignoring the intended hide-when-pricing-is-shown behavior — a visible regression for the exact accessibility cohort the gating serves.

REQUIRED FIX:
Compute the visibility predicate once regardless of motion preference and only vary the transition: `const shown = visible && !dismissed && !pricingInView;` then `initial={{ y: 100 }}` always, `animate={{ y: shown ? 0 : 100 }}`, and `transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.3 }}`. (With initial y:100 always, the reduced-motion-only early-return at line 45 becomes unnecessary.)

ACCEPTANCE CRITERIA:
- The required fix above is implemented in the cited files (read them first;
  confirm line numbers before editing).
- No regression to adjacent behavior; no unrelated refactors.
- Add or update a unit test that fails before and passes after the fix.

VERIFY (must pass before committing):
  npm run typecheck
  npm run test
  npx eslint <each file you changed>

COMMIT (only after the checks pass):
  git add <only the files you changed>      # NOT docs/, NOT lockfiles you didn't mean to
  git commit -m "fix(accessibility): H17 — Reduced-motion users get the mobile sticky CTA bar pinned ov"
Then report: the diff summary + the command output. Do NOT push.
```

---

### M46 — High-contrast mode flattens every semantic border color to one gray via `* !important`
`severity: medium` · `effort: small` · `files: app/globals.css:1725-1727`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app
(Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

BRANCH: Work on "audit/prod-readiness-2026-06-14". First run:
  git rev-parse --abbrev-ref HEAD
If it is not "audit/prod-readiness-2026-06-14" and not a "fix/M46" worktree branched off it, run:
  git checkout audit/prod-readiness-2026-06-14
Do NOT create unrelated branches and do NOT switch away mid-task.

FILES: app/globals.css:1725-1727

PROBLEM:
`html[data-contrast="high"] * { border-color: var(--cf-border) !important; }` overrides border-color on EVERY element with !important. Verified that semantic state classes set border-color: .cf-banner-success (--cf-success-border), .cf-banner-warning, .cf-banner-danger (1053-1069), .cf-pill-info/success/warning/danger (1081-1099), .cf-chip-active (931), and the quiz state classes .cr-answer-correct (border-color var(--cr-success), border-width 2px) / .cr-answer-incorrect (var(--cr-error)) at 1670-1680. The bare `*` rule (outside any @layer) outranks those layered component rules, so for a high-contrast user all of these collapse to the same neutral gray, erasing the color-coded success/error/warning/info affordances.

WHY IT MATTERS:
High-contrast mode degrades semantic differentiation for the exact users who need it most: quiz correct vs incorrect and banner danger vs success vs info become visually indistinguishable by border. An a11y regression inside an a11y feature.

REQUIRED FIX:
Drop the blanket `*` border override. The intended neutralization is already achieved by redefining --cf-border/--cf-border-strong at 1709-1724, which every neutral border consumes. If a forced uniform neutral border on generic elements is still wanted, scope it to exclude state classes (`html[data-contrast="high"] *:not(.cf-banner-danger):not(.cf-banner-success):not(.cf-banner-warning):not(.cf-pill-info):not(.cf-pill-success):not(.cf-pill-warning):not(.cf-pill-danger):not(.cr-answer-correct):not(.cr-answer-incorrect):not(.cf-chip-active)`) OR add higher-specificity high-contrast variants for those classes after line 1727 that set border-color to the strong semantic text color (so they get MORE contrast, not less).

ACCEPTANCE CRITERIA:
- The required fix above is implemented in the cited files (read them first;
  confirm line numbers before editing).
- No regression to adjacent behavior; no unrelated refactors.
- Existing tests still pass.

VERIFY (must pass before committing):
  npm run typecheck
  npm run test
  npx eslint <each file you changed>

COMMIT (only after the checks pass):
  git add <only the files you changed>      # NOT docs/, NOT lockfiles you didn't mean to
  git commit -m "fix(accessibility): M46 — High-contrast mode flattens every semantic border color to o"
Then report: the diff summary + the command output. Do NOT push.
```

---

### L55 — Interactive demo auto-advances animated content with no reduced-motion guard or pause control
`severity: low` · `effort: small` · `files: components/landing/reader-demo/DesktopReaderShell.tsx:33-38,76-86,185-191`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app
(Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

BRANCH: Work on "audit/prod-readiness-2026-06-14". First run:
  git rev-parse --abbrev-ref HEAD
If it is not "audit/prod-readiness-2026-06-14" and not a "fix/L55" worktree branched off it, run:
  git checkout audit/prod-readiness-2026-06-14
Do NOT create unrelated branches and do NOT switch away mid-task.

FILES: components/landing/reader-demo/DesktopReaderShell.tsx:33-38,76-86,185-191

PROBLEM:
DesktopReaderShell auto-cycles summary->examples->quiz->practice on setTimeout (PHASE_DURATIONS_MS 12000-14000ms; effect at lines 76-86) until the user interacts (hasInteracted ref). Unlike sibling landing components (Problem, SocialProof, MobileStickyBar all consult useReducedMotion), this component never imports or checks useReducedMotion, and there is no explicit pause/play control — the only way to stop is to click into the content (markInteracted). Additionally the phase-transition AnimatePresence motion (lines 185-191, opacity/y on each phase change) animates unconditionally. This is auto-updating moving content >5s with no pause/stop/hide affordance (WCAG 2.2.2).

WHY IT MATTERS:
Reduced-motion users get an auto-playing, periodically-transitioning demo; users wanting to self-pace must discover that clicking halts it. Minor accessibility/UX gap.

REQUIRED FIX:
In DesktopReaderShell read useReducedMotion() and skip the auto-advance setTimeout when true (render phases statically / let the user step via the PhaseStepper and ContinueButton, which already exist), and gate the AnimatePresence phase transition (initial/animate/exit at 185-191) behind the same flag. Optionally add a visible pause/play toggle for all users.

ACCEPTANCE CRITERIA:
- The required fix above is implemented in the cited files (read them first;
  confirm line numbers before editing).
- No regression to adjacent behavior; no unrelated refactors.
- Existing tests still pass.

VERIFY (must pass before committing):
  npm run typecheck
  npm run test
  npx eslint <each file you changed>

COMMIT (only after the checks pass):
  git add <only the files you changed>      # NOT docs/, NOT lockfiles you didn't mean to
  git commit -m "fix(accessibility): L55 — Interactive demo auto-advances animated content with no redu"
Then report: the diff summary + the command output. Do NOT push.
```

---

### L66 — Keyboard-shortcuts overlay (and AddScenarioModal) are bespoke dialogs without focus trap / focus restore
`severity: low` · `effort: small` · `files: app/book/library/[bookId]/chapter/[chapterId]/ChapterReaderClient.tsx:1238-1287, app/book/library/[bookId]/chapter/[chapterId]/components/ExamplesList.tsx:635-663, components/ui/Dialog.tsx`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app
(Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

BRANCH: Work on "audit/prod-readiness-2026-06-14". First run:
  git rev-parse --abbrev-ref HEAD
If it is not "audit/prod-readiness-2026-06-14" and not a "fix/L66" worktree branched off it, run:
  git checkout audit/prod-readiness-2026-06-14
Do NOT create unrelated branches and do NOT switch away mid-task.

FILES: app/book/library/[bookId]/chapter/[chapterId]/ChapterReaderClient.tsx:1238-1287, app/book/library/[bookId]/chapter/[chapterId]/components/ExamplesList.tsx:635-663, components/ui/Dialog.tsx

PROBLEM:
The '?' shortcuts overlay (ChapterReaderClient:1238-1287) is a raw role="dialog" div: focus is not moved in on open, not trapped (Tab leaves to the page behind), not restored on close, and there is no aria-modal; background is not inert. Escape closes (global shortcut) and backdrop click closes. AddScenarioModal (ExamplesList:635-663) is similar — it DOES have aria-modal=true (line 655), an Escape handler (643-649) and a body-scroll lock (635-641), but no focus trap, no initial-focus move, and no focus restore. Both reimplement bespoke fixed-inset overlays instead of the shared components/ui/Dialog OverlayShell, whose header comment confirms it provides portal + role=dialog + aria-modal + focus trap + initial focus + focus restore + Escape + backdrop + scroll lock (and is already used by NotesDrawer via Sheet).

WHY IT MATTERS:
Keyboard and screen-reader users can Tab out of the open dialog into the obscured page and lose focus after close — a known a11y gap for launch.

REQUIRED FIX:
Render both overlays through the shared Dialog (center) component used by NotesDrawer/ResetProgressModal/ChapterCompleteModal, which gives focus-trap, scroll-lock, aria-modal and focus restore for free, instead of the bespoke fixed-inset divs.

ACCEPTANCE CRITERIA:
- The required fix above is implemented in the cited files (read them first;
  confirm line numbers before editing).
- No regression to adjacent behavior; no unrelated refactors.
- Existing tests still pass.

VERIFY (must pass before committing):
  npm run typecheck
  npm run test
  npx eslint <each file you changed>

COMMIT (only after the checks pass):
  git add <only the files you changed>      # NOT docs/, NOT lockfiles you didn't mean to
  git commit -m "fix(accessibility): L66 — Keyboard-shortcuts overlay (and AddScenarioModal) are bespok"
Then report: the diff summary + the command output. Do NOT push.
```

---

### P10 — Onboarding swipe-deck arrow-key handler is global and unguarded (no input-focus / modifier check)
`severity: polish` · `effort: trivial` · `files: app/onboarding/components/StepStarterShelf.tsx:585-598`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app
(Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

BRANCH: Work on "audit/prod-readiness-2026-06-14". First run:
  git rev-parse --abbrev-ref HEAD
If it is not "audit/prod-readiness-2026-06-14" and not a "fix/P10" worktree branched off it, run:
  git checkout audit/prod-readiness-2026-06-14
Do NOT create unrelated branches and do NOT switch away mid-task.

FILES: app/onboarding/components/StepStarterShelf.tsx:585-598

PROBLEM:
A window-level keydown listener calls e.preventDefault() and triggers a left/right card swipe on ArrowLeft/ArrowRight (lines 588-594). It does guard on isComplete/!frontBook (587) but has no check for whether focus is in a text field/contenteditable or whether a modifier key is held. There is no text input on this step today, so practical impact is low, but it's a fragile pattern that would hijack arrow keys from any future input or a screen-reader user.

WHY IT MATTERS:
Minor today; a latent keyboard/a11y trap if any focusable text control is added to the step.

REQUIRED FIX:
Bail early if document.activeElement is INPUT/TEXTAREA/[contenteditable] or if e.metaKey/ctrlKey/altKey is set, before preventDefault and swiping.

ACCEPTANCE CRITERIA:
- The required fix above is implemented in the cited files (read them first;
  confirm line numbers before editing).
- No regression to adjacent behavior; no unrelated refactors.
- Existing tests still pass.

VERIFY (must pass before committing):
  npm run typecheck
  npm run test
  npx eslint <each file you changed>

COMMIT (only after the checks pass):
  git add <only the files you changed>      # NOT docs/, NOT lockfiles you didn't mean to
  git commit -m "fix(accessibility): P10 — Onboarding swipe-deck arrow-key handler is global and unguar"
Then report: the diff summary + the command output. Do NOT push.
```
