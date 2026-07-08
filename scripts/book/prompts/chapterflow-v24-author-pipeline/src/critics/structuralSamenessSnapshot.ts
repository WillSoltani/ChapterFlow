/**
 * structuralSamenessSnapshot — compact DETERMINISTIC sameness telemetry (F-06).
 *
 * The author-acceptance loop's only veto is the semantic panel + the composite
 * floor/margin; the deterministic anti-sameness critics (ARCH0/CM0) do not run on
 * that path. This helper produces a small, READ-ONLY snapshot of the deterministic
 * saturation state so it can ride the acceptance record as telemetry: a churn-HIGH
 * rejection can then be cross-checked against which skeleton axes / body devices
 * were actually over-saturated (attribution), WITHOUT feeding the accept predicate.
 *
 * It is computed from the chapters only — it touches no docText, so it never
 * changes the acceptance docSha / pooling key.
 */

import type { ChapterV21 } from "../types.js";
import {
  checkArchitectureMonoculture,
  DEFAULT_ARCHITECTURE_MONOCULTURE_THRESHOLDS,
} from "./architectureMonoculture.js";
import {
  reportContentMachinery,
  DEFAULT_CONTENT_MACHINERY_THRESHOLDS,
} from "./contentMachinery.js";
import { resolveStructuralSamenessMode, type StructuralSamenessMode } from "./structuralSamenessMode.js";
import type { ContentDeviceId } from "../compiler/contentDeviceDeal.js";

export type StructuralSamenessSnapshot = {
  /** The enforcement mode in force when this snapshot was taken (telemetry only —
   *  the snapshot never changes the accept predicate in any mode). */
  mode: StructuralSamenessMode;
  /** ARCH skeleton axes that fired (ARCH1..ARCH4), with the chapters each names. */
  archAxes: Array<{ id: string; chapters: number[] }>;
  /** True when ≥ axesBlock skeleton axes fired — a SEVERE structural mold. */
  archSevere: boolean;
  /** Content-machinery devices over the ubiquity cap, with book-wide fraction
   *  (rounded to 2dp) and the chapters that carry them. */
  contentOverCap: Array<{ id: ContentDeviceId; frac: number; chapters: number[] }>;
  /** True when ≥ axesBlock devices are over cap — a SEVERE content mold. */
  contentSevere: boolean;
};

/** Build the deterministic sameness snapshot for a whole book. Pure/read-only:
 *  no state writes, no docText, deterministic in the chapters. */
export function structuralSamenessSnapshot(chapters: ChapterV21[]): StructuralSamenessSnapshot {
  // Extract the per-axis ARCH minors explicitly at "advisory" so axis extraction
  // is mode-independent; severity here is derived from the axis COUNT, not the
  // (possibly promoted) ARCH0 aggregate severity.
  const archFindings = checkArchitectureMonoculture(
    chapters,
    DEFAULT_ARCHITECTURE_MONOCULTURE_THRESHOLDS,
    "advisory",
  );
  const archAxes = archFindings
    .filter((f) => /^ARCH[1-4]\./.test(f.catalogId))
    .map((f) => ({ id: f.catalogId, chapters: f.chapters ?? [] }));
  const archSevere = archAxes.length >= DEFAULT_ARCHITECTURE_MONOCULTURE_THRESHOLDS.axesBlock;

  const report = reportContentMachinery(chapters, DEFAULT_CONTENT_MACHINERY_THRESHOLDS);
  const contentOverCap = report.usage
    .filter((u) => u.overCap)
    .map((u) => ({ id: u.id, frac: Math.round(u.frac * 100) / 100, chapters: u.chapters }));
  const contentSevere = report.overCapDevices.length >= DEFAULT_CONTENT_MACHINERY_THRESHOLDS.axesBlock;

  return {
    mode: resolveStructuralSamenessMode(),
    archAxes,
    archSevere,
    contentOverCap,
    contentSevere,
  };
}
