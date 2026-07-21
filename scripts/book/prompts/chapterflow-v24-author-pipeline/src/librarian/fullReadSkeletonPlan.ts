/**
 * Full-read skeleton plan — timingPlan's prevention pattern applied to the
 * breakdown.fullRead "third angle + limits" beat (the `scene_skeleton` sweep
 * family, fullRead variant).
 *
 * THE PROBLEM: fullRead is specced as "depth + third angle + limits", but the
 * boundary/caveat beat had no dealt allocator, so mutually-blind authors reached
 * for the same bare hinge — the-daily-stoic closed the third angle with "The
 * limit matters." / "One limit matters." / "There is a limit." across 10 of 12
 * chapters (scene_skeleton). The chapters read as assembled from one safety-
 * caveat skeleton. No deterministic gate saw it (the hinge is too short for the
 * cross-tier verbatim checks).
 *
 * THE FIX: deal each chapter a DISTINCT boundary beat (where it breaks / what it
 * costs / when not to / who it fails / the counter-case / the overcorrection /
 * the precondition), and forbid the bare "limit/limits" hinge as the default
 * transition. This is PREVENTION-only: the scene_skeleton hinge is NOT given a
 * deterministic book-gate because calibration proved it inseparable from the
 * clean corpus (start-with-why, a gold book, uses a limit hinge in 14/14
 * fullReads — fullRead is even specced as "… + limits"). The model QC sweep
 * remains the backstop; this allocator keeps the authors from converging.
 *
 * Deterministic and a PURE function of (bookId, n): FNV-1a(bookId) rotation +
 * stride-1 round-robin over the boundary-beat palette, keyed on absolute n-1 (a
 * single-chapter redo gets the same beat).
 */

import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { mkdirSync, writeFileSync } from "fs";
import type { BookContentReader } from "../books/candidateTypes.js";
import { fnv1a } from "../lib/fnv1a.js";

const __dirname = dirname(fileURLToPath(import.meta.url)); // .../src/librarian
const FULLREAD_SKELETON_PLANS_DIR = resolve(__dirname, "../../state/fullread-skeleton-plans");

/** Distinct boundary/caveat BEATS for the fullRead third angle. Each earns the
 *  limit from a different angle so no two chapters share the "there is a limit"
 *  hinge. {idea} is filled by the author with this chapter's own concept. Keep
 *  ≥ 7 so round-robin holds any one beat under the BP31 density floor. */
export const FULLREAD_BOUNDARY_BEATS: Array<{ id: string; directive: string }> = [
  { id: "where_it_breaks", directive: 'FULLREAD BOUNDARY = WHERE IT BREAKS. Close the third angle by naming a concrete case where {idea} stops working — a real situation it cannot handle. Do NOT use the bare phrase "the limit"/"there is a limit".' },
  { id: "what_it_costs", directive: 'FULLREAD BOUNDARY = WHAT IT COSTS. Close by naming the price/tradeoff of applying {idea} — what the reader gives up to get it. Show the cost in a scene, not as "there are limits".' },
  { id: "when_not_to", directive: 'FULLREAD BOUNDARY = WHEN NOT TO. Close by naming the situation that calls for the OPPOSITE of {idea} — when following it would be the wrong move. Avoid the bare "limit" hinge.' },
  { id: "who_it_fails", directive: 'FULLREAD BOUNDARY = WHO IT FAILS. Close by naming a person or role for whom {idea} misleads — the boundary is about FIT, not a generic caveat. No "there is a limit here".' },
  { id: "the_counter_case", directive: 'FULLREAD BOUNDARY = THE COUNTER-CASE. Close with one concrete counter-case: a specific moment where obeying {idea} would have been a mistake. Earn it from the case, not from the word "limit".' },
  { id: "the_overcorrection", directive: 'FULLREAD BOUNDARY = THE OVERCORRECTION. Close by showing how {idea} curdles when pushed too far — the failure mode of the virtue itself. Avoid the bare "limit/limits" transition.' },
  { id: "the_precondition", directive: 'FULLREAD BOUNDARY = THE PRECONDITION. Close by naming the precondition {idea} quietly assumes — and what happens when it is absent. Name the assumption, not "the limit".' },
];

