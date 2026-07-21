/**
 * Scene-mechanism plan — the prevention pattern (sceneModePlan / actionMechanismPlan)
 * applied to the scene's FUNCTIONAL MOVE, the previously un-dealt axis of the
 * scene_skeleton / repeated_unit sweep families.
 *
 * THE PROBLEM: shapePlan deals the scene SHAPE (postmortem/dialogue/contrast — the
 * narrative grammar), sceneModePlan deals the STANCE (live/retrospective — the temporal
 * vantage), and openerPlan deals the opener GRAMMAR. NONE of them touches the dramatic
 * TRANSACTION — what actually happens between people/forces in the scene. So mutually-blind
 * authors reach for the same favorite DEVICE with only the nouns swapped: the-happiness-
 * hypothesis put "a leader loses her/his voice → a substitute seizes the teaching prop →
 * teaches the concept" in ch3, ch8, ch11 (scene_skeleton), and reused a "Restarted Reply"
 * reframe-the-message unit in ch2 + ch4 (repeated_unit). The shape and stance varied; the
 * underlying MOVE did not, and no allocator spread it.
 *
 * THE FIX: deal each chapter one DISTINCT functional move (decide alone / two peers disagree
 * and one concedes / the expert admits a limit / the outsider notices / …). This is an axis
 * ORTHOGONAL to shape and stance, so it composes with them rather than fighting them.
 *
 * RELIABILITY: a functional move is a SEMANTIC constraint the author satisfies in their own
 * words — there is NO deterministic adherence gate (unlike shapePlan's on-disk format check),
 * because "did chapter N dramatize 'the expert admits a limit'?" is open-ended NLP. This dealer
 * raises the first-pass floor; the model QC sweep (sharpened to hunt cross-chapter device reuse)
 * is what actually CATCHES drift. Prevention-only, forward-only (already-authored books untouched).
 *
 * Deterministic and a PURE function of (bookId, n): FNV-1a(bookId) rotation + a COPRIME stride
 * over the palette (spreads each move across the book, non-adjacent — stronger than stride-1),
 * keyed on absolute n-1 (a single-chapter redo gets the same move).
 */

import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import type { BookContentReader } from "../books/candidateTypes.js";
import { fnv1a } from "../lib/fnv1a.js";
import { assertCoprimeSteps } from "../lib/coprime.js";
import { assertMaxShare } from "./saturationGuard.js";

const __dirname = dirname(fileURLToPath(import.meta.url)); // .../src/librarian
const SCENE_MECHANISMS_PATH = resolve(__dirname, "../../config/scene-mechanisms.json");
const SCENE_MECHANISM_PLANS_DIR = resolve(__dirname, "../../state/scene-mechanism-plans");

/** Spread stride over the palette. MUST be coprime with the palette size (asserted at deal
 *  time) so the rotation visits every move and holds same-move chapters non-adjacent. */
const CHAPTER_STEP = 3;

export type SceneMechanism = { id: string; directive: string };
export type SceneMechanismAllocation = { mechanismId: string; directive: string };
export type SceneMechanismPlan = {
  schemaVersion: "scene-mechanism-plan-v1";
  bookId: string;
  createdAt: string;
  allocation: Record<number, SceneMechanismAllocation>;
  diagnostics: { mechanismCounts: Record<string, number> };
};

/** Load + de-dupe the palette. Throws if it has fewer than 9 usable moves (a real palette is
 *  required — too few and round-robin would over-concentrate any one move). */
