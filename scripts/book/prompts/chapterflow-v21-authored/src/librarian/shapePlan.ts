/**
 * Scene-shape plan — name-plan's pattern applied to example STRUCTURE.
 *
 * THE PROBLEM: chapters authored by concurrent, mutually-blind Codex agents
 * converge on one scene frame ("[Name] does X at [clock time] in [place];
 * must decide whether A or B") — the systemic templating class with NO viable
 * deterministic gate (PIPELINE-HANDOFF §11: clock-time/decision checks flag
 * the GOLD corpus more than the templated books; any such blocker is a false-
 * positive machine). Like protagonist-name collisions (F1), the fix is
 * PREVENTION: deal each chapter a palette of structurally distinct shapes
 * BEFORE authoring, so the skeleton can't form in the first place.
 *
 * Allocation scheme (deterministic, no RNG, reproducible like namePlan):
 *   - rotation = FNV-1a(bookId) — different books start elsewhere in the
 *     palette, so the catalog doesn't share a global shape sequence.
 *   - chapter n, slot i → shapes[(rotation + n*CHAPTER_STEP + i*SLOT_STEP) % L]
 *     With L=16 shapes, SLOT_STEP=3 (coprime with 16) → all slots within a
 *     chapter are DISTINCT; CHAPTER_STEP=5 → consecutive chapters never put
 *     the same shape at the same slot, and (because 3·(i−j) ≡ 5 (mod 16) has
 *     no solution with |i−j| ≤ 5) consecutive chapters share ZERO shapes.
 *   - Idempotent re-plan: an already-authored chapter carries the formats
 *     actually on disk (examples[].planSpec.format), exactly like namePlan
 *     carries real on-disk names.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { chapterFileName } from "../lib/chapterPaths.js";
import type { ChapterV21 } from "../types.js";

const __dirname = dirname(fileURLToPath(import.meta.url)); // .../src/librarian
const SCENE_SHAPES_PATH = resolve(__dirname, "../../config/scene-shapes.json");
const SHAPE_PLANS_DIR = resolve(__dirname, "../../state/shape-plans");
const CHAPTERS_DIR = resolve(__dirname, "../../state/chapters");

const SLOT_STEP = 3;    // coprime with the 16-shape palette → intra-chapter distinctness
const CHAPTER_STEP = 5; // see header math: zero shape overlap between consecutive chapters

export type SceneShape = { id: string; definition: string };

export type ShapePlan = {
  schemaVersion: "shape-plan-v1";
  bookId: string;
  createdAt: string;
  perChapter: number;
  /** chapter number → shape ids; index i is the REQUIRED shape for example[i].
   *  Already-authored chapters carry their real on-disk formats instead. */
  allocation: Record<number, string[]>;
  /** chapters whose allocation was read from disk rather than dealt. */
  carriedChapters: number[];
};

function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function loadSceneShapes(): SceneShape[] {
  const raw = JSON.parse(readFileSync(SCENE_SHAPES_PATH, "utf8")) as { shapes: SceneShape[] };
  const seen = new Set<string>();
  const shapes = (raw.shapes ?? []).filter((s) => {
    if (!s?.id || !s?.definition || seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });
  if (shapes.length < 8) throw new Error(`scene-shapes.json has only ${shapes.length} usable shapes — the plan needs a real palette.`);
  return shapes;
}

/** Formats actually used by an authored chapter on disk (slot order). */
function onDiskFormats(bookId: string, chapterNumber: number): string[] | null {
  const file = resolve(CHAPTERS_DIR, chapterFileName(`${bookId}-ch${String(chapterNumber).padStart(2, "0")}`));
  if (!existsSync(file)) return null;
  try {
    const ch = JSON.parse(readFileSync(file, "utf8")) as ChapterV21;
    const formats = (ch.examples ?? []).map((e) => e?.planSpec?.format ?? "vignette");
    return formats.length > 0 ? formats : null;
  } catch {
    return null;
  }
}

export type PlanShapesOpts = {
  /** Deal fresh shapes even for chapters already on disk. The REDO path
   *  (fanout --all) needs this: carrying a templated chapter's own uniform
   *  formats re-pins exactly the skeleton the redo exists to break. */
  forceFresh?: boolean;
};

export function planShapes(bookId: string, from: number, to: number, perChapter = 6, opts: PlanShapesOpts = {}): ShapePlan {
  const shapes = loadSceneShapes();
  const L = shapes.length;
  if (perChapter > L) throw new Error(`perChapter ${perChapter} exceeds the ${L}-shape palette.`);
  const rotation = fnv1a(bookId) % L;
  const allocation: Record<number, string[]> = {};
  const carried: number[] = [];
  for (let n = from; n <= to; n++) {
    const disk = opts.forceFresh ? null : onDiskFormats(bookId, n);
    if (disk) {
      allocation[n] = disk;
      carried.push(n);
      continue;
    }
    const dealt: string[] = [];
    for (let i = 0; i < perChapter; i++) {
      dealt.push(shapes[(rotation + n * CHAPTER_STEP + i * SLOT_STEP) % L].id);
    }
    allocation[n] = dealt;
    // The header's invariants depend on L=16 with steps 3/5; the config can
    // change underneath. Cheap runtime check: dealt slots must be distinct.
    if (new Set(dealt).size !== dealt.length) {
      throw new Error(
        `shape-plan invariant violated: duplicate shapes within ch${n} (palette size ${L} no longer satisfies the step math — see header).`,
      );
    }
  }
  return {
    schemaVersion: "shape-plan-v1",
    bookId,
    createdAt: new Date().toISOString(),
    perChapter,
    allocation,
    carriedChapters: carried,
  };
}

export function writeShapePlan(plan: ShapePlan): string {
  mkdirSync(SHAPE_PLANS_DIR, { recursive: true });
  const p = resolve(SHAPE_PLANS_DIR, `${plan.bookId}.shape-plan.json`);
  writeFileSync(p, JSON.stringify(plan, null, 2), "utf8");
  return p;
}

export function formatShapePlan(plan: ShapePlan): string {
  const byId = new Map(loadSceneShapes().map((s) => [s.id, s.definition]));
  const lines: string[] = [`Shape plan — ${plan.bookId} (${plan.perChapter} per chapter)`];
  for (const [n, ids] of Object.entries(plan.allocation).sort((a, b) => Number(a[0]) - Number(b[0]))) {
    const carried = plan.carriedChapters.includes(Number(n));
    lines.push(`  ch${String(n).padStart(2, "0")}${carried ? " (authored — carried from disk)" : ""}: ${ids.join(", ")}`);
  }
  lines.push("", "Definitions:");
  for (const [id, def] of byId) lines.push(`  ${id}: ${def}`);
  return lines.join("\n");
}
