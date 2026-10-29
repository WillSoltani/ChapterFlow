#!/usr/bin/env node
/**
 * encode.mjs — turn a Blender / Higgsfield frame dump into a web film.
 *
 *   node scripts/film/encode.mjs <input-dir> <film-name> [options]
 *
 * Input: a folder of sequential PNG/JPG/EXR-converted frames (any names; sorted
 * naturally), OR with --from-video an mp4/mov (Higgsfield export) which is
 * split to PNG with ffmpeg first. Output: public/films/<film-name>/f_0001.webp
 * … + poster.webp + manifest.json, and (with --portrait)
 * public/films/<film-name>-p/… cropped 9:16 from the centre (or
 * --portrait-crop x,y,w,h in source px).
 *
 * Options:
 *   --from-video         input is a video file; needs ffmpeg on PATH
 *   --fps 24             frame rate to extract at (with --from-video)
 *   --width 1920         landscape output width (height keeps aspect)
 *   --quality 78         webp quality
 *   --every 1            keep every Nth source frame (2 = halve frame count)
 *   --portrait           also emit a 1080×1920 portrait variant
 *   --portrait-crop x,y,w,h  explicit source crop for portrait (defaults centre)
 *   --portrait-zoom z    portrait framing for a 16:9 source: z = 1 is CONTAIN
 *                        (whole frame 1080 wide, letterboxed top and bottom on
 *                        the frame's darkest corner colour); larger z scales
 *                        the frame up around its centre, so less of the scene
 *                        width shows but the band is taller. The plain centre
 *                        9:16 cover crop is z = 3.16 for 1920×1080 and shows
 *                        only 32 % of the scene width — too little on a phone.
 *                        Default (no flag): the cover crop, as before.
 *   --portrait-ramp a,b  animate the portrait zoom: contain (z = 1) up to frame
 *                        a, smoothstep to --portrait-zoom (or cover) by frame b.
 *   --portrait-bars #rrggbb  letterbox bar colour. Default: the frame's darkest
 *                        corner patch (hides the edge on velvet frames, but on
 *                        a warm paper scene the bars come out brown and shift
 *                        frame to frame). The reel passes the page background
 *                        (#06070A) so the band sits on the page like a strip.
 *   --portrait-only      write only the portrait variant (landscape dir and
 *                        its manifest/version untouched); input may be the
 *                        film's own public/films/<name> landscape frames.
 *   --out public/films   output root
 *   --dry                print plan, write nothing
 *
 * Then run `node scripts/film/encode.mjs --sync-timeline` to copy counts into
 * components/film/book.timeline.json.
 */

import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import sharp from "sharp";

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return def;
  const v = args[i + 1];
  if (v === undefined || v.startsWith("--")) return true;
  return v;
};

const ROOT = process.cwd();
const OUT_ROOT = path.resolve(ROOT, String(opt("out", "public/films")));
const TIMELINE = path.resolve(ROOT, "components/film/book.timeline.json");

if (opt("sync-timeline", false)) {
  await syncTimeline();
  process.exit(0);
}

const [inputArg, filmName] = args.filter((a) => !a.startsWith("--") && !/^\d|,/.test(a)).slice(0, 2);
if (!inputArg || !filmName) {
  console.error("usage: encode.mjs <input-dir|video> <film-name> [--from-video] [--fps 24] [--width 1920] [--quality 78] [--every 1] [--portrait] [--dry]");
  process.exit(1);
}

// --from-video: split the clip to PNG in a temp dir with ffmpeg, then proceed as a folder.
let inputDir = inputArg;
if (opt("from-video", false)) {
  const fps = Number(opt("fps", 24));
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "cf-film-"));
  const ff = spawnSync(
    "ffmpeg",
    ["-hide_banner", "-loglevel", "error", "-i", path.resolve(ROOT, inputArg), "-vf", `fps=${fps}`, "-pix_fmt", "rgb24", path.join(tmp, "f_%05d.png")],
    { stdio: "inherit" },
  );
  if (ff.error || ff.status !== 0) {
    console.error("ffmpeg failed — install with `brew install ffmpeg`");
    process.exit(1);
  }
  inputDir = tmp;
  console.log(`extracted frames → ${tmp}`);
}

