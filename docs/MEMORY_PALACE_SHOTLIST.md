# Memory Palace — shot list (Blender + Higgsfield)

A city built from book pages. You scroll *into* it. Every chapter of the
landing is a room; spaced review lights the rooms; the library is the skyline.
One continuous camera move, cut into 7 films the scrub engine
(`components/film/`) plays back-to-back.

Preview: `/film?hud=1`. Keys live in `components/film/book.timeline.json`.

---

## 1. World rules (every shot obeys these)

| Rule | Value |
|---|---|
| Void | pure black fading to `#06070A`; no horizon, no sky |
| Light | ONE hue: periwinkle `#8AA2FF`. Warm paper `#ECEFF6` only as *lit* surface. Nothing else. |
| Material | paper. Walls, stairs, doors, towers — all paper. Fibre texture, soft subsurface. Ink = periwinkle text printed on paper. |
| Fog | thin volumetric, density 0.02–0.05, periwinkle tint. Depth = fog, not colour. |
| Camera | 35mm, f/2.8 look. Always moving, never static. Slow. Ease in/out on every move. |
| Motion | nothing fast. Paper folds ≥2 s. Camera ≤1 m/s equivalent. |
| Text on surfaces | real prose from a ChapterFlow summary (Atomic Habits ch.1), serif, legible at rest. |
| Top band | top 12% of frame low-contrast, object-free (nav pill lives there). |
| Composition | copy-side vs object-side per shot (see each). Object stays out of the copy column. |
| Resolution | 16:9 master **2560×1440** (we downscale to 1920). Optional 9:16 second camera. |
| FPS / delivery | 24 fps. PNG sequence, or ProRes/H.264 mp4 → `encode.mjs --from-video`. |
| Continuity | **last frame of shot N == first frame of shot N+1** (camera + pose). Engine dissolves ~14 f to hide drift, not a cut. |

---

## 2. The journey (7 shots · 1640 f ≈ 68 s)

```
P00 The Fold          240f  one page folds into a doorway; camera pushes through   HERO
P01 Hall of Summary   240f  corridor of text pages compress to a few lit lines     01 Summary
P02 Rooms of Example  240f  three paper dioramas; camera peeks into each           02 Examples
P03 The Vault         240f  a handleless door; a lit line slots in; lock pulse     03 Quiz
P04 The Lights        280f  camera rises; rooms light on 1·4·12·36 rhythm          04 Spaced review
P05 The City          240f  aerial orbit: 135 towers, facades are real covers      Library
P06 Home              160f  descend to one lit window; the page rests under a lamp Close
```

Engine `pace`: P00 3.2 · P01 3.5 · P02 3.5 · P03 3 · P04 4 · P05 3 · P06 2.2.

Higgsfield workflow for every shot: render **two Blender stills** (first + last
frame of the shot, final materials/lighting) → Higgsfield image-to-video with
start & end frame → prompt below → export mp4 → `encode.mjs --from-video`.
Blender does geometry + continuity; Higgsfield does the in-between motion.

---

## 3. Shots

### P00 — The Pop-up Book · 240 f · HERO · object CENTRE, copy stacked

**Beat (v4, 2026-10-28).** A small closed hand-bound book of cream cotton-rag
rests on black velvet, lit from above-right; only the incense moves. The front
cover swings open on its own and, as it passes vertical, a paper tower rises
from the gutter the way a pop-up book works, one dark doorway at its base. The
light moves behind it so the walls glow through. Last 3 s: the camera pushes
into that doorway and stops 5 cm from the opening on the Hall seam still. Open
a book, get a building — the product's metaphor in one motion, and the city
at the end of the reel foreshadowed.

**Keys.** `book 0` · `cover_lifts 28` · `building_up 100` · `doorway 156` · `push_in 172` · `through 240`

Spec: `docs/superpowers/specs/2026-10-28-hero-popup-book-design.md`. The v1–v3
hero (a blank sheet folding itself into the doorway) is kept below for the
record; its crease pops (f32→33, f66→67) were model output and the reason for
the reshoot.

**Previous beat (v1–v3, The Fold).** A single sheet hangs in the void, lit
from above-right. It folds itself — valley, mountain, valley — origami logic,
no hands. By 6 s it is a tall paper doorway with a dark opening. Last 4 s:
camera pushes slowly through.

