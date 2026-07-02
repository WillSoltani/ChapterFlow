# B5 — Chapter audio delivery contract (for the native iOS client)

**Status:** documents the endpoint **exactly as it exists today** (commit on `feat/ios-b5`).
Every field below is derived from the route source, not from an intended design. Where the
current behavior is a poor fit for a native player, it is called out under
[§8 Known gaps & follow-ups](#8-known-gaps--follow-ups) rather than papered over.

> **TL;DR for iOS:** This endpoint is **not** a segment manifest. It returns **one stitched
> `audio/mpeg` blob** built server-side from many per-segment S3 objects. There are **no
> per-segment URLs**, **no presigned URLs**, and **no HTTP Range / seek support**. It is
> **per-user, non-deterministic, and `Cache-Control: no-cache`**. Play it the way the web
> client does: `GET` the whole body once, then seek locally in the decoded buffer. A future
> `?mode=plan` JSON contract (per-segment URLs, ids, durations, Range) is specified in §8 as a
> follow-up and is **not implemented yet**.

Source of truth:
- Route: [`app/app/api/book/books/[bookId]/chapters/[chapterNumber]/audio/route.ts`](../../app/app/api/book/books/%5BbookId%5D/chapters/%5BchapterNumber%5D/audio/route.ts)
- Planner: [`app/app/api/book/_lib/audio-narration-core.ts`](../../app/app/api/book/_lib/audio-narration-core.ts) (pure; re-exported by `audio-narration.ts`)
- Contract test: [`app/app/api/book/_lib/audio-narration-core.test.ts`](../../app/app/api/book/_lib/audio-narration-core.test.ts)

---

## 1. Endpoint

| | |
|---|---|
| **Method** | `GET` (only — no `POST`/`HEAD`/`OPTIONS` handler is defined) |
| **Path** | `/app/api/book/books/{bookId}/chapters/{chapterNumber}/audio` |
| **Path note** | Routes are **double-nested** (`app/app/api/**`) → served under **`/app/api/...`** in prod. Same convention as B1. |
| **Prod host** | `https://app.chapterflow.ca` |

### Path params

| Param | Type | Rule |
|-------|------|------|
| `bookId` | string | Non-empty. |
| `chapterNumber` | integer | `Number(chapterNumber)` must be finite and `>= 1`, else `400 invalid_params`. |

### Query params

There are exactly **two** query params. There is **no `mode` param** (despite what a plan-style
contract would imply).

| Param | Default | Allowed values | On invalid |
|-------|---------|----------------|-----------|
| `tone` | `direct` | `gentle` \| `direct` \| `competitive` | `400 invalid_params` ("Invalid tone") |
| `variant` | `medium` | `easy` \| `medium` \| `hard` \| `precise` \| `balanced` \| `challenging` | `400 invalid_params` ("Invalid variant") |

`tone`/`variant` are validated against fixed sets **before** use because they are interpolated
into S3 keys that are both read and (on cache miss) written — an unvalidated value would let a
caller mint unlimited billable TTS generations. Pass the same `tone`/`variant` the reader is
using so the audio matches the on-screen chapter content.

---

## 2. Authentication & authorization

| Requirement | Detail |
|---|---|
| **Auth** | `requireActiveBookUser()` → `requireUser()`. Native clients use **`Authorization: Bearer <Cognito id_token>`** (shipped in B1). This is a `GET`, so it is **never** subject to the CSRF/same-origin guard. |
| **Entitlement** | **Pro only.** `entitlement.plan !== "PRO"` → `403 pro_required` ("Audio mode requires a Pro subscription"). |
| **Account status** | Deleted accounts are blocked inside the auth guard (see §3 note — the code is currently `500`, not `403`). |

---

## 3. Success response

`200 OK` with a **single stitched MP3** — the raw audio bytes, not JSON.

| Header | Value | Notes |
|--------|-------|-------|
| `Content-Type` | `audio/mpeg` | |
| `Content-Length` | byte length of the stitched MP3 | Whole stream only; **not** per-segment. |
| `Cache-Control` | `no-cache` | The stitched result is per-user/per-request; do not cache it. |

**Not present:** `Accept-Ranges`, `ETag`, `Last-Modified`, `Content-Range`. There is no
`Accept-Ranges: bytes` — see [§5 Range / seeking](#5-range-requests--seeking).

### Error responses

All errors use the standard envelope `{ "error": { "code", "message", "requestId" } }`
(`requestId` = the `x-amzn-trace-id` header or a generated UUID).

| HTTP | `error.code` | Cause |
|------|--------------|-------|
| `400` | `invalid_params` | Bad `bookId`/`chapterNumber`, or invalid `tone`/`variant`. |
| `403` | `pro_required` | Caller is not on the Pro plan. |
| `404` | `book_not_found` | No book package for `bookId`+`tone`. |
| `404` | `no_audio` | Zero segments were available to stitch (see §4 skip behavior). |
| `503` | `tts_unavailable` | Body segments are uncached **and** the server has no `ELEVENLABS_API_KEY` to generate them. Chapter audio has not been pre-generated yet. |
| `500` | `internal_error` | Any thrown error — **including auth failures** (see the trap below). |

> ⚠️ **Auth-error trap (documented as-is; fix tracked in §8).** This route does **not** use the
> shared `withBookApiErrors` wrapper. Its generic `catch` maps *every* thrown error to
> `500 internal_error`. So a **missing / expired / invalid `Bearer` token** — which
> `requireUser()` raises as `AuthError("UNAUTHENTICATED"|"INVALID_TOKEN")` — currently returns
> **`500 internal_error`, not `401`**. A deleted account (`BookApiError(403)`) likewise returns
> `500`. **Today the iOS client cannot distinguish "refresh your token" from "server broke" on
> this endpoint.** Until the §8 fix lands, treat a `500` from this route defensively (retry once;
> if it persists and other endpoints return `401`, force a token refresh).

---

## 4. How the stream is assembled (internal — the client never sees this)

The client gets one opaque MP3, but understanding the internals explains the non-determinism,
the cold-start latency, and why a segment manifest is the right long-term shape.

The server builds an **ordered list of S3 keys** ([`getSegmentKeys`](../../app/app/api/book/_lib/audio-narration-core.ts)),
`GET`s each object from the private content bucket **using its own IAM credentials**, and
`Buffer.concat`s them into the final MP3. The plan is personalized from user state
(streak, last score, time of day, learning mode, first/last/halfway chapter, weekend, late night).

**Actual segment order** (exactly what `getSegmentKeys` emits — note there is **no** leading
silence segment despite the code comment; `SILENCE_S3_KEY` is exported but unused):

| # | Segment | S3 key pattern | Present when | Auto-generated on miss? |
|---|---------|----------------|--------------|--------------------------|
| 1 | Per-user greeting | `book-content/audio-segments/names/{userId}-{tod}.mp3` | `userName` is known | ✅ yes (all 3 TODs, via ElevenLabs) |
| 2 | Contextual greeting | `book-content/audio-segments/greetings/{greetingId}.mp3` | always | ❌ must be pre-generated |
| 3 | Book intro (title + author) | `book-content/audio-segments/books/{bookId}.mp3` | always | ❌ pre-generated |
| 4 | Score callout | `book-content/audio-segments/scores/{scoreId}.mp3` | `plan.scoreId != null` | ❌ pre-generated |
| 5 | Chapter-number lead-in | `book-content/audio-segments/chapters/chapter-{n}.mp3` | always | ❌ pre-generated |
| 6 | **Summary body** | `book-content/audio/{bookId}/ch{NNNN}.{tone}.{variant}.summary.mp3` | always | ✅ yes (ElevenLabs) |
| 7 | Transition | `book-content/audio-segments/transitions/{transitionId}.mp3` | always | ❌ pre-generated |
| 8 | **Takeaways body** | `…/ch{NNNN}.{tone}.{variant}.takeaways.mp3` | always | ✅ yes (ElevenLabs) |
| 9 | **Recap body** | `…/ch{NNNN}.{tone}.{variant}.recap.mp3` | always | ✅ yes (ElevenLabs) |
| 10 | Closing CTA | `book-content/audio-segments/closings/{closingId}.mp3` | always | ❌ pre-generated |

- `{NNNN}` = `chapterNumber` zero-padded to 4 digits (`ch0004`). Only the three **body** segments
  are `tone`/`variant`-scoped; all `audio-segments/*` clips are tone/variant-agnostic.
- **Skip behavior:** any segment whose S3 object is missing **and** cannot be generated is
  **silently dropped** from the stitch. So the number of segments in the output is **not fixed** —
  a chapter with an un-pre-generated `scores`/`books` clip simply omits it. Only if *every*
  segment is unavailable do you get `404 no_audio`.
- The three body segments and the per-user greeting are the only pieces generated on the fly
  (ElevenLabs `eleven_turbo_v2_5`, `mp3_44100_128` = 44.1 kHz / 128 kbps). Generated bytes are
  cached back to S3 with `Cache-Control: public, max-age=31536000` (server-side reuse only).

**Determinism:** the greeting, transition, and closing fall back to `generic-01…10` chosen with
`Math.random()`, and the greeting/score also vary with user state and clock. **Two requests for
the same chapter can return different bytes and a different byte length.** This is the core reason
Range requests are unsafe here (see §5).

---

## 5. Range requests / seeking

**Not supported.** The handler returns `new Response(finalAudio, …)` with the full body and a
`200` status; it sets no `Accept-Ranges` and does no `Range`/`206`/`Content-Range` handling.
Next.js will **not** auto-satisfy a `Range` header for this dynamically-built body.

Do **not** point `AVPlayer`/`AVURLAsset` at this URL expecting progressive range-based streaming
or server-side seeking:
- There is no `Accept-Ranges: bytes`, so a well-behaved player will fetch the whole body anyway.
- Even if a player *did* issue byte-range requests, the response is **non-deterministic per
  request** (§4) — bytes `0–1000` and `1000–2000` could come from two differently-stitched files,
  corrupting playback.

**How the web client does it (and what iOS should mirror today):** it `fetch`es the entire body
(`res.arrayBuffer()`), then feeds the bytes into MediaSource / a Blob URL and seeks **locally in
the decoded buffer** — the server is never asked to seek. On iOS: download the full body once,
then play from local `Data`/a temp file (`AVAudioPlayer(data:)` or an `AVURLAsset` over a
`file://` URL). Local seeking works fine; you just can't stream-seek off the network.

Per-segment Range **is** viable — individual cached S3 objects are stable and S3 serves Range
natively — but only via the `?mode=plan` follow-up in §8, which exposes those objects.

---

## 6. Caching & refresh semantics

| Concern | Behavior |
|---|---|
| **Response caching** | `Cache-Control: no-cache`. The stitched MP3 is **not** cached (intentionally — it's per-user and varies each play). Do not persist it as a stable asset for a chapter. |
| **URL expiry** | **None.** There are no presigned URLs, so nothing expires and there is **no TTL to honor**. The endpoint URL is stable and reusable. |
| **Refresh** | To get audio again, simply **re-`GET` the same endpoint**. There is no refresh token / re-sign step because no signed URL is ever handed to the client. |
| **Server-side cache** | The expensive body segments (and per-user greeting clips) are cached in S3 for reuse across users/plays. This is invisible to the client. |

**Cold-start latency:** the **first** `GET` for a `(bookId, chapter, tone, variant)` whose body
segments aren't cached will synchronously call ElevenLabs to generate them (and generate the
user's greeting clips) before responding — this can take **several seconds**. Subsequent plays are
fast (S3 cache hits). Show a "generating audio…" state on first play, and set a generous client
timeout. If the body segments are missing and the server has no TTS key, you get `503
tts_unavailable`.

---

## 7. Duration / length metadata

| Available | Not available |
|-----------|----------------|
| `Content-Length` (bytes of the whole stitched MP3) | Any **duration** (total or per-segment) |
| | Per-segment `contentLength`, `segmentId`, offsets, or a manifest |

There is **no duration field anywhere** in the response. Derive playback duration on-device after
loading (`AVAudioPlayer.duration` / `AVAsset` `.duration`) — the web client does the equivalent by
reading the decoded element's `duration`. Do not try to infer duration from `Content-Length`: the
body/greeting segments are 128 kbps CBR, but the pre-generated `audio-segments/*` clips have no
guaranteed bitrate, so byte-length → seconds is unreliable across a mixed stitch.

---

## 8. Known gaps & follow-ups

These are the deltas between "what a great native player wants" and "what ships today." Per the B5
scope decision, this PR **documents** them; building them is deferred.

### 8a. Auth errors return `500` instead of `401`/`403` (recommended quick fix)

As noted in §3, this route's bare `try/catch` maps `AuthError`/`BookApiError` to `500`. The fix is
small, additive, and error-path-only (it cannot affect the web player's happy path, which treats
any non-`2xx` identically): map `AuthError` → `401 invalid_token`/`unauthenticated` and
`BookApiError` → its own status, matching the shared `withBookApiErrors` behavior every other Book
API route already uses. This is the single most impactful change for the iOS Bearer flow, because
it lets the client detect an expired `id_token` and refresh.

### 8b. `?mode=plan` segment-manifest contract (the real native-player upgrade — NOT implemented)

The right long-term shape for a native player (gapless `AVQueuePlayer`, per-segment caching, true
seeking, offline) is an **additive** JSON mode that exposes the plan the server already computes.
Proposed, subject to design review — the URL-delivery mechanism (presigned S3 vs. a proxy
`/audio/segment/{id}` endpoint) is an open decision:

```jsonc
// GET .../audio?tone=direct&variant=medium&mode=plan  →  200 application/json
{
  "version": 1,
  "bookId": "crucial-conversations",
  "chapterNumber": 4,
  "tone": "direct",
  "variant": "medium",
  "expiresAt": "2026-07-02T18:00:00Z",   // when the segment URLs stop working (TTL ≥ 6h)
  "segments": [
    {
      "segmentId": "greeting-user-evening",  // stable id
      "type": "greeting",
      "url": "https://…s3…?X-Amz-Expires=21600",  // presigned OR proxy URL; Range-capable
      "contentLength": 40213,                 // bytes
      "durationSeconds": 2.5,                 // when cheaply known
      "rangeSupported": true
    }
    // …greeting, bookIntro, score, chapterNumber, summary, transition, takeaways, recap, closing
  ]
}
```

Why it's the right target (and why it's genuinely additive): the default (no `mode`) stitched-MP3
path stays byte-for-byte unchanged for the web player, while native clients opt in to a manifest
whose individual S3 objects are **stable** (so Range/seek work), **cacheable**, and **refreshable**
by simply re-`GET`ting `?mode=plan`. Delivering per-segment `segmentId` + `contentLength` +
`durationSeconds` + Range then falls out naturally.

---

## 9. Quick reference — playing a chapter on iOS today

1. Ensure the user is **Pro** and authenticated with a `Bearer` id_token (B1).
2. `GET /app/api/book/books/{bookId}/chapters/{n}/audio?tone={t}&variant={v}` with
   `Authorization: Bearer <id_token>`. Use the reader's current `tone`/`variant`.
3. Expect a possibly-slow first response (cold-start TTS). Show a generating state; use a generous
   timeout.
4. On `200`, read the **whole** body (`audio/mpeg`), write it to a temp `file://` (or hold as
   `Data`), and play with `AVAudioPlayer`/`AVURLAsset`. Seek **locally**; do not rely on network
   Range.
5. Error handling: `403 pro_required` → upsell; `503 tts_unavailable` → "not ready yet, try
   later"; `500 internal_error` → retry once, and (until §8a lands) treat a persistent `500` as a
   possible auth failure and refresh the token.
6. To replay, just re-`GET` (no URL expiry). Do not cache the stitched body as a stable chapter
   asset — it's `no-cache` and non-deterministic.

_Last updated: 2026-07-02._