const width = Number(opt("width", 1920));
const quality = Number(opt("quality", 78));
const every = Math.max(1, Number(opt("every", 1)));
const portrait = Boolean(opt("portrait", false));
const portraitCrop = opt("portrait-crop", null);
const portraitRamp = opt("portrait-ramp", null);
const ramp = portraitRamp ? String(portraitRamp).split(",").map(Number) : null;
const portraitZoom = opt("portrait-zoom", null);
const zoom = portraitZoom ? Number(portraitZoom) : null;
const portraitOnly = Boolean(opt("portrait-only", false));
const portraitBars = opt("portrait-bars", null);
const barsRgb = portraitBars
  ? (() => {
      const m = /^#?([0-9a-f]{6})$/i.exec(String(portraitBars));
      if (!m) throw new Error(`--portrait-bars expects #rrggbb, got ${portraitBars}`);
      const n = parseInt(m[1], 16);
      return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    })()
  : null;
const dry = Boolean(opt("dry", false));

const naturalSort = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
const srcFiles = (await fs.readdir(path.resolve(ROOT, inputDir)))
  .filter((f) => /\.(png|jpe?g|webp|tiff?)$/i.test(f) && f !== "poster.webp")
  .sort(naturalSort)
  .filter((_, i) => i % every === 0);

if (srcFiles.length === 0) {
  console.error(`no frames found in ${inputDir}`);
  process.exit(1);
}

const pad = Math.max(4, String(srcFiles.length).length);
const first = sharp(path.resolve(ROOT, inputDir, srcFiles[0]));
const meta = await first.metadata();
const srcW = meta.width ?? 0;
const srcH = meta.height ?? 0;
const landH = Math.round((srcH / srcW) * width);

let crop = null;
if (portrait) {
  if (portraitCrop) {
    const [x, y, w, h] = String(portraitCrop).split(",").map(Number);
    crop = { left: x, top: y, width: w, height: h };
  } else {
    const h = srcH;
    const w = Math.round((h * 9) / 16);
    crop = { left: Math.round((srcW - w) / 2), top: 0, width: w, height: h };
  }
}

console.log(`film ${filmName}: ${srcFiles.length} frames  src ${srcW}×${srcH}  → ${portraitOnly ? "(landscape untouched)" : `${width}×${landH}`}${portrait ? `  + portrait 1080×1920${zoom ? ` zoom ${zoom}` : ""}${ramp ? ` ramp ${ramp.join("→")}` : ""}` : ""}`);
if (dry) process.exit(0);

const landDir = path.join(OUT_ROOT, filmName);
const portDir = path.join(OUT_ROOT, `${filmName}-p`);
if (!portraitOnly) await fs.mkdir(landDir, { recursive: true });
if (portrait) await fs.mkdir(portDir, { recursive: true });

// Portrait framing as a scale factor on the source: contain → cover.
const sContain = 1080 / srcW;
const sCover = 1920 / srcH;
const sEnd = zoom ? sContain * zoom : sCover;

