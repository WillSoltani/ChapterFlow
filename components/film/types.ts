/**
 * Film reel types — the scroll-scrubbed image-sequence engine.
 *
 * A "film" is a folder of pre-rendered frames (Blender / Higgsfield output,
 * encoded by scripts/film/encode.mjs) plus a poster and a manifest.json. A
 * "reel" is the ordered list of films the landing scrubs through as you scroll.
 */

export type FilmVariant = {
  /** Folder name under the film base, e.g. "book-01" or "book-01-p". */
  name: string;
  /** Number of frames in the sequence (f_0001 … f_NNNN). */
  count: number;
  /** Zero-pad width of the frame index in filenames. */
  pad: number;
  /** File extension without the dot. */
  ext: "webp" | "avif" | "jpg";
  /** Intrinsic frame size (px). Used for cover-fit math. */
  width: number;
  height: number;
  /** URL of the poster image (first frame, served immediately). */
  poster: string;
  /** Base URL for this variant's frame folder. */
  base: string;
  /** Content version (from manifest.json `v`), appended as ?v= to every frame URL. */
  v?: string;
};

export type FilmManifest = {
  /** Film name shared by both orientations. */
  name: string;
  landscape: FilmVariant;
  /** Optional 9:16 variant for phones. Falls back to landscape when absent. */
  portrait?: FilmVariant;
};

export type Orientation = "landscape" | "portrait";

/** Named keyframes per film, authored in components/film/book.timeline.json. */
export type FilmTimeline = {
  films: Record<
    string,
    {
      count: number;
      /** Content version, bumped by encode.mjs on every encode; busts frame caches. */
      v?: string;
      keys: Record<string, number>;
    }
  >;
};

export type SegmentRegistration = {
  index: number;
  el: HTMLElement;
  film: FilmManifest;
  /** Frames to cross-fade from the previous film's last frame. */
  dissolveIn: number;
  /** Discrete frame steps under reduced motion. */
  reducedSteps: number;
  /** Micro-zoom amplitude while idle (0 = off). */
  breath: number;
  /** Section id reported on <html data-reel-section>. */
  section?: string;
  onProgress: (progress: number, frame: number) => void;
};

export type ReelChrome = "film" | "body";