**Blender.** Plane 1×1.4, 64×64 subdiv. 3 shape keys (fold_1/2/3) driven by
an empty's Z, or Geometry Nodes bend chain. Paper: Principled, base `#ECEFF6`,
subsurface 0.15, roughness 0.7, fibre normal. Area light 2 m above-right,
periwinkle 0.2; rim light behind. Camera dolly on path, ease in/out.

**Higgsfield.** *A single sheet of cream paper floating in a black void, lit
by soft periwinkle light from above right, slowly folds itself like origami
into a tall paper doorway, volumetric fog, cinematic macro, 35mm, shallow
depth of field, slow motion, no hands, no text, seamless loop-safe.*
Second clip 144→239: *camera pushes slowly forward through the dark opening
of a paper doorway, periwinkle rim light on the paper edges, into darkness.*

### P01 — Hall of Summary · 240 f · object LEFT, copy RIGHT

**Beat.** We emerge inside a long corridor. Walls are pages dense with printed
text, lit by light leaking through the paper. As the camera glides forward
(0–120), most lines **dim and fold inward**; 3–4 lines per page stay lit and
float slightly off the surface — the summary. By 180 the corridor is sparse
and calm. Frame 239: the corridor ends at a junction with three dark openings.

**Keys.** `enter 0` · `walls_dense 30` · `compress 90` · `lines_lit 150` · `junction 239`

**Blender.** Two wall arrays of page planes (3×10 each); paper floor. Text as
emission map (periwinkle 0.6) on each page; a second "summary" map with 3
lines; mix factor keyed 90→150. Fold-inward = shape-key rig at 30% on dimmed
pages. Camera dolly along corridor axis.

**Higgsfield.** *Slow dolly forward through a corridor whose walls are printed
book pages glowing faintly periwinkle; most of the text dims and folds away,
leaving only a few luminous lines floating off the page; volumetric fog,
cinematic, 35mm.*

### P02 — Rooms of Example · 240 f · object alternates, copy opposite

**Beat.** At the junction the camera turns and peeks into three small rooms
(~70 f each). Each is a paper diorama of a real situation: (a) paper kitchen,
glass of water on a counter; (b) paper desk, closed laptop, running shoe
beside it; (c) paper doorway, coat on a hook. Lit from inside like lanterns.
Camera never enters. Frame 239: camera faces a closed door.

**Keys.** `turn 0` · `room_a 40` · `room_b 110` · `room_c 180` · `door_ahead 239`

**Blender.** Three 1.5 m boxes open on the camera side; low-poly paper props,
flat-shaded white, periwinkle edge light. Point light inside each. Camera path:
S-curve past each opening with a pan-to-look.

**Higgsfield.** One clip per room, 3 s, from a Blender still: *camera slowly
peeks into a miniature diorama of a kitchen made entirely of folded cream
paper, lit from inside with soft periwinkle light, lantern-like, shallow depth
of field, black void outside.* Swap "kitchen" → "desk with a laptop and a
running shoe" / "doorway with a coat on a hook".

### P03 — The Vault · 240 f · object RIGHT, copy LEFT

**Beat.** A tall paper door, no handle. One glowing line of text (from P01)
drifts in from the left, hesitates (0–100), then **slots into a slit** in the
door like a key (110). The door pulses once — a periwinkle bloom through the
paper (140) — and the whole door **folds flat into a single closed book**
resting on the floor (180–239). This is the quiz: recall is the key.

**Keys.** `door 0` · `line_approach 40` · `line_lock 110` · `pulse 140` · `fold_to_book 180` · `book_closed 239`

**Blender.** Door = plane 1×2.4 with a slit cut. Line = thin emissive plane on
a path. Pulse = emission strength key 0→3→0.3 over 12 f on the door material.
Fold-to-book = shape keys collapsing the door to 0.2×0.28, then a book mesh
swap at 200 (match-cut; hide/unhide).

**Higgsfield.** *A glowing periwinkle line of text floats toward a tall door
made of cream paper and slides into a narrow slit; the door pulses with soft
light and folds itself down into a small closed book resting on a paper
floor; black void, volumetric fog, cinematic.*


### P04 — The Lights · 280 f · object CENTRE-LOW, copy TOP-RIGHT

