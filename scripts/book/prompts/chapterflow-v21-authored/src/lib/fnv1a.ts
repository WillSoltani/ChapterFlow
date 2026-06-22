/**
 * FNV-1a 32-bit hash — the deterministic, RNG-free seed for the librarian "deal"
 * allocators (openerPlan, stakesPlan, rhetoricPlan, …). A pure function of the input
 * string, so a deal keyed off `${bookId}:${namespace}` is reproducible and redo-stable.
 *
 * Extracted from ~15 byte-identical copies that had drifted across src/librarian/. Keep
 * this the single source of truth: changing the constants here would re-key EVERY deal,
 * so don't — it exists only to dedupe, not to be tuned.
 */
export function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
