# app/ — Next.js App Router root

Global rules live in the root [CLAUDE.md](../CLAUDE.md). Layering is
mid-upgrade (S-Tier campaign) — a future pass may revise this file.

## Map
- `app/app/api/**` — ALL authenticated API routes, double-nested on purpose
  (serves `/app/api/**`; shipped iOS contract). See
  [app/app/api/CLAUDE.md](app/api/CLAUDE.md). The rest of `app/app/` is just a
  bare layout, a redirect `page.tsx`, and `_lib`.
- `app/api/` — shallow tree with exactly two deliberately PUBLIC routes
  (`health`, `book-requests`), placed outside the auth middleware's
  `/app|/book|/dashboard` matcher. Never add an authenticated feature route
  here — it would bypass auth.
- `app/book/**` — the authenticated app tree: a mix of legacy pages
  (`page.tsx` + colocated `*Client.tsx` — still live; confirm importers before
  touching) and migrated thin pages that render `components/*`. New pages
  follow the migrated pattern (thin server `page.tsx` + top-level component).
- `app/auth/**` — Cognito OAuth routes (login/callback/logout/refresh).
- `app/_lib/` — page-guard glue (partly `server-only`).
- Top level — marketing/landing, legal, onboarding (`app/onboarding/components/`).

## Source-of-truth files
- `app/_lib/site-url.ts` — `CANONICAL_PROD_SITE_URL = "https://chapterflow.ca"`
  + `getSiteUrl()`: the single source of the public origin.
- `app/_lib/chapterflow-brand.ts` — brand + standalone-mode helpers; every
  site/app/auth href builder collapses to one origin (single-host standalone).
- `middleware.ts` — path-prefix auth only (`/app`, `/book`, `/dashboard`);
  `/app/api/*` is explicitly exempted (routes do their own auth). No
  Host-header routing anywhere; `next.config.ts` is `output: "standalone"`.

## Traps
- `middleware.ts` also carries the WS6-002 origin-verify header gate, which
  runs before auth — a 403 from the app can be origin-verify, not auth.
- Don't confuse `app/api/` (shallow, public) with `app/app/api/` (the real API).
