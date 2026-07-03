# B2 — Push notification payload contract (APNs + Web-Push)

**Status:** documents what the backend send path **actually emits today**
(`feat/ios-b2`). Every field below is produced by the pure builder in
[`push-payload-core.ts`](../../app/app/api/book/_lib/push-payload-core.ts) and is
pinned by [`push-payload-core.test.ts`](../../app/app/api/book/_lib/push-payload-core.test.ts).
This doc and that module MUST stay in lockstep.

> **TL;DR for iOS:** every push carries the Apple `aps` dictionary **plus** a
> custom `{ type, route, data }` block. `route` is the `chapterflow://` deep link
> the app opens on tap. `aps.badge` is the user's **unread inbox count** (not a
> per-type counter). All payloads are kept **< 4 KB** (APNs hard limit) by
> truncating the alert body if needed.

Source of truth:
- Payload/route builder (pure): [`app/app/api/book/_lib/push-payload-core.ts`](../../app/app/api/book/_lib/push-payload-core.ts)
- Send path (branches web-push vs APNs): [`app/app/api/book/_lib/push-service.ts`](../../app/app/api/book/_lib/push-service.ts) · [`notifications-repo.ts`](../../app/app/api/book/_lib/notifications-repo.ts)
- Device registration: `POST /app/api/book/me/devices/register` · `POST /app/api/book/me/devices/unregister`
- Env config (`APNS_*`): [`docs/ENVIRONMENT.md`](../ENVIRONMENT.md) §D

---

## 1. Device registration

The iOS app registers its APNs device token per user+token; the same route also
serves web-push. Both are authenticated (session cookie or `Authorization:
Bearer <id_token>` for native clients — see B1).

### Register — `POST /app/api/book/me/devices/register`

iOS body:

```jsonc
{
  "platform": "ios",
  "apnsToken": "a1b2…"   // hex APNs device token (64–200 hex chars; <..> / spaces are stripped)
}
```

Web body (unchanged, back-compat — `platform` optional, defaults to `"web"`):

```jsonc
{
  "platform": "web",
  "endpoint": "https://web.push.apple.com/…",
  "keys": { "p256dh": "…", "auth": "…" }
}
```

- Response `200 { "registered": true }` on success.
- Web without `keys` → `200 { "registered": false, "reason": "missing_keys" }` (soft, not an error).
- Bad token / platform → `400` with code `invalid_apns_token` | `invalid_platform` | `missing_endpoint`.
- Upsert is idempotent per user+token: the DynamoDB SK is a SHA-256 of the token
  (ios) or endpoint (web), so re-registering the same token refreshes `lastSeenAt`
  without creating a duplicate. A per-user device cap (10) evicts the oldest row
  beyond the cap.

### Unregister — `POST /app/api/book/me/devices/unregister`

```jsonc
{ "platform": "ios", "apnsToken": "a1b2…" }   // or web: { "endpoint": "https://…" }
```

Removes the row by the same hashed identifier. Response `200 { "unregistered": true }`.

---

## 2. APNs payload shape (what iOS receives)

```jsonc
{
  "aps": {
    "alert": { "title": "…", "body": "…" },
    "badge": 3,                 // UNREAD INBOX COUNT (omitted if the count is unavailable)
    "sound": "default",
    "category": "STREAK",       // per-type; drives notification actions + grouping
    "thread-id": "streak",      // per-type; groups related notifications
    "mutable-content": 1        // lets a Notification Service Extension enrich it
  },
  "type": "streak_milestone",   // the notification type (mirrors the in-app inbox item)
  "route": "chapterflow://progress/streak",  // deep link opened on tap
  "data": { "days": 7, "ip": 50 }            // per-type structured payload (see table)
}
```

### APNs request headers (set by the send path)

| Header | Value |
|---|---|
| `apns-topic` | `APNS_BUNDLE_ID` (the app bundle id) |
| `apns-push-type` | `alert` |
| `apns-priority` | `10` for `streak_at_risk` (time-sensitive), else `5` |
| `apns-collapse-id` | present only for coalescing types (see table); capped at 64 bytes |
| `authorization` | `bearer <ES256 provider JWT>` (token auth; `kid=APNS_KEY_ID`, `iss=APNS_TEAM_ID`) |

Delivery errors: a `410 Unregistered` or `400 BadDeviceToken` /
`DeviceTokenNotForTopic` marks the token expired so the caller can prune it.

---

## 3. Web-Push payload shape (browser service worker)

The web transport keeps its existing `public/sw.js` contract and adds `type` /
`route` additively:

```jsonc
{
  "title": "…",
  "body": "…",
  "url": "/book/progress",       // in-app WEB path opened on tap (route's web equivalent)
  "type": "streak_milestone",
  "route": "chapterflow://progress/streak"
}
```

`apns-collapse-id` maps to the Web-Push `Topic` header for the same coalescing.

---

## 4. Per-type contract

`badge` (unread inbox count), `sound: "default"`, and `mutable-content: 1` are
identical for every type below and are omitted from the table. `data` fields are
included only when the source notification's metadata carries them.