export type FullReadSkeletonAllocation = { beatId: string; directive: string };
export type FullReadSkeletonPlan = {
  schemaVersion: "fullread-skeleton-plan-v1";
  bookId: string;
  createdAt: string;
  allocation: Record<number, FullReadSkeletonAllocation>;
  diagnostics: { beatCounts: Record<string, number> };
};

export function planFullReadSkeletons(bookId: string, from: number, to: number): FullReadSkeletonPlan {
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from) {
    return { schemaVersion: "fullread-skeleton-plan-v1", bookId, createdAt: new Date().toISOString(), allocation: {}, diagnostics: { beatCounts: {} } };
  }
  const offset = fnv1a(`${bookId}:fullread-skeleton`) % FULLREAD_BOUNDARY_BEATS.length;
  const allocation: Record<number, FullReadSkeletonAllocation> = {};
  const beatCounts: Record<string, number> = {};
  for (let n = from; n <= to; n++) {
    const idx = n - 1; // absolute → single-chapter redo matches the full deal
    const beat = FULLREAD_BOUNDARY_BEATS[(offset + idx) % FULLREAD_BOUNDARY_BEATS.length];
    allocation[n] = { beatId: beat.id, directive: beat.directive };
    beatCounts[beat.id] = (beatCounts[beat.id] ?? 0) + 1;
  }
  const N = to - from + 1;
  if (N >= 5) {
    const maxBeat = Math.max(0, ...Object.values(beatCounts));
    if (maxBeat / N >= 0.34) {
      throw new Error(`fullread-skeleton-plan invariant violated: one boundary beat lands ${maxBeat}/${N} >= 0.34 (BP31 risk).`);
    }
  }
  return {
    schemaVersion: "fullread-skeleton-plan-v1",
    bookId,
    createdAt: new Date().toISOString(),
    allocation,
    diagnostics: { beatCounts },
  };
}

export function fullReadSkeletonPlanPath(bookId: string): string {
  return resolve(FULLREAD_SKELETON_PLANS_DIR, `${bookId}.fullread-skeleton-plan.json`);
}

export function writeFullReadSkeletonPlan(plan: FullReadSkeletonPlan): string {
  mkdirSync(FULLREAD_SKELETON_PLANS_DIR, { recursive: true });
  const p = fullReadSkeletonPlanPath(plan.bookId);
  writeFileSync(p, JSON.stringify(plan, null, 2), "utf8");
  return p;
}

export function loadFullReadSkeletonPlan(bookId: string): FullReadSkeletonPlan | null;
export function loadFullReadSkeletonPlan(bookId: string, reader: BookContentReader, candidateId: string): Promise<FullReadSkeletonPlan>;
export function loadFullReadSkeletonPlan(bookId: string, reader?: BookContentReader, candidateId?: string): FullReadSkeletonPlan | null | Promise<FullReadSkeletonPlan> {
  if (!reader || !candidateId) throw new Error("CANDIDATE_READER_REQUIRED: BookContentReader and candidateId are required");
  return reader.open({ bookId, selector: { kind: "CANDIDATE", candidateId } }).then((opened) => {
    if (!opened.ok) throw new Error(`${opened.error.code}: ${opened.error.message}`);
    const logicalPath = `state/fullread-skeleton-plans/${bookId}.fullread-skeleton-plan.json`;
    const file = opened.value.files.find((entry) => entry.logicalPath === logicalPath);
    if (!file) throw new Error(`CANDIDATE_ENTRY_MISSING: ${logicalPath}`);
    try { return JSON.parse(Buffer.from(file.bytes).toString("utf8")) as FullReadSkeletonPlan; }
    catch (cause) { throw new Error(`CANDIDATE_ENTRY_MALFORMED: ${logicalPath}: ${(cause as Error).message}`); }
  });
}

export function formatFullReadSkeletonPlan(plan: FullReadSkeletonPlan): string {
  const lines = [`Full-read skeleton plan — ${plan.bookId}`];
  for (const [n, a] of Object.entries(plan.allocation)) {
    lines.push(`  ch${String(n).padStart(2, "0")}: ${a.beatId}`);
  }
  lines.push(`  beat counts: ${JSON.stringify(plan.diagnostics.beatCounts)}`);
  return lines.join("\n");
}
