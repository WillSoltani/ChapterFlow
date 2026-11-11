/**
 * band-sync.mjs — the pure part of encode.mjs's timeline sync for portrait
 * band tiers (films.<name>.bands.<tier> in components/film/book.timeline.json).
 * Kept separate so lib/film-band-sync.test.ts can test it without running
 * the encoder.
 */

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
