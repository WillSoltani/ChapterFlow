/**
 * Messages between the page (pack-client.ts) and the film worker
 * (film-worker.ts). Structured-clone data only; decoded frames travel as
 * transferred ImageBitmaps.
 */

import type { NetPack, NetStats, NetWhere } from "./pack-net";

export type ToWorker =
  /** First message: the compressed-byte cap (48 MB phones, 160 MB otherwise). */
  | { t: "init"; cap: number }
  /** The reel's packs for the current view, in film order (re-sent when the view changes). */
  | { t: "packs"; packs: Array<NetPack & { type: string }> }
  /** Where the visitor is (one per scroll decision, and on scroll/visibility/connection changes). */
  | { t: "where"; where: NetWhere }
  /** Decode a held frame. */
  | { t: "decode"; id: number; key: string; index: number };

export type FromWorker =
  /** Reply to init: false when the worker lacks createImageBitmap or a streaming fetch body. */
  | { t: "ready"; ok: boolean; missing?: string }
  /** Frames whose bytes arrived (complete) or were dropped (byte cap, failure). */
  | { t: "frames"; key: string; added: number[]; removed: number[] }
  /** The pack is unusable for the rest of the page view: load the variant frame by frame. */
  | { t: "failed"; key: string; reason: string }
  | { t: "stats"; stats: NetStats }
  /** A decode result: the bitmap (transferred) and the decode time in the worker. */
  | { t: "decoded"; id: number; ok: true; bitmap: ImageBitmap; ms: number }
  | { t: "decoded"; id: number; ok: false; reason: "missing" | "error" };
