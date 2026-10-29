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
  types.ts            FilmManifest / FilmVariant / SegmentRegistration
  scrub.ts            pure math: pickActive, frameAt, quantise, coverRect, breathAt
  frame-cache.ts      ImageBitmap LRU (160 frames), directional prefetch, nearest()
  reel-context.tsx    ReelContext + orientation media query
  use-scrub-loop.ts   the ONE rAF loop: rects → active segment → frame → canvas
  FilmBackdrop.tsx    fixed <canvas>, registers segments, owns caches
  FilmSegment.tsx     N×100svh section + sticky 100svh stage; progress store
  FramePin.tsx        copy pinned to [from,to] frames (opacity/transform only)
  timeline.ts         key("book-01","sheet_split") → frame; manifest(name)
  book.timeline.json  named keyframes + counts per film (SOURCE OF TRUTH)
  book-reel.ts        ordered FilmManifest[] for the landing
  chapters/*.tsx      HeroChapter, SummaryExamples, Quiz, Review, Library, Close
  BookReelLanding.tsx composition
scripts/film/
  encode.mjs          Blender frames → public/films/<name>/f_0001.webp + poster + manifest
  placeholder.mjs     synthetic frames from timeline (dev only)
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
  and its copy rides in with its stage (`pickActive` in `scrub.ts`).
- Dissolve: first `dissolveIn` frames cross-fade over previous film's last
  frame (so it happens during the slide-in, not at the pin).
- Prefetch is directional (24 ahead / 10 behind) and CANCELLABLE: moving the
  window aborts speculative fetches outside it, so a fast scrub never piles
  up a reel's worth of requests in front of the app's own navigations.
- Decoded frames live under ONE byte budget shared by every film's cache
  (`FrameBudget`, LRU across caches): 160 MB on phones/tablets, 384 MB on
  desktop, `deviceMemory`×48 MB where Chrome reports it. Without it a single
  portrait film could hold 1.3 GB of bitmaps and mobile Safari killed the tab.
- Breath: `±amp` slow sinusoidal zoom while held (off under reduced motion).
- Reduced motion (OS or in-app toggle): progress quantised to `reducedSteps` (5).
- `<html data-reel-chrome="film|body" data-reel-section="…">` + `cf-reel-chrome`
  CustomEvent for nav/scrim restyling.
- FramePin: SSR renders copy VISIBLE; JS arms + scrubs after mount (crawler-safe).
  A pin with `from=0` is fully visible at frame 0 (LCP).
- Keyboard focus inside a stage snaps the segment to the top.
- Portrait variant (`<name>-p`) picked at `<64rem` or portrait orientation.

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
node scripts/film/encode.mjs public/films/palace-01 palace-01 --portrait --portrait-only --portrait-zoom 1.6
# hero: contain (z = 1) until f150, ramping to the same zoom 1.6 by f200
node scripts/film/encode.mjs ~/renders/p00v4_blend palace-00 --portrait --portrait-only --portrait-ramp 150,200 --portrait-zoom 1.6
# from a Higgsfield mp4 (needs ffmpeg: brew install ffmpeg)
node scripts/film/encode.mjs ~/renders/P03.mp4 palace-03 --from-video --fps 24 --portrait
# counts are synced into book.timeline.json automatically; then edit the keys.

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

# optional: an external CDN instead — then set the origin at BUILD time and
# lib/csp.ts adds it to img-src + connect-src
NEXT_PUBLIC_FILM_BASE=https://<cdn>/films
```

Budget: ~1360 frames × 2 variants × ~45 KB ≈ 120 MB total on CDN; a visitor
scrubbing the whole page pulls ~30–60 MB of the variant they're on. Prefetch is
directional (24 ahead / 10 behind) so first paint needs only the poster.

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
- `node scripts/film/seam-geometry.mjs` (dev server on :3000, `BASE=` to
  override): steps the scroll across the hero→hall and tower→city boundaries
  and prints the HUD frame per 15 px, so a freeze (same frame for hundreds of
  px) or a cut (frame jump) at a seam is visible as numbers. This is what
  found the one-viewport freeze that the lead-in mapping above removed.


## Tests

- `components/film/scrub.test.ts` — pure math + pin opacity + timeline invariants.
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
