/**
 * Stakes plan — deals each chapter a small MENU of modern felt-consequence "stakes"
 * so a wide/younger reader feels what's at risk, not just learns a tidy method.
 *
 * THE PROBLEM (reader review): chapters read "more useful than exciting" — the
 * subject matter (keys, bills, drawers, receipts) is practical but mundane, so the
 * reader thinks "that's a smart way to organize things," never "this is why my life
 * feels more cluttered than it should." The fix is the same prevention pattern as
 * openerPlan/venuePlan: deal a rotating set of CONCRETE modern costs before authoring,
 * so each chapter lands a real consequence the reader recognizes.
 *
 * This is a CONTENT cue, not a scene position: the dealt stakes name a cost to make
 * the reader feel, in an example or the chapter framing — they never compete with the
 * opener/venue/shape dealers for the first sentence. The card frames the menu as a
 * fit-or-substitute, never a mandate, so an ill-fitting stake is never forced onto a
 * chapter whose subject doesn't carry it (the venue-mismatch lesson).
 *
 * Allocation (deterministic, no RNG, reproducible — the openerPlan pattern):
 *   - rotation = FNV-1a(`${bookId}:stakes`) % N.
 *   - chapter n, slot i → stakes[(rotation + n*CHAPTER_STEP + i*SLOT_STEP) % N].
 *     N=13 (prime); SLOT_STEP=5 (coprime → the perChapter slots are distinct);
 *     CHAPTER_STEP=7 (coprime, ≠0 → consecutive chapters draw a different menu, and
 *     the induced membership step spreads each stake across the book, not a block).
 *   - A deal-time `assertMaxCoverage` caps how much of the book any single stake can
 *     cover (target 0.5, raised to the unavoidable small-N floor so a correct deal on a
 *     short book never false-throws — the openerPlan small-N-floor lesson).
 *
 * No on-disk carry: a stake is prose guidance, not a stored structured field, so the
 * deal is pure and redo-stable by construction.
 */

import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { assertMaxCoverage } from "./saturationGuard.js";

const __dirname = dirname(fileURLToPath(import.meta.url)); // .../src/librarian
const STAKES_PALETTE_PATH = resolve(__dirname, "../../config/stakes-palette.json");
const STAKES_PLANS_DIR = resolve(__dirname, "../../state/stakes-plans");

const SLOT_STEP = 5; // coprime with the 13-stake palette → intra-chapter distinctness
const CHAPTER_STEP = 7; // coprime with 13 (≠0) → consecutive chapters draw a different menu + spread
const COVERAGE_TARGET = 0.5; // no single stake should cover more than half a book (raised to the small-N floor)

export type Stake = { id: string; definition: string };

export type StakesPlan = {
  schemaVersion: "stakes-plan-v1";
  bookId: string;
  createdAt: string;
  perChapter: number;
  /** chapter number → dealt stake ids (a menu the writer lands one of, or substitutes). */
  allocation: Record<number, string[]>;
};

function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function loadStakes(): Stake[] {
  const raw = JSON.parse(readFileSync(STAKES_PALETTE_PATH, "utf8")) as { stakes?: Stake[] };
  const seen = new Set<string>();
  const stakes = (raw.stakes ?? [])
    .filter((s) => {
      if (!s?.id || !s?.definition || seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    })
    .map((s) => ({ id: s.id, definition: s.definition }));
  if (stakes.length < 8) {
    throw new Error(`stakes-palette.json has only ${stakes.length} usable stakes — the plan needs a real palette.`);
  }
  return stakes;
}

export function planStakes(bookId: string, from: number, to: number, perChapter = 3): StakesPlan {
  if (to < from) throw new Error(`to (${to}) < from (${from})`);
  if (from < 1) throw new Error(`from (${from}) must be >= 1 (chapters are 1-based)`);
  const stakes = loadStakes();
  const N = stakes.length;
  if (perChapter > N) {
    throw new Error(`perChapter ${perChapter} exceeds the ${N}-stake palette — add stakes to stakes-palette.json or lower perChapter.`);
  }
  const rotation = fnv1a(`${bookId}:stakes`) % N;

  const allocation: Record<number, string[]> = {};
  for (let n = from; n <= to; n++) {
    const dealt: string[] = [];
    for (let i = 0; i < perChapter; i++) {
      dealt.push(stakes[(rotation + n * CHAPTER_STEP + i * SLOT_STEP) % N].id);
    }
    // The distinctness invariant depends on N and the coprime step; the config can change
    // underneath, so verify the dealt menu is actually distinct.
    if (new Set(dealt).size !== dealt.length) {
      throw new Error(`stakes-plan invariant violated: duplicate stakes within ch${n} (palette size ${N} no longer satisfies the step math).`);
    }
    allocation[n] = dealt;
  }

  // GUARANTEE: no single stake covers more than a minority of the book. The linear deal's
  // unavoidable worst case for Nch chapters is a contiguous run of `perChapter` in-window
  // chapters per N-period; cap at the larger of that and the target so a correct deal never
  // false-throws on a short book (the openerPlan small-N-floor lesson).
  const chapters = Object.values(allocation);
  if (chapters.length) {
    const Nch = chapters.length;
    const contiguousFloor = (Math.floor(Nch / N) * perChapter + Math.min(Nch % N, perChapter)) / Nch;
    const coverageCap = Math.max(COVERAGE_TARGET, contiguousFloor);
    assertMaxCoverage(chapters, coverageCap, `stakes-plan coverage (${bookId})`);
  }

  return { schemaVersion: "stakes-plan-v1", bookId, createdAt: new Date().toISOString(), perChapter, allocation };
}

/** Card-ready lines: the dealt stakes menu framed as a fit-or-substitute CONTENT cue,
 *  never a mandate or a scene position. */
export function formatStakesForChapter(plan: StakesPlan, chapterNumber: number): string[] {
  const ids = plan.allocation[chapterNumber];
  if (!ids?.length) return [];
  const byId = new Map(loadStakes().map((s) => [s.id, s.definition]));
  const lines = [
    "STAKES — make the reader FEEL the cost, not just learn a tidy method. Land at least one",
    "real modern consequence in an example or the chapter framing. Draw from this menu if one",
    "fits the chapter; otherwise use a fitting modern stake of your own. NEVER force an",
    "ill-fitting stake, and do NOT make it the scene's opening construction (that's the opener's job):",
  ];
  ids.forEach((id) => lines.push(`  - ${id}: ${byId.get(id) ?? ""}`));
  return lines;
}

export function writeStakesPlan(plan: StakesPlan): string {
  mkdirSync(STAKES_PLANS_DIR, { recursive: true });
  const path = resolve(STAKES_PLANS_DIR, `${plan.bookId}.stakes-plan.json`);
  writeFileSync(path, JSON.stringify(plan, null, 2), "utf8");
  return path;
}
