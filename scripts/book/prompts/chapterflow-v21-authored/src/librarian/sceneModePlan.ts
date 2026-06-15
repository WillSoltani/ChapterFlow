/**
 * Scene-mode plan — rhetoricPlan's prevention pattern applied to the narrative
 * STANCE of a chapter's scenes (the `scene_skeleton` sweep family).
 *
 * THE PROBLEM: shapePlan already deals a per-slot scene SHAPE (postmortem,
 * dialogue, vignette, …) so the examples WITHIN a chapter differ structurally.
 * But the retrospective-evidence shapes (postmortem, audit) are spread
 * independently across chapters, and the "outcome already closed, then review
 * the notes" INTERIOR leaks across slots regardless of the dealt shape — so the
 * BOOK converges on one scene engine. the-daily-stoic shipped the postmortem-
 * evidence-trail in 5 of 13 chapters. Per config/scene-shapes.json this class
 * has NO viable deterministic gate (clock/decision/closed-outcome markers flag
 * the clean corpus too), so it is handled by PREVENTION.
 *
 * The fix: deal each chapter a dominant temporal STANCE and cap the
 * retrospective-review stance to a small slice of the book. runFanout uses the
 * stance to reconcile shapePlan (it dampens postmortem/audit shapes in chapters
 * NOT dealt the retrospective stance), so a freshly authored book can't pile up
 * "review the evidence afterward" scenes.
 *
 * Deterministic and a PURE function of (bookId, n): the stance comes from a
 * fixed rotation in which `retrospective_review` appears once per ~7 slots, so
 * it naturally lands on ≤ ~2 chapters of a 12–13 chapter book — and a single-
 * chapter redo gets the SAME stance the full-book deal gave it (idempotent).
 */

import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url)); // .../src/librarian
const SCENE_MODE_PLANS_DIR = resolve(__dirname, "../../state/scene-mode-plans");

export type NarrativeStance =
  | "live_unfolding"
  | "forward_planning"
  | "in_dialogue"
  | "embodied_moment"
  | "retrospective_review";

const STANCE_DIRECTIVES: Record<NarrativeStance, string> = {
  live_unfolding: "Center this chapter's scenes on a decision unfolding in real time — the reader is in the moment with the protagonist, outcome unknown.",
  forward_planning: "Center this chapter's scenes BEFORE the action: allocating attention, rehearsing, or choosing among options. No outcome to review yet.",
  in_dialogue: "Center this chapter's scenes on a live exchange between named people — the lesson emerges in the conversation, not in a later summary.",
  embodied_moment: "Center this chapter's scenes on one closely-observed lived moment (a body, an object, a place) — present-tense texture, not retrospection.",
  retrospective_review: "This chapter MAY use a retrospective/evidence-review scene (outcome already known, then reconstruct what mattered). You are one of the FEW chapters dealt this stance — most chapters must NOT review evidence after a closed outcome.",
};

/** Rotation in which retrospective_review appears once per 7 slots; the other
 *  four stances fill the rest. Round-robin over this (keyed on absolute n-1)
 *  keeps retrospective chapters ≤ ~N/7 and spreads the live stances evenly. */
const STANCE_ROTATION: NarrativeStance[] = [
  "live_unfolding",
  "forward_planning",
  "in_dialogue",
  "embodied_moment",
  "retrospective_review",
  "live_unfolding",
  "in_dialogue",
];

/** Scene shapes whose INTERIOR is the retrospective-evidence-review skeleton.
 *  In chapters not dealt the retrospective stance, runFanout swaps these out of
 *  the dealt shapePlan slots. */
export const RETROSPECTIVE_SHAPES = new Set<string>(["postmortem", "audit"]);
/** Live substitutes used when dampening a retrospective shape (first one not
 *  already in the chapter's slots wins). */
export const LIVE_SHAPE_SUBSTITUTES: string[] = [
  "dialogue",
  "mistake_recovery",
  "predict_reveal",
  "reset_moment",
  "coach_talk",
  "text_thread",
  "contrast",
];

export type SceneModeAllocation = { stance: NarrativeStance; directive: string };
export type SceneModePlan = {
  schemaVersion: "scene-mode-plan-v1";
  bookId: string;
  createdAt: string;
  allocation: Record<number, SceneModeAllocation>;
  diagnostics: { stanceCounts: Record<string, number> };
};

