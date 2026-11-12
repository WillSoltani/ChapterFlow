# Film reel landing

The landing page (`/`, `app/page.tsx`) is one scroll-scrubbed film: seven
rendered clips ("Memory Palace", `palace-00` … `palace-06`, 1,693 frames)
drawn frame by frame on one fixed `<canvas>` as the page scrolls, with the
copy pinned to named moments of each clip. Request, FAQ, pricing and the
close follow as ordinary content, then the shared footer.

This file describes the film as it is: how it loads, draws, lays out, fails
and is tested, the URL switches that remain, and the commands. The footage
itself (shots, keys, prompts, render log) is in
`docs/MEMORY_PALACE_SHOTLIST.md`; the working state and open items are in
`docs/HANDOFF_MEMORY_PALACE.md`.

## Files

```
components/film/
  book.timeline.json   SOURCE OF TRUTH per film: frame count, named keys, version v,
                       band tiers (size, virtual frame, band rect, v), packs (bytes, header,
                       skeletonEnd, openingEnd, v). Written by the encode / pack scripts.
  timeline.ts          key("palace-01", "lines_lit") → frame; manifest(name), bandTiers(name)
  book-reel.ts         the ordered FilmManifest[] of the landing
  types.ts             FilmManifest / FilmVariant / BandTier / SegmentRegistration
  BookReelLanding.tsx  composition: FilmBackdrop, HUD, the seven chapters, the body
  chapters/            FoldChapter (hero) · HallChapters (Hall, Rooms, Vault) · CityChapters (Lights, City, Home)
  FilmBackdrop.tsx     the fixed canvas wrapper, the HTML poster, caches, pack client, segment registry
  use-scrub-loop.ts    the ONE rAF loop: cached geometry → active segment → frame → canvas
  FilmSegment.tsx      one chapter: pace × 100svh section, sticky 100svh stage, progress store, focus handler
  FramePin.tsx         copy pinned to a frame range (opacity / transform only)
  HallText.tsx         the Hall's wall prose (CSS 3D, decoration, aria-hidden)
  SkipFilmLink.tsx     "Skip the film"
  FilmHud.tsx          the ?hud=1 overlay
  scrub.ts             pure math: pickActive, frameAt, coverRect, framePlacement, variantPlacement,
                       stageShift, backingSize, smoothingMs, reelAnchor, pageStop, focusArrived, …
  pins.ts              pin opacity, reduced-motion stops, focus frames (pure)
  layers.ts            when a pin holds a compositor layer
  view.ts              the variant pick: PORTRAIT_QUERY, SHORT_LANDSCAPE_QUERY, quantDpr, pickVariant
  reel-context.tsx     ReelContext (re-exports view.ts)
  first-paint.ts       the hero poster: <picture> sources, exclusive preload media, band rectangle
  readable-layout.ts   the readable page (no script, or the reel never arms)
  focus-guard.ts       the element whose keyboard focus last moved the film (refocus guard)
  frame-cache.ts       FrameBudget (wanted set, byte budget, load limits, failures, recovery) + FrameCache
  pack-format.ts       pack layout: header parse, check against the timeline
  pack-store.ts        held bytes per frame slot, the incremental frame cutter
  pack-plan.ts         the network plan (pure): which ranges of which packs to read now
  pack-net.ts          Range streams, retries, byte cap, stats (the worker's core)
  film-worker.ts       the film worker: pack-net + createImageBitmap, bitmaps transferred
  film-worker-protocol.ts  page ↔ worker messages
  pack-client.ts       the page side of the worker: lazy start, held-frame mirror, fallback
  pin-registry.ts      test-only collector contexts (pins.test.tsx)
scripts/film/
  encode.mjs           renders → <name>/f_0001.webp … + poster + manifest + pack; --bands writes the tiers;
                       --sync-timeline copies counts, versions, tiers and packs into the timeline
  pack.mjs, pack-lib.mjs   build or --verify packs (npm run film:pack)
  placeholder.mjs      synthetic frames, tiers and packs from the timeline (dev and CI)
  ci-timeline-check.mjs    CI: the placeholder run changed only the timeline's pack fields
  scrub-quality.mjs    the loading gate (npm run film:quality)
  tier-parity.mjs      the band tiers against the legacy -p frames (npm run film:parity)
  layout-sheets.mjs, a11y-sheets.mjs, nav-looks.mjs, sheet-lib.mjs   owner contact sheets
  smoothness.mjs, scrub-smoothness.mjs, seam-geometry.mjs           footage and runtime probes
  hf*.mjs, palace-prompts.mjs, blend-tail.mjs, splice-clip.mjs, deletterbox.mjs, stamp-version.mjs
                       footage generation and repair (see the shot list)
```

CSS lives in `app/globals.css` under `FILM REEL` (`.film-stage-grid`,
`.film-halo`, `.film-box`, `.film-label`/`.film-h1`/`.film-h2`/`.film-lede`,
`.film-btn*`, `.film-poster`, `[data-film-segment]`, `[data-film-body]`,
`html[data-reel-chrome]`).

## URL switches

Read once on the client; none changes the server HTML.

| Switch | What it does | Why it stays |
|---|---|---|
| `?hud=1` | Frame counter and load / draw / input lines (`FilmHud`) | Diagnosis on a real phone; the live check after a deploy |
| `?pack=0` | Every variant on the per-frame path | The fallback path must stay testable (`film-quality`, `film:quality`) |
| `?nav=1` … `?nav=5` | The touch nav look over the film (`data-nav-look`) | Owner pick still open (look 1 is the default) |
| `?smooth=<ms>` | Touch smoothing, 0–200 ms (default 35) | Owner pick on a real phone still open |

