# ChapterFlow Domain Migration

This file covers the manual work required to launch ChapterFlow as its own branded product under:

- `siliconx.ca`
- `chapterflow.siliconx.ca`
- `auth.siliconx.ca`
- `login.siliconx.ca`

The codebase now supports a clean shared backend model:

- Cloud Portfolio remains on `soltani.org`
- ChapterFlow marketing runs on `siliconx.ca`
- ChapterFlow runs on `chapterflow.siliconx.ca`
- auth entry points run on `auth.siliconx.ca`
- Cognito Hosted UI runs on `login.siliconx.ca`
- the same repo and backend services can continue to be used
- `https://siliconx.ca/auth/callback` is supported as a ChapterFlow callback host

## 1. DNS and certificates

Create or confirm DNS records in Route 53 for:

- `siliconx.ca`
- `chapterflow.siliconx.ca`
- `auth.siliconx.ca`
- `login.siliconx.ca`

Point both to the same deployed Next.js app surface if you are keeping a shared deployment.

Issue or attach TLS certificates that cover:

- `chapterflow.siliconx.ca`
- `auth.siliconx.ca`

If the same app serves both hosts, both domains must terminate on the same deployment target.

## 2. Required environment variables

Set these for the deployed web app:

```text
NEXT_PUBLIC_CHAPTERFLOW_SITE_URL=https://siliconx.ca
NEXT_PUBLIC_CHAPTERFLOW_APP_URL=https://chapterflow.siliconx.ca
NEXT_PUBLIC_CHAPTERFLOW_AUTH_URL=https://auth.siliconx.ca
CHAPTERFLOW_SITE_BASE_URL=https://siliconx.ca
CHAPTERFLOW_APP_BASE_URL=https://chapterflow.siliconx.ca
CHAPTERFLOW_AUTH_BASE_URL=https://auth.siliconx.ca
AUTH_COOKIE_DOMAIN=.siliconx.ca
CHAPTERFLOW_COOKIE_DOMAIN=.siliconx.ca
COGNITO_CUSTOM_DOMAIN=https://login.siliconx.ca
```

Keep the existing Cognito and AWS variables in place.

If Cloud Portfolio still runs on a separate main domain, `APP_BASE_URL` should remain the Cloud Portfolio origin, not the ChapterFlow origin.

## 3. Cognito hosted UI and callback setup

Update Cognito Hosted UI configuration to use:

- hosted auth domain at `login.siliconx.ca`
- callback URL:
  - `https://siliconx.ca/auth/callback`
  - `https://auth.siliconx.ca/auth/callback`
- sign out URL:
  - `https://siliconx.ca/`
  - `https://auth.siliconx.ca/`

Local development callback URLs should also include:

- `http://localhost:3001/auth/callback`
- `http://localhost:3001/`

Set the corresponding runtime variables:

```text
COGNITO_DOMAIN=https://login.siliconx.ca
COGNITO_CUSTOM_DOMAIN=https://login.siliconx.ca
COGNITO_REDIRECT_URI=https://siliconx.ca/auth/callback
COGNITO_LOGOUT_REDIRECT_URI=https://siliconx.ca/
```

If you prefer the dedicated auth host to receive the callback and logout flow, these also work:

```text
COGNITO_REDIRECT_URI=https://auth.siliconx.ca/auth/callback
COGNITO_LOGOUT_REDIRECT_URI=https://auth.siliconx.ca/
```

For local ChapterFlow development:

```text
COGNITO_REDIRECT_URI=http://localhost:3001/auth/callback
COGNITO_LOGOUT_REDIRECT_URI=http://localhost:3001/
```

## 4. Cookie domain requirement

This migration depends on shared auth cookies so that:

- login happens on `auth.siliconx.ca`
- the authenticated session is then visible on `chapterflow.siliconx.ca`

Set:

```text
AUTH_COOKIE_DOMAIN=.siliconx.ca
```

Without that, the auth callback will only authenticate the auth subdomain and ChapterFlow will appear logged out.

## 5. Old domain behavior

The code now redirects `/book*` traffic away from the old host toward ChapterFlow.

You should still verify:

- links on `soltani.org` now point users to ChapterFlow through `/chapterflow`
- no public navigation still treats `soltani.org` as the primary home of the reading product

The old site handoff path can now point to the ChapterFlow product home on `siliconx.ca` instead of dropping users directly into the app host.

## 6. Local development

ChapterFlow now has a dedicated local dev script:

```bash
npm run dev:chapterflow
```

That runs the app on:

- `http://localhost:3001`

It also overrides the local ChapterFlow auth and app URLs so the Book product can be tested separately from the rest of the repo.

## 7. Stripe return URLs

Because ChapterFlow is now a separate host, verify the deployed runtime has:

```text
CHAPTERFLOW_APP_BASE_URL=https://chapterflow.siliconx.ca
NEXT_PUBLIC_CHAPTERFLOW_APP_URL=https://chapterflow.siliconx.ca
```

The Book billing routes now use the ChapterFlow app origin for:

- Stripe checkout success and cancel return
- billing portal return URL

## 8. Post deployment verification

Run these checks after deployment:

### ChapterFlow app
- `https://chapterflow.siliconx.ca/` shows the ChapterFlow launch surface
- `https://chapterflow.siliconx.ca/book` opens the product entry flow
- unauthenticated access to `/book/*` sends users into the auth flow cleanly

### Auth
- `https://auth.siliconx.ca/` shows the auth entry surface
- `/auth/login` redirects to Cognito Hosted UI
- `/auth/callback` returns users to ChapterFlow
- `/auth/logout` clears the shared session and returns cleanly

### Old site handoff
- `https://soltani.org/chapterflow` redirects to ChapterFlow
- `https://soltani.org/book` redirects to ChapterFlow
- the portfolio navbar and hero link users to ChapterFlow instead of treating it as an internal tool

### Billing
- checkout success returns to `chapterflow.siliconx.ca`
- billing portal returns to ChapterFlow settings
- webhook events still update entitlements correctly

## 9. Recommended release order

1. Configure DNS and certificates
2. Update runtime environment variables
3. Update Cognito callback and logout URLs
4. Deploy the app
5. Verify auth cookie sharing across subdomains
6. Verify ChapterFlow redirects from the old site
7. Verify billing return URLs