**Beat.** Camera lifts off the floor beside the book and rises straight up
through the ceiling of the vault (0–60). We rise past floor after floor of a
paper tower — dark rooms stacked. Rooms begin to **light up** on the FSRS
rhythm: one room (80), then four (130), then twelve (190), then thirty-six
(250). Each lighting is a soft bloom, not a switch. By 279 the tower is a lit
column in the void, camera above it looking down.

**Keys.** `lift 0` · `floors 60` · `light_1 80` · `light_4 130` · `light_12 190` · `light_36 250` · `tower_lit 279`

**Blender.** Tower = 12×12 grid of room cells, 40 floors; cells are paper
boxes with an interior point light at 0 strength. Light strength keyed per
cell group (1/4/12/36). Camera on straight vertical path with a slow tilt-down
near the end. Fog density 0.04.

**Higgsfield.** *Camera rises slowly up the outside of a tall tower built from
stacked paper rooms; one by one, then in clusters, the rooms light up from
inside with warm periwinkle light; black void, volumetric fog, cinematic
aerial.*

### P05 — The City · 240 f · object FULL, copy CENTRE (halo scrim)

**Beat.** From above the tower the camera pulls back and begins a slow orbit.
The void fills with **135 towers** of different heights — a skyline. Every
tower's facade is a real book cover (135 cover SVG/PNGs in
`public/book-covers/`). Fog between the towers. Lit windows scattered. Frame
239: orbit completes a quarter-turn, one tower near the centre is brightest.

**Keys.** `pull_back 0` · `skyline 90` · `orbit 150` · `one_bright 239`

**Blender.** Instance a tower on a scattered grid (Geometry Nodes, 135 points,
random height 8–40 m). Facade: image texture per instance from a cover atlas
(bake `public/book-covers/` to a 4096 atlas, index by instance ID). Emission
on random windows 5%. Camera orbit path 90°, slow.

**Higgsfield.** Hard to control 135 specific covers — Blender this shot. If
forced: *slow aerial orbit over a skyline of tall paper towers, each facade a
different book cover, scattered lit windows, periwinkle fog in the void.*

### P06 — Home · 160 f · object CENTRE, copy CENTRE (halo scrim)

**Beat.** Camera descends toward the brightest tower, into one lit window.
Inside: a paper desk, a reading lamp, the single closed book from P03. The
lamp **warms** (80–159) — a slow brightening on the page. Hold.

**Keys.** `descend 0` · `window 50` · `lamp_on 80` · `lamp_warm 120` · `hold 159`

**Blender.** Reuse P03 book + a paper lamp. Spot light strength 0→1.2 keyed
80→120. Camera path through the window frame, ends 0.6 m from the book, f/2.

**Higgsfield.** *Camera descends into a lit window of a paper tower and
settles on a small closed book under a paper reading lamp that slowly warms;
periwinkle and cream, shallow depth of field, cinematic, calm.*

---

## 4. Render log (Higgsfield, 2026-10-27)

Pipeline: `nano_banana_pro` 2k stills (first/last frame) → `media_import_url` →
`flux_3_video` 2k 24fps start+end image → `hf-fetch.mjs` → `encode.mjs --from-video`.
Keys below are the **re-timed** values after inspecting the real frames (dense→sparse
luminance, blue-text fraction, lit-window fraction); `book.timeline.json` is canonical.

| film | job | frames | keys (re-timed) | notes |
|---|---|---|---|---|
| palace-00 | (earlier session) | 241 | sheet 0 · first_fold 36 · doorway 144 · push_in 180 · through 240 | object centred → hero uses `data-stack="hero"` |
| palace-01 | `faa1a202…` | 241 | enter 0 · walls_dense 20 · compress 45 · lines_lit 100 · junction 240 | text thins by f60, paper floor brightens from f200; 1-pt perspective → copy LEFT |
| palace-02 | `81222193…` | 241 | turn 0 · room_a 40 · room_b 100 · room_c 160 · door_ahead 240 | diorama peeks peak at 41/101/161; dark door from f221 |
| palace-03 | `d6fd3a17…` | 241 | door 0 · line_approach 60 · line_lock 160 · pulse 180 · fold_to_book 205 · book_closed 240 | blue-line spike at f181 = pulse; luminance drops f200→ = fold |
| palace-04 v2 | `3bcae0aa…` | 241 | lift 0 · floors 50 · light_1 60 · light_4 100 · light_12 130 · light_36 160 · tower_lit 240 | **photography-bible re-render**; mid-frame micro-texture 8.7→12.7 vs v1 |
| palace-05 | `91dd14b2…` | 241 | pull_back 0 · skyline 40 · orbit 100 · one_bright 240 | skyline fills by f40, lit% peaks 29 at f80 |
| palace-06 | `915bddf2…` | 169 | descend 0 · window 70 · lamp_on 105 · lamp_warm 130 · hold 168 | lum spikes 109 at f113 (through the window), lamp settles f127+ |

