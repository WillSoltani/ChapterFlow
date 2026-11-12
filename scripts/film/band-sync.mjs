/**
 * band-sync.mjs — the pure part of encode.mjs's timeline sync for portrait
 * band tiers (films.<name>.bands.<tier> in components/film/book.timeline.json).
 * Kept separate so lib/film-band-sync.test.ts can test it without running
 * the encoder.
 */

/** Frames 0 … OPENING_FRAMES − 1 are the opening window (pack-lib.mjs, pack-plan.ts). */
const OPENING_FRAMES = 48;

/** Band tiers written by encode.mjs --bands: output width (the height keeps the band's aspect). */
export const BAND_TIER_WIDTHS = [1080, 900];

/**
 * The timeline entry for one band tier, from the tier's manifest.
 *
 * - The version: the manifest's `v`, or, when the manifest has none (the
 *   placeholder writes none), the version the timeline already holds, the
 *   same way the landscape variant keeps its `v`. Dropping it would leave
 *   the tier's frame URLs with no `?v=` while the CDN serves them immutable.
 * - `stale`: a message when the tier holds a different number of frames than
 *   the film (the tier was encoded from an older render; the film's frames
 *   past the tier's count would 404 and the rest show the old render), else
 *   null. The timeline gives every variant the film's count, so a tier must
 *   match it.
 *
 * @param {{ v?: string } | undefined} prev  the timeline's current entry
 * @param {{ width: number, height: number, frame: { w: number, h: number }, band: { x: number, y: number, w: number, h: number }, count?: number, v?: string }} manifest
 * @param {number} filmCount  the film's frame count (its landscape manifest)
 * @param {string} dirName  the tier directory, for the message
 * @returns {{ entry: { width: number, height: number, frame: { w: number, h: number }, band: { x: number, y: number, w: number, h: number }, v?: string }, stale: string | null }}
 */
export function bandTierEntry(prev, manifest, filmCount, dirName) {
  const v = manifest.v || prev?.v;
  const entry = { width: manifest.width, height: manifest.height, frame: manifest.frame, band: manifest.band, ...(v ? { v } : {}) };
  const stale =
    manifest.count !== filmCount
      ? `${dirName} holds ${manifest.count ?? "an unknown number of"} frames but the film has ${filmCount}: ` +
        "re-encode its band tiers (encode.mjs … --bands, docs/FILM_REEL.md) from the current render"
      : null;
  return { entry, stale };
}

/**
 * The timeline entry for a variant's pack (films.<name>.pack, or
 * films.<name>.bands.<tier>.pack), from its manifest and what is on disk.
 *
 * - The version: the manifest's `pack.v`, or, when it has none, the one the
 *   timeline already holds (as for band tiers above).
 * - `stale`: a message when pack.bin no longer matches its directory (a
 *   frame re-encoded, added or removed after the pack was built, the
 *   manifest rewritten without its `pack` field, the film's count changed,
 *   the manifest and the file disagree, or pack.bin is gone). A stale pack
 *   is NOT recorded (entry null): the runtime then loads that variant frame
 *   by frame instead of drawing an old render, and the sync exits 1.
 * - No pack.bin and no `pack` in the manifest, but the timeline records a
 *   pack (a checkout whose folders were copied without pack.bin, or written
 *   before packs): the timeline's entry is KEPT, unverified, and reported
 *   (`stale`, exit 1), never silently deleted. With nothing in the timeline
 *   either, there is nothing to record and nothing to report.
 * Frame sizes are compared, not bytes (cheap); `npm run film:pack -- --verify`
 * compares every byte.
 *
 * @param {{ bytes: number, header: number, skeletonEnd: number, openingEnd?: number, v?: string } | undefined} prev
 * @param {{ bytes: number, header: number, skeletonEnd: number, openingEnd?: number, v?: string } | undefined} manifestPack
 * @param {{ header: null | { error?: string, count?: number, bytes?: number, header?: number, skeletonEnd?: number, entries?: Array<{ index: number, offset: number, length: number }> }, fileBytes: number, sizes: number[] }} onDisk
 * @param {number} filmCount
 * @param {string} dirName
 * @returns {{ entry: { bytes: number, header: number, skeletonEnd: number, openingEnd?: number, v?: string } | null, stale: string | null }}
 */
export function packTimelineEntry(prev, manifestPack, onDisk, filmCount, dirName) {
  const fix = "rebuild it with `npm run film:pack` (docs/FILM_REEL.md)";
  const h = onDisk.header;
  if (!h) {
    if (!manifestPack) {
      if (!prev) return { entry: null, stale: null };
      return {
        entry: prev,
        stale: `${dirName}: no pack.bin here, but the timeline records a pack: its entry is kept unverified (folders copied without pack.bin?); ${fix}, or upload it per docs/FILM_REEL.md`,
      };
    }
    return { entry: null, stale: `${dirName}: manifest.json records a pack but there is no pack.bin: ${fix}` };
  }
  const fail = (why) => ({ entry: null, stale: `${dirName}: STALE PACK, ${why}: ${fix}` });
  if (h.error) return fail(h.error);
  if (!manifestPack) return fail("pack.bin is not recorded in its manifest.json (the directory was re-encoded?)");
  if (h.count !== onDisk.sizes.length) return fail(`pack.bin holds ${h.count} frames but the directory has ${onDisk.sizes.length}`);
  if (h.count !== filmCount) return fail(`pack.bin holds ${h.count} frames but the film has ${filmCount}`);
  if (onDisk.fileBytes !== manifestPack.bytes) return fail(`manifest says ${manifestPack.bytes} bytes, pack.bin is ${onDisk.fileBytes}`);
  if (h.bytes !== onDisk.fileBytes) return fail(`pack.bin's header says ${h.bytes} bytes, the file is ${onDisk.fileBytes}`);
  if (h.header !== manifestPack.header) return fail(`manifest says a ${manifestPack.header}-byte header, pack.bin has ${h.header}`);
  if (h.skeletonEnd !== manifestPack.skeletonEnd) return fail(`manifest says the skeleton ends at ${manifestPack.skeletonEnd}, pack.bin at ${h.skeletonEnd}`);
  let openingEnd = h.header ?? 0;
  for (const e of h.entries ?? []) {
    const size = onDisk.sizes[e.index];
    if (size !== e.length) return fail(`frame ${e.index} is ${size ?? "missing"} bytes on disk, ${e.length} in the pack`);
    if (e.index < OPENING_FRAMES) openingEnd = Math.max(openingEnd, e.offset + e.length);
  }
  if (manifestPack.openingEnd !== undefined && manifestPack.openingEnd !== openingEnd) {
    return fail(`manifest says the opening window ends at ${manifestPack.openingEnd}, pack.bin at ${openingEnd}`);
  }
  const v = manifestPack.v || prev?.v;
  return {
    entry: { bytes: manifestPack.bytes, header: manifestPack.header, skeletonEnd: manifestPack.skeletonEnd, openingEnd, ...(v ? { v } : {}) },
    stale: null,
  };
}