The HUD's lines: the drawn film and frame; `exact 97% · refetch 0 · dist 0.4 ·
fetch 3/4`; `pack 42% · skeleton done · decode 14.4 ms in worker` (or
`frames · decode 9.0 ms on page`); `input touch · smooth 35 ms · want f0123`.

## Variants and the pick

A film has a landscape variant (`<name>`, 1920×1080, the film's `v`) and two
band tiers for portrait screens:

| Tier | Folder | Frame | Decoded | Drawn on |
|---|---|---|---|---|
| b900 | `<name>-b900` | 900×810 | 2.9 MB | phones (canvas backing ≤ 900 px wide) |
| b1080 | `<name>-b1080` | 1080×972 | 4.2 MB | tablets and wider portrait windows |

A band tier holds only the picture band of a 1080×1920 portrait composition:
its manifest (and `films.<name>.bands.<tier>` in the timeline) records the
virtual frame `{w:1080,h:1920}` and the band `{x:0,y:474,w:1080,h:972}`
(the rows the picture fills at `--portrait-zoom 1.6`). The hero's frames up
to 200 carry bars inside the band, encoded in `#06070A`. Each tier has its
own version `v`.

- **Pick** (`pickVariant`, pure, `reel-context.test.ts`). Orientation from
  `PORTRAIT_QUERY` = `(max-width: 63.99rem) and (min-height: 500.0001px),
  (orientation: portrait)`: portrait, or narrow and not short landscape →
  the band tiers. `SHORT_LANDSCAPE_QUERY` = `(orientation: landscape) and
  (max-height: 500px)` (a phone held sideways) → the landscape frames.
  Within portrait, by canvas backing width `min(innerWidth ×
  quantDpr(devicePixelRatio), 1920)` (`quantDpr` rounds the DPR up to the
  next quarter, 0.5 … 2, so the poster's media queries can reproduce the
  pick): the narrowest tier at least that wide, else the widest. Width only,
  so an address bar never changes the pick. `FilmBackdrop` reads the view
  synchronously in the first client render, so a phone never requests
  another variant's frame or poster; the rendered state starts as the
  server's landscape view (no hydration mismatch) and changes only when a
  film's pick changes (`viewKey`: rotation, a resize across 900 backing px),
  which refreshes caches and loop like an orientation flip.
- **Placement** (`variantPlacement`, `framePlacement`, `stageShift`). The
  picture is cover-fitted to the canvas box (width × large-viewport height),
  grown by the breath zoom around (0.5, 0.45) and centred on the stage
  centre, so neither scale nor place moves with a phone's address bar. A
  band tier: the virtual 1080×1920 frame is placed that way and the tier's
  image fills the band rectangle inside it (frames, posters and the
  dissolve underlay alike); every picture pixel lands where the full
  portrait frame put it (`npm run film:parity` proves it against the legacy
  frames). The rest of the canvas is cleared with `--cf-recall-bg`
  (`#06070A`). On a tall phone the band is wider than the screen and its
  sides are cut (up to about 20 % of its width); the owner chose this over
  fitting the band to the width.
- The legacy `<name>-p` folders (1080×1920 with baked bars) are not
  requested at runtime (`reel-context.test.ts`); they are the parity
  reference and stay until the owner confirms their removal.

## Loading

### The frame budget (`frame-cache.ts`)

Decoded frames live under ONE byte budget shared by every film
(`FrameBudget`): 160 MB on phones and tablets, 384 MB on desktop,
`deviceMemory` × 48 MB where Chrome reports it. The budget is also the
scheduler:

- **One wanted set per scroll decision** (`budget.want`, called when the
  target frame moves): a window around the playhead in the active film, about
  70 % ahead in the scroll direction; the previous film's last frame while
  the dissolve can draw it; the next film's opening (at most 12 frames) once
  progress passes 0.6; and, when the network is behind, the frame the canvas
  would fall back to. Its decoded size is at most 80 % of the budget,
  computed from the variant's real frame size before any decode (phones on
  b900: 45 frames wanted; tablets on b1080: 31; desktop on 1920×1080: 38).
- Loads start only for wanted frames, nearest first in the scroll direction.
  At most 4 fetches in flight and 2 decodes (4 on budgets of 256 MB or more);
  a decode reserves its bytes when it starts.
- A started fetch is never aborted: its compressed bytes are kept in a
  byte-capped store (24 MB on small budgets, 96 MB otherwise), so a frame is
  fetched once per page and re-decoded from its bytes on the way back. Only
  queued requests are dropped when they leave the wanted set.
- Eviction removes only frames outside the wanted set: other films first,
  then the active film's farthest from the playhead.
- A frame that lands nearer to the wanted one than what is drawn repaints
  (`budget.subscribe`), scrolling or not.
- Per-frame mode (no pack): before the first scroll decision a weak plan
  warms the first film's opening and the second film's head; the loop's first
  decision replaces it. Pack mode has no such warm-up (below). Every film
  gets its cache (and its poster) at mount.

### Packs

One streamed file per variant, decoded off the main thread. Every variant
the timeline records a pack for loads this way; the per-frame path is the
complete fallback.

- **Layout** (`pack.bin` beside the frames; written by `pack-lib.mjs`, read
  by `pack-format.ts`). Little-endian u32: magic `CFPK`, layout 1, frame
  count N, header length 24 + 12·N, skeleton end, total length, then N
  entries in FILE order (frame, offset, length), then the frame files byte
  for byte. File order: the skeleton layer (every 4th frame) first, then the
  rest in frame order. Deterministic; the version is the first 12 hex digits
  of its SHA-256. The manifest and the timeline record `{bytes, header,
  skeletonEnd, openingEnd, v}` (`openingEnd`: the byte where frames 0–47 are
  complete). URL: `<variant>/pack.bin?v=<pack v>`.
- **Worker** (`film-worker.ts`, created by `pack-client.ts` on the first
  scroll decision with `new Worker(new URL("./film-worker.ts",
  import.meta.url), { type: "module" })`; its own chunk in dev and in the
  build). It reads Range responses as streams, cuts frames as bytes arrive
  (`PackBytes`), caps held compressed bytes at 48 MB on small budgets and
  160 MB otherwise (the variant farthest from the active film loses frames
  first; never the active film, the neighbour being prepared, an open stream
  or the dissolve pin) and decodes held frames on request with
  `createImageBitmap`, transferring the bitmaps. Held bytes that fail to
  decode three times make the pack unusable.
