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
 * Allocation scheme (deterministic, no RNG, reproducible like shapePlan):
 *   - rotation = FNV-1a(`${bookId}:opener`) — a per-book offset distinct from shapePlan's
 *     so the opener sequence isn't correlated with the shape sequence.
 *   - chapter n, slot i → openers[(rotation + n*CHAPTER_STEP + i*SLOT_STEP) % L].
 *     With L=8 openers, SLOT_STEP=3 (coprime with 8) → all slots within a chapter are
 *     DISTINCT (perChapter ≤ L); CHAPTER_STEP=5 (coprime with 8) → consecutive chapters
 *     don't put the same archetype at the same slot.
 *
 * Unlike shapePlan there is no on-disk carry: an opener archetype is prose guidance, not a
 * stored structured field, so there is nothing to read back — the deal is pure and
 * redo-stable by construction (same bookId → same allocation).
 */

import { readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url)); // .../src/librarian
const SCENARIO_OPENERS_PATH = resolve(__dirname, "../../config/scenario-openers.json");

const SLOT_STEP = 3;    // coprime with the 8-opener palette → intra-chapter distinctness
const CHAPTER_STEP = 5; // coprime with 8 → consecutive chapters don't repeat a slot's opener

export type ScenarioOpener = { id: string; definition: string };

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
  const openers = (raw.openers ?? []).filter((o) => {
    if (!o?.id || !o?.definition || seen.has(o.id)) return false;
    seen.add(o.id);
    return true;
  });
  if (openers.length < 6) throw new Error(`scenario-openers.json has only ${openers.length} usable openers — the plan needs a real palette.`);
  return openers;
}

export function planOpeners(bookId: string, from: number, to: number, perChapter = 6): OpenerPlan {
  const openers = loadScenarioOpeners();
  const L = openers.length;
  if (perChapter > L) throw new Error(`perChapter ${perChapter} exceeds the ${L}-opener palette.`);
  const rotation = fnv1a(`${bookId}:opener`) % L;
  const allocation: Record<number, string[]> = {};
  for (let n = from; n <= to; n++) {
    const dealt: string[] = [];
    for (let i = 0; i < perChapter; i++) {
      dealt.push(openers[(rotation + n * CHAPTER_STEP + i * SLOT_STEP) % L].id);
    }
    // The header's distinctness invariant depends on L and the coprime steps; the config
    // can change underneath, so verify the dealt slots are actually distinct.
    if (new Set(dealt).size !== dealt.length) {
      throw new Error(`opener-plan invariant violated: duplicate openers within ch${n} (palette size ${L} no longer satisfies the step math — see header).`);
    }
    allocation[n] = dealt;
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
