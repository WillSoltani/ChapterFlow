/**
 * Chapter-cadence plan — rhetoricPlan's prevention pattern applied to the chapter
 * BODY ARC, the one axis the other dealers never moved.
 *
 * THE PROBLEM (cold-validation read of the-paradox-of-choice, 2026-06): the
 * conversational-voice + hook + stakes changes diversified the FIRST SENTENCE of
 * each chapter, but the floor plan never moved — every chapter ran the identical
 * rhetorical arc ("named scene -> you-lesson -> caveat -> skill", deepRead beat order
 * "mechanism-claim -> academic citation -> everyday person -> closer" in all 11). A
 * reader feels the machine by chapter 3. Hooks are already varied (leave them alone);
 * this rotates WHICH beat leads the breakdown so the arc itself differs chapter to
 * chapter.
 *
 * Deterministic, like the sibling allocators: a namespaced FNV-1a(`${bookId}:cadence`)
 * rotation picks the starting archetype (books don't share a global sequence) and a
 * stride-1 round-robin spreads archetypes evenly — over N chapters across K archetypes
 * every archetype lands <= ceil(N/K) times (well under the 0.40 cap) and adjacent
 * chapters always differ. NOT carried from disk: the deal is the TARGET, so
 * re-dispatching a chapter that drifted back to the herd arc hands it the same varied
 * assignment.
 *
 * SCOPE GUARD: an archetype steers the SEQUENCE of beats (which one leads), never the
 * tier contracts. Every tier still obeys its own rules (open concrete, fastRead is the
 * 2-minute read, no meta, etc.); the archetype only changes the order they unfold in,
 * and it does NOT touch the hook (that is the hook/opener dealers' job).
 */

import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { fnv1a } from "../lib/fnv1a.js";

const __dirname = dirname(fileURLToPath(import.meta.url)); // .../src/librarian
const CADENCE_PLANS_DIR = resolve(__dirname, "../../state/cadence-plans");

/** Body-arc archetypes — each a one-line steer on which beat LEADS the breakdown and
 *  the deepRead order. Concrete-opener and tier contracts still apply (see header). */
export const CHAPTER_ARCHETYPES: Array<{ id: string; directive: string }> = [
  {
    id: "problem-first",
    directive:
      "ARC = problem-first. Open the breakdown on the reader's felt problem (a concrete moment where it bites), sit in it before naming any cause, THEN give the mechanism, THEN the move. Don't lead with the tidy rule.",
  },
  {
    id: "myth-first",
    directive:
      "ARC = myth-first. Open by naming the common belief the reader already holds (shown through a person acting on it), then puncture it — the real mechanism is the reversal. The chapter earns the correction by voicing the wrong move first.",
  },
  {
    id: "story-first",
    directive:
      "ARC = story-first. Let one concrete scene RUN in the fastRead before any principle — follow a named person through the moment, and extract the rule only after the reader has lived it. deepRead opens on a second scene, mechanism after.",
  },
  {
    id: "mechanism-first",
    directive:
      "ARC = mechanism-first. Open on the surprising cause itself, shown through one concrete instance (never an abstract definition), then watch it play out across lives. The 'why' leads; the 'what to do' follows once the gear is visible.",
  },
  {
    id: "question-first",
    directive:
      "ARC = question-first. Open on a real question the reader is already asking, GROUNDED in a concrete moment, not an abstract query (\"Why does Maya freeze at a 30-fund menu?\" not \"What is choice?\") — then work visibly toward the answer. The chapter is the reasoning, not a verdict announced up front; resolve it by the fullRead. (The tier still opens concrete — the question rides on a scene/person, never a bare definition.)",
  },
  {
    id: "stakes-first",
    directive:
      "ARC = stakes-first. Open on what it costs to get this wrong — the felt consequence (lean on the chapter's dealt STAKES) — then turn to the fix. The reader should feel the price before they learn the method.",
  },
];

export type CadenceAllocation = { archetype: string; directive: string };
export type CadencePlan = {
  schemaVersion: "cadence-plan-v1";
  bookId: string;
  createdAt: string;
  allocation: Record<number, CadenceAllocation>;
  diagnostics: { archetypeCounts: Record<string, number> };
};

export function planChapterArchetypes(bookId: string, from: number, to: number): CadencePlan {
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from) {
    return { schemaVersion: "cadence-plan-v1", bookId, createdAt: new Date().toISOString(), allocation: {}, diagnostics: { archetypeCounts: {} } };
  }
  const offset = fnv1a(`${bookId}:cadence`) % CHAPTER_ARCHETYPES.length;
  const allocation: Record<number, CadenceAllocation> = {};
  const archetypeCounts: Record<string, number> = {};
  for (let n = from; n <= to; n++) {
    // Absolute chapter index (not relative to `from`) so a single-chapter redo gets the
    // SAME assignment it had in the full-book deal.
    const idx = n - 1;
    const a = CHAPTER_ARCHETYPES[(offset + idx) % CHAPTER_ARCHETYPES.length];
    allocation[n] = { archetype: a.id, directive: a.directive };
    archetypeCounts[a.id] = (archetypeCounts[a.id] ?? 0) + 1;
  }
  const N = to - from + 1;
  // The round-robin keeps every archetype to <= ceil(N/K); assert it (only at a
  // representative whole-book range, like the sibling caps) so a future palette/length
  // change that breaks the math fails loud rather than shipping a monotonous deal.
  if (N >= 5) {
    const maxShare = Math.max(0, ...Object.values(archetypeCounts));
    if (maxShare / N >= 0.4) {
      throw new Error(`cadence-plan invariant violated: archetype lands ${maxShare}/${N} >= 0.40 (round-robin should keep it under).`);
    }
  }
  return { schemaVersion: "cadence-plan-v1", bookId, createdAt: new Date().toISOString(), allocation, diagnostics: { archetypeCounts } };
}

export function cadencePlanPath(bookId: string): string {
  return resolve(CADENCE_PLANS_DIR, `${bookId}.cadence-plan.json`);
}

export function writeCadencePlan(plan: CadencePlan): string {
  mkdirSync(CADENCE_PLANS_DIR, { recursive: true });
  const p = cadencePlanPath(plan.bookId);
  writeFileSync(p, JSON.stringify(plan, null, 2), "utf8");
  return p;
}

export function loadCadencePlan(bookId: string): CadencePlan | null {
  const p = cadencePlanPath(bookId);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8")) as CadencePlan;
  } catch {
    return null;
  }
}

/** Card line: the chapter's dealt body arc, framed as a beat-order steer (not a template). */
export function formatCadenceForChapter(plan: CadencePlan, chapterNumber: number): string[] {
  const a = plan.allocation[chapterNumber];
  if (!a) return [];
  return [
    `CHAPTER ARC — vary the breakdown's floor plan from the other chapters (this is the anti-monotony lever):`,
    `  ${a.directive}`,
    `  This steers WHICH beat leads and the deepRead order — it does NOT change the hook (dealt separately) or any tier's own contract (still open concrete, no meta, fastRead stays the 2-minute read).`,
  ];
}

export function formatCadencePlan(plan: CadencePlan): string {
  const lines = [`Cadence plan — ${plan.bookId}`];
  for (const [n, a] of Object.entries(plan.allocation)) lines.push(`  ch${String(n).padStart(2, "0")}: ${a.archetype}`);
  lines.push(`  archetype counts: ${JSON.stringify(plan.diagnostics.archetypeCounts)}`);
  return lines.join("\n");
}
