# HANDOFF — Memory Palace landing: finish to perfection

You are continuing a session. Read this whole file before touching anything.
Workspace: `/Users/radinsoltani/ChapterFlow`. Caveman rules apply (see
`.clinerules/caveman.md`): terse, no filler, technical substance intact.

## 0. Landed on `main` (2026-10-28, branch `memory-palace-landing`)

The reel was built on the stale `update` branch (HEAD July 17, 578 commits
behind). It was re-based by hand onto `origin/main` in a worktree; what main
had changed underneath, and how the reel now fits:

- **Public chrome.** `app/page.tsx` keeps main's `LandingMotionProvider` →
  `PublicSiteShell` (nav + footer, once) shell and the per-request JSON-LD
  nonce; `BookReelLanding` mounts inside the single `main#main`. The
  persistent-CTA sentinel (`data-public-hero-end`, read by `RecallNav`) is
  passed as `afterHero` and rendered right after the hero chapter.
  `PublicSiteShell.contract.test.ts` and the LazyMotion reachability anchors
  in `LandingMotionProvider.contract.test.ts` were updated to the film graph.
- **CSP** moved to `middleware.ts` + `lib/csp.ts` (WS8-001); the film CDN
  origin (`NEXT_PUBLIC_FILM_BASE`) is now added there (`resolveFilmOrigin`,
  img-src + connect-src), not in `next.config.ts`.
- **`noUncheckedIndexedAccess`** is on: every `arr[i]` in the engine, specs and
  audit lib carries a guard. Behaviour unchanged.
- **Layering lint.** `lib/` may not import `components/`, so the engine's unit
  test lives at `components/film/scrub.test.ts` (the `npm test` glob covers
  `components/`).
- **Smoke.** Main's two reduced-motion smokes (`expectReducedMotionFinalState`)
  asserted the old hero plates; they now assert the film's quantised final
  state (library chapter pins at `transform: none`, no infinite animations).
- `public/films` is a symlink in the worktree, so the ignore is `/public/films`
  (no trailing slash).
- **Frames are in production storage.** `public/films` was synced to the
  ChapterFlowFrontend StaticAssets bucket under `_assets/films/` (3,414
  objects, 197 MB, immutable cache headers) and the frontend stack gained a
  `films/*` CloudFront behavior on the assets origin with a cache policy that
  keys on `?v`. Same-origin, so no CSP entry and `NEXT_PUBLIC_FILM_BASE` stays
  default. The behavior goes live with the next app deploy
  (`deploy.yml`, deploy_app) — until then `/films/*` on prod 404s from the
  server origin, which is fine because the page is not deployed either.

Found by re-running the gates on main (all fixed, all in this branch):

- **Nav anchors never landed after a scrub.** `FrameCache.prefetch` queued a
  fetch for nearly every frame a fast scrub passed (~1,600 same-origin
  requests); the browser's per-host connection budget serialised the nav
  link's RSC round-trip (main's nav links are Next `<Link>`s on a dynamic
  page) behind them — >10 s in dev. Speculative loads now carry an
  `AbortController` and `prefetch` aborts everything outside its new window,
  so in-flight work is bounded by the window (≈34 frames), not the reel.
- **Persistent nav CTA after an instant jump.** `RecallNav` only updated on
  IntersectionObserver changes; a jump that carries the sentinel from below
  the viewport to above it in one step (anchor link, restored scroll, a
  4-viewport hero) never intersects. A rAF-throttled scroll listener now runs
  alongside the observer.
- **Laptop 1280×720 UNDER NAV.** Main's nav is taller (bottom ≈ 83 px); the
  stage's top padding floor rose 5.5rem → 6rem so the hero label clears it
  by the audit's 8 px at short viewports (12svh still wins from ~800 px tall).
- `film-perf` polls for the anchor landing (the Link round-trips first) and
  selects the link via `header.rl-nav nav[aria-label="Primary"]`.

Found on the LIVE site after the first prod deploy (2026-10-28), fixed in the
follow-up PR:

- **CSP console errors on the auth CTAs.** The hero and close CTAs were Next
  `<Link>`s to the external Cognito URL; Next tried to prefetch it and the
  browser blocked the fetch under `connect-src 'self'` (three errors per page
  view). They are plain `<a>`s now, like every other auth CTA on the public
  site. Clicks were never affected.
- **Phones downloaded the landscape variants first.** The rendered orientation
  starts as "landscape" (SSR) and the media query was applied in an effect,
  but child segments register in THEIR effects (which run first) and the scrub
  loop's first tick follows at once — so every phone warmed the first 12
  frames of all seven landscape films (~5 MB, 97 requests) before flipping to
  the portrait ones. `FilmBackdrop` now reads the query synchronously into a
  ref during the first client render and picks variants from it; the state
  (and hydration markup) is unchanged. Phone load: 0 landscape requests.

## 0a. Round 4 — evaluation + finish (2026-10-27, Claude)

Everything in §0–§9 below was Cline's state at its handoff. A full evaluation
of that work (frames read, every chapter screenshotted at 1440/390, gates
re-run) found and fixed these — see `MEMORY_PALACE_SHOTLIST.md` §4 "Round 4":

- **Letterboxed seam P03→P04.** P04's start still (`p04_f0.png`) was itself
  letterboxed (127 px black bars top+bottom at 1080p), so flux baked bars into
  P04 f0–20 and into the P03_FOLD insert's tail (f250–281) — a black slab
  popping in and out across the dissolve. Fixed at source with
  `scripts/film/deletterbox.mjs` (strict brightest-pixel bar test, symmetric
  bars only) on the raw clips, then the same blend/splice/encode chain. No
  credits spent.
- **Scrims lingered after copy.** `.film-halo` / `.film-box` gradients sat on
  containers that never faded, so a dark bloom hung over the paper after the
  hero copy cleared (desktop + phone). Every copy column is now a
  `<FramePin scrim>` (new prop: fades only, tagged `data-frame-scrim` so the
  audit ignores the wrapper) whose range is the union of its pins.
- **Copy accuracy.** Quiz lede claimed free recall ("say it back in your own
  words") — the product quiz is multiple choice (`options` / `correctIndex`
  in `app/app/api/book/_lib/types.ts`); rewritten around "answered from
  memory before you look back". Hall lede hardcoded "twelve-minute" → uses
  `CATALOG_MEDIAN_CHAPTER_MINUTES`. Hero lede now states the actual loop
  (read / quiz / review). Hall + Examples labels name the source book
  (Atomic Habits — the prose on the walls is from the live package). Home
  beat no longer repeats RecallClose's "Read it once. Keep it for good."
- **Phone layout.** Hall wall prose collided with the centred headline →
  `data-hall` grid drops the block to the lower third under 64rem. Edge-to-
  edge `.film-box` band on phones feathered top/bottom and lightened.
- **Desktop splits.** Copy column 0.88fr / object 1.12fr with a longer
  feather so the diorama subject (centred in the footage) clears the scrim.