/** Letterbox-or-crop one frame at scale `sc` into a 1080×1920 webp. */
async function portraitAt(base, sc, outFile) {
  const w = Math.round(srcW * sc);
  const h = Math.round(srcH * sc);
  const left = Math.round((w - 1080) / 2);
  const top = Math.round((h - 1920) / 2); // negative while letterboxed
  const scaled = await base.clone().resize({ width: w, height: h }).toBuffer();
  if (top < 0) {
    // Letterboxed: bars take the colour of the frame's darkest corner patch
    // (the velvet), so the void runs through and no edge shows.
    let bg = barsRgb ?? { r: 0, g: 0, b: 0 };
    if (!barsRgb) {
      let darkest = Infinity;
      const P = 48;
      for (const [cx, cy] of [[0, 0], [w - P, 0], [0, h - P], [w - P, h - P]]) {
        const { data } = await sharp(scaled).extract({ left: cx, top: cy, width: P, height: P }).resize(1, 1, { fit: "fill" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
        const lum = data[0] * 0.3 + data[1] * 0.59 + data[2] * 0.11;
        if (lum < darkest) { darkest = lum; bg = { r: data[0], g: data[1], b: data[2] }; }
      }
    }
    await sharp({ create: { width: 1080, height: 1920, channels: 3, background: bg } })
      .composite([{ input: await sharp(scaled).extract({ left, top: 0, width: 1080, height: h }).toBuffer(), left: 0, top: -top }])
      .webp({ quality, effort: 4 }).toFile(outFile);
  } else {
    await sharp(scaled).extract({ left, top, width: 1080, height: 1920 }).webp({ quality, effort: 4 }).toFile(outFile);
  }
}

const CONCURRENCY = 8;
let done = 0;
async function encodeOne(i) {
  const src = path.resolve(ROOT, inputDir, srcFiles[i]);
  const name = `f_${String(i + 1).padStart(pad, "0")}.webp`;
  const base = sharp(src);
  if (!portraitOnly) await base.clone().resize({ width }).webp({ quality, effort: 4 }).toFile(path.join(landDir, name));
  if (portrait && crop && ramp) {
    // t = 0 → contain (scale so the frame is 1080 wide), t = 1 → the end zoom.
    const [a, b] = ramp;
    const u = i <= a ? 0 : i >= b ? 1 : (i - a) / (b - a);
    const t = u * u * (3 - 2 * u);
    await portraitAt(base, sContain + (sEnd - sContain) * t, path.join(portDir, name));
  } else if (portrait && crop && zoom) {
    await portraitAt(base, sEnd, path.join(portDir, name));
  } else if (portrait && crop) {
    await base.clone().extract(crop).resize({ width: 1080, height: 1920 }).webp({ quality, effort: 4 }).toFile(path.join(portDir, name));
  }
  done++;
  if (done % 20 === 0 || done === srcFiles.length) process.stdout.write(`  ${done}/${srcFiles.length}\r`);
}

const queue = srcFiles.map((_, i) => i);
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  while (queue.length) await encodeOne(queue.shift());
}));
process.stdout.write("\n");

// Content version: bumps on every encode so browsers never serve frames from
// a previous render (the frame URLs are otherwise identical).
const VERSION = Date.now().toString(36);
async function writeVariant(dir, w, h) {
  await fs.copyFile(path.join(dir, `f_${"1".padStart(pad, "0")}.webp`), path.join(dir, "poster.webp"));
  const manifest = { name: path.basename(dir), count: srcFiles.length, pad, ext: "webp", width: w, height: h, v: VERSION };
  await fs.writeFile(path.join(dir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
}
if (!portraitOnly) await writeVariant(landDir, width, landH);
if (portrait) await writeVariant(portDir, 1080, 1920);
if (portraitOnly) {
  // One content version per film (timeline.ts stamps ?v= on both variants from
  // the landscape manifest), so a portrait-only re-encode must bump the
  // landscape manifest's v too — otherwise browsers keep the old portrait
  // frames from cache under the unchanged URL. Landscape frames are untouched.
  const lm = path.join(landDir, "manifest.json");
  try {
    const m = JSON.parse(await fs.readFile(lm, "utf8"));
    m.v = VERSION;
    await fs.writeFile(lm, JSON.stringify(m, null, 2) + "\n");
  } catch {
    console.warn(`no landscape manifest at ${lm}; timeline v not bumped`);
  }
}
await syncTimeline();
console.log(`done → ${portraitOnly ? "" : path.relative(ROOT, landDir)}${portrait ? `${portraitOnly ? "" : ", "}${path.relative(ROOT, portDir)}` : ""}`);

async function syncTimeline() {
  let tl;
  try {
    tl = JSON.parse(await fs.readFile(TIMELINE, "utf8"));
  } catch {
    return;
  }
  let changed = false;
  for (const name of Object.keys(tl.films)) {
    try {
      const m = JSON.parse(await fs.readFile(path.join(OUT_ROOT, name, "manifest.json"), "utf8"));
      const film = tl.films[name];
      if (film.count !== m.count) {
        film.count = m.count;
        changed = true;
      }
      if (m.v && film.v !== m.v) {
        film.v = m.v;
        changed = true;
      }
      // The final key always means "last frame"; keep it pinned to count-1 and
      // clamp any key that a shorter render left out of range.
      const keyNames = Object.keys(film.keys);
      const lastKey = keyNames[keyNames.length - 1];
      for (const k of keyNames) {
        const want = k === lastKey ? m.count - 1 : Math.min(film.keys[k], m.count - 1);
        if (film.keys[k] !== want) {
          film.keys[k] = want;
          changed = true;
        }
      }
    } catch {
      /* film not encoded yet */
    }
  }
  if (changed) {
    await fs.writeFile(TIMELINE, JSON.stringify(tl, null, 2) + "\n");
    console.log("timeline counts synced");
  }
}
