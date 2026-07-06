/**
 * contentMachinery — book-level BODY-DEVICE saturation critic (v24, 2026-07-06).
 *
 * architectureMonoculture catches a repeated OPENING skeleton (lead anchor, practice
 * shell). This critic catches the repeated BODY machinery the acceptance panel named
 * as the deeper churn cause — devices that recur across every chapter's examples,
 * quiz, and cards regardless of opening:
 *   - return-proof / receipt device        (measured 13/14 = 93% on start-with-why)
 *   - invented proxy-cast                    (13/14 = 93%)
 *   - "it travels" second-setting case, hard-detail "stays home" boundary rhetoric,
 *     famous-company anchor lead, WHY/HOW/WHAT three-part split.
 *
 * It reuses the SAME device catalog + detectors as the content-device deal
 * (contentDeviceDeal.ts) — the deal PREVENTS the saturation (rotating bans in the
 * writer card), this critic DETECTS residual saturation before the expensive
 * book-acceptance panel and names the chapters the content-deal repair lane should
 * fix. A device present in > cap fraction of chapters is over-reliance; ≥ axesWarn
 * such devices → the book is one content template (major, surfaced advisory —
 * never blocks; the semantic panel remains the true gate).
 *
 * Thematic consistency is NOT penalised: the devices are DELIVERY machinery, not the
 * argument. Recurring thesis vocabulary (WHY/belief/trust), source facts, and the
 * required app schema repeat freely without tripping anything here.
 */

import type { ChapterV21 } from "../types.js";
import type { BookGateFinding } from "./bookGate.js";
import {
  CONTENT_DEVICE_CATALOG,
  CONTENT_DEVICE_IDS,
  type ContentDeviceId,
  detectChapterDevices,
} from "../compiler/contentDeviceDeal.js";

export type ContentMachineryThresholds = {
  /** A device used in > this fraction of chapters is over-reliance (an axis). */
  deviceUbiquityFrac: number;
  /** Number of over-cap devices for the aggregate WARN (major). */
  axesWarn: number;
  /** Number of over-cap devices for SEVERE. */
  axesBlock: number;
};

export const DEFAULT_CONTENT_MACHINERY_THRESHOLDS: ContentMachineryThresholds = {
  // The deal caps each device at ~57% by construction; a book landing above 60%
  // ubiquity on a device has escaped the deal (or never had one) → over-reliance.
  deviceUbiquityFrac: 0.6,
  axesWarn: 2,
  axesBlock: 4,
};

export type ContentMachineryReport = {
  /** Per-device usage across the book. */
  usage: Array<{ id: ContentDeviceId; chapters: number[]; frac: number; overCap: boolean }>;
  /** Devices over the ubiquity cap (the churn drivers). */
  overCapDevices: ContentDeviceId[];
  /** Per-chapter count of over-cap devices used (ranking weight for repair). */
  chapterHits: Map<number, number>;
};

/** Compute the raw per-device / per-chapter usage report (no findings). Exposed so
 *  the repair planner and tests can rank chapters without re-deriving detection. */
export function reportContentMachinery(
  chapters: ChapterV21[],
  thresholds: ContentMachineryThresholds = DEFAULT_CONTENT_MACHINERY_THRESHOLDS,
): ContentMachineryReport {
  const N = chapters.length;
  const perChapterDevices = new Map<number, Set<ContentDeviceId>>();
  for (const c of chapters) perChapterDevices.set(c.number, detectChapterDevices(c));

  const usage = CONTENT_DEVICE_IDS.map((id) => {
    const chs = chapters.filter((c) => perChapterDevices.get(c.number)!.has(id)).map((c) => c.number);
    const frac = N > 0 ? chs.length / N : 0;
    return { id, chapters: chs, frac, overCap: frac > thresholds.deviceUbiquityFrac };
  });
  const overCapDevices = usage.filter((u) => u.overCap).map((u) => u.id);

  const chapterHits = new Map<number, number>();
  for (const c of chapters) {
    const used = perChapterDevices.get(c.number)!;
    let hits = 0;
    for (const id of overCapDevices) if (used.has(id)) hits++;
    chapterHits.set(c.number, hits);
  }
  return { usage, overCapDevices, chapterHits };
}

export function checkContentMachinery(
  chapters: ChapterV21[],
  thresholds: ContentMachineryThresholds = DEFAULT_CONTENT_MACHINERY_THRESHOLDS,
): BookGateFinding[] {
  const findings: BookGateFinding[] = [];
  const N = chapters.length;
  if (N < 4) return findings;

  const report = reportContentMachinery(chapters, thresholds);
  const overCap = report.usage.filter((u) => u.overCap);
  if (overCap.length === 0) return findings;

  // Per-device axis (minor, routable evidence).
  for (const u of overCap) {
    findings.push({
      catalogId: `CM.${u.id}`,
      severity: "minor",
      message:
        `Content-machinery over-reliance: the ${CONTENT_DEVICE_CATALOG[u.id].label} recurs in ` +
        `${u.chapters.length}/${N} chapters (${Math.round(u.frac * 100)}%, cap ${Math.round(thresholds.deviceUbiquityFrac * 100)}%). ` +
        `Chapters: ${u.chapters.map((n) => `ch${String(n).padStart(2, "0")}`).join(", ")}.`,
      chapters: u.chapters,
    });
  }

  // Aggregate CM0 — the book runs one content template on ≥ axesWarn devices.
  if (overCap.length >= thresholds.axesWarn) {
    // Target = chapters carrying the MOST over-cap devices (the densest offenders).
    const ranked = [...report.chapterHits.entries()]
      .filter(([, h]) => h > 0)
      .sort((a, b) => (b[1] - a[1]) || (a[0] - b[0]))
      .map(([n]) => n);
    findings.push({
      catalogId: "CM0.content_machinery_monoculture",
      severity: "major",
      message:
        `Book-level content-machinery monoculture: ${overCap.length} body device(s) saturate the book ` +
        `(${overCap.map((u) => `${u.id} ${Math.round(u.frac * 100)}%`).join(", ")}). Every chapter reuses the same ` +
        `example/quiz/card machinery — the "one template filled with different nouns" the book-acceptance panel ` +
        `rejects as "churn HIGH". Route the densest chapters through content-deal-sameness repair so each device ` +
        `drops below ${Math.round(thresholds.deviceUbiquityFrac * 100)}% ubiquity (keep facts, keys, thesis; vary ` +
        `the body devices). Densest chapters: ${ranked.map((n) => `ch${String(n).padStart(2, "0")}`).join(", ")}.`,
      chapters: ranked,
    });
  }
  return findings;
}
