# ChapterFlow

Next.js (App Router) web app — an AI book-learning product. The live web app is
the focus of current work; the v21 book-generation pipeline under `scripts/book/`
is separate background tooling.

## Worktree
This checkout (`~/ChapterFlow-books`) is the canonical worktree for all work.
`~/ChapterFlow` is a separate checkout — don't run its generated files or mix the two.

## Where things live
- `app/` — Next.js App Router. **API routes are double-nested**: `app/app/api/book/**` (not `app/api/`).
- `components/` — the live route UIs (`library/`, `progress/`, `onboarding/`, `landing/`, `sections/`, `ui/`). Live routes render `components/*`; the older `app/book/*Client.tsx` are largely dead — confirm a component is actually mounted before editing it.
- `lib/` — shared app code.
- `infra/` — AWS CDK (its own `package.json`).
- `scripts/book/prompts/chapterflow-v24-author-pipeline/` — the ACTIVE (v24 author-first) book pipeline: briefs → whole-chapter writers → reader reviews → publish-final. Background tooling, not the web app.
- `scripts/book/prompts/chapterflow-v21-authored/` — the LEGACY v21 pipeline; its `state/` is the tracked gold regression corpus (never delete).
- `docs/` — architecture & audit docs.

## Commands (Node 20 — currently 20.20.2)
- `npm run dev` — local app at http://localhost:3000 (DEV_AUTH_BYPASS + standalone env baked in).
- `npm run typecheck` — `tsc --noEmit`.
- `npm run lint` — `eslint .`.
- `npm run test` — `tsx --test` over `*.test.ts` in `app/` and `lib/`.
- `npm run verify` — typecheck + test + build; run before pushing.

## Don't read / search these
- `scripts/book/**/state/**.json` — ~4,150 tracked generated book-state files (~78% of tracked files). They bloat grep/glob and waste tokens; scope searches to `app/`, `components/`, `lib/`. Open a specific state file only when working on it directly.

## Pipeline traps (only when touching `scripts/book/`)
- **Dual state dirs:** repo-root `/state/` is a forbidden shadow (gitignored); each pipeline reads its own `state/` under its dir (`chapterflow-v24-author-pipeline/state/` for active work). Don't let repair output land in the root copy.
- Gates can pass structurally-valid but content-corrupt output (templated cards, wrong quiz keys). Read the actual content before any ship/GREEN verdict.