| `type` | `route` (deep link) | web `url` | `category` | `thread-id` | `collapse-id` | priority | `data` |
|---|---|---|---|---|---|---|---|
| `badge_earned` (achievement) | `chapterflow://progress/achievements` | `/book/progress` | `ACHIEVEMENT` | `achievements` | — | 5 | `{ achievementId?, badgeId?, ip? }` |
| `badge_earned` (journey done) | `chapterflow://journeys/<journeyId>` | `/book/journeys` | `ACHIEVEMENT` | `achievements` | — | 5 | `{ journeyId, ip? }` |
| `badge_earned` (event done) | `chapterflow://events/<eventId>` | `/book/events` | `ACHIEVEMENT` | `achievements` | — | 5 | `{ eventId, badgeId?, ip? }` |
| `tier_up` | `chapterflow://progress/tier` | `/book/progress` | `TIER_UP` | `progress` | `tier-up` | 5 | `{ tier, ip? }` |
| `streak_milestone` | `chapterflow://progress/streak` | `/book/progress` | `STREAK` | `streak` | — | 5 | `{ days, ip? }` |
| `insight_spark` | `chapterflow://progress` | `/book/progress` | `INSIGHT_SPARK` | `insights` | — | 5 | `{ amount? }` |
| `reading_reminder` | `chapterflow://home` | `/book/library` | `READING_REMINDER` | `reminders` | `reading-reminder` | 5 | `{}` |
| `streak_at_risk` | `chapterflow://progress/streak` | `/book/progress` | `STREAK_AT_RISK` | `streak` | `streak-at-risk` | **10** | `{}` |
| `partner_nudge` | `chapterflow://partner` | `/book/progress` | `PARTNER_NUDGE` | `partner` | — | 5 | `{}` |
| `commitment_followup` | `chapterflow://commitments/<commitmentId>` | `/book/progress` | `COMMITMENT_FOLLOWUP` | `commitments` | — | 5 | `{ commitmentId, bookId? }` |
| `event_reminder` | `chapterflow://events/<eventId>` | `/book/events` | `EVENT_REMINDER` | `events` | `event-<eventId>` | 5 | `{ eventId? }` |
| `scenario_approved` | `chapterflow://scenarios/<submissionId>` | `/book/progress` | `SCENARIO_REVIEW` | `scenarios` | — | 5 | `{ submissionId, ip? }` |
| `scenario_rejected` | `chapterflow://scenarios/<submissionId>` | `/book/progress` | `SCENARIO_REVIEW` | `scenarios` | — | 5 | `{ submissionId }` |

Notes:
- **Fallback:** any unknown/undocumented `type` routes to
  `chapterflow://notifications` (the inbox), `category: "GENERAL"`,
  `thread-id: "general"` — a new type can never produce a dead deep link.
- `<placeholders>` come from the notification's `metadata`; when a metadata id is
  absent the route degrades to the hub (e.g. `chapterflow://commitments`,
  `chapterflow://events`, `chapterflow://scenarios`).
- **Badge count semantics:** `aps.badge` = the user's current **unread inbox
  count** (`countUnreadNotifications`), so clearing the app's inbox clears the
  springboard badge. It is NOT a per-notification-type tally.
- **Size:** the builder guarantees the serialized payload stays `< 4096` bytes by
  truncating `aps.alert.body` (the only unbounded field) with an ellipsis.

---

## 5. Deep-link route scheme

Routes the app must handle (host + path under `chapterflow://`):

| Route | Screen |
|---|---|
| `chapterflow://home` | Home / continue reading |
| `chapterflow://library` | Library |
| `chapterflow://notifications` | Notification inbox |
| `chapterflow://progress` | Progress / profile hub |
| `chapterflow://progress/streak` | Streak detail |
| `chapterflow://progress/tier` | Tier detail |
| `chapterflow://progress/achievements` | Achievements |
| `chapterflow://journeys/<journeyId>` | A learning journey |
| `chapterflow://events/<eventId>` | A seasonal event |
| `chapterflow://partner` | Reading partner |
| `chapterflow://commitments/<commitmentId>` | A commitment check-in |
| `chapterflow://scenarios/<submissionId>` | A submitted scenario |

---

## 6. Emitters (where each type originates)

The send path (`createNotification` → push-service) is generic on `type`, so any
notification the backend creates for a push-enabled user emits the shape above.

| Type | Emitted by |
|---|---|
| `tier_up`, `streak_milestone`, `insight_spark`, `badge_earned` | quiz-submit loop pipeline (`me/quiz/**/submit`) |
| `badge_earned` (journey/event) | journey advancement / event completion (`events-repo.ts`) |
| `scenario_approved`, `scenario_rejected` | community-scenario auto/admin review |
| `partner_nudge` | reading-partner nudge (`me/pairs/**/nudge`) |
| `reading_reminder` | reading-reminder cron (`infra/lambda`) |
| `streak_at_risk` | streak-at-risk cron (`infra/lambda`) |
| `commitment_followup` | commitment-followup cron (`infra/lambda`) |
| `event_reminder` | seasonal-event reminder |

> The cron Lambdas (`infra/lambda`) currently write the in-app + email channels
> only; when their push channel is wired it MUST route through this same builder
> so the emitted shape stays identical to the table above.
