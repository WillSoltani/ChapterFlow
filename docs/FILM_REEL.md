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
  frame-cache.ts      FrameBudget (one wanted set, byte budget, load limits) + FrameCache, nearest()
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
  placeholder.mjs     synthetic frames from timeline (dev only): landscape + band tiers
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
  - Counters, always on (production too): `window.__filmStats` — `fetches`,
    `refetches` (a network fetch for bytes this page already fetched),
    `decodes`, `redecodes`, `exactDraws`, `fallbackDraws`,
    `fallbackDistanceSum` (|drawn − wanted| summed over fallback draws; the
    poster counts as frame 0), `evictions`, `maxFetchInFlight`,
    `maxDecodeInFlight`, plus the live `fetchInFlight` / `decodeInFlight`;
    and from the scrub loop `canvasResizes` (backing-store reallocations: 1
    per visit unless the window's width, orientation, zoom or DPR changes),
    `geometryMeasures`, `ticksWorked` and `ticksSkipped` (not in the HUD).
    `?hud=1` shows a second line: `exact 97% · refetch 0 · dist 0.4 · fetch
    3/4` (dist = mean distance over ALL draws).
- Breath: `±amp` slow sinusoidal zoom while held (off under reduced motion).
- Reduced motion (OS or in-app toggle): progress quantised to `reducedSteps` (5).
- `<html data-reel-chrome="film|body" data-reel-section="…">` + `cf-reel-chrome`
  CustomEvent for nav/scrim restyling.
- FramePin: SSR renders copy VISIBLE; JS arms + scrubs after mount (crawler-safe).
  A pin with `from=0` is fully visible at frame 0 (LCP).
- Keyboard focus inside a stage snaps the segment to the top.
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

# dev: serve from public/films (gitignored)
npm run dev → http://localhost:3000/?hud=1

# prod: the frames live in the frontend stack's static-assets bucket under
# `_assets/films/` and CloudFront serves them SAME-ORIGIN at /films/* (the
# `films/*` behavior in infra/lib/chapterflow-frontend-stack.ts, cache key
# includes ?v). Nothing to configure in the app: NEXT_PUBLIC_FILM_BASE stays at
# its default (/films). Upload after every encode (the bucket name is the
# StaticAssets resource of the ChapterFlowFrontend stack):
B=s3://$(aws cloudformation describe-stack-resources --stack-name ChapterFlowFrontend \
    --query 'StackResources[?LogicalResourceId==`StaticAssetsDDEE9873`].PhysicalResourceId' --output text)/_assets/films
aws s3 sync public/films "$B" --exclude '*' --include '*.webp' --content-type image/webp \
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
aws s3 sync public/films "$B" --exclude '*' --include 'palace-0?-b900/*.json' --include 'palace-0?-b1080/*.json' \
    --content-type application/json --cache-control 'public,max-age=300'
# Tier URLs are new paths with their own ?v=, so no CloudFront invalidation is
# needed for them. The old <name>-p objects stay in the bucket for one release
# (pages already open in a browser still ask for them); delete them only in
# the release after this one.

# optional: an external CDN instead — then set the origin at BUILD time and
# lib/csp.ts adds it to img-src + connect-src
NEXT_PUBLIC_FILM_BASE=https://<cdn>/films
```

Budget (measured 2026-11-11, frame files only, 1,693 frames per variant):
landscape 108.5 MB, b1080 50.6 MB, b900 38.3 MB (the legacy -p folders were
53.7 MB). A visitor scrubbing the whole reel pulls the variant they are on,
each frame once (see the wanted set under Runtime): desktop ~108 MB, a phone
~38 MB. First paint needs only the poster.

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
- `npm run film:quality` (`scripts/film/scrub-quality.mjs`; dev server or
  `next start` on :3000) — the loading gate: one time-based scroll down the
  whole reel per profile (`phone-webkit` = iPhone 14 at 600 px/s,
  `phone-chromium-slow` = Pixel 7, CPU 4×, Fast 4G, no `deviceMemory`, at
  600 px/s, `desktop-chromium` = 1440×900 at 900 px/s; `ONLY=`, `SPEED=`
  override). Prints frame requests on the network vs distinct frames, the
  frame requests per variant folder (which tier the profile drew), the
  `__filmStats` counters, the exact-draw share and the mean fallback
  distance, and the scrub loop's counters plus its worked / skipped ticks
  over the next 2 s at rest; exits non-zero on any refetch or more than 4
  fetches in flight. (The pass stops at the last segment's bottom; WebKit
  rounds scrollY down, so there the reel can sit 1 px short of its end and
  the loop keeps breathing instead of stopping.)
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
  to zero after `dispose()`.
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
  - `film-quality.spec.ts` scrolls steadily over the first two films and
    asserts from the network and `__filmStats` (not the HUD): 0 refetches,
    ≤ 4 fetches in flight, no frame requested twice. On a 390 × 844 phone
    viewport: `canvasResizes` is 1 after a pass over the first film; 2 s at
    rest add ≤ 24 worked ticks (breath repaints only: the hero's 0.012
    breath changes ≤ ~9 times a second; measured 16–18); at the pricing
    section the loop stops (no worked or skipped ticks); a `scrollTo` back
    into the fourth film shows the frame the scroll position demands three
    animation frames later; widening the window to 430 px, the first
    animation frame after the `resize` already has a backing store of the
    new box, and that is the second (and only other) allocation; and every
    frame and poster request of that phone is for a `palace-*-b900` folder.
- `npm run film:parity` (`scripts/film/tier-parity.mjs`; dev server on :3000,
  local only like `film:quality`) — the tier proof: on a 390 × 844 phone (b900)
  and an 820 × 1180 tablet (b1080), both DPR 2, reduced motion, 36 positions
  over all seven films (the hero before, inside and after its ramp; no
  dissolve frames), it compares the canvas with a reference drawn in the page
  from the LEGACY `<name>-p` file of the same frame with the legacy math. It
  prints the mean |Δ| per channel and the band's top and bottom edge row in
  both images (half-height point of the first step in from the canvas edge),
  and fails on an edge more than 1 px apart, a mean above 4 (phone) / 2
  (tablet), or any cache of another variant. Edges fainter than 10 (a dark
  picture at the band edge, the hero's soft picture bottom) are printed with
  `*` and not gated: the legacy q78 WebP smears them over 3–5 rows. Exits 0
  with a message when the -p folders are absent. 2026-11-11: every gated edge
  equal or 1 px apart; means 0.64–1.40.
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