- **Protocol** (`film-worker-protocol.ts`). Page → worker: `init` (cap),
  `packs` (the view's packs in film order; failed ones keep their place),
  `where` (active pack, playhead, direction, wanted window, dissolve pin,
  scrolled yet, hidden, constrained connection), `decode`, `recover`.
  Worker → page: `ready`, `frames`, `failed` (with `permanent`), `stats`,
  `decoded`.
- **Scheduler** (`attachPacks`). For a pack variant the page holds no
  compressed bytes. A wanted frame the worker holds is decoded there; one
  not yet arrived takes no slot and is decoded on arrival if still wanted.
  Within the window: the playhead, every 4th frame nearest first, then the
  rest nearest first.
- **Network plan** (`pack-plan.ts`, re-run after every chunk, stream end,
  scroll decision and backoff). Once the visitor has scrolled: (1) the active
  film's skeleton, (2) the skeleton of the film the visitor travels towards,
  (3) the active film's remaining frames, (4) the neighbour's; plus the
  dissolve pin while the opening dissolves from a frame not yet held. One
  stream per pack, at most 2 at once, none while hidden. A stream starts at
  the first byte not held and ends before the next held byte (open-ended at
  the end of the file), so no range is read twice (`packBytesRepeated`).
  Before the first scroll (position 0, no anchor, first film active) only the
  first film's pack is read, bounded at `openingEnd`, and it continues from
  there on the first scroll. Re-aim (stop and reopen at the playhead, or 64
  frames below it going up) only on a jump (≥ 24 frames, or a film entered
  out of order), a stop (300 ms still) or while scrolling up; a stream within
  16 frames of the target is left to reach it. The neighbour flips with the
  direction after 8 frames of travel; across a cut the two films at the cut
  stay paired while the playhead is within 8 frames of it. Constrained
  connections (`saveData`, slow-2g / 2g / 3g): skeletons only while moving,
  the missing frames of the window in one request after 300 ms still.
- **Responses** (`pack-net.ts`). 206 must start where asked and carry the
  timeline's total. 200 to a Range request: read from 0, held bytes
  discarded (counted as repeated), that pack read whole from then on. A
  length or header that disagrees with the timeline, 404, 410, 416: unusable
  at once, permanently. Network errors, 403, 429, 5xx, a short body: retried
  after 400 ms, 800 ms, 1.6 s from the first missing byte; a fourth failure
  makes the pack unusable until a recovery signal.
- **Fallback** (`pack-client.ts`). Per variant: no pack in the timeline, or
  an unusable pack → per-frame path (for the page view when permanent, until
  `resume` when transient). Every variant: `?pack=0`, no `Worker`, the
  worker cannot start or lacks `createImageBitmap` / `fetch` / streaming
  bodies, or crashes. Decoded frames stay; the switch is immediate.

### Counters

`window.__filmStats`, always on (production too): `fetches` and `refetches`
(per-frame requests only), `decodes`, `redecodes`, `exactDraws`,
`fallbackDraws`, `fallbackDistanceSum`, `evictions`, `maxFetchInFlight`,
`maxDecodeInFlight`, `framesFailed`, `recoveries`, `probes`; for packs
`mode` (of the active variant), `packRequests`, `packBytes`,
`packBytesRepeated` (must stay 0), `packBytesHeld`, `packReaims`,
`packFallbacks`, `packHeldShare`, `packSkeleton`, `workerDecodes` and
`mainThreadDecodes` with their mean and max ms, `drawWant` / `drawAt`; from
the loop `canvasResizes`, `geometryMeasures`, `ticksWorked`, `ticksSkipped`.
`window.__filmCaches` (name@v → FrameCache) exists in development only.

## Drawing (`use-scrub-loop.ts`)

- **Segments.** A chapter is `pace × 100svh` tall with a sticky 100svh stage
  (`FilmSegment`). The first scrubs over its sticky travel; every later one
  starts one stage early, as its box enters from the bottom while the
  previous stage slides out, and scrubs over `travel + stage` (`pickActive`),
  so the next film already moves during the slide-out. The first
  `dissolveIn` frames of a film cross-fade over the previous film's last
  frame.
- **Viewport.** Progress is measured against the stage height (svh), never
  `innerHeight`, which changes with the iOS address bar. The canvas wrapper
  is `fixed` and `100lvh`; its backing store is sized from the wrapper's box
  (DPR capped at 2, width at 1920) and reallocated only when that box or the
  DPR changes, never on an address-bar resize. The tick that handles a
  `resize` refits the canvas itself before drawing (the ResizeObserver comes
  later in the frame). Lab browsers have no collapsing address bar; that the
  film holds still when it hides and shows is checked on an iPhone.
- **Cached geometry.** Segment tops and heights and the stage height are
  measured on register, resize, a ResizeObserver on the reel and on `<body>`,
  `document.fonts.ready`, and at most every 500 ms while working. A tick
  reads no layout.
- **Idle and pause.** A tick works only when something changed (scroll,
  box, DPR, geometry, the glide not yet on target, a frame landed, breath,
  reduced motion). The loop stops while the tab is hidden and once the reel
  has ended; a scroll back above the end (`reelEndScrollY`), a resize, a
  landed frame or a registration restarts it, and the first tick after a
  restart snaps to the scroll position. Breath runs on its own clock that
  holds while stopped.
- **Smoothing** (`smoothingMs`). An exponential glide toward the target
  frame whose time constant depends on the last scroll input: wheel, key and
  other 90 ms, touch 35 ms (`?smooth=` replaces the touch value), focus and
  snaps 0. The input kind comes from passive listeners; a click on a link
  counts as `other`.
- **Breath:** a slow ± zoom while held (hero 0.012, others 0.01), quantised
  to 1/4000; off under reduced motion.
- **Chrome:** `<html data-reel-chrome="film|body" data-reel-section="…">` and
  a `cf-reel-chrome` event for the nav and scrim.
- **Below the reel** the canvas wrapper is `visibility: hidden` past
  `canvasHiddenFrom` (not composited under the body, which is opaque from
  30svh); the scroll handler shows it again before the frame paints as soon
  as the scroll is above that line.
- **Layers.** Pins hold no permanent `will-change`: promoted while their
  values change, demoted 300 ms after (`PIN_DEMOTE_MS`) or at once at
  opacity 0; values are quantised and written only when their string
  changes. The Hall's two walls get `will-change: transform` only while the
  Hall is on screen. `.film-box::before` has no mask and no overdraw.

## Layout

- **Stages.** Each chapter's copy sits in `.film-stage-grid` columns over the
  picture, with scrims (`.film-halo`, `.film-box`) that are themselves
  FramePins (`scrim`) and fade with their copy.
- **Compact stage** (`@media` with the exact `SHORT_LANDSCAPE_QUERY`): a
  phone held sideways draws the landscape frames, so the copy goes where it
  sits on desktop (split columns), type sized from the stage height (headline
  about 9.5svh, lede about 4.2svh, never under 15 px); a bottom beat sits
  under the picture column.
- **Hall wall prose** shares the stage with the centred copy on short
  stages: on the compact stage the copy keeps to the middle 40vw and each
  wall ends at 29vw from its side; on short portrait phones the walls are
  wider and their lines 12 px.
- **Safe areas** (`viewport-fit=cover`): the stage padding, nav, nav scrim,
  bottom beats, footer and mobile menu keep `max(spacing,
  env(safe-area-inset-*))`. The canvas and the poster still cover the
  screen.
- **Nav over the film on touch screens** (`(hover: none) and (pointer:
  coarse)` with `data-reel-chrome="film"`): no `backdrop-filter` and no
  `filter` (re-blurring the moving canvas cost every scroll frame); a tinted
  fill instead, in one of five looks (`?nav=1` … `5`): 1 tinted pill (panel
  at 86 %, default), 2 solid pill, 3 top scrim only, 4 light pill on scrim,
  5 lifted pill. `node scripts/film/nav-looks.mjs` writes a contact sheet and
  checks every look's ink contrast. Desktop keeps the glass.
- **Start button always in reach.** From the top to the end of the reel at
  least one primary start button is visible (effective opacity at least one
  half), and never two once a hand-over has committed. The hero's and the Home chapter's
  buttons are FramePins with `startCta`: suppression zones for the nav's
  persistent button, marked `data-cta-off` while their button is under one
  half (the hero's switches at √½ of its own opacity, its halo fading on the
  same curve). `RecallNav` watches that attribute with a MutationObserver
  and commits with `flushSync`: the attribute flips in the scrub tick and the
  observer runs in that tick's microtasks, so the nav's button leaves (or
  comes back) in the same painted frame. Visibility of the zones comes from
  IntersectionObservers, also committed with `flushSync`; no layout read in
  the scroll path. One case keeps one frame of overlap: a start pin that
  scrolls into view already fully on (the Home chapter's, met scrolling back
  up from the body) is reported by its observer only after the frame in
  which it crossed the header line, so that one frame shows both buttons. On this page the
  nav's button also shows while the session is unresolved (the signed-out
  "Start free"). `data-cta-off` is never in the server HTML.