- **Seam freeze → lead-in (owner report: "next video replaces and there's a
  gap" at the hero and the tower).** Measured with `seam-geometry.mjs`: every
  film froze on its last frame for ~885 px (the stage's slide-out viewport),
  then cut to the next film whose 14-frame dissolve spanned 135 px — one wheel
  flick. The footage seams themselves are continuous (Δ 2–3, same as
  frame-to-frame). `pickActive` now starts every segment after the first one
  viewport early (as its box enters from the bottom) and scrubs it over
  `travel + vh`, so the next film is already moving while the previous stage
  slides out and the dissolve rides the slide-in. Copy keyed to early frames
  rises in with its stage (checked 1440 + 390). Hero pace 3.2 → 4 (it was the
  fastest scrub on the page at 8 px/frame; now 11, in line with the rest).
  Unit tests in `components/film/scrub.test.ts`; `film-truth` and the hall test in
  `film-reel` mirror the mapping.
- **Hero reshoot (2026-10-28, ~104 cr).** palace-00 is now the pop-up book
  (closed book opens, paper tower rises, push into its doorway onto the
  unchanged P01 seam). Keys renamed (`book`, `cover_lifts`, `building_up`,
  `doorway`, `push_in`, `through`); `FoldChapter.tsx` uses `book`. Portrait
  uses the new `encode.mjs --portrait-ramp`. Old frames backed up at
  `~/renders/palace-00-v3-backup/`. Shotlist §4 "Round 5".
- **Production CDN.** `next.config.ts` adds the `NEXT_PUBLIC_FILM_BASE`
  origin to CSP `img-src` + `connect-src`. Upload of `public/films` to the
  CDN is still an owner step (bucket + distribution choice).

## 0. One-paragraph state

`chapterflow.ca` landing (`app/page.tsx`) is now a **scroll-scrubbed film
reel**: a fixed `<canvas>` paints frames from 7 AI-generated clips
("Memory Palace": a city built from book pages) as the user scrolls; copy is
pinned to named keyframes. All 7 clips exist and play end-to-end. The
engine, audits, encoder, and Higgsfield CLI are built and green. **What's
left is footage quality**: 4 of 7 clips are round-1 "CG look" with model
pseudo-text, 3 are round-2 "photographed miniature". Your job: regenerate
the weak clips under the photography bible, keep continuity at every seam,
re-time keys, and re-run the audits until zero problems. Then it is final.

Higgsfield balance at handoff: **526 credits**. Enough for everything below
with ~100 buffer. No video without a scored still first.

## 1. Known issues (precise)

| # | Where | Issue | Root cause | Fix |
|---|---|---|---|---|
| 1 | **P01 Hall** (`palace-01`) | Printed text on the corridor walls is **model gibberish** (pseudo-glyphs, not English), every frame. | Round-1 prompt asked for "printed book pages"; video models can't render real words. | **Regenerate** with a prompt that bans printed text: blank cream paper walls with tooth/fibre, lit from behind. Real English prose is already supplied by `HallText.tsx` (CSS 3D planes). After regen remove `softFocus` from `HallChapter` — it blurs the canvas to hide the gibberish. |
| 2 | **P03 Vault** (`palace-03`) | Pseudo-text on the glowing strip that enters the door. Round-1 look. | Same. | **Regenerate**: plain glowing paper strip, no glyphs. Timing for "Locked." / "One book. Kept." is already fixed in code (smoothstep + glide + re-keyed). |
| 3 | **P00 Fold** (`palace-00`) | Blank clean CG sheet, round-1 look. Object centred. | Round-1 prompt. | **Regenerate** under bible. Still blank (text = gibberish) but cotton-rag, deckle, fibre, one LED, incense haze. Keep object centred — hero layout `data-stack="hero"` depends on it. |
| 4 | **P02 Rooms** (`palace-02`) | Dioramas generic, round-1 look, not tied to the product's examples. | Round-1 prompt. | **Regenerate**: three *Atomic Habits* examples — glass of water by the bed (cue), running shoes by the door (environment), coat on hook (2-minute rule). Object RIGHT, copy left. |
| 5 | **Seam P03→P04** | Round-1 → round-2 texture/lighting jump across the dissolve. | Mixed rounds. | Solved when P03 is regenerated with P04's *real* frame 0 as its end still (§4). |
| 6 | P04–P06 | Good. Round-2 bible. **Do not regenerate.** | — | Reuse their stills as seam anchors. |
| 7 | Assistant image reader | Rejected nearly every image this session ("exceeds size limit") regardless of size. | Harness fault. | Don't depend on viewing frames. Use §6 profilers + `hf-stills.mjs` scorer. If yours works, view `_v.jpg` previews from `hf-fetch.mjs`. |

Everything else — engine, cache-busting, layout, contrast, perf, a11y, tests —
is done and verified. Do not refactor the engine.

## 2. Architecture you're inheriting (don't rebuild)

```
components/film/
  FilmBackdrop.tsx     fixed canvas; FrameCache per variant keyed name@v; registers segments
  use-scrub-loop.ts    ONE rAF loop: segment rects → progress → target frame → exponential
                       glide (90 ms) → draw cover-fit + breath + smoothstep dissolve;
                       publishes html[data-reel-chrome|section|soft]
  FilmSegment.tsx      pace×100svh section + sticky 100svh stage; `softFocus` prop
  FramePin.tsx         copy pinned to [from,to] frames; smoothstep opacity; SSR-visible
  HallText.tsx         real English prose on P01 walls (CSS 3D), compresses to 3 kept lines
  timeline.ts          key("palace-01","compress") → frame; manifest(name) appends ?v=
  book.timeline.json   SOURCE OF TRUTH: count, v, keys per film
  chapters/            FoldChapter · HallChapters (Hall/Rooms/Vault) · CityChapters (Lights/City/Home)
  BookReelLanding.tsx  composition; mounted in app/page.tsx
scripts/film/
  hf.mjs               raw Higgsfield MCP call:  hf.mjs <tool> '<json>'   (token from Cline settings)
  hf-stills.mjs        <KEY> --n 2 → generate, download, SCORE, pick best, register → media_id
  hf-video.mjs         <KEY> <start_media> <end_media> [--duration 10] → job id (auto-declines preset)
  hf-fetch.mjs         <outDir> name=jobId … → poll, download mp4/png, _v.jpg preview
  encode.mjs           <mp4|dir> <film> --from-video --fps 24 --portrait → public/films/<film>/
                       + poster + manifest{v}; syncs count/v/last-key into timeline
  palace-prompts.mjs   BIBLE + STILLS{…} + VIDEOS{…}   ← you will edit this
  stamp-version.mjs    re-stamp v on all manifests (cache bust without re-encode)
e2e/
  film-reel.spec.ts    CI: scrub, dissolve, chrome, hall prose, reduced motion
  film-audit.spec.ts   4 viewports × 17 steps: clip / overlap / nav / contrast (screenshot-sampled)
  film-truth.spec.ts   canvas PIXELS vs the frame file the scroll demands (catches stale/wrong frames)
  film-perf.spec.ts    wheel scrub: monotonic, handoffs inside dissolve, fps, anchor links
docs/
  FILM_REEL.md                engine + ops
  MEMORY_PALACE_SHOTLIST.md   per-shot beats, keys, render log, bible rationale
```

Run everything: `npm run test:film` (chromium) · `npm run test:film:safari`.
After editing `globals.css`: `rm -rf .next-chapterflow` and restart dev —
Turbopack served stale CSS twice this session.

## 3. Workflow per shot (proven 7× this session)

```bash
node scripts/film/hf.mjs balance '{}'
# 1. stills — 2 candidates, auto-scored (texture / black / periwinkle / clip), best registered
node scripts/film/hf-stills.mjs P01_START --n 2        # → media_id
node scripts/film/hf-stills.mjs P01_END   --n 2
# 2. video — 100 cr @ 2k 10 s (70 @ 7 s). Preset nudge auto-declined.
node scripts/film/hf-video.mjs P01 <start_media> <end_media> --duration 10   # → job id
# 3. poll + download (3–8 min). FOREGROUND.
node scripts/film/hf-fetch.mjs ~/renders p01v2=<job>
ffprobe -v error -select_streams v:0 -show_entries stream=width,height,r_frame_rate,nb_frames -of csv=p=0 ~/renders/p01v2.mp4
# 4. encode — FOREGROUND with </dev/null (spawnSync inherits stdin; hangs if backgrounded)
rm -rf public/films/palace-01 public/films/palace-01-p
node scripts/film/encode.mjs ~/renders/p01v2.mp4 palace-01 --from-video --fps 24 --portrait --quality 78 </dev/null
# 5. profile frames → re-time keys (§6)
# 6. rm -rf .next-chapterflow; restart dev; npm run test:film
```

Gotchas learned the hard way:
- `generate_video` may answer with a `preset_recommendation` instead of a job; `hf-video.mjs` re-sends with `declined_preset_id`.
- `$(… | grep media_id)` once captured duplicate IDs → malformed JSON → silent no-op. Use literal IDs.
- "Out of credits" with credits present = rate-limit race when two jobs submit together. Wait 20 s, retry.
- `generate_image_batch` 500'd on one index once; single `generate_image` retry worked.
- Flux 3 returns 241 frames for 10 s, 169 for 7 s. `encode.mjs` syncs count and pins the last key to `count-1`.
- Keys are 0-based; the HUD shows 1-based (`f0001` = key 0).
- Never ask Seedance (160 cr/clip) — no quality gain measured.

## 4. Continuity rule (non-negotiable)

Last frame of film N **is** first frame of film N+1. The engine dissolves
14 frames to hide drift, not to hide a cut.

- `P00_END` still → P01's start still (same media_id).
- `P01_END` → P02 start. `P02_END` → P03 start.
- **P03_END must be P04's real frame 0**:
  `ffmpeg -i ~/renders/p04v2.mp4 -vframes 1 ~/renders/p04_f0.png` →
  host it at a public URL → `hf.mjs media_import_url '{"url":"…","type":"image"}'`.
  If no public host is available, generate `STILLS.P03_END` and accept the dissolve.
- P04 / P05 / P06 already share seams. Leave them.

Order: **P03 first** (visible seam) → P01 (gibberish) → P00 (hero) → P02.
If credits run short, P02 is the one to skip.


## 5. Prompt standard — what "precise and detailed" means here

Round-1 failed because it described a *rendered world* ("glowing paper
corridor, volumetric fog, cinematic, 35mm") — every model has a default for
that, and it's the generic look. Round-2 worked because it described a
*photographed physical miniature*. Every prompt = `BIBLE + SHOT`,
**2,500–3,500 chars**; flux_3_video ignores the tail past ~3.5k.

Order and weight inside every prompt:

1. **SUBJECT 40 %** — every object in frame: material, size in cm, age and
   wear, how it's held (PVA, pins, thread). Nothing abstract.
2. **LIGHT 20 %** — one practical source: position relative to camera, gel
   (Lee 181 Congo Blue), power, what it bounces off, falloff into black
   velvet. Haze = incense smoke crossing the beam. Room bulbs =
   grain-of-wheat. No fill, no rim, no second source.
3. **CAMERA 20 %** — Laowa 24 mm probe, T2.8, full-frame cinema body; what
   the focus plane holds; move type (vertical slider / dolly / crane orbit);
   constant speed; start framing → end framing; any rack focus.
4. **FILM 10 %** — Kodak Vision3 500T grain, halation on the brightest
   edges, faint cyan lateral CA, optical vignetting, mild lens breathing.
5. **NEGATIVE 10 %** — `no legible text, no printed text, no glyphs, no
   handwriting, no logos, no people, no hands, no sky, no horizon, no
   digital glow, no lens flare, no HDR, no neon, no bloom filter, not
   illustration, not 3D render, not stylized`.
   **"No printed text" is mandatory on every shot now.** Models cannot
   render real words; words come from CSS (`HallText.tsx`, `FramePin`).

Composition per shot (object stays out of the copy column):
P00 centred (hero stacks copy top/bottom) · P01 walls both sides, centre dark,
copy centred · P02 object RIGHT, copy left · P03 object RIGHT, copy left ·
P04 tower centre, copy left · P05 full, copy centred on halo · P06 centred.
**Top 12 % of frame dark and empty** — the nav pill lives there.


### Prompts to write into `scripts/film/palace-prompts.mjs`

`BIBLE` is done. Rewrite these entries to the standard above (drafts exist
there; expand each to ≥2,500 chars including BIBLE):

**STILLS.P00_START** — a *blank* sheet of 300 gsm cotton-rag, 10×14 cm,
deckled all four edges, slight bow, hung by invisible thread 40 cm from the
lens. LED above-right rakes across so every fibre and the torn edge catch
light; far edge in shadow. One thread of incense smoke behind. Black velvet.
Centred, nothing else. **No printed text.**

**STILLS.P00_END** — that sheet hand-folded into a standing doorway: two
walls + lintel, crisp scored folds with fibre burrs on the creases. Camera
5 cm from the opening, looking through into black. LED behind the paper so
the walls glow faintly; the inside edges of the opening are the brightest
lines in frame. Opening = centre 40 % of frame. Top 12 % black.

**VIDEOS.P00** — 10 s motion-control. Sheet folds itself over 6 s (valley,
mountain, valley — creases appear as crisp lines with burrs) and stands as
the doorway; last 4 s the camera dollies through the opening into black, the
glowing edges sliding out of frame. No hands, no cuts, constant speed.

**STILLS.P01_START** — one-point perspective down a 40 cm corridor whose
walls are **blank cream cotton-rag sheets**, overlapping, glued, lit from
BEHIND by the LED so the paper glows evenly with visible fibre and **no
markings of any kind**. Floor same paper. Far end black. Camera at floor
level, vanishing point dead centre. Top 12 % black.

**STILLS.P01_END** — same corridor, same camera; backlight lower (walls
dimmer); far end opens onto a paper wall with three cut rectangular
doorways, edges hand-cut and fuzzy, a few mm deep. Still blank paper.

**VIDEOS.P01** — 10 s dolly forward at walking pace along the floor; the
wall backlight dims gently over the middle 4 s (≈100 → 60 %); ends at the
three doorways. Haze drifts. Nothing else moves. *(The prose and the "lines
peel and stay lit" beat are the CSS overlay's job — never ask the model.)*

**STILLS.P02_A / P02_B / P02_C** — looking into a doorway at 10 cm, each a
6 cm lantern-lit paper diorama with one grain-of-wheat bulb inside, doorway
in the RIGHT half, left half dark paper wall + velvet, shallow focus on the
prop. **A** bedroom: folded paper bed, real cotton-thread blanket, on the
paper nightstand a tiny paper glass with one real drop of water. **B**
hallway: a pair of 1 cm paper running shoes with real cotton laces beside a
paper front door. **C** a paper coat on a bent-wire hook by a paper door.

**STILLS.P02_END** — tall paper door, 12 cm, no handle, RIGHT half, in a
paper wall; a 2 mm vertical slit at chest height glowing periwinkle from a
bulb behind; grain vertical; hand-cut fuzzy edges; left half dark wall +
velvet + haze; camera at floor level 10 cm back. *(Reuse as P03 start.)*

**VIDEOS.P02** — 10 s glide along the corridor pausing to look into each
diorama in turn (bedroom → shoes by the front door → coat on the hook),
never entering; ends facing the handleless door with the glowing slit.
Nothing moves but camera and haze. Pass P02_A/B/C as `image_references`
alongside start/end (`models_explore '{"action":"get","model_id":"flux_3_video"}'`
lists roles).

**STILLS.P03_END** — prefer P04's real frame 0 (§4). Fallback: probe lens
4 cm from a 2 cm closed book, worn cloth cover, **no title, no lettering**,
on the paper floor in the RIGHT half; LED behind-left for a periwinkle rim;
left half black velvet + haze; focus on the top edge.

**VIDEOS.P03** — 10 s, camera locked on the handleless door. A thin **plain**
glowing paper strip (no marks) drifts in from the left, pauses, slides into
the slit. The bulb behind the door flares once over half a second and
settles. The door folds itself down crease by crease into a small closed
cloth-bound book on the floor. Last 2 s: rack focus to the book's top edge.

`STILLS.P04_END / P05_END / P06_END` and `VIDEOS.P04 / P05 / P06` are done
and good — do not touch.


## 6. Re-timing keys after each regen (do this, don't guess)

Frames differ per render. Profile, set keys where the beats *actually* land,
run the invariant test.

```bash
node -e "
const s=require('sharp');(async()=>{const f='palace-01',n=241;for(let i=1;i<=n;i+=20){const {data}=await s('public/films/'+f+'/f_'+String(i).padStart(4,'0')+'.webp').resize(96,54,{fit:'fill'}).raw().toBuffer({resolveWithObject:true});let lum=0,peri=0;const N=data.length/3;for(let p=0;p<N;p++){const r=data[p*3],g=data[p*3+1],b=data[p*3+2];lum+=r*.3+g*.59+b*.11;if(b>r+30&&b>150)peri++;}console.log(i,'lum='+Math.round(lum/N),'peri%='+Math.round(peri/N*100));}})()"
# edit book.timeline.json: first key 0, last = count-1, ascending
npx tsx --test components/film/scrub.test.ts
```

Keep the key *names* (copy is choreographed to them); move the *numbers*.
P01 `compress`/`lines_lit` drive `HallText`. P03 `pulse`/`fold_to_book` drive
"Locked." / "One book. Kept.". P00 `push_in` is where hero copy clears.

## 7. Code changes after regeneration

1. `components/film/chapters/HallChapters.tsx` — remove `softFocus` from
   `<FilmSegment id="how-it-works">` once P01 has no gibberish. Keep
   `<HallText/>` — it *is* the summary beat.
2. `e2e/film-reel.spec.ts` "hall of summary" — drop the two
   `data-reel-soft` assertions with the prop.
3. `docs/MEMORY_PALACE_SHOTLIST.md §4` render log — job ids, counts,
   re-timed keys, credits.
4. `stamp-version.mjs` is only for hand-edited frames; `encode.mjs` stamps `v` itself.

## 8. Definition of done

- [ ] P00 · P01 · P02 · P03 regenerated under the bible; **no printed text in any frame of any film**
- [ ] Every seam continuous (shared still or real frame at each boundary)
- [ ] Keys re-timed from real frames; `components/film/scrub.test.ts` green
- [ ] `softFocus` removed from P01
- [ ] `npm run test:film` → audit **0 problems × 4 viewports** · truth all ok · perf ≥ 45 fps · reel green
- [ ] `npm run test:film:safari` → audit 0 problems laptop/tablet/phone (desktop may time out — not a layout failure) · perf ≥ 20 fps
- [ ] `npm test` ≥ 1842 pass · `npx tsc --noEmit` · `npx eslint components/film e2e/film-*.ts` · `npm run scan:style`
- [ ] `e2e/smoke.spec.ts` green
- [ ] Render log updated; credits accounted
- [ ] Hard-refresh `http://localhost:3000/` and scroll end to end
- [x] **No letterbox bars in any frame** (`deletterbox.mjs` reports 0 rescaled on a clean clip) — round 4
- [x] Every scrim fades with its copy (scroll past each beat: no dark shape left on the footage) — round 4
- [x] Copy matches the product (quiz = multiple choice; numbers from `lib/catalog-stats` / `lib/pricing`) — round 4
- [ ] Frames uploaded to the CDN and `NEXT_PUBLIC_FILM_BASE` set in the prod build — **owner step**
- [ ] Commit: everything is still uncommitted on branch `update` (568 behind `main`); branch off `main`

Budget (526): P03 4+100 → P01 4+100 → P00 4+100 → P02 8+100 = **420**;
~106 left for one reshoot. Preflight each video with `"get_cost":true`.

## 9. Do not

- Add "volumetric fog / cinematic / epic / 8k" — that's how round-1 went generic.
- Ask any model to render words. Words come from CSS.
- Background `encode.mjs` or `hf-fetch.mjs`.
- Trust the HUD alone — `film-truth.spec.ts` compares pixels.
- Touch `use-scrub-loop.ts` glide / breath / dissolve maths; tuned.
- Re-add `RecallAmbient` / `RecallHeroSplit` to `app/page.tsx`.
- Commit `public/films` (gitignored, 157 MB). Production = CDN via `NEXT_PUBLIC_FILM_BASE` (`docs/FILM_REEL.md`).

