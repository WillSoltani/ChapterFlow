/**
 * Film reel types — the scroll-scrubbed image-sequence engine.
 *
 * A "film" is a folder of pre-rendered frames (Blender / Higgsfield output,
 * encoded by scripts/film/encode.mjs) plus a poster and a manifest.json. A
 * "reel" is the ordered list of films the landing scrubs through as you scroll.
 */

export type FilmVariant = {
  /** Folder name under the film base, e.g. "palace-01" or "palace-01-b900". */
  name: string;
  /** Number of frames in the sequence (f_0001 … f_NNNN). */
  count: number;
  /** Zero-pad width of the frame index in filenames. */
  pad: number;
  /** File extension without the dot. */
  ext: "webp" | "avif" | "jpg";
  /** Real pixel size of the frame files (px): what one decoded frame costs. */
  width: number;
  height: number;
  /** URL of the poster image (first frame, served immediately). */
  poster: string;
  /** Base URL for this variant's frame folder. */
  base: string;
  /** Content version (from manifest.json `v`), appended as ?v= to every frame URL. */
  v?: string;
  /**
   * Band tiers only: the virtual frame the file is a band of (1080×1920, the
   * old full portrait frame) and where the band sits in it (virtual px). The
   * file's pixels fill exactly `band`; the rest of the virtual frame is the
   * canvas clear colour. Placement is computed on the virtual frame (see
   * variantPlacement in scrub.ts), so the picture lands where the full frame
   * put it.
   */
  frame?: FrameSize;
  band?: BandRect;
};

export type FrameSize = { w: number; h: number };
export type BandRect = { x: number; y: number; w: number; h: number };

/** A band-only portrait tier ("<film>-b900", "<film>-b1080"). */
export type BandTier = FilmVariant & { frame: FrameSize; band: BandRect };

export type FilmManifest = {
  /** Film name shared by every variant. */
  name: string;
  landscape: FilmVariant;
  /**
   * Band-only portrait tiers, narrowest first. Portrait views pick one by
   * canvas backing width (pickVariant); none = portrait draws landscape.
   */
  bands: BandTier[];
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
      /**
       * Band tiers by tier name ("b1080", "b900"), synced from their
       * manifests by encode.mjs (--bands). Each has its own version.
       */
      bands?: Record<string, { width: number; height: number; frame: FrameSize; band: BandRect; v?: string }>;
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
