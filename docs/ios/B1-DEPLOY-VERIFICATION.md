# B1 — Bearer auth + CSRF exemption: deploy & live verification

**Change:** native iOS clients authenticate with `Authorization: Bearer <Cognito id_token>`;
CSRF (`requireSameOrigin`) is skipped for header-authed requests that carry **no** `id_token`
cookie. Cookie-authed mutations keep the CSRF guard unchanged.

## Ship record

| Step | Status | Detail |
|------|--------|--------|
| Rebase | ✅ | `web/native-bearer-auth` rebased on `origin/main` (was 57 behind) — clean, no conflicts |
| PR | ✅ merged | [#381](https://github.com/WillSoltani/ChapterFlow/pull/381) — squash-merged to `main` as `19b44fac4` on 2026-07-02 |
| CI | ✅ green | All 11 checks passed (App Build + Tests, E2E dev/prod, Integration, Infra synth, Lambda, v21 pipeline, scans) |
| Auth/CSRF tests | ✅ green | 34 auth/CSRF unit tests + full `npm run verify` (954/954 tests) locally; App Build + Tests green in CI |
| CI-unblock | ✅ | Pre-existing es2018 `/s` regex typecheck break on `main` fixed (v23 pipeline test → `[\s\S]*`); bundled in #381 |
| Prod deploy | ✅ success | `Deploy` run [28560175800](https://github.com/WillSoltani/ChapterFlow/actions/runs/28560175800), env=prod, app-only, `--ref main`; health gate passed. Prod now serves commit `19b44fac42` (was `f3923e00`). |

## Live verification — the four checks

- **Date:** 2026-07-02, ~02:30Z (final run, CSRF enforcing)
- **Target API host:** `https://app.chapterflow.ca` (prod; `/api/health` → `env:prod`, `commit:19b44fac42`)
- **API path prefix:** routes are double-nested (`app/app/api/**`) → served under **`/app/api/...`** (only `/api/health` is single-nested)
- **Credential:** a real Cognito **id_token** (dev/test admin user `soltani.willx`, `token_use:id`, `aud:6iik2mf6cbsncngvk96fjoutec`)
- **Harness:** `scratchpad/verify-b1.sh`
- **Endpoints:** session `GET /app/api/auth/session`; mutating `PATCH /app/api/book/me/settings` with body `{"settings":{"appearance":{}}}` (deep-merge no-op; exercises the write path)

| # | Check | Expected | Observed | Verdict |
|---|-------|----------|----------|---------|
| (a) | `GET /app/api/auth/session` — **Bearer only**, no Origin | `200 loggedIn:true` | **`200 { loggedIn:true, user.sub:04284448…, email:soltani.willx@gmail.com }`** | ✅ PASS |
| (b) | `PATCH /app/api/book/me/settings` — **Bearer only, NO Origin** | `200`, mutation succeeds | **`200`** (returned saved settings tree) | ✅ PASS |
| (c) | `PATCH /app/api/book/me/settings` — **cookie auth + cross-site** (no Bearer) | `403 forbidden_origin` | **`403 { error.code:"forbidden_origin" }`** | ✅ PASS |
| (d) | `GET /app/api/book/me/settings` — **garbage Bearer** | `401 invalid_token` | **`401 { error.code:"invalid_token" }`** | ✅ PASS |

**Safety check (no regression from enabling enforcement):** a *legitimate* same-origin cookie-authed
`PATCH` (`Sec-Fetch-Site: same-origin`, `Origin: https://app.chapterflow.ca`, cookie) → **`200`**.
Real browser traffic is unaffected.

> Note on (d): `/api/auth/session` intentionally returns `200 loggedIn:false` on a bad token, so the
> `401 invalid_token` mapping is verified on a `withBookApiErrors` route (`/app/api/book/me/settings`).

### Prod CSRF enforcement was re-enabled to complete (c)

The first verification run (~02:18Z) returned **`200` on (c)** because prod ran the CSRF guard in
**observe-only** mode — the prod GitHub environment variable **`CSRF_ORIGIN_ENFORCE=0`** (set
2026-06-24, unrelated to B1) makes `isCsrfEnforcementOn()` return `false`, so `requireSameOrigin`
logs `csrf_origin_observe_only` but lets the request through (by design; see `docs/ENVIRONMENT.md`).

Before flipping it, CloudWatch Logs Insights was queried over the full observe-only window
(2026-06-24 → 2026-07-02, log group `/aws/lambda/ChapterFlowServer`): of 13,901 records scanned,
**only 2** `csrf_origin_observe_only` entries existed — both this verification's own synthetic test
calls. **Zero legitimate hosts/aliases were being flagged**, so re-enabling was safe.

Actions taken:
1. Set prod env variable `CSRF_ORIGIN_ENFORCE=1` (the intended default).
2. Redeployed the app to prod (`Deploy` run [28560998733](https://github.com/WillSoltani/ChapterFlow/actions/runs/28560998733), success).
3. Re-ran the harness → (c) now returns **`403 forbidden_origin`**; (a)(b)(d) + the same-origin
   safety check remain green.

## Summary

**B1 is merged to `main`, deployed to prod, and fully verified live — all four checks pass.**
Native Bearer auth works end-to-end (Bearer-only session + Bearer-only no-Origin mutation succeed;
a bad Bearer → `401 invalid_token`), and cookie-authed CSRF protection is confirmed enforcing
(cross-site cookie mutation → `403`, same-origin cookie mutation → `200`). As a side effect of
verification, prod CSRF enforcement — which had been in observe-only mode since 2026-06-24 — was
restored to its intended enforcing default after confirming the logs were clean.

_Last updated: 2026-07-02._
