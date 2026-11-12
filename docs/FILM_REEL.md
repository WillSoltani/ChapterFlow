# Film reel landing — engine + render spec

> **Continuing the work?** Read `docs/HANDOFF_MEMORY_PALACE.md` first —
> current state, known issues, prompt standard, budget, definition of done.

Scroll-scrubbed image-sequence landing (the soltani.org technique): one 3D
object, rendered in Blender/Higgsfield, scrubbed frame-by-frame as the page
scrolls, with copy choreographed to named moments in the animation.

Live at `/` (append `?hud=1` for the frame counter).

## Architecture

```
components/film/
  types.ts            FilmManifest / FilmVariant / BandTier / SegmentRegistration
  scrub.ts            pure math: pickActive, frameAt, quantise, coverRect, breathAt,
                      backingSize, stageShift, framePlacement, variantPlacement,
                      viewportRects, reelEndScrollY
  frame-cache.ts      FrameBudget (one wanted set, byte budget, load limits) + FrameCache, nearest();
                      pack mode via a PackSource (decode in the worker, coarse first)
  pack-format.ts      pack layout v1: header parse, layout check against the timeline
  pack-store.ts       PackBytes: held bytes per frame slot, the incremental frame cutter
  pack-plan.ts        the network plan (pure): which ranges of which packs to read now
  pack-net.ts         PackNet: Range streams, retries, byte cap, stats (the worker's core)
  film-worker.ts      the film worker: PackNet + createImageBitmap, bitmaps transferred
  film-worker-protocol.ts  page ↔ worker messages
  pack-client.ts      page side of the worker (PackSource): lazy start, held-frame mirror, fallback
  reel-context.tsx    ReelContext + orientation media query + variant pick (readView, pickVariant)
  use-scrub-loop.ts   the ONE rAF loop: cached geometry → active segment → frame → canvas
  FilmBackdrop.tsx    fixed 100lvh <canvas>, registers segments, owns caches
  FilmSegment.tsx     N×100svh section + sticky 100svh stage; progress store
  FramePin.tsx        copy pinned to [from,to] frames (opacity/transform only)
  timeline.ts         key("book-01","sheet_split") → frame; manifest(name), bandTiers(name)
  book.timeline.json  named keyframes + counts + versions + band tiers per film (SOURCE OF TRUTH)
  book-reel.ts        ordered FilmManifest[] for the landing
  chapters/*.tsx      HeroChapter, SummaryExamples, Quiz, Review, Library, Close
  BookReelLanding.tsx composition
scripts/film/
  encode.mjs          Blender frames → public/films/<name>/f_0001.webp + poster + manifest;
                      --bands writes the portrait band tiers <name>-b1080, <name>-b900
  placeholder.mjs     synthetic frames from timeline (dev only): landscape + band tiers, with packs
  pack.mjs            one pack.bin per variant from its frame files (npm run film:pack; --verify)
  pack-lib.mjs        pack builder / verifier shared by pack.mjs, encode.mjs, placeholder.mjs
  tier-parity.mjs     proof that the band tiers draw like the legacy -p frames (npm run film:parity)
```

CSS lives in `app/globals.css` under `/* FILM REEL */`: `.film-stage-grid`,
`.film-halo`, `.film-box`, `.film-label/.film-h1/.film-h2/.film-lede`,
`.film-btn*`, `[data-film-body]`, `html[data-reel-chrome]`.

## Runtime behaviour

- Segment height = `pace × 100svh`. The first segment scrubs over its sticky
  travel: progress = `-top / (height - vh)`. Every later segment starts one
  viewport EARLY — the moment its box crosses the viewport bottom, while the
  previous stage slides out — and scrubs over `travel + vh`:
  progress = `(vh - top) / (height - vh + vh)`. The reel never freezes on a
  chapter's last frame during the slide-out; the next film is already moving
  and its copy rides in with its stage (`pickActive` in `scrub.ts`). `vh` is
  the sticky STAGE height (100svh, measured from `[data-film-stage]`), never
  `window.innerHeight`: see Viewport below.