- **Prefetch.** `/books` is public (the middleware gate matches whole path
  segments, `lib/protected-surface.ts`), so the nav, the City chapter and the
  footer prefetch it. A link to a protected surface (`/book`, `/app`,
  `/dashboard` and below) does not prefetch for a visitor not known to be
  logged in, and an `/auth/` link never does (`gatedRoutePrefetchProps`): the
  prefetch would follow the sign-in redirect to Cognito and trip the CSP.

## First paint

- **The hero poster is in the server HTML** (`FilmBackdrop.tsx`,
  `first-paint.ts`): a `<picture>` (b900 source, b1080 source, landscape
  `<img>`, `fetchpriority=high`) over the canvas on a page-colour layer, and
  one `<link rel=preload as=image>` per poster with mutually exclusive media.
  The media reproduce `pickVariant` in quarter-DPR clauses, so the browser
  downloads exactly the poster URL the film code then uses
  (`first-paint.test.ts` checks it on 2,361 widths × 20 DPRs × both
  orientations and short landscape heights). Known limit: Chromium's preload
  scanner resolves `device-width` against the screen, so a window narrower
  than its screen (split screen, headless CI) may fetch a second poster.
  The one-poster gate (`film-first-paint.spec.ts`) is strict where the
  scanner sees the window and tolerates exactly one speculative poster, the
  pick for the screen the scanner sees, where it sees a larger screen. A
  canary page in the same browser context decides which (a preload whose
  media match only a wider window, plus a copy of the poster preloads).
- **Placement:** exactly where the canvas draws the variant's first picture
  with no breath (`.film-poster`, a size container: `cqw`/`cqh` are the
  canvas box; moved by `(100svh − 100cqh) / 2`). Portrait: the `<picture>`
  is the virtual frame, `max(100cqw, 100cqh × 1080/1920)` wide and centred,
  the tier image fills the band; only when the first film has tiers
  (`data-film-band`).
- **Takeover:** the loop hides the poster layer in the frame the canvas
  first draws the exact frame or the film's own poster, never a frame
  farther away (`FrameCache.nearest` with `handover`); the breath starts
  from rest (`breathRestOffset`). Over a later chapter the HTML poster is
  the wrong picture and goes at the first tick (`htmlPosterStands`).
  `film-first-paint.spec.ts` measures band mean |Δ| ≤ 3 and edges within 1 px
  on phone, tablet, desktop and a phone held sideways.
- **Before hydration** pins that are off at their chapter's first frame carry
  `data-frame-later` and stay hidden until `[data-film-reel]` gets
  `data-film-armed` (set after every pin has written its state).
- **The readable page** (`readable-layout.ts`, tested against the real
  server HTML): every pin visible at full opacity, each chapter as tall as
  its copy, stage grids as flex columns (the hero keeps one screen with its
  poster), the wall prose left out. Without script a `<noscript><style>`
  applies it; with script but a reel that never arms, an inline style
  applies the same rules after 8 s through zero-length CSS animations (no
  JavaScript). The footer is lifted above the reel's stacking context from
  the server HTML on.
