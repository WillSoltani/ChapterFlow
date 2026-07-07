/**
 * contentDeviceRepair — turn content-machinery saturation into SURGICAL, per-chapter
 * content-deal-sameness-repair directives (v24, 2026-07-06).
 *
 * checkContentMachinery DETECTS the body devices that saturate the book (return-proof,
 * proxy-cast, …). This module decides the SMALLEST set of chapters to re-author so
 * every over-cap device drops below the ubiquity cap, and builds the concrete writer
 * directive for each — the "content-deal repair lane".
 *
 * Selection is GREEDY minimum-cover: it repeatedly picks the chapter whose re-author
 * would relieve the most still-over-cap devices, until every device is projected under
 * cap or targetCap is reached (logged if it cannot reach cap within the budget — no
 * silent truncation). A chapter that uses none of the over-cap devices is never a
 * target (it is not part of the churn) and is preserved byte-stable.
 *
 * The directive keeps the chapter's facts / quiz keys / thesis and varies only the
 * BODY machinery, and it names EXACTLY which devices this chapter must drop (the
 * over-cap devices it currently uses ∪ its dealt content-device bans).
 */

import type { ChapterV21 } from "../types.js";
import {
  CONTENT_DEVICE_CATALOG,
  type ContentDeviceId,
  dealContentDeviceBans,
  detectChapterDevices,
} from "../compiler/contentDeviceDeal.js";
import {
  reportContentMachinery,
  DEFAULT_CONTENT_MACHINERY_THRESHOLDS,
  type ContentMachineryThresholds,
} from "./contentMachinery.js";

export type ContentRepairTarget = {
  chapterNumber: number;
  /** Over-cap devices this chapter currently uses (the churn it contributes). */
  usedOverCap: ContentDeviceId[];
  /** All devices this chapter must drop (usedOverCap ∪ dealt bans for this chapter). */
  bannedDevices: ContentDeviceId[];
  directive: string;
  reason: "content-deal-sameness-repair";
};

export type ContentRepairPlan = {
  fired: boolean;
  targets: ContentRepairTarget[];
  preserved: number[];
  /** Devices still over cap after flipping all targets (empty = plan fully relieves). */
  residualOverCap: ContentDeviceId[];
  overCapDevices: ContentDeviceId[];
};

export type ContentRepairOptions = {
  /** Max chapters to re-author in one round (never rewrite the whole book by default). */
  targetCap?: number;
  thresholds?: ContentMachineryThresholds;
  /** Force EXACTLY these chapters (retry mode) even if the aggregate no longer trips. */
  forceChapters?: number[];
  /** Chapters to force-preserve (never targeted). */
  preserveChapters?: number[];
};

const DEFAULT_TARGET_CAP = 8;

function buildDirective(usedOverCap: ContentDeviceId[], banned: ContentDeviceId[], overCap: ContentDeviceId[], usagePct: Map<ContentDeviceId, number>): string {
  const banLines = banned.map((id) => `  - ${CONTENT_DEVICE_CATALOG[id].banInstruction}.`).join("\n");
  const overList = overCap.map((id) => `${CONTENT_DEVICE_CATALOG[id].label} (${usagePct.get(id) ?? 0}%)`).join(", ");
  const altHints = [...new Set(banned.map((id) => CONTENT_DEVICE_CATALOG[id].altHint))].join("; ");
  return (
    `CONTENT-DEAL SAMENESS REPAIR — the book-acceptance panel rejected this book as "one template filled ` +
    `with different nouns": the same BODY machinery recurs across nearly every chapter's examples, quiz, and ` +
    `cards. Over-used book-wide: ${overList}. This chapter leans on ${usedOverCap.length > 0 ? "them" : "the mold"} too. ` +
    `Rebuild it so it does NOT use the devices below — vary the BODY, not just the opening:\n${banLines}\n` +
    `Prefer instead: ${altHints}. KEEP intact: this chapter's WHY/thesis, its source-supported facts, its quiz ` +
    `keys and correctIndex order, its required sections. Change HOW the chapter teaches (how examples are ` +
    `staged, how the quiz tests the idea, how cards reinforce it, how the chapter closes) — not what it teaches. ` +
    `EXAMPLE GROUNDING: every example must be EITHER a source-attested real case OR explicitly framed as ` +
    `hypothetical ("Imagine…", "Suppose a team…") — never present an invented person, title, or specific as if ` +
    `it were a sourced fact (that is a fabricated example and will fail review). INVISIBLE VARIETY: the ` +
    `variety must be felt, never NARRATED — do NOT describe your own teaching machinery in the prose ("this is ` +
    `the second setting", "a different token", "keep the detail with its source") and NEVER call a company, ` +
    `case, or fact a "source", "token", "material", or "anchor" in reader text (that scaffold vocabulary reads ` +
    `as corrupted residue). Just teach the idea through the case. Do NOT invent facts, do NOT add fake variety, ` +
    `do NOT swap one repeated device for a new repeated device.`
  );
}

