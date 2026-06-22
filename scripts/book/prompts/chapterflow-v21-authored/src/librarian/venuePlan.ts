/**
 * Venue plan — pre-authoring location variety for example scenes.
 *
 * Allocation math:
 *   - L=103 venues (prime). The 34-chapter / 6-venue request needs 204
 *     placements, so L must be at least 102 to keep every venue at cap 2.
 *   - SLOT_STEP=17 and CHAPTER_STEP=102 are both coprime with 103.
 *   - CHAPTER_STEP ≡ 6*SLOT_STEP (mod 103), so chapter n receives the next
 *     six positions in one full 103-cycle permutation. Consecutive chapters
 *     are adjacent six-position windows with zero overlap; a 34-chapter plan
 *     visits 204 positions in a 103-cycle, so no venue can appear more than
 *     twice book-wide.
 */

import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { fnv1a } from "../lib/fnv1a.js";
import { gcd } from "../lib/coprime.js";

const __dirname = dirname(fileURLToPath(import.meta.url)); // .../src/librarian
const VENUE_PALETTE_PATH = resolve(__dirname, "../../config/venue-palette.json");
const VENUE_PLANS_DIR = resolve(__dirname, "../../state/venue-plans");

const PER_CHAPTER = 6;
const SLOT_STEP = 17;
const CHAPTER_STEP = 102;

export type VenuePlan = {
  schemaVersion: "venue-plan-v1";
  bookId: string;
  createdAt: string;
  fromChapter: number;
  toChapter: number;
  perChapter: number;
  allocation: Record<number, string[]>;
};

export function loadVenuePalette(): string[] {
  const raw = JSON.parse(readFileSync(VENUE_PALETTE_PATH, "utf8")) as { venues?: unknown[] };
  const seen = new Set<string>();
  const venues: string[] = [];
  for (const value of raw.venues ?? []) {
    if (typeof value !== "string") continue;
    const venue = value.trim();
    if (!venue || seen.has(venue)) continue;
    seen.add(venue);
    venues.push(venue);
  }
  if (venues.length < 102) {
    throw new Error(`venue-palette.json has ${venues.length} usable venues; need at least 102 for a 34-chapter cap-2 allocation.`);
  }
  return venues;
}

function assertVenueInvariants(allocation: Record<number, string[]>, from: number, to: number): void {
  const seenByVenue = new Map<string, Set<number>>();
  for (let chapter = from; chapter <= to; chapter++) {
    const venues = allocation[chapter] ?? [];
    if (new Set(venues).size !== venues.length) {
      throw new Error(`venue-plan invariant violated: duplicate venues within ch${chapter}.`);
    }
    for (const venue of venues) {
      const chapters = seenByVenue.get(venue) ?? new Set<number>();
      chapters.add(chapter);
      seenByVenue.set(venue, chapters);
    }
    if (chapter < to) {
      const next = allocation[chapter + 1] ?? [];
      const shared = venues.filter((venue) => next.includes(venue));
      if (shared.length > 0) {
        throw new Error(`venue-plan invariant violated: ch${chapter}->ch${chapter + 1} share venues: ${shared.join(", ")}`);
      }
    }
  }
  for (const [venue, chapters] of seenByVenue) {
    if (chapters.size > 2) {
      throw new Error(`venue-plan invariant violated: "${venue}" appears in ${chapters.size} chapters (${Array.from(chapters).join(", ")}).`);
    }
  }
}

export function planVenues(bookId: string, from: number, to: number): VenuePlan {
  if (to < from) throw new Error(`to (${to}) < from (${from})`);
  if (from < 1) throw new Error(`from (${from}) must be >= 1`);
  const venues = loadVenuePalette();
  const L = venues.length;
  if (gcd(SLOT_STEP, L) !== 1 || gcd(CHAPTER_STEP, L) !== 1 || CHAPTER_STEP !== (PER_CHAPTER * SLOT_STEP) % L) {
    throw new Error(
      `venue-plan invariant violated: palette size ${L} breaks the step proof (slot=${SLOT_STEP}, chapter=${CHAPTER_STEP}).`,
    );
  }

  const rotation = fnv1a(bookId) % L;
  const allocation: Record<number, string[]> = {};
  for (let chapter = from; chapter <= to; chapter++) {
    const dealt: string[] = [];
    const chapterOffset = chapter - from;
    for (let slot = 0; slot < PER_CHAPTER; slot++) {
      dealt.push(venues[(rotation + chapterOffset * CHAPTER_STEP + slot * SLOT_STEP) % L]);
    }
    allocation[chapter] = dealt;
  }
  assertVenueInvariants(allocation, from, to);
  return {
    schemaVersion: "venue-plan-v1",
    bookId,
    createdAt: new Date().toISOString(),
    fromChapter: from,
    toChapter: to,
    perChapter: PER_CHAPTER,
    allocation,
  };
}

export function writeVenuePlan(plan: VenuePlan): string {
  mkdirSync(VENUE_PLANS_DIR, { recursive: true });
  const path = resolve(VENUE_PLANS_DIR, `${plan.bookId}.venue-plan.json`);
  writeFileSync(path, JSON.stringify(plan, null, 2), "utf8");
  return path;
}

export function formatVenuePlan(plan: VenuePlan): string {
  const lines: string[] = [`Venue plan — ${plan.bookId} ch${plan.fromChapter}-${plan.toChapter} (${plan.perChapter}/chapter)`];
  for (const [chapter, venues] of Object.entries(plan.allocation).sort((a, b) => Number(a[0]) - Number(b[0]))) {
    lines.push(`  ch${String(chapter).padStart(2, "0")}: ${venues.join("; ")}`);
  }
  return lines.join("\n");
}
