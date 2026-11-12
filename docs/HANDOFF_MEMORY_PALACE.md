# HANDOFF: Memory Palace landing

Read this first, then `docs/FILM_REEL.md` (how the film works, the tests and
the commands) and `docs/MEMORY_PALACE_SHOTLIST.md` (the footage: shots,
keys, prompts, render log).

## State

- The landing (`app/page.tsx`) is the film reel: a fixed canvas drawing seven
  rendered clips (`palace-00` … `palace-06`) as the page scrolls, copy pinned
  to named keyframes, then request / FAQ / pricing / close and the footer.
  It is live on `app.chapterflow.ca`.
- The footage is final for now: every film under the photography bible, no
  printed text in any frame, every seam shares a still or a real frame, the
  hero is the pop-up book (shot list, rounds 3 to 5). The hero's crease pops
  at frames 32 and 66 are in the render; a re-render costs credits and is a
  separate decision.
- The engine was rebuilt against the 2026-11-10 performance audit (plan
  `~/.claude/plans/logical-swinging-wren.md`, phases 0 to 10, one branch per
  phase in `~/cf-wt/memory-palace`, `film-p1-cache` … `film-p10-gates`):
  - Phase 0 (rate-limit split) is infra only.
  - 1 cache correctness (one wanted set, no refetch), 2 phone viewport
    (stage-height progress, lvh canvas), 3 band tiers b900 / b1080, 4 one
    streamed pack per variant decoded in a worker, 5 layers, handlers and
    touch feel, 6 first paint and failure states, 7 phone and tablet layout
    (short landscape, compact stage, safe areas, start button in reach),
    8 accessibility and reduced motion (stops, skip link, keyboard focus,
    contrast gate), 10 gates, docs and cleanup (CI film job on placeholder
    frames, the framing switch removed, the start-button hand-over in one
    frame, the refocus guard on keyboard-and-touch devices, the nav's focus
    indicators in the contrast gate, five dead landing sections deleted).
  - Phase 9 (copy and search-engine truth) waits on owner decisions.
- Whole-reel numbers (local production build): 15 film requests, 0
  refetches, 99.9 % exact draws on desktop and the iPhone profile
  (`docs/FILM_REEL.md`, scrub-quality).

## Open, needs the owner

- Phase 9 decisions: book count wording ("135" vs "130+"), note export on the
  Pro card, `/books` for logged-out visitors (middleware gate vs sitemap /
  robots / search action), button labels, the Organization logo.
- Picks still behind URL switches: the touch nav look (`?nav=1` … `5`,
  default 1) and touch smoothing (`?smooth=<ms>`, default 35). Check both on
  a real phone with `?hud=1`.
- Deleting the per-frame objects and the legacy `<name>-p` folders in the
  bucket (permanent; only after the owner confirms), then lowering the
  `/films/` firewall limit.
- Device-only checks: the film holding still while the iPhone address bar
  hides and shows; Safari decode cost on the device.
- Merges and production deploys are the owner's.

## Open, engineering

- Landing files that became unimported when the five old sections were
  deleted, left for a separate cleanup because tests and CSS still reference
  them: `components/landing/recall/DissolveWord.tsx`, `curve-geometry.ts`,
  `RecallReaderShowcase.tsx`, `RecallCoverflow.tsx` (+
  `RecallCoverflowPresentation.ts` and its test), `RecallLibraryBrowser.tsx`
  (+ `book-filter.ts` and its test, `RecallBookRequestDialog.tsx`), and
  `components/landing/reader-demo/*`. Their CSS (`.recall-reader-demo`, the
  coverflow and library-browser blocks) and the contract tests that read
  them (`tests/recall-motion-restraint.contract.test.ts`,
  `RecallBookRequestForm.accessibility.test.ts`, `e2e/visual.spec.ts`) go
  with them.
- The CI film job is new: watch its first runs (time per part, the
  production build of part `prod` inside 15 minutes, the fps gate of
  `film-perf` on a 2-core runner without a GPU).
- The start-button hand-over keeps one painted frame with both buttons when
  the Home chapter's start pin scrolls into view already fully on (scrolling
  back up from the body): its IntersectionObserver reports after that frame.
  Closing it needs the nav to learn of the pin before the browser paints.

## Working rules

- Worktree: `~/cf-wt/memory-palace` (never `/tmp`: macOS reaps it).
  `public/films` there is a symlink to the real frames; never write into it
  from a script or a test (`placeholder.mjs` refuses to overwrite real
  frames). For placeholder runs use a separate worktree, and never commit the
  timeline that `encode.mjs --sync-timeline` rewrites there.
- The dev server, the build and a local hook rewrite `tsconfig.json` and
  `AGENTS.md`: `git checkout -- tsconfig.json AGENTS.md` before committing.
- Stale CSS or odd behaviour from the dev server: `rm -rf .next-chapterflow`
  and restart it.
- Never script or test against `app.chapterflow.ca` (its rate limiter blocks
  the network); every measurement is local. After a deploy, one manual look
  with `?hud=1`.
- Product copy never names competitors.
- Before pushing: `npm run verify`, `npm run test:film` (and
  `test:film:safari` when the change can differ on WebKit),
  `npm run film:quality` against a local build, `npm run film:parity` when
  placement or tiers change.

## Footage workflow (when a film is regenerated)

1. Stills, scored: `node scripts/film/hf-stills.mjs <KEY> --n 2`.
2. Video: `node scripts/film/hf-video.mjs <SHOT> <start> <end> --duration 10`
   (flux_3_video, about 100 credits; preflight with `"get_cost":true`).
3. Download in the foreground: `node scripts/film/hf-fetch.mjs ~/renders name=<job>`.
4. Repair if needed: `deletterbox.mjs` (bars), `blend-tail.mjs` (a model hard
   cut), `smoothness.mjs` (finds cuts and seam jumps).
5. Encode the landscape frames, the band tiers and the packs, sync the
   timeline (commands in `docs/FILM_REEL.md`), run encodes in the foreground
   with `</dev/null`.
6. Re-time the keys from the real frames: keep the key names (the copy is
   choreographed to them), move the numbers; first key 0, last `count − 1`.
   `npx tsx --test components/film/scrub.test.ts components/film/pins.test.tsx`
   checks the invariants and that every pin is still reachable under
   reduced motion.
7. `npm run test:film`, then upload frames, packs and manifests before
   deploying the timeline (`docs/FILM_REEL.md`, Ship).

Rules that held for the footage: the last frame of film N is the first frame
of film N+1 (the 14-frame dissolve hides drift, not a cut); prompts are
`BIBLE + SHOT` at 2,500 to 3,500 characters, describing a photographed
physical miniature (subject, one practical light, camera, film stock,
negatives), never "cinematic / volumetric / 8k"; no model renders words
(words come from CSS); the top 12 % of every frame stays dark for the nav.
Details and the render log are in the shot list.
