# API Versioning Policy

How the ChapterFlow book API (`app/app/api/book/**`, served through the shared
`withBookApiErrors` wrapper) is versioned, how a client opts into a specific
version, and what happens when it asks for one that doesn't exist. Written for
WS4-006. For the shared JSON error shape every version returns, see
[`lib/api/error-envelope.ts`](../lib/api/error-envelope.ts); for the wrapper
itself see [`app/app/api/book/_lib/http.ts`](../app/app/api/book/_lib/http.ts).

## 1) Current version

**v1** is the only version that exists today. Every route under
`app/app/api/book/**` (118 routes) serves v1, and both the web app and the
native iOS client are pinned to v1 request/response shapes.

## 2) Discriminator: `Accept` media type, not a URL segment

The version is negotiated via the standard `Accept` header, using a vendor
media type:

```
Accept: application/vnd.chapterflow.v1+json
```

This is a **header** discriminator, deliberately **not** a `/v1/` URL path
segment. Every route today already lives at a fixed, native-client-pinned path
(`app/app/api/book/<route>`); rewriting 118 routes under `/v1/` would break
every existing native binary's hardcoded paths for zero benefit — the header
carries the same information without relocating anything.

### Resolution rules (`resolveApiVersion`, [`api-version-core.ts`](../app/app/api/book/_lib/api-version-core.ts))

The wrapper scans the raw `Accept` header for the pattern
`application/vnd.chapterflow.v{N}+json`, anywhere in a comma-separated media
range list:

| Accept header | Resolves to |
|---|---|
| Absent (no header at all) | v1 (default) |
| `application/json` | v1 (default) |
| `*/*`, or a browser list like `text/html,application/xhtml+xml,*/*` | v1 (default) |
| Any Accept that doesn't mention a `vnd.chapterflow.v{N}+json` media type | v1 (default) |
| `application/vnd.chapterflow.v1+json` | v1 (explicit, matches current) |
| `application/vnd.chapterflow.v{N}+json` where `N !== 1` | **406** `unsupported_api_version` |

The default-to-v1 behavior is intentional and load-bearing: **every existing
web and native-app request today sends no vendor Accept type at all**, and
must keep working unchanged. Only a client that *explicitly* asks for a
version we don't serve is rejected — nothing else changes behavior.

## 3) Unsupported-version response

A request that names an unsupported version gets a 406, in the same canonical
envelope every other book-API error uses:

```jsonc
// HTTP 406
{
  "error": {
    "code": "unsupported_api_version",
    "message": "This API version is not supported...",
    "requestId": "…",
    "details": { "requested": "application/vnd.chapterflow.v2+json" }
  }
}
```

This check runs **before** the route body — same-origin/CSRF, auth, and any
DynamoDB/S3 access are all skipped for a rejected version, exactly like the
existing same-origin guard (`requireSameOrigin`) that also runs ahead of the
route body in `withBookApiErrors`.

A successful response additionally carries `X-ChapterFlow-Api-Version: 1` so a
client can confirm which version actually served the request.

## 4) Breaking changes & deprecation lane

There is no v2 yet. When one is introduced:

1. A new vendor media type value is added to `resolveApiVersion`'s supported
   set (`application/vnd.chapterflow.v2+json`), and the version-specific
   response shaping lives alongside the existing v1 path inside the route
   handler (or a small per-version adapter) — the wrapper's job stays limited
   to *resolving* the version, not branching business logic itself.
2. v1 keeps serving its existing shape to any client that sends no vendor
   type, `application/json`, or an explicit `v1` type — the default never
   silently moves to the newest version. A client must opt in.
3. A deprecation window is announced here (this file) with a concrete sunset
   date before v1 support is ever removed, and the native app's minimum
   supported build is bumped in lockstep so old binaries aren't stranded
   pinned to a version that no longer exists.
4. Any genuinely breaking change to v1 itself (not a new version) is not
   permitted — that's what a new version number is for.
