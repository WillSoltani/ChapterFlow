# lib/ — app-wide isomorphic single-source-of-truth modules

Global rules live in the root [CLAUDE.md](../CLAUDE.md). Layering is
mid-upgrade (S-Tier campaign) — a future pass may revise this file.

## What lives here
A flat directory (no subdirs) of small SoT constants and pure guards:
`pricing.ts`, `reader-levels.ts`, `learning-loop.ts`, `motion.ts` (mirrors the
CSS motion scale), `catalog-stats.ts` (catalog-size claims — never hardcode
counts; `scan:style` enforces this), `category-taxonomy.ts`,
`book-slug-aliases.ts`, `legal-entity.ts`, `origin-verify-core.ts`,
`catalog-integrity.ts`, plus a couple of client hooks.

**Zero `import "server-only"` anywhere in lib/ — it is safe to import from
client components (50+ `"use client"` files already do). Keep it that way**:
no node/AWS/next imports.

## Boundary (which _lib is which)
- `lib/` — app-wide, isomorphic constants + pure logic (this folder).
- `app/_lib/` — App Router page-guard glue; partly `server-only`.
- `app/app/api/book/_lib/` — the server-only API backend (repos, billing,
  admin — the real business-logic layer, ~230 files). Never move its code here.
- `app/book/_lib/` — isomorphic helpers scoped to the `app/book/*` route tree
  (badge-stats, spaced-repetition, reader-storage). Actively maintained — not
  part of the dead-legacy set.

## Traps
- Some `lib/*.test.ts` files test modules OUTSIDE lib/ (e.g.
  `recall-book-filter.test.ts` → `components/landing/recall/`,
  `retention-loop-phase.test.ts` → `components/sections/`) — a historical
  artifact from when the test glob missed `components/`. Don't assume a test's
  subject lives here.
- lib/ test files count toward `npm test`'s 137-file discovery floor
  (WS7-011 guard) — deleting one without replacement can trip it.
