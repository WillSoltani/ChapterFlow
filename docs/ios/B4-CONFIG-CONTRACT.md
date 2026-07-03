# B4 — Native-iOS launch config contract

**Status:** documents the endpoint **exactly as it exists today** (`feat/ios-b4`). Every field below
is derived from the route source, not an intended design.

> **TL;DR for iOS:** `GET /app/api/book/config/ios` is a **public, unauthenticated, cacheable**
> (`Cache-Control: public, max-age=300`) JSON endpoint the app fetches on **every launch** to drive
> the force-update gate, kill-switch feature flags, the StoreKit product list, and maintenance mode
> — **without shipping a new binary**. A force-update gate cannot be retrofitted into binaries
> already in the field, so this must exist before v1.0 ships.

Source of truth:
- Route: [`app/app/api/book/config/ios/route.ts`](../../app/app/api/book/config/ios/route.ts)
- Builder (pure): [`app/app/api/book/config/ios/config-core.ts`](../../app/app/api/book/config/ios/config-core.ts)
- Contract test: [`app/app/api/book/config/ios/route.test.ts`](../../app/app/api/book/config/ios/route.test.ts)

## 1. Request

```
GET /app/api/book/config/ios
```

No auth, no cookies, no params, no body. Middleware passes everything under `/app/api/` through
without a session check, and the handler reads only server env vars (no DB/S3/network), so it can
never false-fail and always returns 200.

## 2. Response body

```jsonc
{
  "minSupportedVersion": "1.0.0",   // lowest version allowed to run → BLOCKING force-update below this
  "latestVersion": "1.0.0",         // newest App Store version → DISMISSIBLE soft-update nudge below this
  "featureFlags": {                 // remote kill-switch / rollout flags, boolean-valued
    "audioTab": true
  },
  "storeKitProductIds": [           // StoreKit 2 product ids to offer, in display order
    "com.chapterflow.pro.monthly",
    "com.chapterflow.pro.annual",
    "com.chapterflow.pro.annual_upfront"
  ],
  "maintenanceMode": false,         // true → show full-screen "we'll be right back"
  "messageOfTheDay": "…"            // OPTIONAL: present only when set; otherwise the key is absent
}
```

All fields except `messageOfTheDay` are always present. `messageOfTheDay` is omitted entirely when
unset (do not treat a missing key as an error).

## 3. Caching

`Cache-Control: public, max-age=300` — the CDN and the app may cache for 5 minutes. Long enough to
shield the origin, short enough that flipping a kill-switch or entering maintenance mode propagates
within minutes. The app should still fetch on every cold launch and tolerate a stale (cached) copy.

## 4. Operating it (no app release)

Every value is overridable via server Lambda env vars, all optional with safe defaults:

| Env var | Drives | Default |
| --- | --- | --- |
| `IOS_MIN_SUPPORTED_VERSION` | `minSupportedVersion` | `1.0.0` |
| `IOS_LATEST_VERSION` | `latestVersion` | `1.0.0` |
| `IOS_FEATURE_FLAGS` | `featureFlags` — a JSON object of `{ name: boolean }` | `{}` |
| `IOS_STOREKIT_PRODUCT_IDS` | `storeKitProductIds` — comma-separated | the 3 plan ids above |
| `IOS_MAINTENANCE_MODE` | `maintenanceMode` — `1`/`true`/`yes`/`on` ⇒ true | `false` |
| `IOS_MESSAGE_OF_THE_DAY` | `messageOfTheDay` — omitted when blank | (absent) |

Fail-safe parsing: malformed `IOS_FEATURE_FLAGS` JSON, a non-object shape, or non-boolean values
yield `{}` (never crashes the launch endpoint, never silently enables a flag); a blank/empty product
list falls back to the default plan set rather than shipping an empty store.
