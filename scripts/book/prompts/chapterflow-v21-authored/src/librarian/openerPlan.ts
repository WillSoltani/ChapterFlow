/**
 * Scenario-opener plan — shapePlan's pattern applied to the GRAMMAR of a scenario's
 * first clause.
 *
 * THE PROBLEM: blind, concurrent Codex writers default to a location/time-stamp opener
 * ("At the [venue], [Name] …" / "On [day], …"), so a book's example scenarios all OPEN
 * the same way (factfulness shipped 40/66 = 61% stamped openers) — the scene_skeleton /
 * location_stamping families, which have NO viable deterministic gate (a clock/place
 * marker flags the GOLD corpus too). The authoring card already pins scene SHAPE
 * (shapePlan), VENUE (venuePlan) and STANCE, but never the opening CONSTRUCTION, and the
 * dealt venue actively seeds the stamp. Like name/shape collisions, the fix is PREVENTION:
 * deal each example a distinct opener archetype BEFORE authoring so the openers are born
 * varied. This is a CONSTRUCTION constraint, not a script — the writer still writes their
 * own concrete image.
 *
 * SATURATION (the the-organized-mind fix): dealing 6-of-8 archetypes per chapter let every
 * archetype recur in ~75% of chapters (pigeonhole), so the scene-skeleton-PRONE shells —
 * after-action ("has already" / "had already"), clipped-count ("N. That is the count"),
 * object-in-motion ("[object] travels surface→surface") — saturated the book and the sweep
 * flagged cross-chapter templating. The hookShape dealer already defends against this
 * (sceneSkeletonProne + assertMaxShare). We mirror it here: archetypes tagged `proneClass`
 * in scenario-openers.json are dealt at most ONCE per chapter on a round-robin over
 * [...proneClasses, "none"], so each prone CLASS recurs in only ~1/(classes+1) of chapters;
 * the rest of every chapter is filled from the non-prone "spine". A deal-time
 * `assertMaxShare` makes an over-saturated prone class impossible to PRODUCE.
 *
 * SPINE SATURATION (the quiet fix): capping the prone CLASSES left the non-prone spine
 * uncapped — with only 8 spine archetypes and 6 slots/chapter, each spine archetype landed
 * in ~6/8 = 75% of chapters (pigeonhole), so on the quiet run a single spine opener
 * (`hand_hovers`) recurred across ~⅓ of chapters and the sweep flagged it MINOR. Fixed two
 * ways: (1) the spine grew 8→12 archetypes so the natural per-archetype coverage drops to
 * ~6/12 = 50%; (2) the chapter step was chosen so each archetype's appearances are SPREAD
 * across the book (not a contiguous run of chapters), keeping even short-book worst-case
 * coverage near the target. A deal-time `assertMaxCoverage` makes an over-saturated spine
 * archetype impossible to PRODUCE, the coverage analogue of the prone `assertMaxShare`.
 *
 * Allocation scheme (deterministic, no RNG, reproducible like shapePlan):
 *   - rotation = FNV-1a(`${bookId}:opener`) — a per-book offset distinct from shapePlan's.
 *   - SPINE: chapter n, slot i → nonProne[(rotation + n*CHAPTER_STEP + i*SLOT_STEP) % NP].
 *     With NP=12 non-prone, SLOT_STEP=5 (coprime 12) → slots distinct; CHAPTER_STEP=11
 *     (coprime 12, ≠0) → consecutive chapters don't repeat a slot's spine opener, and the
 *     induced slot-membership step (≡5 mod 12) spreads each archetype across the book
 *     instead of clustering it into a contiguous block of chapters.
 *   - PRONE accent: a round-robin schedule [...proneClasses,"none"] picks at most one prone
 *     class per chapter; one spine slot (rotating position) is replaced with a member of
 *     that class. Prone ∉ nonProne, so distinctness holds and the replaced slot still
 *     differs from the neighbour chapter's slot.
 *
 * Unlike shapePlan there is no on-disk carry: an opener archetype is prose guidance, not a
 * stored structured field, so the deal is pure and redo-stable by construction.
 */

import { readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { assertMaxShare, assertMaxCoverage } from "./saturationGuard.js";

const __dirname = dirname(fileURLToPath(import.meta.url)); // .../src/librarian
const SCENARIO_OPENERS_PATH = resolve(__dirname, "../../config/scenario-openers.json");

const SLOT_STEP = 5;    // coprime with the 12-archetype non-prone spine → intra-chapter distinctness
const CHAPTER_STEP = 11; // coprime with 12 (≠0) → consecutive chapters don't repeat a slot's spine opener;
                         // also SPREADS each archetype's appearances (slot-membership step ≡5 mod 12, not a
                         // contiguous run) so no spine archetype clusters into a block of chapters.
const PRONE_TARGET_FLOOR = 0.45; // a prone class may never exceed this; the round-robin keeps it ~1/(classes+1)
const SPINE_COVERAGE_TARGET = 0.6; // no opener archetype (spine OR prone) should appear in more than this
                                   // fraction of chapters; cap is raised to the unavoidable floor for small N.

export type ScenarioOpener = { id: string; definition: string; proneClass?: string };

export type OpenerPlan = {
  schemaVersion: "opener-plan-v1";
  bookId: string;
  createdAt: string;
  perChapter: number;
  /** chapter number → opener-archetype ids; index i is the dealt construction for example[i]. */
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

export function loadScenarioOpeners(): ScenarioOpener[] {
  const raw = JSON.parse(readFileSync(SCENARIO_OPENERS_PATH, "utf8")) as { openers: ScenarioOpener[] };
  const seen = new Set<string>();
  const openers = (raw.openers ?? [])
    .filter((o) => {
      if (!o?.id || !o?.definition || seen.has(o.id)) return false;
      seen.add(o.id);
      return true;
    })
    .map((o) => (o.proneClass ? { id: o.id, definition: o.definition, proneClass: o.proneClass } : { id: o.id, definition: o.definition }));
  if (openers.length < 6) throw new Error(`scenario-openers.json has only ${openers.length} usable openers — the plan needs a real palette.`);
  return openers;
}

export function planOpeners(bookId: string, from: number, to: number, perChapter = 6): OpenerPlan {
  const openers = loadScenarioOpeners();
  const nonProne = openers.filter((o) => !o.proneClass);
  const NP = nonProne.length;
  if (perChapter > NP) {
    throw new Error(`perChapter ${perChapter} exceeds the ${NP}-archetype non-prone spine — add non-prone openers to scenario-openers.json or lower perChapter.`);
  }
  // Group the prone archetypes by class; the schedule rotates over the classes + "none".
  const proneByClass = new Map<string, ScenarioOpener[]>();
  for (const o of openers) {
    if (!o.proneClass) continue;
    const arr = proneByClass.get(o.proneClass) ?? [];
    arr.push(o);
    proneByClass.set(o.proneClass, arr);
  }
  const proneClasses = [...proneByClass.keys()].sort();
  const schedule = [...proneClasses, "none"];

  const rotation = fnv1a(`${bookId}:opener`) % NP;
  const schedRot = fnv1a(`${bookId}:opener-prone`) % schedule.length;
  const slotRot = fnv1a(`${bookId}:opener-prone-slot`) % perChapter;

  const allocation: Record<number, string[]> = {};
  const proneClassPerChapter: string[] = [];
  for (let n = from; n <= to; n++) {
    // SPINE: perChapter distinct non-prone archetypes.
    const dealt: string[] = [];
    for (let i = 0; i < perChapter; i++) {
      dealt.push(nonProne[(rotation + n * CHAPTER_STEP + i * SLOT_STEP) % NP].id);
    }
    // PRONE accent: at most one prone opener, on a rotating class + slot, so each prone CLASS
    // recurs in only ~1/schedule.length of chapters (the deal-time saturation defence).
    const slotClass = schedule[(schedRot + n) % schedule.length];
    if (slotClass !== "none") {
      const members = proneByClass.get(slotClass) ?? [];
      if (members.length) {
        const proneId = members[(schedRot + n) % members.length].id;
        dealt[(slotRot + n) % perChapter] = proneId; // replace one spine slot (prone ∉ nonProne → still distinct)
        proneClassPerChapter.push(slotClass);
      } else {
        proneClassPerChapter.push("none");
      }
    } else {
      proneClassPerChapter.push("none");
    }
    // The header's distinctness invariant depends on NP and the coprime steps; the config can
    // change underneath, so verify the dealt slots are actually distinct.
    if (new Set(dealt).size !== dealt.length) {
      throw new Error(`opener-plan invariant violated: duplicate openers within ch${n} (non-prone spine size ${NP} no longer satisfies the step math — see header).`);
    }
    allocation[n] = dealt;
  }

  // GUARANTEE: a scene-skeleton-prone opener CLASS can never recur across more than a minority
  // of the book — the deal-time defence the hookShape dealer already has (saturationGuard). The
  // round-robin's unavoidable max for N chapters is ceil(N/schedule.length); cap at the larger of
  // that and the PRONE_TARGET_FLOOR so a correct deal never false-throws on a short book.
  if (proneClasses.length) {
    const N = proneClassPerChapter.length;
    const scheduleCap = N > 0 ? Math.ceil(N / schedule.length) / N : 1;
    const cap = Math.max(PRONE_TARGET_FLOOR, scheduleCap);
    // anyCap = 1 (no cap) on the non-prone entries: the only non-special value here is "none"
    // (the chapters that got NO prone opener), which carries no templating risk and is 100% on a
    // single-chapter deal. Only the prone CLASSES are capped, via `special`.
    assertMaxShare(proneClassPerChapter, 1, `opener-plan prone saturation (${bookId})`, {
      ids: new Set(proneClasses),
      cap,
      note: "scene-skeleton-prone opener class over-recurs across the book — see openerPlan header",
    });
  }

  // GUARANTEE: no single opener archetype — spine OR prone — recurs across more than a minority
  // of the book (the coverage analogue of the prone guard above). The linear deal's unavoidable
  // worst case for Nch chapters is a contiguous run of `perChapter` in-window chapters per NP-period
  // (⌊Nch/NP⌋·perChapter + min(Nch mod NP, perChapter)); cap at the larger of that and the target so
  // a correct deal never false-throws on a short book. The chosen step SPREADS appearances, so the
  // real coverage sits well under this bound for realistic book lengths (N≥~9).
  const chapters = Object.values(allocation);
  if (chapters.length) {
    const Nch = chapters.length;
    const contiguousFloor = (Math.floor(Nch / NP) * perChapter + Math.min(Nch % NP, perChapter)) / Nch;
    const coverageCap = Math.max(SPINE_COVERAGE_TARGET, contiguousFloor);
    assertMaxCoverage(chapters, coverageCap, `opener-plan coverage (${bookId})`);
  }

  return { schemaVersion: "opener-plan-v1", bookId, createdAt: new Date().toISOString(), perChapter, allocation };
}

/** Card-ready lines: the dealt opener archetype per example slot + its definition, framed as
 *  a CONSTRUCTION constraint (form, not script) so it breaks the stamp without re-templating. */
export function formatOpenerPlanForChapter(plan: OpenerPlan, chapterNumber: number): string[] {
  const ids = plan.allocation[chapterNumber];
  if (!ids?.length) return [];
  const byId = new Map(loadScenarioOpeners().map((o) => [o.id, o.definition]));
  const lines = [
    "OPENER GRAMMAR — open each example's scenario with the dealt CONSTRUCTION (a form, not a script:",
    "write your own concrete image; do NOT copy the example wording). Do NOT open with \"At the [venue], …\"",
    "or \"On [day], …\" — the dealt venue is the SETTING, not the first clause.",
  ];
  ids.forEach((id, i) => lines.push(`  example[${i + 1}] → ${id}: ${byId.get(id) ?? ""}`));
  return lines;
}
