# Hero reshoot: the pop-up book (palace-00 v4)

Date: 2026-10-28 · Owner pick: "Pop-up book" (over pages-that-forget, macro
reveal, hand-sets-it-down, re-render-the-fold) · Status: APPROVED 2026-10-28 and
RENDERED in one attempt (job `d85a550a…`, ~104 credits); shipped as palace-00
v4. See `MEMORY_PALACE_SHOTLIST.md` §4 "Round 5" for what the render needed
(push-in cut dissolved f172→191, portrait contain→cover ramp).

## 1. Goal

Replace the hero film (`palace-00`, the blank sheet that folds into a doorway)
with one that states the product in a single physical motion: **open a book,
and a building stands up out of it.** It is the first thing a visitor sees
under "Stop forgetting what you read." and it foreshadows the end of the reel
(the library is a city of buildings, one per book).

Must feel photographed, not rendered. Must be unique. Must end on the exact
frame the Hall of Summary starts from, so nothing downstream changes.

## 2. The shot (10 s · 241 f at 24 fps · one take, no cuts, no hands)

| time | frames | what happens | copy over it |
|---|---|---|---|
| 0–2 s | 0–48 | A small closed hand-bound book rests on black velvet, lit from above-right. Nothing moves except one thread of incense and a millimetre of lift at the cover's corner. Calm. | headline, lede, CTAs (`sheet`→`book` pin, from 0) |
| 2–5 s | 48–120 | The front cover swings open on its own at the pace of heavy board. As it passes vertical, card walls hinged into the gutter rise the way a pop-up book works, pulled by paper tabs: a tower of cream cotton-rag, two storeys, one dark doorway at its base. | copy still up; building rises under the headline (same as today's doorway) |
| 5–7 s | 120–168 | The pop-up locks upright with the tiny spring of card. The LED is now behind it: walls glow through, the doorway reads pure black. | "No card · free · N titles" label (from `doorway − 30`) |
| 7–10 s | 168–240 | Camera dollies straight forward and slightly down toward the doorway at constant speed; the open pages leave the frame at the bottom; stops 5 cm from the opening on the END IMAGE: black opening = centre 40 % of frame width, glowing walls either side, lintel cropped by the frame top. | copy clears at `push_in`; "Every book is a building. Step inside." (from `push_in + 20`, hold) |

Keys (provisional, re-timed from the real frames after encode, §6 of the
handoff): `book 0 · cover_lifts 48 · building_up 120 · doorway 168 · push_in
175 · through 240`. Engine pace stays 4.

## 3. Continuity (non-negotiable)

- END image = the existing seam still `STILLS.P00_END`, media id
  `8a6f1fa3-77b6-428d-8251-6dd97829c97c` (also P01's start image). Reusing it
  means P01 is untouched and the seam Δ stays ≈ 3.
- START image = a new still (`STILLS.P00_BOOK_START`, 2 candidates, pick by
  eye from the contact sheet; score is advisory).
- If flux hard-cuts to the end image instead of dollying into it (it did on
  P00 v3 at f145→163): `blend-tail.mjs --from a --to b` as before, not a
  re-render.

## 4. Prompts (§5 standard: BIBLE + SUBJECT / LIGHT / CAMERA / FILM / COMPOSITION, 2.5–3.5 k chars)

Both go into `scripts/film/palace-prompts.mjs` as new keys; the old P00 keys
stay for the record.

### `STILLS.P00_BOOK_START`

> ${BIBLE} SUBJECT: A small closed book, 9 × 12 cm and 2 cm thick, hand-bound:
> cover boards wrapped in the same cream Hahnemühle 300 gsm cotton-rag, the
> wrap worn soft and slightly lifted at the corners, one corner bumped, a
> faint pencil tick on the spine where the boards were squared. The text block
> is a stack of about sixty blank cotton-rag leaves whose fore-edge is deckled,
> furred and uneven, fanned open a millimetre or two as a book is after many
> readings. A short tail of unbleached cotton ribbon marker trails from the
> foot. It lies flat on black velvet, front cover up, spine toward camera-left,
> turned about 15° off square, 35 cm from the lens. ${NEG} LIGHT: a single
> bare 5 W LED gelled Lee 181 Congo Blue, above and right of camera at about
> 45°, rakes across the cover so the paper tooth casts micro-shadows and the
> furred fore-edge reads as a bright line; the lit centre of the cover is warm
> cream, the edges and the velvet shadow side go periwinkle. One thread of
> incense smoke rises behind the book and catches the blue. Black velvet
> everywhere else; no fill, no rim, no second source. CAMERA: Laowa 24 mm
> probe at T2.8 on a full-frame cinema body, lens 6 cm above the velvet,
> looking slightly down at the book; focus on the near corner of the cover,
> the far spine edge softening; natural vignetting in the corners. FILM:
> Kodak Vision3 500T grain, gentle halation on the brightest fore-edge, faint
> cyan fringe where paper meets black. COMPOSITION: 16:9; the book sits in the
> lower-middle of frame, filling about 40 % of frame width; generous black
> above it; the top 12 % of frame is empty velvet.

### `VIDEOS.P00_BOOK`

> ${BIBLE} SUBJECT: the small closed hand-bound book of cream cotton-rag from
> the start image, 9 × 12 cm, lying on black velvet; inside it, hinged into the
> gutter of the first spread, a pop-up of the same paper: card walls and a
> lintel cut and scored by hand, held by paper tabs glued with PVA, folded flat
> between the pages. ${NEG} Every surface stays blank from first frame to last.
> ACTION, 10 seconds, one continuous take, no cuts, no hands: 0–2 s the book
> rests; only the incense moves and the cover's near corner lifts a
> millimetre. 2–5 s the front cover swings open on its own at the slow, even
> pace of heavy board, and as it passes vertical the pop-up rises from the
> gutter the way a pop-up book works, tabs pulling the card walls upright until
> a small tower stands on the open spread: two storeys tall, one dark doorway
> about 4 cm wide at its base, card-stiff, never cloth. 5–7 s the tower
> settles upright with the tiny spring of card; nothing else moves. 7–10 s the camera dollies straight forward and
> slightly down at constant speed toward the doorway, the open pages sliding
> out of the bottom of frame, and stops 5 cm from the opening, matching the end
> image exactly: the black opening filling the centre 40 % of frame width, the
> glowing paper walls framing it left and right, the lintel cropped by the
> frame top. LIGHT: one bare 5 W LED gelled Lee 181 Congo Blue; above-right
> while the book is closed, raking the cover's tooth; once the tower stands the
> light is behind it so the walls glow through faintly and the inner edges of
> the doorway are the brightest lines in frame. One slow thread of incense
> drifts throughout. No fill, no second source. CAMERA: Laowa 24 mm probe at
> T2.8 on a motion-control dolly, locked off until 7 s, then one straight
> push with no wobble, no zoom, no tilt; mild lens breathing on the doorway's
> edges. FILM: Kodak Vision3 500T
> grain, gentle halation on the brightest paper edges, faint cyan fringe where
> paper meets black. COMPOSITION: the book and then the tower dead centre with
> black above; the top 12 % of frame stays dark throughout.

## 5. Pipeline (proven chain, `HANDOFF_MEMORY_PALACE.md` §3)

```bash
node scripts/film/hf.mjs balance '{}'                      # must be ≥ 110
node scripts/film/hf-stills.mjs P00_BOOK_START --n 2       # ~4 cr → contact sheet → owner/eye pick
node scripts/film/hf-video.mjs P00_BOOK <start_media> 8a6f1fa3-77b6-428d-8251-6dd97829c97c --duration 10   # 100 cr
node scripts/film/hf-fetch.mjs ~/renders p00v4=<job>       # foreground, 3–8 min
node scripts/film/smoothness.mjs  # on the encoded dir; blend-tail any model cut
rm -rf public/films/palace-00 public/films/palace-00-p
node scripts/film/encode.mjs ~/renders/p00v4.mp4 palace-00 --from-video --fps 24 --portrait --quality 78 </dev/null
```

Then: contact sheet of the real frames → re-time keys → `book.timeline.json`
→ `FoldChapter.tsx` key names (`sheet`→`book`, add `cover_lifts`,
`building_up`) → `rm -rf .next-chapterflow`, restart dev → seam-geometry +
scrub-smoothness → `npm run test:film` + safari → docs + memory.

## 6. Budget and stop rules

- Balance 394. First attempt ≈ 104 cr (2 stills + 1 video).
- After the first render: contact sheet to the owner **before** any retry.
- Hard cap for this reshoot: 2 video attempts (≤ 220 cr). If neither reads
  as a pop-up book, stop and report; do not iterate blind.
- Never Seedance (160 cr, no measured gain). Never regenerate P01 to fix a
  seam; the end image makes the seam.

## 7. Verification (definition of done)

- Frames read by eye (contact sheets), not the HUD: book → cover → pop-up →
  push-in, no printed text anywhere, top 12 % band empty.
- `smoothness.mjs palace-00`: no spikes above local median × 3 except the
  card "lock" beat.
- Seam P00→P01 mean abs Δ ≤ 4 (`seams` check), seam-geometry continuous.
- `test:film` chromium + safari green (audit 0 × 4, truth, perf, reel), smoke,
  unit suite, tsc.
- Headed scrub-smoothness: 58–60 fps, 0 holds.

## 8. Blocker

Higgsfield returns `HTTP 401 Unauthorized` for the token Cline stored
(`~/.cline/data/settings/cline_mcp_settings.json`, server `mcp-hf`). Owner
must sign in to that MCP server again in Cline (or export
`HIGGSFIELD_TOKEN`) before step 5 can run.

## 9. Out of scope

P01–P06 untouched. Hero copy unchanged except key names. No new engine work.