- Viewport (phones; `use-scrub-loop.ts`). On iOS Safari `innerHeight` grows by
  ~80–110 px when the address bar collapses and shrinks when it returns,
  while `svh` and `lvh` do not change. So:
  - **Stage-height progress.** Progress is computed against the stage height
    (the unit the segments are sized in). Measuring with `innerHeight` made
    the film jump ~9 frames at the start of almost every scroll gesture.
  - **lvh canvas.** The canvas wrapper (`FilmBackdrop.tsx`) is `fixed top-0
    h-lvh`. Its backing store is sized from the wrapper's own box (DPR capped
    at 2, width capped at 1920 px, `backingSize`) and reallocated only when
    that box changes (width, orientation, browser zoom) or the DPR changes,
    never on an address-bar `resize`. A ResizeObserver on the wrapper watches
    the box, and every geometry measure re-reads it as well: the observer is
    delivered after the animation-frame callbacks of the frame a resize lands
    in, so the tick that handles a `resize` must refit the canvas itself
    before it computes the stage shift, or it paints one stretched frame.
  - **Constant placement.** The frame is cover-fitted to the box (width ×
    large-viewport height) and centred on the stage centre (half the stage
    height from the top, `stageShift` + `framePlacement`), so its scale and
    position never change with the address bar. Where stage = box (desktop,
    Playwright) this is exactly the old rectangle, breath zoom and its
    0.5 / 0.45 origin included. Canvas area the picture does not cover (the
    strip below it on a phone, everything outside a band tier's band) is
    cleared with `--cf-recall-bg` (#06070A), the colour the hero's ramp bars
    are encoded in, not `--cf-page-bg`.
  - **Cached geometry.** Segment document tops and heights and the stage
    height are measured when segments register, on window `resize`, when a
    ResizeObserver on the reel's content wrapper or on `<body>` fires, after
    `document.fonts.ready`, and at most every 500 ms while the loop works. A
    tick computes each viewport top as `cachedTop − scrollY`: no
    `getBoundingClientRect`, no sort.
  - **Idle and pause.** A tick works only when something changed: `scrollY`,
    the canvas box or DPR, the geometry, the smoothed frame not yet on the
    target, a late frame landed, the breath value (quantised to 1/4000) or
    reduced motion. Otherwise it returns after a few comparisons. The loop
    stops requesting animation frames while `document.hidden` and resumes on
    `visibilitychange` / `pageshow`. Once the reel has ended (chrome `body`,
    last frame settled) it stops too; a passive scroll listener restarts it
    when the visitor scrolls back above the end (`reelEndScrollY`), as do a
    resize, a ResizeObserver, a late frame or a segment registering. The
    first tick after a restart snaps to the scroll position (no glide), so
    an anchor jump or a back/forward restore into the middle of the reel
    shows the right frame on that tick. Breath runs on its own clock that
    holds still while the loop is stopped (`holdBreathClock`), so a restart
    continues the zoom from the value it froze on instead of popping by up
    to the breath amplitude. `onProgress` and the chrome flip are unchanged
    (both already ignored repeats).
  - **Verified only on a real phone.** Lab browsers (Playwright, DevTools
    device mode) have no collapsing address bar: there `svh = lvh =
    innerHeight` and the code above draws exactly what it did before. That
    the film does not move or flash when the bar hides and shows has to be
    checked on an iPhone.
- Dissolve: first `dissolveIn` frames cross-fade over previous film's last
  frame (so it happens during the slide-in, not at the pin).
- Frame loading (`frame-cache.ts`). Decoded frames live under ONE byte budget
  shared by every film (`FrameBudget`): 160 MB on phones/tablets, 384 MB on
  desktop, `deviceMemory`×48 MB where Chrome reports it (a single portrait
  film once held 1.3 GB of bitmaps and mobile Safari killed the tab). The
  budget is also the load scheduler:
  - **One wanted set per scroll decision** (`budget.want`, called by the scrub
    loop when the target frame moves): a window around the playhead in the
    active film, ~70 % ahead in the scroll direction; the previous film's
    LAST frame while the window can reach the dissolve (`frame < dissolveIn`
    draws it); the next film's opening (at most 12 frames) once progress
    passes 0.6, and from the hero onward for the second film (the mount
    warm-up, a "weak" plan the loop's first decision replaces); and, when the
    network is behind the playhead, the frame the canvas would fall back to
    (nearest HELD bytes at or below the playhead, decode only, last in line),
    so a late frame is drawn instead of the poster. Its decoded
    size is ≤ 80 % of the budget: capacity = budget ÷ (width × height × 4)
    of the variant's REAL frame files, known before any decode (phones on the
    900×810 band tier, 2.9 MB a frame: 57 frames → 45 wanted; tablets on the
    1080×972 tier, 4.2 MB: 39 → 31 at 160 MB; desktop 384 MB on 1920×1080,
    8.3 MB: 48 → 38. The full 1080×1920 portrait frames gave phones 20 → 16).
  - Loads start only for wanted frames, nearest-first in the scroll
    direction, re-ordered on every decision. At most **4 fetches** in flight
    (the dev server is HTTP/1.1, 6 connections per host: more would starve
    the app's own navigations) and **2 decodes** on budgets under 256 MB,
    4 otherwise. A decode reserves its decoded bytes when it STARTS, so
    decoded + decoding never exceeds the budget by more than one frame.
  - A fetch that has started is **never aborted**: its compressed bytes are
    kept in a byte-capped store (24 MB on small budgets, 96 MB otherwise,
    least recently used out), keyed by frame URL, so a frame is fetched once
    per page and re-decoded from those bytes when the visitor scrolls back
    (or a cache is re-created by a remount). Only requests still QUEUED are
    dropped when they leave the wanted set.
  - A fetch or decode that fails (rate limiter 403/429, 5xx, dropped
    connection) leaves a hole `nearest()` covers, and is retried while the
    frame stays wanted after a backoff of 400 ms, doubling to at most 4 s, so
    a parked visitor recovers once the network does.
  - Eviction removes only frames OUTSIDE the wanted set: other films' frames
    first, then the active film's, farthest from the playhead first. A new
    far frame can no longer push out a near one (the oldest-first LRU did,
    and refetched in a loop: 522 to 10,662 refetches per pass on 2026-11-10).
  - A frame that lands nearer to the wanted one than what the canvas shows
    triggers a repaint (`budget.subscribe`), with or without scrolling,
    breath or reduced motion.
  - Counters, always on (production too): `window.__filmStats` — `fetches`
    (per-frame requests only; packs are counted separately, below),
    `refetches` (a per-frame request for bytes this page already fetched),
    `decodes`, `redecodes`, `exactDraws`, `fallbackDraws`,
    `fallbackDistanceSum` (|drawn − wanted| summed over fallback draws; the
    poster counts as frame 0), `evictions`, `maxFetchInFlight`,
    `maxDecodeInFlight`, plus the live `fetchInFlight` / `decodeInFlight`;
    and from the scrub loop `canvasResizes` (backing-store reallocations: 1
    per visit unless the window's width, orientation, zoom or DPR changes),
    `geometryMeasures`, `ticksWorked` and `ticksSkipped` (not in the HUD).
    `?hud=1` shows a second line: `exact 97% · refetch 0 · dist 0.4 · fetch
    3/4` (dist = mean distance over ALL draws), and a third (see Packs).
- Packs (Phase 4): one streamed file per film variant, decoded off the
  main thread. This is how every variant with a pack loads; the per-frame
  path above stays complete as the fallback.
  - **Layout** (`pack.bin` next to the frames; `scripts/film/pack-lib.mjs`
    writes it, `pack-format.ts` reads it). Little-endian u32: magic `CFPK`,
    layout version 1, frame count N, header length H = 24 + 12·N, the byte
    offset where the skeleton layer ends, the total length, then N entries
    in FILE order (frame index, byte offset, byte length), then the frame
    bytes, byte for byte the frame files, no re-encode. File order: the
    skeleton layer (every 4th frame: 0, 4, 8, … in frame order), then every
    other frame in frame order. The reader takes the order from the table
    and assumes nothing. Deterministic (same frames, same bytes); the
    version is the first 12 hex characters of the pack's SHA-256.
    `manifest.json` gets `pack: {bytes, header, skeletonEnd, openingEnd, v}`
    and the timeline the same under `films.<name>.pack` and
    `films.<name>.bands.<tier>.pack` (`openingEnd`: the byte where frames
    0–47 are all complete, so the request before the first scroll is bounded
    exactly). The URL is `<variant>/pack.bin?v=<pack v>`.
  - **Worker** (`film-worker.ts`, created lazily by `pack-client.ts` with
    `new Worker(new URL("./film-worker.ts", import.meta.url), { type:
    "module" })`, on the first scroll decision; never at import or during
    server render; dev and the production build both emit it as its own
    chunk). It owns the pack bytes: Range requests read through the
    response body's ReadableStream, frames cut as bytes arrive across any
    chunk boundary (`PackBytes`), compressed bytes capped at 48 MB on phones
    and 160 MB otherwise (the budget's own small/large signal, i.e.
    `pickFrameBudgetBytes` < 256 MB; over the cap the variant farthest from
    the active film loses frames first, from the end of its file, never the
    active film, the neighbour being prepared, a pack with a stream open or
    the dissolve pin's frame), and decodes a held frame on request with
    `createImageBitmap`, transferring the ImageBitmap with its decode time.
    Held bytes that will not decode count against their pack: the third
    such failure makes the pack unusable (fallback below) instead of
    retrying the same bytes.
  - **Protocol** (`film-worker-protocol.ts`). Page → worker: `init` (the
    cap), `packs` (the reel's packs for the current view, in film order; a
    pack that failed earlier keeps its place marked `failed` and is never
    read, so the films around it keep their neighbours), `where` (active
    pack, playhead frame, direction, wanted window lo/hi, the dissolve pin
    while wanted and not decoded, scrolled yet, document hidden, connection
    constrained), `decode`. "Scrolled" is read on each scroll decision
    until it holds, never during render (a client-side link from a scrolled
    page still reports the old scrollY there): a scroll position above 0, a
    #anchor, or an active film past the first.
    Worker → page: `ready` (false without createImageBitmap, fetch or a
    streaming body), `frames` (frames arrived / dropped), `failed` (the pack
    is unusable), `stats`, `decoded` (the bitmap, or missing / error).
  - **Scheduler** (`frame-cache.ts`, `attachPacks`). For a variant served
    from its pack the page holds no compressed bytes. A wanted frame the
    worker holds is decoded there (same decode limit, bytes reserved when
    it starts); one whose bytes have not arrived is not loadable yet (no
    slot, blocks nothing) and is decoded when they arrive if still wanted.
    Within the window: the playhead frame, then every 4th frame nearest
    first, then the in-between frames nearest first (coarse first). The
    Phase 1 guarantees hold in both modes (frame-cache.test.ts). A bitmap
    landing for a disposed cache is closed at once; one landing for a frame
    no longer wanted is kept while it fits and closed on eviction or
    dispose.
  - **Network plan** (`pack-plan.ts`, pure, re-run after every chunk, stream
    end, scroll decision and backoff). Once the visitor has scrolled, in
    order: (1) the active film's skeleton, (2) the skeleton of the film the
    visitor travels towards (next scrolling down, previous scrolling up), (3)
    the active film's remaining frames, (4) the neighbour's remaining frames;
    nothing else (a stream on any other pack is stopped, its bytes stay),
    except the dissolve pin: while the active film's opening dissolves from
    the previous film's last frame and that frame is not held, it is read
    right after step 1 (its header first when that film was never read, e.g.
    after an anchor jump; a stream a few frames short of it is left to reach
    it; scrolling up that film is the neighbour and its own plan reaches it).
    One stream per pack, at most 2 at once, none opened while the document is
    hidden. A stream starts at the first byte not held and ends before the
    next held byte; it is open-ended (`bytes=N-`) when that is the end of the
    file, so a skeleton followed by the frames about to be needed is ONE
    request, and no range is read twice while its bytes are held
    (`packBytesRepeated`). Before the first scroll (scroll position 0, no
    #anchor, the first film active) only the first film's pack is requested,
    bounded at `openingEnd` (skeleton plus frames through 47), and it
    continues from the first missing byte on the first scroll; there is no
    two-film warm-up in pack mode. Posters load as before. Re-aim: when the
    playhead is where the stream is not, the stream is stopped and reopened at
    the first missing frame at the playhead (forward), or at a run ending at
    the highest missing frame at or below it, starting 64 frames lower
    (backward), and what was skipped is filled afterwards with a range that
    ends before the held bytes. Only on a jump (≥ 24 frames in one decision,
    or a film entered out of order), a stop (300 ms without a playhead
    change), or while scrolling up; a stream ≤ 16 frames short of the target
    is left to reach it; while the visitor moves forward steadily faster than
    the network the stream keeps reading in order (a re-aim there would cost a
    request a second for frames passed at once; the skeleton covers the
    motion). Scrolling up, a stream reading towards the playhead from below
    (at most 64 + 16 frames below it) goes on until the playhead passes it, so
    an upward pass costs about one request per 64 frames, not one per frame.
    The neighbour flips with the direction only after 8 frames of travel,
    counted across film cuts too. Crossing a cut (not a jump) holds the two
    films at that cut while the playhead stays within 8 frames of it on
    either side, whichever way it moves and however long it pauses: the film
    the plan works from stays the one the playhead came from and the
    neighbour is the other film at the cut; past those 8 frames, or on a
    jump, the playhead's own film and the direction decide again. So a
    playhead wobbling across a cut, with pauses or not, keeps the same two
    films and their streams: it costs no requests beyond what a stop costs
    anywhere (at most one re-aim at the playhead, once, while the frames
    there are missing). On a constrained connection a stop in the other film
    of the pair makes it the active one (still paired with the film across
    the cut), so its window is read. Constrained connections (`saveData`, or `effectiveType` slow-2g /
    2g / 3g): skeletons only (1, 2) while moving; after 300 ms still, the
    missing frames of the wanted window in one bounded request (from the first
    missing remaining frame to the end of the last one; the skeleton frames
    are already held). The dissolve pin is read there too, moving or settled,
    by the same rules, except that its film being the neighbour (or the
    active film) does not exempt it, since those are read only to their
    skeletons: it follows that film's own skeleton. A pin that is a skeleton
    frame (the last frame of a film whose count is 1 + a multiple of 4) costs
    no request; any other costs one request for its slot.
  - **Responses** (`pack-net.ts`). 206 must start where asked and carry the
    timeline's total. 200 to a request past byte 0 (a server that ignores
    Range): the body is read from 0, bytes already held are discarded (and
    counted as repeated) and that pack is read whole from then on. A total,
    `Content-Length` or header that disagrees with the timeline, 404, 410 or
    416: the pack is unusable at once. Network errors, 403, 429, 5xx or a
    body that ends early: retried after 400 ms, 800 ms, 1.6 s (what arrived
    is kept; the retry starts at the first missing byte); a fourth failure
    in a row makes the pack unusable.
  - **Fallback** (`pack-client.ts`). Per variant: the timeline has no pack
    for it, or its pack is unusable (above, including three frames whose
    held bytes would not decode) → per-frame path for the rest of the page
    view. Every variant: `?pack=0`, no `Worker`, the worker cannot
    start, lacks createImageBitmap / fetch / a streaming body, or errors
    (crash). Frames already decoded stay, pending decodes reject quietly,
    the order and the mode switch at once, no error loop (the per-frame
    path keeps its own backoff).
  - **Counters** added to `__filmStats`: `mode` of the ACTIVE variant
    (`pack` or `frames`), `packRequests`, `packBytes` (received),
    `packBytesRepeated` (received for a range already held; must stay 0),
    `packBytesHeld`, `packReaims`, `packFallbacks`, `packHeldShare` and
    `packSkeleton` (active film's pack), `workerDecodes` with
    `workerDecodeMeanMs` / `workerDecodeMaxMs`, `mainThreadDecodes` with
    `mainThreadDecodeMeanMs` / `mainThreadDecodeMaxMs` (decodes started from
    the page on the per-frame path; WebKit runs those on the main thread),
    and the draw gauges `drawWant` / `drawAt` (the last paint's wanted and
    drawn frame). `fetches` and `refetches` count per-frame requests only.
    `?hud=1` third line: `pack 42% · skeleton done · decode 14.4 ms in
    worker`, or `frames · decode 9.0 ms on page`.
- Breath: `±amp` slow sinusoidal zoom while held (off under reduced motion).
- Reduced motion (OS or in-app toggle): progress quantised to `reducedSteps` (5).
- `<html data-reel-chrome="film|body" data-reel-section="…">` + `cf-reel-chrome`
  CustomEvent for nav/scrim restyling.
- FramePin: SSR renders copy VISIBLE; JS arms + scrubs after mount (crawler-safe).
  A pin with `from=0` is fully visible at frame 0 (LCP).
- Keyboard focus inside a stage snaps the segment to the top.
- Smoothing by input (`smoothingMs` in `scrub.ts`, called by the loop). The
  scrub chases the target frame with an exponential glide whose time constant
  depends on the last scroll input: **wheel 90 ms, key 90 ms, other 90 ms,
  touch 35 ms**. Higher = a smoother glide but the film lags the input; lower
  = tighter but a wheel's 10–30 frame steps show. The input kind is tracked
  with passive listeners (no per-frame cost): `wheel`; `touch` (touchstart /
  touchmove, held through a fling until another input); `key` (arrow, page,
  space, home/end keydown); `other` (a press on the scrollbar, a hashchange,
  or any scroll more than 400 ms after the last wheel or key input:
  programmatic scrolls, anchor jumps). `?smooth=<ms>` (0–200, read once; 0 =
  no smoothing) replaces the **touch** value only. Values to try on a phone:
  `?smooth=0`, `20`, `35` (default), `50`, `90`. The idle rule still holds: a
  tick is skipped once the smoothed frame equals the target. `?hud=1` fourth
  line: `input touch · smooth 35 ms · want f0123` (the frame the scroll wants;
  the first line is the frame drawn).
- Nav over the film on touch screens (`globals.css`, `@media (hover: none)
  and (pointer: coarse)` with `html[data-reel-chrome="film"]`): no
  `backdrop-filter` and no `filter` (re-blurring the moving canvas under the
  pill was paid on every scroll frame); a tinted fill instead. Desktop (fine
  pointer) and the nav over the body sections keep the glass. Five looks for
  the owner to pick from, **temporary** until the pick: `?nav=1` … `?nav=5`
  (read once by RecallNav onto `data-nav-look` on the pill and its scrim):
  1. **Tinted pill** (default, recommended): panel colour at 86 %, today's
     hairline and shadow.
  2. **Solid pill**: page colour at 96 %, no hairline, no shadow.
  3. **Top scrim only**: no pill; a darker, taller scrim behind the nav.
  4. **Light pill on scrim**: panel at 72 %, no hairline, today's scrim at
     full strength.
  5. **Lifted pill**: a slightly lighter grey (panel + 8 % ink) at 90 %,
     hairline, no shadow.
  `node scripts/film/nav-looks.mjs` (dev server running) captures the top
  140 px of each look over a bright hero, a dark Hall and a city frame into
  one contact sheet (`~/cf-wt/p5-nav-looks/nav-looks.png`) and measures each
  look's worst-case contrast of the nav ink and link ink over a white and a
  black backdrop (all ≥ 4.5:1; it exits 1 otherwise).
- Layers (what holds a compositor layer, and when):
  - **FramePin**: no permanent `will-change`. A pin is promoted
    (`will-change: opacity, transform`; a scrim pin `opacity`) only while its
    scripted values change, and demoted 300 ms after they settle
    (`PIN_DEMOTE_MS`, `layers.ts`) or at once when it rests at opacity 0.
    Opacity is quantised to 0.01 and the rise to 0.5 px, and each style is
    written only when its string changed. The rise is a 2D `translate`; a
    resting visible pin has `transform: none`. Scrim pins write opacity only.
  - **Hall**: `.hall-line` has no `will-change`; the two wall containers get
    `will-change: transform` only while the Hall segment is on screen (an
    IntersectionObserver). HallText caches each written value, quantises
    opacity (0.01) and lift (0.5 px), and writes a line's colour only when
    its highlight flips (the 240 ms colour transition then runs for those
    lines only). The walls are static: the old `--hall-dolly` parallax never
    reached them (`.hall-wall` redeclared it as 0), so its per-frame write
    is gone and the walls look as before.
  - **`.film-box::before`**: no `mask-image`, no 100vw overdraw. It covers the
    box, the stage padding on the copy side and 7rem on the film side; the
    top/bottom feather is built into the gradients (a band, two edge strips,
    two corner ellipses). The band is a flat 90 % up to its fade, the value
    the strips end on, so there is no step where they meet.
  - **Canvas under the body**: `[data-film-body]` fades from the film over
    10svh and is opaque from 30svh. Past `canvasHiddenFrom` (the last
    segment's bottom + 30 % of a stage height) the canvas wrapper is
    `visibility: hidden` (not composited; the canvas keeps its picture). The
    loop's scroll handler, which runs before the frame's animation callbacks
    and paint, makes it visible again as soon as the scroll is above that
    line, from cached geometry (no layout read): scrolling back up, a reload
    at Pricing, or an anchor jump back into the reel never shows a blank or
    stale canvas.
- Handlers: the nav (RecallNav) does no layout read on scroll: its persistent
  CTA state comes from IntersectionObservers (suppression zones below the
  header line; the hero-end sentinel against a root that reaches far below
  the viewport, so a jump across the line still flips it), rebuilt only when
  the header's own size changes (on window resize where ResizeObserver is
  missing; a rAF-throttled scroll read only where IntersectionObserver is
  missing). `usePrefersReducedMotion` shares one
  `matchMedia` listener and one MutationObserver for the whole page.
- Prefetch: the city chapter's `/books` link and the footer's links to
  auth-gated routes (`AUTH_GATED_NAV_ROUTES`, `gatedRoutePrefetchProps`) do
  not prefetch for a visitor not known to be logged in: an anonymous
  prefetch follows the login redirect and trips CSP. The city link reads the
  login state (`useAuthStatus`), so a logged-in visitor keeps the prefetch;
  the footer cannot, so it never prefetches those routes.
- Input kind: a click or tap on a link marks the input `other` (a Next hash
  link jumps with `history.pushState`, which fires no `hashchange`). The HUD
  shows the smoothing actually applied: 0 on a snap (reduced motion, a
  segment change, a restart).
- Gate: `e2e/film-layers.spec.ts` (`RUN_AUDIT=1`, in both `test:film`
  scripts) checks the touch nav, the absence of resting layers, at most 64
  `getBoundingClientRect` calls in a 3 s scroll through two chapters, the
  Hall's style writes, the reduced-motion listener count, the canvas under
  the body and the smoothing per input. The `/books` prefetch check is tagged
  `@prod` and runs in the E2E_MODE=prod job (`next build` + `next start`, the
  only build that prefetches); it also asserts that public links are being
  prefetched, so an empty `/books` list means something.
- Variants and tiers (`reel-context.tsx`, `timeline.ts`, `types.ts`). A film
  has its landscape variant (`<name>`, 1920×1080, the film's `v`) and a list
  of **band tiers** for portrait screens:

  | Tier | Folder | File size | Decoded | Drawn on |
  |---|---|---|---|---|
  | b900 | `<name>-b900` | 900×810 | 2.9 MB | phones (canvas backing ≤ 900 px wide) |
  | b1080 | `<name>-b1080` | 1080×972 | 4.2 MB | tablets, landscape phones (wider) |

  A band tier holds only the picture band of the old full portrait frame (no
  bars). Its manifest (and `films.<name>.bands.<tier>` in book.timeline.json)
  records the **virtual frame** it sits in, `{w:1080,h:1920}`, and the
  **band** rectangle in that frame, `{x:0,y:474,w:1080,h:972}` (the rows the
  picture fills at `--portrait-zoom 1.6`). The hero's early frames (before its
  ramp ends at frame 200) have bars INSIDE the band box, encoded in #06070A.
  Each tier has its own content version `v`, separate from the landscape
  `v`; landscape frame URLs did not change.
  - **Drawing.** `variantPlacement` (scrub.ts) places the virtual 1080×1920
    frame exactly as `framePlacement` placed the full portrait frame (cover-fit
    to the canvas, breath zoom around 0.5 / 0.45, stage shift) and draws the
    tier's image into the band's rectangle inside it, for frames, posters and
    the dissolve underlay alike. Every picture pixel lands where the full frame
    put it (to within resampling); the rest of the canvas is the clear colour.
    A tall phone draws the 900 tier about 5 % upscaled (a 780 px canvas cover-
    fits the virtual frame to ~949 px): accepted. Landscape drawing is
    unchanged (`variantPlacement` = `framePlacement` without a band).
  - **Pick rule** (`pickVariant`, pure, `reel-context.test.ts`). Orientation
    as before (`PORTRAIT_QUERY`: `< 64rem` or portrait orientation → portrait).
    Within portrait, by canvas backing width
    `min(innerWidth × min(devicePixelRatio, 2), 1920)`: the narrowest tier at
    least that wide (≤ 900 → b900, wider → b1080), else the widest. No band
    tiers → landscape. Width only, so an address bar showing or hiding never
    changes the pick. `FilmBackdrop` reads the view synchronously in the first
    client render (a ref), so a phone never requests a frame or poster of
    another variant; the rendered state starts as the server's landscape view
    (no hydration mismatch) and is replaced only when a film's pick changes
    (`viewKey`: rotation, a window resized across 900 backing px), which
    refreshes the caches and the scrub loop exactly as an orientation flip did.
  - The legacy `<name>-p` folders (1080×1920 with baked bars) are no longer
    referenced at runtime; they stay on disk and in the bucket for one release
    and are the reference of `npm run film:parity`.

## Render spec

The reel is **Memory Palace** — full shot list, keyframes, Blender setup and
Higgsfield prompts per shot: `docs/MEMORY_PALACE_SHOTLIST.md`. Films are
`palace-00 … palace-06` (1640 frames). Keys live in `book.timeline.json`.

Continuity: last frame of film N must match first frame of film N+1 (same
camera, same pose) — dissolve only hides a ~14-frame mismatch.

## Generate with Higgsfield from the CLI

The Higgsfield MCP server (`https://mcp.higgsfield.ai/mcp`) exposes ~190 tools,
seven of which have `anyOf`/`oneOf`/`allOf` at the top level of their input
schema — Anthropic models reject the whole tool list with
`tools.N.custom.input_schema: input_schema does not support oneOf, allOf, or anyOf at the top level`.
Keep the server **disabled** in Cline and drive it with these scripts instead
(they reuse the OAuth token Cline stored after you logged in):

```bash
node scripts/film/hf.mjs tools                               # list tools
node scripts/film/hf.mjs balance '{}'
node scripts/film/hf.mjs generate_video '{"params":{...,"get_cost":true}}'   # preflight
node scripts/film/hf-fetch.mjs <outDir> name=<jobId> ...     # poll + download + thumbs
```

P00 recipe (what produced `palace-00` v4, the pop-up book): one new
`nano_banana_pro` start still (`hf-stills.mjs P00_BOOK_START --n 2`, pick by
eye) + the existing P00_END seam still as `end_image` → `hf-video.mjs P00_BOOK
<start> 8a6f1fa3-77b6-428d-8251-6dd97829c97c --duration 10` (flux_3_video,
2k, 100 credits) → `hf-fetch.mjs` → cut scan → `blend-tail.mjs` across the
model's hard cut into the end image → `encode.mjs <dir> palace-00 --portrait
--portrait-ramp 150,200`. If the server replies with a preset "notice", the
script retries with `declined_preset_id`. Auth: `hf.mjs` refreshes the stored
OAuth token on a 401 (Cline keeps the server disabled, so it never does).

## Encode + ship

```bash
# from a PNG sequence
node scripts/film/encode.mjs ~/renders/P00 palace-00 --portrait --quality 78
# PHONES: never the blind 9:16 centre crop — that shows 32 % of a 16:9 scene.
# Every portrait variant is framed with --portrait-zoom 1.6 (frame scaled to
# 1.6× contain, letterboxed on the frame's darkest corner colour: ~62 % of the
# scene width visible, band ≈ 51 % of the screen). One zoom for ALL films so
# the seams keep one scale. --portrait-only re-frames from the film's own
# landscape frames and bumps the film's version (both variants refetch).
# Bars are the page background (--portrait-bars '#06070A'), not the frame's
# darkest corner: the Hall's corners are warm paper and gave brown bars that
# shifted frame to frame. Same flag on every film.
node scripts/film/encode.mjs public/films/palace-01 palace-01 --portrait --portrait-only --portrait-zoom 1.6 --portrait-bars '#06070A'
# hero: contain (z = 1) until f150, ramping to the same zoom 1.6 by f200
node scripts/film/encode.mjs ~/renders/p00v4_blend palace-00 --portrait --portrait-only --portrait-ramp 150,200 --portrait-zoom 1.6 --portrait-bars '#06070A'
# from a Higgsfield mp4 (needs ffmpeg: brew install ffmpeg)
node scripts/film/encode.mjs ~/renders/P03.mp4 palace-03 --from-video --fps 24 --portrait
# counts are synced into book.timeline.json automatically; then edit the keys.

# PORTRAIT BAND TIERS (what phones and tablets draw since Phase 3). --bands
# builds the same 1080×1920 composition the -p path builds (same code, same
# rounding), cuts the band (rows 474–1445 at zoom 1.6) into <name>-b1080 and
# scales it by 5/6 into <name>-b900. It never writes the landscape or -p
# folders and never changes the landscape manifest or its version; the tiers
# get their own version, synced into book.timeline.json (films.<name>.bands).
# Same sources and flags as the -p recipe above; effort 6 only costs encode
# time (~17 s per 170 frames on an M-series Mac).
for n in 01 02 03 04 05 06; do
  node scripts/film/encode.mjs public/films/palace-$n palace-$n --bands --portrait-zoom 1.6 --portrait-bars '#06070A' --quality 78 --effort 6
done
node scripts/film/encode.mjs ~/renders/p00v4_blend palace-00 --bands --portrait-ramp 150,200 --portrait-zoom 1.6 --portrait-bars '#06070A' --quality 78 --effort 6
npm run film:parity     # dev server on :3000; needs the legacy -p folders as the reference
# EVERY new render of a film (landscape or -p encode above) must be followed
# by the --bands line for that film: phones and tablets draw only the tiers,
# and a tier cut from the old render keeps its URL and version, so it would
# go on showing the old render. The encoder warns when it encodes a film that
# has tier folders without --bands, and the timeline sync (any encode, or
# `node scripts/film/encode.mjs --sync-timeline`) prints STALE BAND TIER and
# exits 1 when a tier's frame count differs from the film's.

# dev: serve from public/films (gitignored)
npm run dev → http://localhost:3000/?hud=1

# prod: the frames live in the frontend stack's static-assets bucket under
# `_assets/films/` and CloudFront serves them SAME-ORIGIN at /films/* (the
# `films/*` behavior in infra/lib/chapterflow-frontend-stack.ts, cache key
# includes ?v). Nothing to configure in the app: NEXT_PUBLIC_FILM_BASE stays at
# its default (/films). Upload after every encode, BEFORE deploying the
# book.timeline.json the encode synced (the bucket name is the StaticAssets
# resource of the ChapterFlowFrontend stack). Every encode rewrites pack.bin
# for each landscape and band-tier folder it writes and the timeline records
# the new pack's size and version: upload pack.bin with the frames, or the
# deployed page fetches the OLD pack under the new ?v=, finds it disagrees
# with the timeline and loads that film frame by frame (one request per
# frame, nothing alerts anyone):
npm run film:pack -- --verify   # first: every pack matches its folder (exit 1 otherwise)
B=s3://$(aws cloudformation describe-stack-resources --stack-name ChapterFlowFrontend \
    --query 'StackResources[?LogicalResourceId==`StaticAssetsDDEE9873`].PhysicalResourceId' --output text)/_assets/films
aws s3 sync public/films "$B" --exclude '*' --include '*.webp' --content-type image/webp \
    --cache-control 'public,max-age=31536000,immutable'
aws s3 sync public/films "$B" --exclude '*' --include '*/pack.bin' --content-type application/octet-stream \
    --cache-control 'public,max-age=31536000,immutable'
aws s3 sync public/films "$B" --exclude '*' --include '*.json' --content-type application/json \
    --cache-control 'public,max-age=300'
# (`--content-type` is explicit because the CLI's mime map is not guaranteed to
# know .webp.) Last done 2026-10-28: 3,414 objects / 197 MB. The OpenNext
# BucketDeployments are prune:false, so app deploys never remove them.
#
# Band tiers (Phase 3): upload the 14 tier folders BEFORE deploying the code
# that draws them (the deployed page requests <name>-b900 / <name>-b1080 the
# moment it ships; until then nothing asks for them). Same flags as above,
# restricted to the tier folders (sync without --delete never touches the
# landscape or -p objects):
aws s3 sync public/films "$B" --exclude '*' --include 'palace-0?-b900/*.webp' --include 'palace-0?-b1080/*.webp' \
    --content-type image/webp --cache-control 'public,max-age=31536000,immutable'
aws s3 sync public/films "$B" --exclude '*' --include 'palace-0?-b900/pack.bin' --include 'palace-0?-b1080/pack.bin' \
    --content-type application/octet-stream --cache-control 'public,max-age=31536000,immutable'
aws s3 sync public/films "$B" --exclude '*' --include 'palace-0?-b900/*.json' --include 'palace-0?-b1080/*.json' \
    --content-type application/json --cache-control 'public,max-age=300'
# (since Phase 4 a --bands encode rewrites the tiers' pack.bin too: the
# pack.bin line is part of every tier upload.)
# Tier URLs are new paths with their own ?v=, so no CloudFront invalidation is
# needed for them. The old <name>-p objects stay in the bucket for one release
# (pages already open in a browser still ask for them); delete them only in
# the release after this one.

# PACKS (Phase 4): one pack.bin per landscape and band-tier folder, built
# from the frame files byte for byte; the manifests and book.timeline.json
# record them (encode.mjs and placeholder.mjs build packs for what they write).
npm run film:pack                      # all 21 folders, then syncs the timeline
npm run film:pack -- palace-03-b900    # one folder
npm run film:pack -- --verify          # every slice equals its file; exit 1 otherwise
node scripts/film/encode.mjs --sync-timeline   # STALE PACK + exit 1 when a pack no longer matches its folder
#   (a folder with no pack.bin whose film the timeline records a pack for:
#   the entry is kept unverified and reported, exit 1, never silently dropped)
# The first time (this release): upload the packs BEFORE deploying the code
# that reads them (until then a deployed page would get 404 and load frame
# by frame). Only the pack files and the manifest.json files that changed;
# the frames stay as they are and remain the fallback for one release. After
# that, every encode uploads its pack.bin with its frames (the "Upload after
# every encode" commands above include it):
aws s3 sync public/films "$B" --exclude '*' --include 'palace-0?/pack.bin' --include 'palace-0?-b900/pack.bin' --include 'palace-0?-b1080/pack.bin' \
    --content-type application/octet-stream --cache-control 'public,max-age=31536000,immutable'
aws s3 sync public/films "$B" --exclude '*' --include 'palace-0?/manifest.json' --include 'palace-0?-b900/manifest.json' --include 'palace-0?-b1080/manifest.json' \
    --content-type application/json --cache-control 'public,max-age=300'
# The pack URL carries ?v=<pack hash>, so no CloudFront invalidation is
# needed. The object key itself is not versioned: a page still open on an
# older version that misses the cache gets the new bytes, sees that their
# length or header disagrees with its timeline and loads frame by frame.
# The production CDN answers Range on /films/* with 206 (checked before Phase 4).
# Remove the per-frame objects only in a later release, after the owner
# confirms (and lower the /films/ WAF limit then, see the plan).

# optional: an external CDN instead — then set the origin at BUILD time and
# lib/csp.ts adds it to img-src + connect-src (the worker fetches packs with
# fetch(), connect-src; lib/csp.ts already allows worker-src 'self' blob:)
NEXT_PUBLIC_FILM_BASE=https://<cdn>/films
```

Budget (measured 2026-11-11, frame files only, 1,693 frames per variant):
landscape 108.5 MB, b1080 50.6 MB, b900 38.3 MB (the legacy -p folders were
53.7 MB). A visitor scrubbing the whole reel pulls the variant they are on,
each frame once (see the wanted set under Runtime): desktop ~108 MB, a phone
~38 MB. First paint needs only the poster.

Packs (2026-11-11; a pack = its frames + a 2–3.4 KB header; skeleton ≈ 25 %):

| Film | landscape | b1080 | b900 |
|---|---|---|---|
| palace-00 | 17.11 MB | 8.60 MB | 6.36 MB |
| palace-01 | 11.19 MB | 5.78 MB | 4.49 MB |
| palace-02 | 12.81 MB | 5.73 MB | 4.32 MB |
| palace-03 | 29.06 MB | 11.56 MB | 8.26 MB |
| palace-04 | 10.12 MB | 5.49 MB | 4.34 MB |
| palace-05 | 18.49 MB | 8.56 MB | 6.65 MB |
| palace-06 | 9.73 MB | 4.91 MB | 3.84 MB |
| all seven | 108.5 MB | 50.6 MB | 38.3 MB |

Before the first scroll a desktop reads 7.12 MB of palace-00 (skeleton plus
the opening frames, one request) and a phone 2.45 MB of palace-00-b900.

## Production status

**Done.** `app/page.tsx` renders `<BookReelLanding body={…}/>` — the film is
the landing. `RecallHeroSplit / RecallHowItWorks / RecallWhyItWorks /
RecallLibrary / RecallAmbient` are no longer mounted (left in the tree for
reference; delete when convenient). `/film` preview route removed; `?hud=1`
on `/` shows the frame counter (read client-side, page stays static).

Cache-busting: every encode writes a content version `v` into each film's
`manifest.json`; `encode.mjs --sync-timeline` (or `stamp-version.mjs`) copies
it into `book.timeline.json`, and every frame/poster URL carries `?v=…`. A
re-render can never be served from a stale browser cache. `FilmBackdrop` keys
its in-memory caches by `name@v` for the same reason.

Cross-origin CDN (not the default — production serves `/films/*` same-origin
from the assets bucket, see above): `lib/csp.ts` adds the origin of
`NEXT_PUBLIC_FILM_BASE` (when it is an absolute URL) to CSP `img-src` and
`connect-src` — the frame cache fetches with `fetch()` + `createImageBitmap`
and falls back to `<img>`, so both directives are needed. Set the variable at
BUILD time (it is inlined into the client bundle and read on the server for
the headers).

Letterboxed stills: a video model seeded from a letterboxed start/end image
bakes the black bars into every frame it generates toward that image.
`scripts/film/deletterbox.mjs <mp4|dir> <outDir>` detects the bars per frame,
crops the inner picture to the frame's aspect and rescales it; run it on the
raw clip BEFORE `blend-tail.mjs` / `splice-clip.mjs` so blends never ramp
toward a barred frame.

## Smoothness tooling

- `node scripts/film/smoothness.mjs [palace-xx …]` — footage: per-frame pixel
  delta, spikes (> 2.5× local median) and the seam into the next film. Any
  spike is a model hard cut: dissolve it with `blend-tail.mjs` (`--head` when
  the frames before the cut are a seam anchor) and re-encode.
- `BASE=http://127.0.0.1:3000 HEADED=1 node scripts/film/scrub-smoothness.mjs`
  — runtime: wheel-scrubs the live page at three speeds on desktop + phone and
  reports rAF fps, stalls (with the frame they hit), long tasks, per-film frame
  coverage, biggest draw jump and holds. Use `HEADED=1` for real numbers:
  headless Chromium has no GPU and its software raster of a full-viewport
  canvas shows stalls real Chrome never does. Reference (prod bundle, M-series):
  58–60 fps, 0 long tasks, 0 holds, worst stall ≤ 70 ms.
- `npm run film:quality` (`scripts/film/scrub-quality.mjs`; `next start` on
  :3000 for real numbers, or the dev server) — the loading gate: one
  time-based scroll down the whole reel per profile, with three 1.5 s stops
  (at 30 %, 55 %, 80 %): `phone-webkit` = iPhone 14 at 600 px/s,
  `phone-chromium-slow` = Pixel 7, CPU 4×, Fast 4G, no `deviceMemory`, at
  600 px/s, `desktop-chromium` = 1440×900 at 900 px/s, all in pack mode,
  and `desktop-chromium-frames` = the same with `?pack=0`; `ONLY=`,
  `SPEED=`, `STRICT=1`, `OUT=<json>`. Prints every film request (packs,
  frames, posters; the worker's requests included: Playwright reports them
  in Chromium and WebKit, and where the network count is below
  `packRequests` the counter is used and the line says so) and their bytes,
  requests per variant folder, the counters, where decodes ran and their
  mean, the exact-draw share, the mean fallback distance over all draws,
  the time to the exact frame after each stop (`drawWant` = `drawAt` and no
  longer changing; on an older build the HUD frame and the paint counters),
  rAF fps and the longest frame, and for the slow profile the peak pack
  throughput over 2 s. Chromium applies CDP network emulation per target
  and a dedicated worker is its own target: measured 2026-11-11, the page's
  Fast 4G emulation does reach the worker's pack requests (1.01 MB/s); the
  script fails the run if the peak is above 1.5× Fast 4G. Hard failures in
  pack mode: any per-frame request, more than 30 film requests, any
  repeated pack byte, any refetch, fewer than 97 % exact draws on
  phone-webkit and desktop; with `?pack=0`: any refetch or more than 4
  fetches in flight. Soft targets (`TARGET MET` / `TARGET MISSED`, failing
  only with `STRICT=1`): slow phone mean fallback distance ≤ 4 frames and
  the exact frame ≤ 1 s after each stop; phone-webkit longest frame
  ≤ 100 ms. (The pass stops at the last segment's bottom; WebKit rounds
  scrollY down, so there the reel can sit 1 px short of its end and the
  loop keeps breathing instead of stopping.) Measured 2026-11-11 on a local
  production build (M-series Mac):

  | Profile | Film requests | Bytes | Exact draws | Mean distance | Exact after each stop | fps / longest | Decodes |
  |---|---|---|---|---|---|---|---|
  | phone-webkit (pack) | 15 (8 pack, 7 poster) | 38.4 MB | 99.9 % | 0.00 | 222 / 250 / 252 ms | 60 / 44 ms | worker, 8.4 ms |
  | phone-chromium-slow (pack) | 17 (10 pack, 7 poster) | 34.7 MB | 87.3 % | 0.25 | 216 / 567 / 232 ms | 60 / 34 ms | worker, 3.4 ms |
  | desktop-chromium (pack) | 15 (8 pack, 7 poster) | 109.0 MB | 99.9 % | 0.00 | 233 / 251 / 250 ms | 60 / 19 ms | worker, 11.5 ms |
  | desktop-chromium `?pack=0` | 1,700 (1,693 frame) | 109.0 MB | 99.9 % | 0.00 | 233 / 250 / 267 ms | 60 / 19 ms | page, 12.5 ms |
  | phone-chromium-slow, Phase 3 build | 707 (700 frame) | 15.3 MB | 9.0 % | 10.34 | 317 / 333 / 265 ms | 60 / 35 ms | page |

  About 230–250 ms of every "exact after stop" is the scroll glide itself
  (the 90 ms smoothing), not loading.
  It refuses a non-local `BASE` unless `ALLOW_REMOTE=1` AND `MAX_REQUESTS=n`
  are set (the live site rate-limits per IP).
- `node scripts/film/seam-geometry.mjs` (dev server on :3000, `BASE=` to
  override): steps the scroll across the hero→hall and tower→city boundaries
  and prints the HUD frame per 15 px, so a freeze (same frame for hundreds of
  px) or a cut (frame jump) at a seam is visible as numbers. This is what
  found the one-viewport freeze that the lead-in mapping above removed.


## Tests

- `components/film/scrub.test.ts` — pure math + pin opacity + timeline invariants.
- `components/film/frame-cache.test.ts` — the scheduler under node with fake
  fetch/decode: wanted set within budget on forward, backward and jumping
  scrubs; 0 refetches; held bytes re-decoded; wanted frames never evicted;
  the dissolve pin; fetch/decode limits; queued vs started; accounting back
  to zero after `dispose()`. Pack mode with a fake PackSource: frames not
  held take no slot and decode on arrival; coarse-first order; the same
  guarantees on forward, backward and jumping scrubs; every bitmap closed
  once (late, unwanted, disposed); fallback keeps decoded frames and loads
  the rest per frame; draw gauges.
- `components/film/pack-build.test.ts` — the pack tool: skeleton-first
  order, header and slices, determinism, `--verify` catching a changed or
  added frame, the timeline sync keeping a version and dropping a stale pack.
- `components/film/pack-format.test.ts` — the TS reader against the mjs
  writer; the cutter fed the same pack one byte at a time, at every slot
  edge, inside the header, at the skeleton boundary and at 40 random chunk
  sets; stop-and-resume at the first byte not held; repeated bytes counted;
  a header that disagrees with the timeline.
- `components/film/pack-plan.test.ts` — the planner driving a simulated
  network: a steady forward pass over two films, a network slower than the
  playhead (no re-aim while moving, a stop re-aims, the skipped frames are
  filled), entering a film backwards, a jump into the middle, the pre-scroll
  stop and its continuation, constrained mode, eviction followed by a
  return, a 200 answer to a Range request, a hidden document, the dissolve
  pin on a constrained connection (after an anchor jump, moving or settled;
  scrolling up; a forward pass).
- `components/film/pack-net.test.ts` — the controller against a fake server
  (real Response / ReadableStream): chunked reads, 404, retries then
  failure, a dropped connection resumed, length and header mismatches, 200
  to a Range request, the pre-scroll stop, the byte cap, hidden, re-aim on
  a jump and on a stop, the direction hysteresis, a steady forward pass, a
  wobble across a cut with pauses of 0, 300 and 1,000 ms (coming down and
  coming up: no request after the first cycle, only the two films at the
  cut), a stop just past a cut, and the dissolve pin after an anchor jump on
  a constrained connection.
- `components/film/pack-client.test.ts` — the page side with a fake worker:
  lazy start, the scrolled flag, the held-frame mirror, per-variant and
  whole fallback, a late bitmap closed.
- `e2e/smoke.spec.ts` (CI, dev and `@prod`): on the landing page the film
  worker starts, a missing pack (404) falls back to frames, the worker stays
  up, and the console shows no CSP violation and no uncaught exception.
- `e2e/film-reel.spec.ts` — scrubs, dissolve, chrome flip, canvas paints,
  reduced-motion quantisation. Skips if `public/films` is empty. Runs in CI.
- `npm run test:film` — **the QA audit** (opt-in, slow, needs frames):
  - `film-audit.spec.ts` scrubs 4 viewports × 17 steps × every segment and
    asserts numerically: no pin clipped, no pin overlap, no pin under the nav,
    composited background under every pin (text hidden, screenshot sampled)
    has mean lum ≤ 110 / p90 ≤ 150, canvas always painting, every pin seen.
  - `film-perf.spec.ts` wheel-scrubs the whole reel: frames monotonic, every
    handoff lands in the dissolve window, rAF ≥ 45 fps (chromium), chrome →
    body at the end, anchor links land exactly on their segment.
  - `film-truth.spec.ts` also runs on a 390 × 844 DPR 2 phone (reduced
    motion: no breath, exact frames): at every stop the canvas must equal the
    b900 tier's own frame file drawn into its band inside the cover-fit
    virtual frame (mean |Δ| ≤ 0.5), be closer to it than to a frame 60 away,
    and be exactly the clear colour outside the band. It does not need the
    legacy -p frames.
  - `film-quality.spec.ts` scrolls steadily over the first two films in pack
    mode and asserts from the network and `__filmStats` (not the HUD): no
    per-frame request, ≤ 30 film requests, no pack byte read twice; and again
    with `?pack=0`: 0 refetches, ≤ 4 fetches in flight, no frame requested
    twice. Before the first scroll: after load and 3 s still, exactly one
    pack request (palace-00) and film bytes ≤ its skeleton + 48 opening
    frames + the posters + 300 KB. On a 390 × 844 phone
    viewport: `canvasResizes` is 1 after a pass over the first film; 2 s at
    rest add ≤ 24 worked ticks (breath repaints only: the hero's 0.012
    breath changes ≤ ~9 times a second; measured 16–18); at the pricing
    section the loop stops (no worked or skipped ticks); a `scrollTo` back
    into the fourth film shows the frame the scroll position demands three
    animation frames later; widening the window to 430 px, the first
    animation frame after the `resize` already has a backing store of the
    new box, and that is the second (and only other) allocation; and every
    film request of that phone is a `palace-*-b900` pack or poster.
- `npm run film:parity` (`scripts/film/tier-parity.mjs`; dev server on :3000,
  local only like `film:quality`) — the tier proof: on a 390 × 844 phone (b900)
  and an 820 × 1180 tablet (b1080), both DPR 2, reduced motion, 36 positions
  over all seven films (the hero before, inside and after its ramp; no
  dissolve frames), it compares the canvas with a reference drawn in the page
  from the LEGACY `<name>-p` file of the same frame with the legacy math. It
  prints the mean |Δ| per channel, the band's top and bottom edge row in
  both images and the content shift of each half of the band. Reference
  edges: the rows the legacy band (rows 474–1445 of the -p frame) covers
  under the legacy placement (row centre inside, as Chrome draws). Live
  edges: measured in the canvas, as the span of rows holding any pixel off
  the exact clear colour (outside the band the canvas is the clear fill), so
  they are the drawn band rectangle whatever the picture shows at its edge,
  dark films and the hero's ramp bars included. Shift: the vertical offset
  (−3…3 rows) that best matches live to reference in each half of the band.
  It fails on an edge more than 1 px apart, a shift of more than 1 row, a
  mean above 4 (phone) / 2 (tablet), or any cache of another variant. Every
  edge and shift is gated; none is exempt, and an edge row that decoded to
  the exact clear colour would read inward and fail (fails closed). Exits 0
  with a message when the -p folders are absent. 2026-11-11: all 144 edges
  equal (phone 417/1270, tablet 442/1917), all shifts 0, means 0.64–1.40; a
  band drawn 2 px low (injected) failed all 36 phone positions.
- `npm run test:film:safari` — same on WebKit (`npx playwright install webkit`
  first). Headless WebKit rasterises in software and caps ~25 fps on any
  full-viewport image swap; the fps gate is 20 there.

Things the audit caught and that are now fixed: global
`html{scroll-behavior:smooth}` + `scroll-padding-top:88px` made every anchor
jump animate through the scrub and land 184px short → overridden under
`html[data-reel-chrome]`. Glass pills on one-line beats let the Vault's pulse
bloom through → near-solid. Column scrims now run edge-to-edge on the copy
side. Canvas backing store capped at source width (1920) — a 2× Retina canvas
only upsampled. Prefetch + breath repaint throttled to frame changes. On main's taller nav the
hero label sat 3 px inside the nav margin at 1280×720 → stage top padding
floor 6rem. Nav `<Link>` anchors never landed after a scrub → cancellable
prefetch (above) + the perf spec polls for the landing.
