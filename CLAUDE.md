# ChapterFlow

Next.js (App Router) web app — an AI book-learning product. The live web app is
the focus of current work; the v21 book-generation pipeline under `scripts/book/`
is separate background tooling.

## Worktree
This checkout (`~/ChapterFlow-books`) is the canonical worktree for all work.
`~/ChapterFlow` is a separate checkout — don't run its generated files or mix the two.

## Where things live
- `app/` — Next.js App Router. **API routes are double-nested**: `app/app/api/book/**` (not `app/api/`).
- New authenticated app routes -> `app/app/api/**` (see `app/app/api/README.md`); the shallow `app/api/**` namespace is reserved for unauthenticated endpoints only (health, book-requests).
- `components/` — route-level UIs for the MIGRATED routes (`library/`, `progress/`, `workspace/`, `landing/`, `sections/`, `ui/`, `website/`). Many `app/book/**/*Client.tsx` pages are still the live render path for their routes — always confirm a component is mounted (grep importers from a `page.tsx`/`layout.tsx`) before editing or deleting it.
- `lib/` — shared app code.
- `infra/` — AWS CDK (its own `package.json`).
- `scripts/book/prompts/chapterflow-v24-author-pipeline/` — the ACTIVE (v24 author-first) book pipeline: briefs → whole-chapter writers → reader reviews → publish-final. Background tooling, not the web app.
- `scripts/book/prompts/chapterflow-v21-authored/` — the LEGACY v21 pipeline; its `state/` is the tracked gold regression corpus (never delete).
- `docs/` — architecture & audit docs.

## Commands (Node 20 — currently 20.20.2)
- `npm run dev` — local app at http://localhost:3000 (DEV_AUTH_BYPASS + standalone env baked in).
- `npm run typecheck` — `tsc --noEmit`.
- `npm run lint` — `eslint .`.
- `npm run test` — `tsx --test` over `*.test.ts`/`*.test.tsx` in `app/`, `lib/`, `components/`, `tests/` (137-file discovery floor).
- `npm run verify` — typecheck + test + scan:secrets + scan:style + lint:ratchet + build; run before pushing. Mirrors most, not all, of CI's 9 required jobs — `docs/CI_CD.md` §6/§7 name the exact delta (e2e, coverage, lambda/pipeline/infra suites, PR-relative shared-closure diff); `npm run verify:ci` gets closer.
- Full script catalogue (test tiers, scanners, contract + live-sync tools): `docs/SCRIPTS.md`.

## Per-folder guides
Folder-specific source-of-truth files and traps live next to the code:
[app/CLAUDE.md](app/CLAUDE.md) · [app/app/api/CLAUDE.md](app/app/api/CLAUDE.md) ·
[components/CLAUDE.md](components/CLAUDE.md) · [lib/CLAUDE.md](lib/CLAUDE.md) ·
[infra/CLAUDE.md](infra/CLAUDE.md) · [docs/CLAUDE.md](docs/CLAUDE.md)

## Don't read / search these
- `scripts/book/**/state/**.json` — ~4,150 tracked generated book-state files (~78% of tracked files). They bloat grep/glob and waste tokens; scope searches to `app/`, `components/`, `lib/`. Open a specific state file only when working on it directly.

## Pipeline traps (only when touching `scripts/book/`)
- **Dual state dirs:** repo-root `/state/` is a forbidden shadow (gitignored); each pipeline reads its own `state/` under its dir (`chapterflow-v24-author-pipeline/state/` for active work). Don't let repair output land in the root copy.
- Gates can pass structurally-valid but content-corrupt output (templated cards, wrong quiz keys). Read the actual content before any ship/GREEN verdict.
