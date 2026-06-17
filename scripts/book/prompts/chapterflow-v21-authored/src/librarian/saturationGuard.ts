/**
 * Variety-allocator saturation guard — the deal-time defence against the
 * structural-sameness class.
 *
 * A v21 variety allocator that deals exactly ONE value per chapter (hook shape,
 * tactic family, …) prevents writer convergence by spreading distinct values.
 * When one value instead occupies too large a SHARE of the book, the blind
 * parallel writers all open the same way and produce a book-wide sameness whose
 * sweep family (scene_skeleton / repeated_unit) has NO deterministic gate — so it
 * surfaces only at the NON-deterministic model QC sweep (the eat-that-frog hook
 * failure: object-in-motion dealt to ~50% of chapters → every dominant chapter
 * opened "[object] travels surface→surface").
 *
 * The cause — a concentrated DEAL — IS deterministically measurable. Cap it at
 * deal time (the pattern `assertTacticFamilyInvariants` already uses, throwing
 * `count > 2`): a saturated deal becomes impossible to PRODUCE, instead of hoping
 * the flaky sweep notices three phases later. Any single-value allocator should
 * call `assertMaxShare` on its realized per-chapter assignments.
 */

/** Count occurrences of each dealt value. */
export function shareCounts(values: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return counts;
}

/** The most-concentrated dealt value and its share (fraction of the book). */
export function maxShare(values: string[]): { value: string | null; count: number; fraction: number } {
  if (values.length === 0) return { value: null, count: 0, fraction: 0 };
  let best: string | null = null;
  let bestCount = 0;
  for (const [v, c] of shareCounts(values)) {
    if (c > bestCount) {
      best = v;
      bestCount = c;
    }
  }
  return { value: best, count: bestCount, fraction: bestCount / values.length };
}

/**
 * Throw if any dealt value exceeds its share cap. `cap` is the universal per-value
 * ceiling; `special` applies a STRICTER cap to a flagged subset (e.g. the
 * scene-skeleton-prone hook shapes, which must never reach the dominant share).
 * A tiny epsilon avoids float-equality false trips at the exact boundary.
 */
export function assertMaxShare(
  values: string[],
  cap: number,
  label: string,
  special?: { ids: Set<string>; cap: number; note?: string },
): void {
  const n = values.length;
  if (n === 0) return;
  for (const [id, count] of shareCounts(values)) {
    const limit = special && special.ids.has(id) ? special.cap : cap;
    const share = count / n;
    if (share > limit + 1e-9) {
      const tag = special && special.ids.has(id) && special.note ? ` (${special.note})` : "";
      throw new Error(
        `${label}: value "${id}" is dealt to ${count}/${n} chapters (${(share * 100).toFixed(0)}%), over the ${(limit * 100).toFixed(0)}% cap${tag}.`,
      );
    }
  }
}
