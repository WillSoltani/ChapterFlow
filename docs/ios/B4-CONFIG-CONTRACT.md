# B4 — Native-iOS launch config contract

**Status:** documents the endpoint **exactly as it exists today** (`feat/ios-b4`). Every field below
is derived from the route source, not an intended design.

> **TL;DR for iOS:** `GET /app/api/book/config/ios` is a **public, unauthenticated, cacheable**
> (`Cache-Control: public, max-age=300`) JSON endpoint the app fetches on **every launch** to drive
> the force-update gate, exact App Store listing, kill-switch feature flags, the StoreKit product list, and maintenance mode
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
without a session check. The handler reads only server environment variables
(no DB/S3/network). It returns 200 only when required purchase/listing identity
passes validation; otherwise it returns `503 ios_config_unavailable`.

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
    "com.chapterflow.pro.annual"
  ],
  "appStoreURL": "https://apps.apple.com/ca/app/chapterflow/id1234567890",
  "maintenanceMode": false,         // true → show full-screen "we'll be right back"
  "messageOfTheDay": "…"            // OPTIONAL: present only when set; otherwise the key is absent
}
```

All fields except `messageOfTheDay` are present on a successful response.
`messageOfTheDay` is omitted entirely when unset. Missing/invalid StoreKit or
App Store listing identity returns a stable `503 ios_config_unavailable` error
envelope instead of a fabricated configuration.

## 3. Caching

`Cache-Control: public, max-age=300` — the CDN and the app may cache for 5 minutes. Long enough to
shield the origin, short enough that flipping a kill-switch or entering maintenance mode propagates
within minutes. The app should still fetch on every cold launch and tolerate a stale (cached) copy.

## 4. Operating it (no app release)

Operational values come from server Lambda environment variables. StoreKit and
listing identity are required and have no fallback:

| Env var | Drives | Default |
| --- | --- | --- |
| `IOS_MIN_SUPPORTED_VERSION` | `minSupportedVersion` | `1.0.0` |
| `IOS_LATEST_VERSION` | `latestVersion` | `1.0.0` |
| `IOS_FEATURE_FLAGS` | `featureFlags` — a JSON object of `{ name: boolean }` | `{}` |
| `IOS_STOREKIT_PRODUCT_IDS` | `storeKitProductIds` — comma-separated exact allowlist | required; no default |
| `APPLE_IAP_APP_APPLE_ID` | Cross-checks the numeric listing and Production notification identity | required; no default |
| `IOS_APP_STORE_URL` | `appStoreURL` — exact product-specific `apps.apple.com` URL | required; no default |
| `IOS_MAINTENANCE_MODE` | `maintenanceMode` — `1`/`true`/`yes`/`on` ⇒ true | `false` |
| `IOS_MESSAGE_OF_THE_DAY` | `messageOfTheDay` — omitted when blank | (absent) |

Fail-safe parsing: malformed `IOS_FEATURE_FLAGS` JSON, a non-object shape, or
non-boolean values yield `{}`. A blank, duplicate, malformed, or unsupported
annual-upfront product list fails closed. The App Store URL must use HTTPS,
`apps.apple.com`, contain a numeric product ID, and contain no credentials,
query, fragment, or nondefault port. Its final numeric id must exactly equal
`APPLE_IAP_APP_APPLE_ID`.

The authenticated StoreKit verification path has a separate, prod-only
TestFlight control that does not change this public response:
`APPLE_IAP_TESTFLIGHT_SANDBOX_ENABLED=1` plus the protected GitHub Environment
secret `APPLE_IAP_TESTFLIGHT_QA_USER_IDS`. CI accepts only exact lowercase
Cognito UUIDs, derives `APPLE_IAP_TESTFLIGHT_QA_USER_HASHES`, and passes only
those one-way values through CDK/CloudFormation/Lambda configuration. Production
TestFlight Sandbox claims are stored in an isolated namespace. Leave the flag
off for ordinary deployments; the workflow then omits the derived hashes even
if the protected raw secret remains stored.
Dev/staging signed Sandbox purchases remain on their deployment's Primary
entitlement keys. See [ENVIRONMENT.md §3.H](../ENVIRONMENT.md#h-apple-storekit--in-app-purchase-app-store-subscriptions--pro-entitlement)
for activation, notification routing, and rollback.