function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function planSceneModes(bookId: string, from: number, to: number): SceneModePlan {
  // Defensive: a NaN/<1/inverted range from the CLI would index the rotation
  // with a negative modulo (undefined stance entries).
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from) {
    return { schemaVersion: "scene-mode-plan-v1", bookId, createdAt: new Date().toISOString(), allocation: {}, diagnostics: { stanceCounts: {} } };
  }
  const offset = fnv1a(`${bookId}:stance`) % STANCE_ROTATION.length;
  const allocation: Record<number, SceneModeAllocation> = {};
  const stanceCounts: Record<string, number> = {};
  for (let n = from; n <= to; n++) {
    const idx = n - 1; // absolute → single-chapter redo matches the full deal
    const stance = STANCE_ROTATION[(offset + idx) % STANCE_ROTATION.length];
    allocation[n] = { stance, directive: STANCE_DIRECTIVES[stance] };
    stanceCounts[stance] = (stanceCounts[stance] ?? 0) + 1;
  }
  const N = to - from + 1;
  // Invariant only at the threshold the sweep cares about; a short redo never
  // throws. The rotation guarantees this for any contiguous range ≥ 5.
  if (N >= 5) {
    const retro = stanceCounts["retrospective_review"] ?? 0;
    if (retro / N >= 0.3) {
      throw new Error(`scene-mode-plan invariant violated: retrospective_review ${retro}/${N} >= 0.30 (scene_skeleton risk).`);
    }
  }
  return {
    schemaVersion: "scene-mode-plan-v1",
    bookId,
    createdAt: new Date().toISOString(),
    allocation,
    diagnostics: { stanceCounts },
  };
}

/** Reconcile a chapter's dealt shapePlan slots with its stance: in a chapter NOT
 *  dealt the retrospective stance, replace each retrospective-evidence shape with
 *  the first live substitute not already used in the chapter. Preserves slot
 *  count and within-chapter distinctness. Pure — used at card-assembly time. */
export function dampenRetrospectiveShapes(shapeIds: string[], stance: NarrativeStance): string[] {
  if (stance === "retrospective_review") return shapeIds;
  const used = new Set(shapeIds);
  const out: string[] = [];
  for (const id of shapeIds) {
    if (!RETROSPECTIVE_SHAPES.has(id)) {
      out.push(id);
      continue;
    }
    const sub = LIVE_SHAPE_SUBSTITUTES.find((s) => !used.has(s));
    if (!sub) {
      // Palette exhausted: re-emitting the retrospective `id` here would silently
      // defeat the dampening (the very shape we must remove survives under a
      // non-retrospective stance). With 7 live substitutes and ≤6 shape slots this
      // is unreachable, so a hit means the palette/slot config drifted — fail loud
      // rather than ship a retrospective shape into a live chapter (scene_skeleton).
      throw new Error(
        `dampenRetrospectiveShapes: no live substitute left for "${id}" (stance=${stance}). ` +
          `LIVE_SHAPE_SUBSTITUTES (${LIVE_SHAPE_SUBSTITUTES.length}) is exhausted by this chapter's ${shapeIds.length} slots.`,
      );
    }
    used.delete(id);
    used.add(sub);
    out.push(sub);
  }
  return out;
}

export function sceneModePlanPath(bookId: string): string {
  return resolve(SCENE_MODE_PLANS_DIR, `${bookId}.scene-mode-plan.json`);
}

export function writeSceneModePlan(plan: SceneModePlan): string {
  mkdirSync(SCENE_MODE_PLANS_DIR, { recursive: true });
  const p = sceneModePlanPath(plan.bookId);
  writeFileSync(p, JSON.stringify(plan, null, 2), "utf8");
  return p;
}

export function loadSceneModePlan(bookId: string): SceneModePlan | null {
  const p = sceneModePlanPath(bookId);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8")) as SceneModePlan;
  } catch {
    return null;
  }
}

export function formatSceneModePlan(plan: SceneModePlan): string {
  const lines = [`Scene-mode plan — ${plan.bookId}`];
  for (const [n, a] of Object.entries(plan.allocation)) {
    lines.push(`  ch${String(n).padStart(2, "0")}: ${a.stance}`);
  }
  lines.push(`  stance counts: ${JSON.stringify(plan.diagnostics.stanceCounts)}`);
  return lines.join("\n");
}