### Round 2 — the photography bible (`scripts/film/palace-prompts.mjs`)

Round 1 looked generic because the prompts described a CG world ("glowing
paper corridor, cinematic, 35mm"). Round 2 describes a **photographed physical
miniature**: Hahnemühle cotton-rag with deckle + fibre + glue seams, one bare
LED gelled Lee 181, incense haze (not fog FX), Laowa 24 probe lens T2.8,
Vision3 500T grain + halation, black velvet, motion-control slider. The model
has to imitate a camera, not a renderer. Negatives kill the usual tells (bloom,
flare, HDR, neon, illustration).

Pipeline round 2: `hf-stills.mjs <KEY> --n 2` generates 2 candidates, scores
them (micro-texture + black-fraction + periwinkle-fraction − clipping), picks
the best, registers media. `hf-video.mjs <KEY> <start> <end>` submits and
auto-declines the preset nudge.

Budget round 2: 308 → 26. Stills 3×2×2=12 · P04 100 · P05 100 · P06 70.
P04→P05→P06 share stills at every seam, so the final act is one continuous
move. P00–P03 prompts + stills are authored in `palace-prompts.mjs` (keys
`P00_START…P03_END`, `P00…P03`) for the next refill: ~16 stills + 4×100 = 416.

### Round 3 — first act under the bible (2026-10-27)

All four first-act films regenerated with §5-standard prompts (BIBLE + SUBJECT /
LIGHT / CAMERA / FILM / COMPOSITION, 2.8–3.4 k chars, "nothing printed" on every
shot). **No printed text in any frame of any film** — words come only from CSS
(`HallText`, `FramePin`). `softFocus` removed from `HallChapter`.

Seam chain (same media_id at every boundary; P03→P04 is P04's real frame 0):

| seam | shared image | media_id |
|---|---|---|
| P00 end = P01 start | `STILLS.P00_END` (still #0) | `8a6f1fa3…` |
| P01 end = P02 start | `STILLS.P01_END` (still #1, three doorways) | `a9d9f484…` |
| P02 end = P03 start | `STILLS.P02_END` (still #0, dark left half) | `891ba699…` |
| P03 end = P04 start | ffmpeg frame 0 of `p04v2.mp4` → `media_upload` + PUT + `media_confirm` | `bb20e02f…` |

P00 start = `STILLS.P00_START` #1 (`47cfe187…`). P02_A/B/C stills (bedroom/glass
`3f7e9e6f…`, shoes/front door `84ffec99…`, coat/hook `719c3b87…`) were sent as
`image_references` on the first P02 job (`9875b6ce…`). That job sat
`in_progress` for 60 min, then **failed** and got refunded. The retry
(`0a65a27b…`) sent start + end only, and the prompt alone produced all three
dioramas. Auto-scorer picks were overridden by eye where composition beat score
(P01_END #0 had one doorway, P02_END #1 lit the top band).

flux_3_video sometimes **hard-cuts** to the end image instead of animating into
it. `scripts/film/blend-tail.mjs <mp4> <dir> --from a --to b` smoothstep-blends
frames [a, b) toward b, then `encode.mjs <dir>` (no `--from-video`). Measured
seam P03-last vs P04-f0: mean abs diff 2.5/255.

| film | job | frames | snap blended | keys (re-timed from real frames) | notes |
|---|---|---|---|---|---|
| palace-00 v3 | `6048a49c…` | 241 | f145→163 | sheet 0 · first_fold 30 · doorway 144 · push_in 150 · through 240 | first crease f30; doorway stands f140; framing jump at f163 → blended push-in |
| palace-01 v3 | `cc96284b…` | 241 | f32→52 | enter 0 · walls_dense 56 · compress 84 · lines_lit 136 · junction 240 | doorway→corridor cut f51 blended into a pass-through; corridor settles f56; backlight dips f80–136 (lum 49→83) |
| palace-02 v3 | `0a65a27b…` | 241 | — (no cut, max Δ 43) | turn 0 · room_a 85 · room_b 140 · room_c 172 · door_ahead 240 | glide through doorways f0–70; bedroom/glass peak f85, shoes by front door f140, coat on hook f172; turns to door f198–210 |
| palace-03 v3 | `c798f138…` | 241 | f200→220 | door 0 · line_approach 16 · line_lock 104 · pulse 112 · fold_to_book 200 · book_closed 240 | blank strip enters f16, in the slit f104, flare lum-peak f112, door crumples f172+, book resolves f200→220 |

Seam diffs after encode (last frame N vs frame 0 of N+1, mean abs /255):
P00→P01 3.6 · P01→P02 2.7 · P02→P03 2.8 · P03→P04 2.6.

Credits round 3: 526 → 594. Spent 432 = stills 7 keys × 2 × 2 = 28 · videos
P03 100 · P01 100 · P00 100 · P02 100 = 400 · Ads Studio 4 (06:00:59Z, not
triggered by any script here; unexplained, flag to account owner). P02 first
attempt −100 then refunded +100 (net 0). Credit package +500 granted
07:14:34Z (external top-up).
526 − 432 + 500 = 594.

### Story pass (copy ↔ footage)

Every pinned line was checked against the frame it lands on:
- **P04 spaced review:** first bulb lights at f100, not f60, so "Day 1 · one
  room lit" was showing over a dark tower. Re-keyed light_1/4/12/36 to
  100/135/165/200 to match the lit-room count rising in the real frames.
- **P03 quiz:** "Locked." ran until the book appeared, but the door swings
  open from f172. Added key `door_opens` 172; "Locked." now clears before it.
- **P02 examples:** copy now names exactly what is on screen (glass by the bed,
  shoes by the front door, coat on the hook).
- **P02 reshoot `4b093d28…` (100 cr) rejected and not encoded.** The
  paper-only negatives made it worse: a real glass lamp became the "glass of
  water", and the shoes and coat ended up in the same room. The current P02
  (`0a65a27b…`) reads the three examples more clearly. The negatives were
  reverted in `palace-prompts.mjs`.

Credits after the story pass: 494.

### Story inserts (5 s clips spliced into existing films)

Cheaper than re-rendering whole films: each insert is 5 s (50 cr, vs 100 for
10 s). Its start and end images are **real frames of the existing footage**,
uploaded with `scripts/film/hf-upload.mjs`. `scripts/film/splice-clip.mjs`
then swaps the insert in for that stretch and blends 4 frames at each cut.

| insert | job | replaces | start → end frame | result |
|---|---|---|---|---|
| `P03_FOLD` | `3204cc93…` | palace-03 f160–240 | p03 f160 (door shut) → P04 f0 (`bb20e02f…`) | door folds itself down from the top, then becomes the book; model cut at insert f91 blended (78→92). palace-03 now 281 f |
| `P02_BEDROOM` | `a182cac9…` | palace-02 f56–138 | p02 f56 (`b5ea072e…`) → p02 f138 (`ca88357e…`) | plain tumbler of water by the bed, no lamp; model cuts at f46 and f91 blended. palace-02 now 279 f |

Re-timed keys: palace-02 room_a 101 · room_b 170 · room_c 215 · door_ahead 278.
palace-03 `door_opens` renamed `door_folds` 195 · fold_to_book 238 ·
book_closed 280. Max frame-to-frame Δ after splicing: P02 14.1 (camera
motion), P03 5.1. Seams P01→P02 3.3 · P02→P03 2.8 · P03→P04 2.4.

**P04 opening** (no render; handoff says do not regenerate P04): new pin
"Left alone, even a kept book fades." over the empty-room shot (`lift` →
light_1). The quiet room now states the problem, and the lights that follow
are the answer.

Credits: 494 → 394 (two inserts × 50).

Verification (2026-10-27): `npm run test:film` 9/9, audit 0 problems × 4
viewports, truth ok=65 issues=0, 55 fps · `test:film:safari` audit 0 × 4
(desktop included), truth ok; webkit perf 19 fps in the parallel run (CPU
contention), 34 fps when re-run alone · `npm test` 1842/1842 · tsc · eslint ·
scan:style · smoke 26/26.

### Round 5 — hero reshoot, the pop-up book (2026-10-28, Claude; ~104 credits)

Owner asked for "the best possible hero other than an empty paper". Five
concepts were pitched (pop-up book · pages that forget · macro reveal · a hand
sets it down · re-render the fold); owner picked the pop-up book. One render,
no retry:

| film | job | frames | snap blended | keys (re-timed from real frames) | notes |
|---|---|---|---|---|---|
| palace-00 v4 | `d85a550a…` | 241 | f172→191 | book 0 · cover_lifts 28 · building_up 100 · doorway 156 · push_in 172 · through 240 | start still `P00_BOOK_START` #1 (`7940d994…`), end = the P00_END seam still (`8a6f1fa3…`) so P01 untouched; flux hard-cut to the end image at f186→190 (its usual tell), dissolved; after blend p50 3.7 · p95 11 · max 13 · no spikes; seam P00→P01 Δ 4.2 |

Portrait: the 16:9 book fills ~75 % of frame width, so the old centre crop
turned the phone hero into an abstract paper macro. `encode.mjs` gained
`--portrait-ramp a,b`: the portrait variant is the whole frame letterboxed on
the velvet (bars take the darkest corner colour, so no edge) up to frame a,
zooming smoothly to the centre cover crop by frame b, cover after — so the
book sits small under the stacked copy and the push-in lands on the same crop
P01's portrait variant uses. palace-00 encoded with `--portrait-ramp 150,200`.

Auth: the Higgsfield OAuth token Cline stores expires after 24 h and Cline
never refreshes it because the server is kept disabled; `hf.mjs` now refreshes
it itself on a 401 (refresh_token grant at the issuer's token endpoint) and
writes the new token set back into the same record. Balance before 310.5 (the
394 noted after round 4 had dropped outside these scripts).

Final read-through (same day, by eye at 1440×900 and 390×844): the hero h1
wrapped "read." alone onto its second line at 1440 and the phone beat pill
left "INSIDE." orphaned; `.film-h1` and `.film-label` now carry
`text-wrap: balance` (labels also `line-height: 1.4` for the two-line case).
Turbopack served the stale label rule until `.next-chapterflow` was cleared
and dev restarted — the known trap, not an HMR bug in the edit.

Phone framing (2026-10-28, after launch): every `-p` variant re-encoded with
`--portrait-zoom 1.6 --portrait-only` from the film's own landscape frames
(the blind 9:16 centre crop showed 32 % of each scene); the hero ramp ends at
the same zoom. Versions bumped: all seven films.

### Round 4 — evaluation + seam repair (2026-10-27, Claude; 0 credits)

Reading the encoded frames (not the HUD) found that **P04's start still was
letterboxed**: `p04_f0.png` carries 127 px black bars top and bottom at 1080p
(168 px at 1440p). flux kept the bars in P04 f0–19 and, because that still was
also the P03_FOLD insert's end image and p03v3's end image, in P03 f250–280 and
p03v3's own tail — so the P03→P04 dissolve showed a black slab snapping in and
out. The earlier seam figure (2.6) compared two letterboxed frames with each
other, which is why it looked fine on paper.

Fix, all offline (`scripts/film/deletterbox.mjs`): per frame, detect bars by
the brightest sampled pixel (`< 6`; a mean test misfires on the dark void
above the tower, whose grain peaks at ~28), require bars on BOTH edges
(≥ 8 rows), crop the inner picture to 16:9 and rescale. Applied to the raw
clips before any blend, so blends never ramp toward a barred frame:

| film | chain | frames | notes |
|---|---|---|---|
| palace-03 v4 | `deletterbox(p03v3)` + `deletterbox(p03fold)` → `blend-tail 78→92` → `splice 160..240 --blend 4` → encode | 281 (unchanged, keys unchanged) | base tail (f230–240) was barred too → the splice's end-blend had been mixing bars back in |
| palace-04 v3 | `deletterbox(p04v2)` → `blend-tail 6→21` (model cut from the barred still to its own framing) → `blend-tail 43→55` (model hard cut, room floor → tower exterior, Δ64 in v2) → encode | 241 (unchanged, keys unchanged) | `v` mvrf9r3t |

After: strict bar scan = 0 frames in every film; seams P02→P03 3.2 · P03→P04
3.0 · P04→P05 2.7; max frame-to-frame Δ P03 5.1 · P04 16 (camera motion).

Verification (2026-10-27, round 4): `npm run test:film` 9/9 — audit **0
problems × 4 viewports**, truth ok=65 issues=0, perf 53 fps · `test:film:safari`
audit 0 × 4 (desktop included), truth ok=65, perf 23 fps (gate 20); the reel
spec's canvas-painted read flaked once under 4 parallel WebKit workers and now
polls · `npm test` 1842/1842 · `tsc --noEmit` clean · eslint clean on every
touched file (`npm run lint` as a whole fails on 9 pre-existing react-hooks
errors in untouched files plus stale `.claude/worktrees/*` that eslint scans) ·
smoke 26/26.

Smoothness pass (same day): `scripts/film/smoothness.mjs` found three model
hard cuts inside **P05** (0-based 1→2, 46→47, 88→89; Δ 69 / 41 / 45 against a
local median of ~1–12) — the "jerk" in the orbit. Dissolved offline:
`blend-tail --from 1 --to 15 --head` (new mode: holds the seam-anchor frame and
dissolves INTO the post-cut footage, so frame 0 = P04's last frame is untouched),
then `--from 35 --to 47` and `--from 77 --to 89`; re-encoded (v after encode in
`book.timeline.json`). P05 now p95 13.8 · max 17.5 · no spikes; every film
spike-free except P00's natural fold accelerations (f33–35, f67; ≤ 12).

Runtime: the engine flipped `<html data-reel-chrome>` to `body` for the last
viewport of EVERY segment (each reaches p = 1 while its stage slides out), which
pulsed the nav scrim and cost a 120–250 ms style recalc at each boundary. Now
gated on the last segment (`use-scrub-loop.ts`). Measured with the new
`scripts/film/scrub-smoothness.mjs` (wheel scrub at read / brisk / flick on
desktop + phone, production bundle, **headed Chromium = GPU raster**): 58–60 fps,
0 long tasks, 0 holds, worst stall 67–68 ms (one, at the body handoff). Headless
Chromium rasterises in software and reports 100–400 ms RasterTask stalls on the
desktop canvas — pessimistic, not what users see.

Seam freeze (owner report, same day): at every chapter boundary the film held
its last frame for a full viewport of scroll (~885 px at 1440×900) while the
stage slid out, then cut into the next film with a 14-frame dissolve that spans
135 px — the "gap, then replace" at the hero and the tower. Footage seams are
continuous (Δ 2–3); the freeze was `pickActive` mapping each film onto its
sticky travel only. Every segment after the first now starts one viewport early
and scrubs over `travel + vh` (lead-in), so the next film moves while the
previous stage slides out. Verified with `scripts/film/seam-geometry.mjs`
(frame advances every 15 px across both seams, no hold) and seam contact
sheets at 1440 and 390. Hero pace 3.2 → 4. The hero's own remaining
roughness is in the footage: P00's crease pops at f32→33 and f66→67 (paper
snapping into its fold) — a regen question, not an engine one.

Code/copy changes in the same pass (see `HANDOFF_MEMORY_PALACE.md` §0a):
scrim containers fade with their copy (`FramePin scrim`), hall block drops to
the lower third on phones, split columns 0.88/1.12, quiz lede matches the
multiple-choice product, hall/hero numbers from `lib/catalog-stats`, Hall and
Examples labels name Atomic Habits, Home beat no longer repeats RecallClose,
CSP accepts the `NEXT_PUBLIC_FILM_BASE` origin.

## 5. Deliverables

- [ ] 7 PNG sequences (or mp4) at 2560×1440, 24 fps, counts per §2
- [ ] optional 9:16 camera per shot (else `encode.mjs --portrait` centre-crops; pass `--portrait-crop` where the object is off-centre: P00, P01, P03)
- [ ] frame-0 and frame-last stills per shot (continuity check + Higgsfield start/end)
- [ ] continuity pairs verified: P00→P01 … P05→P06

Encode:
```bash
node scripts/film/encode.mjs ~/renders/P00 palace-00 --portrait --portrait-crop 1100,0,810,1440
node scripts/film/encode.mjs ~/renders/P03.mp4 palace-03 --from-video --portrait
# counts sync into book.timeline.json automatically; then set key frames from your render
```