/**
 * Build the content-deal repair plan. `chapters` is the current book. Greedy
 * minimum-cover selection over the over-cap devices.
 */
export function planContentDeviceRepair(
  chapters: ChapterV21[],
  opts: ContentRepairOptions = {},
): ContentRepairPlan {
  const thresholds = opts.thresholds ?? DEFAULT_CONTENT_MACHINERY_THRESHOLDS;
  const N = chapters.length;
  const report = reportContentMachinery(chapters, thresholds);
  const overCap = report.overCapDevices;
  const forced = opts.forceChapters && opts.forceChapters.length > 0 ? opts.forceChapters : null;
  const usagePct = new Map<ContentDeviceId, number>(report.usage.map((u) => [u.id, Math.round(u.frac * 100)]));

  if (overCap.length === 0 && !forced) {
    return { fired: false, targets: [], preserved: chapters.map((c) => c.number), residualOverCap: [], overCapDevices: [] };
  }

  const preserveSet = new Set(opts.preserveChapters ?? []);
  const targetCap = opts.targetCap ?? DEFAULT_TARGET_CAP;
  const capCount = Math.floor(thresholds.deviceUbiquityFrac * N); // max chapters that may keep a device

  // Per-chapter device use (only over-cap devices matter for selection).
  const chapterDevices = new Map<number, Set<ContentDeviceId>>();
  for (const c of chapters) chapterDevices.set(c.number, detectChapterDevices(c));

  // How many current users of each over-cap device we still need to flip.
  const remainingUsers = new Map<ContentDeviceId, number>();
  for (const d of overCap) remainingUsers.set(d, report.usage.find((u) => u.id === d)!.chapters.length);

  const selected: number[] = [];
  const stillOver = () => overCap.filter((d) => (remainingUsers.get(d) ?? 0) > capCount);

  if (forced) {
    for (const n of forced) if (!preserveSet.has(n)) selected.push(n);
  } else {
    // Greedy: pick the unselected, non-preserved chapter that covers the most
    // still-over-cap devices; break ties by fewer total device-hits then chapter #.
    const candidates = chapters.map((c) => c.number).filter((n) => !preserveSet.has(n));
    while (stillOver().length > 0 && selected.length < targetCap) {
      const over = new Set(stillOver());
      let best: { n: number; cover: number } | null = null;
      for (const n of candidates) {
        if (selected.includes(n)) continue;
        const used = chapterDevices.get(n)!;
        const cover = [...over].filter((d) => used.has(d)).length;
        if (cover === 0) continue;
        if (!best || cover > best.cover || (cover === best.cover && n < best.n)) best = { n, cover };
      }
      if (!best) break; // no remaining chapter can relieve the over-cap devices
      selected.push(best.n);
      for (const d of chapterDevices.get(best.n)!) if (remainingUsers.has(d)) remainingUsers.set(d, (remainingUsers.get(d) ?? 0) - 1);
    }
  }

  selected.sort((a, b) => a - b);
  const targets: ContentRepairTarget[] = selected.map((n) => {
    const used = chapterDevices.get(n)!;
    const usedOverCap = overCap.filter((d) => used.has(d));
    const dealtBans = dealContentDeviceBans(n, N);
    const bannedDevices = [...new Set<ContentDeviceId>([...usedOverCap, ...dealtBans])];
    return {
      chapterNumber: n,
      usedOverCap,
      bannedDevices,
      reason: "content-deal-sameness-repair",
      directive: buildDirective(usedOverCap, bannedDevices, overCap, usagePct),
    };
  });

  const targetNums = new Set(targets.map((t) => t.chapterNumber));
  const preserved = chapters.map((c) => c.number).filter((n) => !targetNums.has(n));
  return { fired: targets.length > 0, targets, preserved, residualOverCap: stillOver(), overCapDevices: overCap };
}
