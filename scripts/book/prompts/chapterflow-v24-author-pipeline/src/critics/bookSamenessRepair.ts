/**
 * bookSamenessRepair — turn book-level architecture-monoculture findings into
 * SURGICAL, per-chapter diversification directives (2026-07-05).
 *
 * The architecture-monoculture critic (architectureMonoculture.ts) DETECTS a book
 * that runs one delivery skeleton and names the implicated chapters. This module
 * decides the SMALLEST set of chapters to diversify and the concrete directive for
 * each — the "book-sameness repair lane" that routes a churn-HIGH book without
 * full-regenerating it or disturbing the chapters that already carry the variety.
 *
 * Policy (matches the owner's constraints):
 *   - Only chapters IMPLICATED by an axis are candidates; a chapter that is already
 *     structurally distinct (appears in no axis) is PRESERVED untouched.
 *   - The candidate set is capped (targetCap) and ranked by how many axes implicate
 *     the chapter (the most-templated chapters first) — full-book rewrites are never
 *     the default.
 *   - Each selected chapter is assigned a DISTINCT architecture family (round-robin
 *     over the families NOT already dominating the book) and a directive that keeps
 *     the thesis/facts/quiz and varies only the delivery architecture.
 *   - The directive is a writer COMPLAINT (reason `book-sameness-repair`) — it rides
 *     the existing surgical re-author path; facts, source fidelity, and schema stay.
 */

import type { BookGateFinding } from "./bookGate.js";
import { ARCHITECTURE_FAMILIES, ARCHITECTURE_INSTRUCTION, type ArchitectureFamily } from "../compiler/briefRotation.js";

export type SamenessRepairTarget = {
  chapterNumber: number;
  /** How many monoculture axes implicated this chapter (ranking weight). */
  axisHits: number;
  /** The distinct architecture family this chapter should be rebuilt on. */
  assignedFamily: ArchitectureFamily;
  /** The writer directive (a book-sameness-repair complaint) — keeps facts, varies shape. */
  directive: string;
  reason: "book-sameness-repair";
};

export type SamenessRepairPlan = {
  fired: boolean;
  /** Chapters to diversify, most-templated first. */
  targets: SamenessRepairTarget[];
  /** Chapters deliberately preserved (structurally distinct already). */
  preserved: number[];
};

export type SamenessRepairOptions = {
  /** Max chapters to diversify in one round (never rewrite the whole book). */
  targetCap?: number;
  /** Families already over-used in the book (excluded from assignment) — e.g. the
   *  default 3-anchor skeleton is closest to none of the families, so pass the
   *  families the book already leans on if known. */
  avoidFamilies?: ArchitectureFamily[];
  /** Chapters known to be already-distinct — force-preserved even if an axis grazes them. */
  preserveChapters?: number[];
  /** Operator override: force EXACTLY these chapters as targets (in order), firing
   *  even when the ARCH0 aggregate no longer trips — used to RETRY specific chapters
   *  (reverts, or a chapter a fresh review newly flagged) after an earlier round has
   *  already cleared the aggregate signal. */
  forceChapters?: number[];
};

const DEFAULT_TARGET_CAP = 6;

/**
 * Build the surgical repair plan from the architecture-monoculture findings.
 * `findings` is the output of checkArchitectureMonoculture (the ARCH* set).
 */
export function planBookSamenessRepair(
  findings: BookGateFinding[],
  totalChapters: number,
  opts: SamenessRepairOptions = {},
): SamenessRepairPlan {
  const forced = opts.forceChapters && opts.forceChapters.length > 0 ? opts.forceChapters : null;
  const aggregate = findings.find((f) => f.catalogId === "ARCH0.architecture_monoculture");
  if (!aggregate && !forced) return { fired: false, targets: [], preserved: [] };

  const targetCap = opts.targetCap ?? DEFAULT_TARGET_CAP;
  const preserveSet = new Set(opts.preserveChapters ?? []);

  // Count axis hits per chapter across the per-axis (ARCH1-4) findings.
  const hits = new Map<number, number>();
  for (const f of findings) {
    if (f.catalogId === "ARCH0.architecture_monoculture") continue;
    for (const n of f.chapters ?? []) {
      if (preserveSet.has(n)) continue;
      hits.set(n, (hits.get(n) ?? 0) + 1);
    }
  }

  // Force mode: target EXACTLY the requested chapters (in order). Otherwise rank
  // by axis-hits, most-implicated first, then lowest chapter number (deterministic).
  const ranked: Array<[number, number]> = forced
    ? forced.map((n) => [n, hits.get(n) ?? 0] as [number, number])
    : [...hits.entries()]
        .sort((a, b) => (b[1] - a[1]) || (a[0] - b[0]))
        .slice(0, targetCap);

  // Assign DISTINCT families, skipping any the book already over-uses. Round-robin
  // so the diversified chapters do not themselves collapse into one new mold.
  const avoid = new Set(opts.avoidFamilies ?? []);
  const pool = ARCHITECTURE_FAMILIES.filter((f) => !avoid.has(f));
  const families = pool.length > 0 ? pool : [...ARCHITECTURE_FAMILIES];

  const targets: SamenessRepairTarget[] = ranked.map(([chapterNumber, axisHits], i) => {
    const assignedFamily = families[i % families.length];
    return {
      chapterNumber,
      axisHits,
      assignedFamily,
      reason: "book-sameness-repair",
      directive:
        `BOOK-SAMENESS REPAIR — this chapter reads as one of a repeated mold across the book, which the ` +
        `book-acceptance panel rejected ("churn HIGH"). Rebuild ONLY its delivery ARCHITECTURE as ` +
        `"${assignedFamily}": ${ARCHITECTURE_INSTRUCTION[assignedFamily]} Keep the chapter's WHY/thesis, its ` +
        `source-supported facts, its quiz keys, and its required sections intact — vary only the SHAPE ` +
        `(opening, scene machinery, practice framing, and the return-point device). Do NOT invent facts, ` +
        `do NOT reuse the default named-anchor → second-setting → proxy-cast → return-drill skeleton, and ` +
        `do NOT lift the same practice shell or reversal line other chapters use. EXAMPLE GROUNDING: every ` +
        `example must be EITHER a source-attested real case OR explicitly framed as hypothetical ("Imagine…", ` +
        `"Suppose a team…") — never present an invented person, title, or specific (a named "product lead", a ` +
        `"blue launch tag") as if it were a concrete sourced fact; an invented specific stated as fact is a ` +
        `fabricated/misleading example and will fail review.`,
    };
  });

  const targetNums = new Set(targets.map((t) => t.chapterNumber));
  const preserved = Array.from({ length: totalChapters }, (_, i) => i + 1).filter((n) => !targetNums.has(n));
  return { fired: true, targets, preserved };
}