- **Fonts:** the landing preloads exactly the files its first screen uses
  (`app/_fonts/landing.ts`; Satoshi 700 from the root layout).
- **Motion features** (framer-motion) load when Pricing comes within 1.5
  viewports, an overlay opens, or the menu button is hovered, focused or
  touched; the import is retried and never rejects.

## Failure and recovery

- **Kinds.** PERMANENT: 404, 410, 416, a pack whose length or header
  disagrees with the timeline, bytes that will not decode, a canvas with no
  2D context. TRANSIENT: everything else (network errors, aborted bodies,
  403, 429, 5xx, a probe with no answer in 10 s). A poster's first load goes
  through `<img>` (no status), so a failed poster counts as transient until
  a retry through `fetch` says otherwise.
- **Retries.** A frame 3 tries (400, 800 ms), a pack 4 (400 ms, 800 ms,
  1.6 s), a poster 1. Spent: failed, its neighbours serve, until a recovery
  signal if transient.
- **Static mode** (`data-film-static`): the canvas has no 2D context, or
  nothing of the film has loaded, a poster has failed and 3 frames have
  failed. The budget halts (no fetch, decode or pack read; the worker idles),
  the loop runs without painting (progress, pins, chrome and nav follow the
  scroll), the HTML poster stays if it loaded.
- **Recovery signals:** `online`; the document shown after 10 s or more
  hidden; a film response that succeeds after a drop (2 distinct files failed
  transiently since the last success); while halted, a successful probe.
  Honoured at most once per 5 s. An honoured signal gives transiently failed
  frames fresh tries, retries failed posters through `fetch`, and has the
  worker read transiently failed packs again. While halted it only asks for a
  probe; a probe that succeeds un-halts.
- **Probes** (halted, something failed transiently): the active film's
  poster with `cache: "no-store"` at 5 s, 15 s, 45 s, then every 60 s, at
  most 10 per page view, none while hidden.
- **Bounds:** with the network down for good a page view makes the requests
  it made before the halt plus at most 10 probes. With no film files at all
  (every request 404) everything is permanent: static mode, no probe.
- **Measured** (dev, desktop Chromium, 2026-11-11): all 404 → 91–93
  requests, none after 12 s, no probe; all aborted for 70 s → static at
  4.4–5.3 s, then only the probes; aborted for 6 s → film back 10.1–10.5 s
  after load; offline until 6 s → film 0.1 s after going online.
- **Not covered:** a visitor parked on a window whose frames all failed in a
  drop the browser never noticed waits for the next successful film request.

## Accessibility and reduced motion

- **Reduced motion** (the OS setting or `html[data-motion="reduced"]`): each
  chapter draws only its stops (`reducedStops` in `pins.ts`): one stop per
  named beat where the most pins not yet seen are fully on, plus the fewest
  extra stops that show every remaining pin; later chapters' stops start
  after their dissolve. The loop maps progress to a stop (`reducedStopIndex`)
  and snaps, no glide, no breath. Stops (0-based, `data-film-stops`): hero 0,
  28, 136, 156, 204, 240; Summary 14, 62, 90, 142, 240; Examples 97, 107,
  176, 270, 278; Quiz 14, 22, 110, 118, 195, 258, 280; Spaced review 14, 56,
  104, 141, 169, 204, 240; Library 14, 54, 106, 240; Home 12, 76, 105, 136,
  168.
- **Shorter reel:** a chapter is one stage plus a 40svh step per stop after
  the first (CSS, from `--film-pace` / `--film-stops`): 19.8 screens instead
  of 23.2.
- **Switching the mode keeps the place:** the loop takes the visitor's
  chapter and frame from the old geometry (`reelAnchor`) and scrolls to the
  nearest stop (or that frame) in the new one (`anchorScroll`).
- **Keyboard paging** under reduced motion: Space / PageDown and Shift+Space
  / PageUp go to the adjacent stop (`pageStop`), not a browser page.
- **Skip the film** (`SkipFilmLink.tsx`): the second tab stop, after "Skip to
  main content"; it moves focus to the first content after the reel
  (`#after-film`). Under reduced motion it also shows among the hero's
  buttons.
- **Pins stay in the tree:** an off pin is hidden by opacity only; its links
  stay in the tab order, without pointer events.
- **Keyboard focus drives the film** (`FilmSegment` focus handler): keyboard
  focus (`:focus-visible`) on an element whose pin is not fully on scrolls at
  once to the nearest frame (or stop) where it is, with the stage pinned.
  Pointer focus never moves the page. Focus coming back to the same element
  when the window or tab regains focus does not either (`focus-guard.ts`):
  the guard is cleared only when focus really leaves that element, so a
  touch scroll (pointerdown without a focus change) on a device with a
  keyboard keeps it.
- **Forced colors:** `.film-btn:focus-visible` restores
  `outline: 2px solid Highlight`.
- **Structure:** one `h1`, six `h2` in order; the canvas layer, poster, HUD
  and wall prose are `aria-hidden`.