export function loadSceneMechanisms(): SceneMechanism[] {
  const raw = JSON.parse(readFileSync(SCENE_MECHANISMS_PATH, "utf8")) as { mechanisms: SceneMechanism[] };
  const seen = new Set<string>();
  const mechs = (raw.mechanisms ?? []).filter((m) => {
    if (!m?.id || !m?.directive || seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });
  if (mechs.length < 9) throw new Error(`scene-mechanisms.json has only ${mechs.length} usable moves — the plan needs a real palette (>= 9).`);
  return mechs;
}

export function planSceneMechanisms(bookId: string, from: number, to: number): SceneMechanismPlan {
  // Defensive: a NaN/<1/inverted range from the CLI would index the rotation with a negative modulo.
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from) {
    return { schemaVersion: "scene-mechanism-plan-v1", bookId, createdAt: new Date().toISOString(), allocation: {}, diagnostics: { mechanismCounts: {} } };
  }
  const mechs = loadSceneMechanisms();
  const L = mechs.length;
  // A palette edit that breaks coprimality fails LOUD here, not as a confusing downstream gap.
  assertCoprimeSteps(L, [CHAPTER_STEP], "scene-mechanism-plan");
  const offset = fnv1a(`${bookId}:scene-mechanism`) % L; // per-book namespace, distinct from every other deal
  const allocation: Record<number, SceneMechanismAllocation> = {};
  const mechanismCounts: Record<string, number> = {};
  const dealt: string[] = [];
  for (let n = from; n <= to; n++) {
    const idx = n - 1; // absolute → single-chapter redo matches the full deal
    const mech = mechs[(offset + idx * CHAPTER_STEP) % L];
    allocation[n] = { mechanismId: mech.id, directive: mech.directive };
    mechanismCounts[mech.id] = (mechanismCounts[mech.id] ?? 0) + 1;
    dealt.push(mech.id);
  }
  // Deal-time saturation guard (only at the density threshold; a short redo never throws). A coprime
  // round-robin over >= 9 moves keeps any one move well under this cap; the assert guards a future
  // palette shrink, so the dealer can never PRODUCE the new-templating-axis risk it exists to prevent.
  const N = to - from + 1;
  if (N >= 5) assertMaxShare(dealt, 0.34, `scene-mechanism-plan (${bookId})`);
  return {
    schemaVersion: "scene-mechanism-plan-v1",
    bookId,
    createdAt: new Date().toISOString(),
    allocation,
    diagnostics: { mechanismCounts },
  };
}

export function sceneMechanismPlanPath(bookId: string): string {
  return resolve(SCENE_MECHANISM_PLANS_DIR, `${bookId}.scene-mechanism-plan.json`);
}

export function writeSceneMechanismPlan(plan: SceneMechanismPlan): string {
  mkdirSync(SCENE_MECHANISM_PLANS_DIR, { recursive: true });
  const p = sceneMechanismPlanPath(plan.bookId);
  writeFileSync(p, JSON.stringify(plan, null, 2), "utf8");
  return p;
}

export async function loadSceneMechanismPlan(bookId: string, reader: BookContentReader, candidateId: string): Promise<SceneMechanismPlan> {
  const opened = await reader.open({ bookId, selector: { kind: "CANDIDATE", candidateId } });
    if (!opened.ok) throw new Error(`${opened.error.code}: ${opened.error.message}`);
    const logicalPath = `state/scene-mechanism-plans/${bookId}.scene-mechanism-plan.json`;
    const file = opened.value.files.find((entry) => entry.logicalPath === logicalPath);
    if (!file) throw new Error(`CANDIDATE_ENTRY_MISSING: ${logicalPath}`);
    try { return JSON.parse(Buffer.from(file.bytes).toString("utf8")) as SceneMechanismPlan; }
    catch (cause) { throw new Error(`CANDIDATE_ENTRY_MALFORMED: ${logicalPath}: ${(cause as Error).message}`); }
}

export function formatSceneMechanismPlan(plan: SceneMechanismPlan): string {
  const lines = [`Scene-mechanism plan — ${plan.bookId}`];
  for (const [n, a] of Object.entries(plan.allocation)) {
    lines.push(`  ch${String(n).padStart(2, "0")}: ${a.mechanismId}`);
  }
  lines.push(`  mechanism counts: ${JSON.stringify(plan.diagnostics.mechanismCounts)}`);
  return lines.join("\n");
}
