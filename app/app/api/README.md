# `app/app/api/**` — the double-nested API namespace

The API route handlers in this directory serve the URL namespace
`/app/api/**` (e.g. `app/app/api/book/books/route.ts` → `GET /app/api/book/books`).
This is a Next.js App Router file-system routing artifact: a route file at
`app/<segment>/api/...` serves `/<segment>/api/...`, and here `<segment>` is
the literal string `app`. **This is intentional, not a typo or an accidental
double-nesting** — do not "fix" it by moving handlers up to `app/api/**`.

## Why it's locked in

The iOS native app hardcodes `/app/api/...` paths for every authenticated
call it makes. Renaming or flattening this namespace is a breaking native
contract change (see `app/app/api/book/_contracts/` and
`npm run contract:native:check`), not a refactor. WS3-015 is the finding that
audited this and confirmed it should stay as-is.

## Where new routes go

**New authenticated user/book/billing routes belong under `app/app/api/**`.**
This is where auth, entitlements, and the native contract already live —
follow the existing `_lib` conventions in this tree
(`*-repo.ts` / `*-service.ts` / `*-core.ts`) documented in
[`docs/architecture/shared-code-layers.md`](../../../docs/architecture/shared-code-layers.md).

## How auth is actually enforced here

`middleware.ts` (repo root) does **not** gate `/app/api/**` with its
cookie-presence/login-redirect check — it early-returns `NextResponse.next()`
for any path starting with `/app/api/` before that check runs. Routes here
enforce their own auth instead: `requireUser()` / `requireActiveBookUser()` /
`requireAdminUser()` (`app/app/api/_lib/auth.ts` and friends) for
cookie/Bearer-token identity, or a route-specific signature/token check for
server-to-server callers that carry no session cookie at all (the Stripe
billing webhook, the CASL/CAN-SPAM email-unsubscribe link). This is
deliberate: those server-to-server callers would otherwise get bounced to
`/auth/login`, which Stripe treats as a delivery failure and eventually
disables the endpoint over.

The three prefixes middleware.ts *does* gate with the cookie-presence +
login-redirect check are the page-serving surfaces: `/app` (non-API pages),
`/book`, and `/dashboard`.

## The other, shallow `app/api/**` namespace

A second, shallow `app/api/**` directory (`app/api/health`,
`app/api/book-requests`) exists side by side with this one. It is reserved
for endpoints that must be reachable **without** authentication — they sit
outside `/app`, `/book`, and `/dashboard` on purpose, so middleware's
protected-surface check never applies to them. Each route file there carries
a header comment saying so explicitly (see `app/api/health/route.ts` and
`app/api/book-requests/route.ts`). Do not add a new authenticated route
there — it would ship with no login-redirect protection and no established
`_lib` auth convention to lean on.

## Summary

| Namespace | Auth model | Use for |
| --- | --- | --- |
| `app/app/api/**` (this dir) | Route enforces its own auth (`requireUser` / `requireActiveBookUser` / `requireAdminUser`, or a signature/token check for server-to-server callers) | New authenticated user/book/billing routes |
| `app/api/**` (shallow) | None — deliberately outside the middleware-protected surface | Unauthenticated endpoints only (health checks, public intake forms) |
