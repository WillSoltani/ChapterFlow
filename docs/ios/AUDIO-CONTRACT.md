# B5 — Chapter audio delivery contract (for the native iOS client)

**Status:** documents the endpoint **exactly as it exists today** (`feat/ios-b5b`). §1–§7 describe
the **default** stitched-stream response; **§8b** documents the additive **`?mode=plan`** JSON
manifest, now implemented (B5b). Every field below is derived from the route source, not from an
intended design. Where a behavior is a poor fit for a native player, it is called out under
[§8 Known gaps & follow-ups](#8-known-gaps--follow-ups) rather than papered over.

> **TL;DR for iOS:** The **default** (no `mode`) response is **not** a segment manifest — it is
> **one stitched `audio/mpeg` blob** built server-side from many per-segment S3 objects, with **no
> per-segment URLs** and **no HTTP Range / seek support**, **per-user, non-deterministic,
> `Cache-Control: no-cache`**. Play it the way the web client does: `GET` the whole body once, then
> seek locally in the decoded buffer.
>
> For a native player, prefer the additive **`?mode=plan`** JSON manifest — **now implemented
> (§8b)** — which returns the ordered segments with **stable ids**, **presigned, Range-capable S3
> URLs (6h TTL)**, `contentLength`, optional `durationSeconds`, and caption `text`. It shares the
> exact same auth/entitlement/params as the stream, and the default path stays byte-for-byte
> unchanged.

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
natively — and is **now exposed via [`?mode=plan`](#8b-modeplan-segment-manifest-contract-implemented--b5b)**
(§8b): each segment is a presigned, Range-capable S3 URL you can seek against directly.

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

There is **no duration field anywhere** in the **default** stream response. Derive playback duration
on-device after loading (`AVAudioPlayer.duration` / `AVAsset` `.duration`) — the web client does the
equivalent by reading the decoded element's `duration`. Do not try to infer duration from
`Content-Length`: the body/greeting segments are 128 kbps CBR, but the pre-generated
`audio-segments/*` clips have no guaranteed bitrate, so byte-length → seconds is unreliable across a
mixed stitch.

> **`?mode=plan` (§8b)** exposes per-segment `contentLength` for every segment and a
> `durationSeconds` estimate for the four 128 kbps-CBR segments (`userGreeting`, `summary`,
> `takeaways`, `recap`) only — consistent with the caveat above, it omits `durationSeconds` for the
> unguaranteed-bitrate pre-generated clips. Even there, prefer the exact on-device `AVAsset.duration`
> when precision matters.

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

### 8b. `?mode=plan` segment-manifest contract (IMPLEMENTED — B5b)

Add a single query param, `mode=plan`, and the endpoint returns the personalized **segment
manifest as JSON** instead of the stitched MP3 — an **additive** native-player upgrade (gapless
`AVQueuePlayer`, per-segment caching, true per-segment seeking). The default (no `mode`, or any
value other than `plan`) still returns the byte-for-byte-unchanged stitched stream of §3; the web
player is untouched.

`mode=plan` shares this route's **entire** preamble: same auth (§2), same **Pro** entitlement, same
`tone`/`variant` validation (§1), the same personalized `buildSegmentPlan`, and the same
generate-missing-on-first-play behavior (§4, §6 cold-start). Only the response shape differs.

```jsonc
// GET .../audio?tone=direct&variant=medium&mode=plan
//   → 200 application/json   (Cache-Control: private, no-cache)
{
  "version": 1,
  "bookId": "crucial-conversations",
  "chapterNumber": 4,
  "tone": "direct",
  "variant": "medium",
  "expiresAt": "2026-07-02T18:00:00.000Z",   // nominal presigned-URL expiry: request time + 6h
  "segments": [
    {
      "segmentId": "greeting-user-evening",       // stable, unique within this manifest
      "type": "userGreeting",
      "url": "https://<bucket>.s3.<region>.amazonaws.com/book-content/audio-segments/names/<userId>-evening.mp3?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=21600&X-Amz-Signature=…",
      "contentLength": 40213,                     // exact bytes of the S3 object
      "durationSeconds": 2.5,                      // present only on 128kbps-CBR segments (bytes/16000)
      "text": "Good evening, Ada.",               // caption; omitted for body segments
      "rangeSupported": true
    }
    // …greeting, bookIntro, score, chapterNumber, summary, transition, takeaways, recap, closing
  ]
}
```

**Top-level fields**

| Field | Type | Notes |
|-------|------|-------|
| `version` | `1` | Manifest schema version. Bump on a breaking change. |
| `bookId`, `chapterNumber`, `tone`, `variant` | | Echo the resolved request scope. `segmentId`s are unique **within** this scope. |
| `expiresAt` | ISO-8601 UTC | Request time **+ 6h** — the nominal instant the presigned URLs stop working. See the credential caveat under *Refresh*. |
| `segments` | array | Ordered exactly as the stitched stream (§4). Length is **not fixed** — a segment whose object is missing and cannot be generated is dropped (same skip behavior as the stream). |

**Per-segment fields**

| Field | Type | Notes |
|-------|------|-------|
| `segmentId` | string | **Stable**, deterministic id for this segment object; unique within the manifest → safe as a client cache key. Not globally unique — scope it by `bookId`+`chapterNumber`+`tone`+`variant`. |
| `type` | enum | One of: `userGreeting`, `greeting`, `bookIntro`, `score`, `chapterNumber`, `summary`, `transition`, `takeaways`, `recap`, `closing`. At most one of each per manifest. |
| `url` | string | **Presigned S3 `GET`** signed with the route's IAM role (`X-Amz-Expires=21600` = 6h). Points straight at the private content bucket — no proxy. Natively **Range-capable** (see below). |
| `contentLength` | number | Exact byte length of the S3 object (S3 `HEAD` for pre-existing objects; known directly for freshly generated ones). |
| `durationSeconds` | number? | Present **only** for the four ElevenLabs-generated 128 kbps-CBR segments (`userGreeting`, `summary`, `takeaways`, `recap`), as a byte-derived estimate (`contentLength / 16000`, ±~1 frame). **Omitted** for the pre-generated `audio-segments/*` clips (unguaranteed bitrate — see §7). Prefer the exact on-device `AVAsset.duration` when you need precision. |
| `text` | string? | Short caption/script for the narration segments (`userGreeting`, `greeting`, `bookIntro`, `score`, `chapterNumber`, `transition`, `closing`). **Omitted** for the long-form body segments (`summary`, `takeaways`, `recap`) — that copy already lives in the reader. |
| `rangeSupported` | `true` | Always `true`: every `url` is a native S3 object. |

**Segment order + `segmentId` scheme** (mirrors §4 exactly):

| # | `type` | `segmentId` | Present when |
|---|--------|-------------|--------------|
| 1 | `userGreeting` | `greeting-user-{morning\|afternoon\|evening}` | `userName` is known |
| 2 | `greeting` | `greeting-{greetingId}` (e.g. `greeting-ctx-weekend`, `greeting-generic-03`) | always |
| 3 | `bookIntro` | `book-intro` | always |
| 4 | `score` | `score-{bucket}` (e.g. `score-90`, `score-100-improved`, `score-first-chapter`) | `plan.scoreId != null` |
| 5 | `chapterNumber` | `chapter-number-{n}` | always |
| 6 | `summary` | `summary` | always |
| 7 | `transition` | `transition-{transitionId}` | always |
| 8 | `takeaways` | `takeaways` | always |
| 9 | `recap` | `recap` | always |
| 10 | `closing` | `closing-{closingId}` | always |

**Range / seeking.** Unlike the stitched stream (§5), each `url` is a **stable, individually
addressable** S3 object, and S3 serves `Range` natively (`Accept-Ranges: bytes`; a `Range` request
returns `206 Partial Content` with `Content-Range`). Point `AVURLAsset` at each segment `url` and
seek freely — the seek is served by S3, not re-stitched. (`rangeSupported` is advertised per segment
and verified end-to-end by the opt-in integration test `app/app/api/book/_lib/audio-plan.itest.ts`.)

**Generation & errors** (same semantics as the stream — §3, §4):
- Missing **body** segments (`summary`/`takeaways`/`recap`) and the **user greeting** are generated
  on the fly (ElevenLabs) and **durably** written to S3 *before* their URL is signed, so the URL is
  immediately fetchable. First play of an un-pre-generated chapter is therefore **slow** (cold-start
  TTS) — show a generating state, use a generous timeout.
- Missing **pre-generated** clips (`greeting`/`bookIntro`/`score`/`chapterNumber`/`transition`/`closing`)
  are **dropped** from the manifest (never generated), exactly as the stream skips them.
- Missing body segment **and no `ELEVENLABS_API_KEY`** → `503 tts_unavailable`.
- **Zero** surviving segments → `404 no_audio`.
- All other errors match §3, **including the §8a auth-error trap**: `mode=plan` runs inside the same
  `try/catch`, so a missing/expired/invalid `Bearer` token currently returns **`500 internal_error`,
  not `401`**, until §8a lands. Treat a `500` defensively (retry once; if it persists and other
  endpoints `401`, refresh the token).

**Caching & refresh.**
- The manifest is `Cache-Control: private, no-cache` — it is per-user and embeds presigned URLs, so
  never share-cache it.
- **Refresh by simply re-`GET`ting `?mode=plan`.** There is no separate re-sign step. Re-fetch when
  either (a) `now >= expiresAt`, or (b) any segment `url` returns `403` (SignatureExpired /
  AccessDenied) — **whichever comes first**. Rule (b) matters because the URLs are signed with the
  Lambda role's **temporary** credentials: the effective lifetime is `min(6h, remaining credential
  lifetime)`, so a URL can occasionally expire before `expiresAt`. Keying refresh off an actual
  `403` (not just the clock) makes that edge case a non-event.
- A refresh recomputes the plan, and the `greeting`/`transition`/`closing` **generic** fallbacks are
  chosen with `Math.random` (§4), so those slots may resolve to a **different clip — and thus a
  different `segmentId`** — on the new manifest. The body segments, `bookIntro`, `chapterNumber`, and
  any context-triggered clip are stable across refreshes for the same user state + chapter + tone +
  variant + time of day. **Treat each freshly fetched manifest as authoritative** and re-key any
  per-segment cache off the new `segmentId`s.

**Why it's genuinely additive:** the default stitched-MP3 path is unchanged for the web player,
while native clients opt in to a manifest whose individual S3 objects are stable (so Range/seek
work), cacheable, and refreshable by re-`GET`ting `?mode=plan`.

---

## 9. Quick reference — playing a chapter on iOS today

> **Two options.** For a native player, prefer **`?mode=plan`** (§8b): fetch the manifest, then feed
> each segment's presigned Range-capable `url` into an `AVQueuePlayer` for gapless playback + true
> per-segment seeking + caching. The steps below describe the **default stitched-stream** path
> (simplest; whole-body download + local seek), which remains fully supported.

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