- **Contrast** (`film-a11y.spec.ts`): every run of copy in every pin, at the
  moments it is fully on, on 390 × 844 and 1440 × 900, against the real
  picture: ink hidden, screenshot, per-pixel WCAG ratio over its line boxes,
  worst 10 %; 4.5:1 (3:1 large). Solid buttons by their own colours
  (8.34:1). Focus indicators: the film buttons' ring (accent over a page
  colour ring, 8.34:1), and every nav control (brand, links, start button,
  menu button) measured the same way over the film at three moments of each
  chapter and over the body on the landing, pricing, contact, legal and
  books. The visible indicator is the page's accent outline; lowest measured
  3.90:1 (2026-11-11, brand link over the hero's last frames). Exempt: the
  Hall wall prose from the 11 px size check (decoration, `aria-hidden`).
- **Known limit:** a fast fling or a scrollbar drag can pass a stop without
  resting on it; the stop is shown on the way.

## Claims and where they come from

Every number or promise the landing makes, and the code it comes from.
`app/public-claims.test.ts` fails on an exact book count (by name or as the
catalog's `.length`) or a hard-coded free-book number on a public surface, on
export sold as Pro while the export route has no plan check, on a yearly price
shown without its plan's name, on the Summary minutes not being that
chapter's own figure, and on robots, the sitemap or the SearchAction
disagreeing with the sign-in gate.

| Claim on the landing | Where | Source in code |
|---|---|---|
| "&lt;floor&gt; titles", "&lt;floor&gt; books. Every one a building.", "Browse all &lt;floor&gt; books", where the floor reads "130+" today | hero label, City chapter | `CATALOG_BOOK_COUNT_DISPLAY` (`lib/catalog-stats.ts`: catalog size floored to 10). JSON-LD `numberOfItems` on `/books` stays exact (`CATALOG_BOOK_COUNT`) |
| "Every chapter becomes a 12-minute read" | hero lede | `CATALOG_MEDIAN_CHAPTER_MINUTES` (median of each book's minutes per chapter) |
| "Atomic Habits, chapter one, in about 14 minutes" | Summary chapter | `chapterMinutes("atomic-habits", 1)` (`app/_lib/chapter-minutes.ts`: chapter one's own minutes from `app/book/data/book-chapter-meta.json`, as the reader lists them; read on the server in `app/page.tsx` and passed down, so the metadata stays out of the client bundle; the number is dropped if the book leaves the catalog) |
| "2 free books", "Finish 2 complete books", "on 2 complete books", "after my 2 free books" | hero label, pricing, FAQ, close, footer | `FREE_OFFER_LABEL` / `PRICING.freeBookLimit` (`lib/pricing.ts`; display value, the enforced limit is `BOOK_FREE_SLOTS_DEFAULT`) |
| "$7.99 / month", "$5.99 /mo billed annually", "Save 25%" | pricing | `PRICING.monthlyAmount`, `PRICING.annualMonthlyAmount`, `ANNUAL_SAVINGS_PCT` |
| "Annual upfront −37%", "$59.99 CAD / year", "$5.00/mo · billed once a year" (on `/pricing`, not the landing) | `/pricing` | `PRICING.annualUpfrontAmount`, `ANNUAL_UPFRONT_SAVINGS_PCT`, `ANNUAL_UPFRONT_MONTHLY_AMOUNT`. The landing's "Annual" is the billed-annually plan, `/pricing`'s yearly view the upfront plan; each is labelled with its in-app name (`SubscriptionCard`: "Annual", "Annual upfront") |
| "Showing all titles" / "Showing N titles" (on `/books`, not the landing) | `/books` filter bar | `resultCountLabel` (`browse-library-core.ts`): a filtered view gives its exact match count; the unfiltered view never prints the exact catalog size beside the hero's floor |
| "Start 14-day free trial", "charged when the 14-day trial ends", trial in the FAQ | pricing, FAQ | `TRIAL_CTA_LABEL`, `PRICING.trialDays` |
| Pro: text-to-speech audio | pricing | the chapter audio route answers Pro only (`entitlement.plan !== "PRO"`) |
| Pro: reading analytics | pricing | Progress shows the insights to Pro only (`isPro`, `ProInsightsPreview`) |
| Pro: deeper depth mode, priority on requests | pricing | plan features as sold; not traced to a plan check in this pass |
| "Export everything … as JSON, CSV, or Markdown" (every plan; not on the Pro card) | FAQ | `/app/api/book/me/export`: a signed-in user with a recent sign-in, no plan check; formats `json`, `csv`, `markdown` |
| "FSRS-5 predicts the moment an idea is about to go dark" | Spaced review chapter | `app/app/api/book/_lib/fsrs.ts` (FSRS-5); cited in the footer |
| "That small effort is the testing effect" | Quiz chapter | cited in the footer (Karpicke & Roediger, Science 2008) |
| Search box in results (`/books?q=`) | JSON-LD SearchAction | `/books` is public (`lib/protected-surface.ts`); `useBrowseLibraryState` seeds the search from `q` |
| Organization logo | JSON-LD | `/icon.svg` (`app/icon.svg`, the brand mark) |
| "Start free" / "Start your first book" | hero, Home chapter, pricing, nav, footer / closing section | one sign-up link (`AUTH_LOGIN_BOOK_URL`); "Start your first book" once, on the closing section (`RecallClose`) |

## Tests and commands

Unit tests (`npm run test`, also in CI): `scrub.test.ts` (math, placement,
focusArrived, paging), `pins.test.tsx` (every pin fully on at a stop),
`frame-cache.test.ts` (scheduler, budget, failures, recovery), `pack-*.test.ts`
(format, plan, network, client, build), `first-paint.test.ts` (poster media
against the pick, CSS formulas), `readable-layout.test.tsx`,
`reel-context.test.ts` (pick rule, no `-p` variant), `focus-guard.test.ts`,
`band-sync.test.ts`, `layers.test.ts`,
`components/landing/recall/RecallNav.test.tsx` (the start-button hand-over).

Browser specs (`e2e/film-*.spec.ts`; `RUN_AUDIT=1`, dev server):

| Spec | Checks |
|---|---|
| `film-audit` | 7 viewports × 17 steps × every chapter: no pin clipped, overlapping, under the nav or over a lit wall line; luminance behind the copy (mean ≤ 110, p90 ≤ 150); canvas painting; every pin seen; ≥ 11 px text; 44 × 44 px targets |
| `film-a11y` | reduced motion (OS and in-app) stop by stop; around the film; keyboard Tab and Shift+Tab; pointer focus; refocus with the window, also after a touch scroll; paging; forced colors; structure; contrast of the copy and of the focus indicators |
| `film-first-paint` | one poster per viewport; all 404 (static, no probe); recovery (aborted 6 s, offline, aborted 70 s); no 2D context; the failsafe over inline styles. `@prod` part (E2E_MODE=prod): the response's picture and preloads, no JavaScript, hydration held back 2 s, scripts blocked, fonts, motion chunk |
| `film-layers` | touch nav without backdrop-filter, no resting layers, ≤ 64 layout reads in a 3 s scroll, Hall style writes, one reduced-motion listener, canvas under the body, smoothing per input. `@prod` part: logged out, `/books` is prefetched and answers 200, nothing is prefetched into the sign-in redirect, no CSP error, `/book/library` still redirects |
| `film-layout` | a phone held sideways requests only landscape variants; safe areas; scrolling down, the start button in reach, one at a time, in every painted frame |
| `film-perf` | a fast wheel scrub: monotonic frames, handoffs in the dissolve, ≥ 45 fps (20 on WebKit), anchors land |
| `film-quality` | pack mode: no per-frame request, ≤ 30 film requests, no pack byte twice, 0 refetches; `?pack=0`: each frame once, ≤ 4 in flight; before the first scroll one pack bounded at its opening; phone: one canvas allocation, idle at rest, stopped below the reel, a jump lands, only b900 requests |
| `film-reel` | scrub, dissolve, chrome, Hall prose, reduced-motion stops (also in the smoke job, skipped there without frames) |
| `film-truth` | canvas pixels against the frame files: desktop by signature against decoys (blank canvas, poster, a far frame, another film; on placeholder frames at every stop), phone (b900 in its band) and a phone held sideways exactly (mean \|Δ\| ≤ 0.5) |

```bash
npm run test:film            # every film spec, Chromium (needs frames in public/films)
npm run test:film:safari     # the same on WebKit (npx playwright install webkit)
npm run film:quality         # scrub-quality: whole-reel loading budgets per device profile
npm run film:parity          # band tiers vs the legacy -p frames (needs the -p folders)
npm run film:pack -- --verify
node scripts/film/placeholder.mjs --out <dir>   # synthetic frames (see below)
```

`placeholder.mjs` writes to `public/films` unless given `--out`, and it
refuses to overwrite a directory whose manifest is a real encode's (`--force`
overrides). In a checkout whose `public/films` links to the real frames,
generate placeholders elsewhere. `encode.mjs --sync-timeline` after it
rewrites the tracked `components/film/book.timeline.json` with the
placeholder packs' sizes and versions: never commit that (production would
then treat every real pack as unusable and load frame by frame). CI does both
in the runner only.

- **CI** (`.github/workflows/ci.yml`, job "film"): when a change touches the
  film or anything it imports (the path list in the job;
  `lib/film-ci-paths.test.ts` walks the import graph and fails when the list
  misses a file), it generates placeholder frames, tiers and packs (cached
  on the timeline and the generator; the tiers follow the timeline's band
  entries), syncs the timeline's pack fields to them in the runner (never
  committed; `ci-timeline-check.mjs` proves nothing else changed), and runs
  in three parallel parts. Parts `1/2` and `2/2` are the two shards of
  `npm run test:film` (dev server, Chromium, two workers each, without
  `@prod`, `@visual` and `film-perf`); part 1 then runs `film-perf` alone on
  one worker, part 2 runs `film:quality` for `desktop-chromium` and
  `desktop-chromium-frames`. Part `prod` builds the app (`next build` +
  `next start`, `E2E_MODE=prod`) and runs the `@prod` tests of
  `film-first-paint` and `film-layers` on the placeholders: the server
  picture and preloads, no JavaScript, the poster-to-canvas hand-over at four
  viewports, scripts blocked, fonts, prefetch. The film audit runs three of
  its seven viewports in CI (`FILM_AUDIT_VIEWPORTS`: desktop, smallest
  phone, landscape phone); the 390 × 844 phone is not in the CI audit (its
  clip, overlap, nav, size and target checks run per reduced-motion stop in
  `film-a11y`), only locally. Placeholder manifests carry
  `placeholder: true`; `e2e/film-frames.ts` reads it, and the checks that
  judge the real footage skip on it: the copy contrast and the focus
  indicators over the film (`film-a11y`), the luminance behind the copy
  (`film-audit` check 4). `film:parity` needs the legacy frames and stays a
  local gate.
- **scrub-quality** (`scripts/film/scrub-quality.mjs`): one time-based
  scroll down the whole reel per profile with three 1.5 s stops:
  `phone-webkit` (iPhone 14, 600 px/s), `phone-chromium-slow` (Pixel 7, CPU
  4×, Fast 4G, no `deviceMemory`), `desktop-chromium` (1440 × 900, 900 px/s),
  `desktop-chromium-frames` (`?pack=0`). Hard failures in pack mode: any
  per-frame request, more than 30 film requests, any repeated pack byte, any
  refetch, under 97 % exact draws (phone-webkit, desktop); with `?pack=0`:
  any refetch, more than 4 fetches in flight; the slow profile fails if its
  throughput exceeds 1.5× Fast 4G. Soft targets (`STRICT=1` makes them hard):
  slow phone mean distance ≤ 4 frames and exact frame ≤ 1 s after a stop;
  phone-webkit longest frame ≤ 100 ms. `ONLY=`, `SPEED=`, `OUT=<json>`. Local
  only unless `ALLOW_REMOTE=1` and `MAX_REQUESTS=n`. Measured 2026-11-11, local
  production build, M-series Mac:

  | Profile | Film requests | Bytes | Exact draws | Mean distance | Exact after each stop | fps / longest |
  |---|---|---|---|---|---|---|
  | phone-webkit | 15 (8 pack, 7 poster) | 38.4 MB | 99.9 % | 0.00 | 222 / 250 / 252 ms | 60 / 44 ms |
  | phone-chromium-slow | 17 (10 pack, 7 poster) | 34.7 MB | 87.3 % | 0.25 | 216 / 567 / 232 ms | 60 / 34 ms |
  | desktop-chromium | 15 (8 pack, 7 poster) | 109.0 MB | 99.9 % | 0.00 | 233 / 251 / 250 ms | 60 / 19 ms |
  | desktop-chromium `?pack=0` | 1,700 (1,693 frame) | 109.0 MB | 99.9 % | 0.00 | 233 / 250 / 267 ms | 60 / 19 ms |

  About 230–250 ms of each "exact after stop" is the 90 ms glide itself.
- **film:parity** (`tier-parity.mjs`): on a 390 × 844 phone (b900) and an
  820 × 1180 tablet (b1080), reduced motion, 36 positions, the canvas against
  a reference drawn from the legacy `-p` file with the legacy math: band edge
  rows within 1 px, content shift within 1 row, mean |Δ| ≤ 4 (phone) / 2
  (tablet). 2026-11-11: all edges equal, all shifts 0, means 0.64–1.40.
- **Other probes:** `smoothness.mjs` (footage deltas and seams),
  `scrub-smoothness.mjs` (runtime fps and stalls; `HEADED=1` for real
  numbers), `seam-geometry.mjs` (the HUD frame every 15 px across a seam).
- **Owner sheets** (dev server): `layout-sheets.mjs` (landscape and small
  phones), `a11y-sheets.mjs` (reduced-motion stops, contrast changes),
  `nav-looks.mjs` (the five touch nav looks).

The live site rate-limits per IP: never point a script or test at
`app.chapterflow.ca`. After a deploy, one short manual check (page loads,
frames load, `?hud=1` counters) is enough.

## Content: render, encode, ship

The shot list, keyframes and prompts per shot are in
`docs/MEMORY_PALACE_SHOTLIST.md`. Continuity: the last frame of film N is the
first frame of film N+1; the dissolve hides a mismatch of about 14 frames,
not a cut.

**Higgsfield from the CLI.** Keep the Higgsfield MCP server disabled (seven
of its tools have top-level `anyOf`/`oneOf`/`allOf`, which the API rejects)
and drive it with the scripts, which reuse the stored OAuth token and refresh
it on a 401:

```bash
node scripts/film/hf.mjs balance '{}'
node scripts/film/hf-stills.mjs P00_BOOK_START --n 2                   # scored stills → media id
node scripts/film/hf-video.mjs P00_BOOK <start> <end> --duration 10    # job id (declines presets)
node scripts/film/hf-fetch.mjs ~/renders p00=<job>                     # poll, download, preview
```

A still seeded from a letterboxed image bakes the bars into the clip: run
`deletterbox.mjs` on the raw clip before `blend-tail.mjs` / `splice-clip.mjs`.

**Encode.** Every new render needs its landscape frames, its band tiers and
its packs, then the timeline sync:

```bash
node scripts/film/encode.mjs ~/renders/P03.mp4 palace-03 --from-video --fps 24 --quality 78
node scripts/film/encode.mjs public/films/palace-03 palace-03 --bands --portrait-zoom 1.6 \
  --portrait-bars '#06070A' --quality 78 --effort 6
# the hero ramps from contain (z = 1) at frame 150 to zoom 1.6 at 200:
node scripts/film/encode.mjs ~/renders/p00v4_blend palace-00 --bands --portrait-ramp 150,200 \
  --portrait-zoom 1.6 --portrait-bars '#06070A' --quality 78 --effort 6
npm run film:pack -- --verify       # every pack matches its folder
node scripts/film/encode.mjs --sync-timeline   # counts, versions, tiers, packs → timeline
```

`--bands` builds the 1080×1920 portrait composition (one zoom, 1.6, for every
film so the seams keep one scale; bars in the page colour), cuts rows
474–1445 into `<name>-b1080` and scales them by 5/6 into `<name>-b900`. A
landscape encode without `--bands` leaves tiers cut from the old render:
the encoder warns, and the sync prints STALE BAND TIER and exits 1 when a
tier's count differs. A pack that no longer matches its folder: STALE PACK,
exit 1, not recorded (that variant would load frame by frame). Every
encode writes a content version `v`; every frame, poster and pack URL carries
`?v=`, so a re-render is never served from a stale cache.

**Ship.** Production serves `/films/*` same-origin from the frontend stack's
static-assets bucket (`_assets/films/`, CloudFront `films/*` behaviour, cache
key includes `?v`). Upload the new frames, `pack.bin` and manifests BEFORE
deploying the timeline that names them; a page whose timeline disagrees with
the pack it gets loads that film frame by frame and nothing alerts anyone:

```bash
B=s3://$(aws cloudformation describe-stack-resources --stack-name ChapterFlowFrontend \
    --query 'StackResources[?LogicalResourceId==`StaticAssetsDDEE9873`].PhysicalResourceId' --output text)/_assets/films
aws s3 sync public/films "$B" --exclude '*' --include '*.webp' --content-type image/webp \
    --cache-control 'public,max-age=31536000,immutable'
aws s3 sync public/films "$B" --exclude '*' --include '*/pack.bin' --content-type application/octet-stream \
    --cache-control 'public,max-age=31536000,immutable'
aws s3 sync public/films "$B" --exclude '*' --include '*.json' --content-type application/json \
    --cache-control 'public,max-age=300'
```

No invalidation is needed (new `?v=`). App deploys never remove these objects
(the BucketDeployments are `prune: false`). The per-frame objects and the
legacy `-p` folders stay until the owner confirms their removal; the `/films/`
firewall limit is lowered only after that. An external CDN instead: set
`NEXT_PUBLIC_FILM_BASE=https://<cdn>/films` at build time; `lib/csp.ts` adds
its origin to `img-src` and `connect-src`.

**Sizes** (2026-11-11, 1,693 frames per variant): landscape 108.5 MB, b1080
50.6 MB, b900 38.3 MB, as packs:

| Film | landscape | b1080 | b900 |
|---|---|---|---|
| palace-00 | 17.11 MB | 8.60 MB | 6.36 MB |
| palace-01 | 11.19 MB | 5.78 MB | 4.49 MB |
| palace-02 | 12.81 MB | 5.73 MB | 4.32 MB |
| palace-03 | 29.06 MB | 11.56 MB | 8.26 MB |
| palace-04 | 10.12 MB | 5.49 MB | 4.34 MB |
| palace-05 | 18.49 MB | 8.56 MB | 6.65 MB |
| palace-06 | 9.73 MB | 4.91 MB | 3.84 MB |

Before the first scroll a desktop reads 7.12 MB of palace-00 (skeleton and
opening, one request), a phone 2.45 MB of palace-00-b900.
