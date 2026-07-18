# app/app/api/ — the ChapterFlow API (double-nested)

Global rules live in the root [CLAUDE.md](../../../CLAUDE.md). Layering is
mid-upgrade (S-Tier campaign) — re-verify structure before large refactors.

## The double-nest is intentional
Handlers here serve URLs at the literal prefix `/app/api/**` — the leading
`app` is a **URL segment**, not a mistake, and it is a **shipped native-client
contract** (iOS hardcodes `/app/api/...`). Never "fix" the nesting. Do not
confuse this tree with the shallow `app/api/` (two deliberately public routes:
`health`, `book-requests` — kept outside the auth middleware) or `app/auth/`
(Cognito OAuth flow).

## Source-of-truth files
- `book/_lib/repo.ts` — DynamoDB persistence layer; `book/_lib/types.ts` — shared types.
- `book/_lib/keys.ts` — PK/SK builders + `retentionPolicyFor()` (per-entity
  retention: TTL vs never-TTL, pinned by `keys.retention.test.ts`; see
  `docs/DATA-RETENTION.md`). New entity types need an entry.
- `book/_lib/http.ts` — `withBookApiErrors()` wraps 114 of 116 book routes:
  same-origin/CSRF guard + maps `AuthError`/`BookApiError` (`book/_lib/errors.ts`)
  to the JSON error envelope. Known exceptions: `email/unsubscribe`, `search-index`.
- `../_lib/auth.ts` — `requireUser()` accepts the `id_token` session cookie OR a
  native `Authorization: Bearer` header (cookie wins if both). Most book routes
  use `book/_lib/account-guard.ts` `requireActiveBookUser()` on top.
- `book/_lib/env.ts` over `../_lib/server-env.ts` — SSM-backed config resolution.
- `book/_contracts/native-contract-registry.ts` → `contracts/native-ios/v1/`
  bundle. After touching covered types/routes (repo, streak-repo, types), run
  `npm run contract:native:generate`; `contract:native:check` is a CI gate.

## Traps
- **`server-only` test trap:** importing `http.ts` (or anything that pulls
  `auth.ts`/`env.ts`) throws under `tsx --test`. Unit-testable logic lives in
  parallel `*-core.ts` files with zero `server-only`/AWS imports
  (`http-guards-core.ts`, `progress-write-core.ts` + `.test.ts`,
  `../_lib/server-env-core.ts`). New logic follows that pattern.
- **Convention:** route.ts stays thin (auth guard + orchestration); logic goes
  in `_lib`. See `book/me/streak/route.ts` for the reference shape.
- `book/admin/**` (40+ routes) is gated by `book/_lib/admin-auth.ts` +
  `getBookAdminGroupName()` — admin changes go through that guard, not ad-hoc checks.
