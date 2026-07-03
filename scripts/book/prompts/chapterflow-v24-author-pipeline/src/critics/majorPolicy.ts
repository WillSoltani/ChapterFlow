/**
 * Major policy tiers — which deterministic MAJOR findings HARD-GATE the autonomous
 * pipeline (QC finalize + publish + the gate-phase major convergence) versus which
 * are ADVISORY (surfaced in `major-status`, fed to the writer self-verify, judged by
 * the semantic bar/sweep reviewers — but never a hard gate).
 *
 * WHY THIS EXISTS.  `currentMajorFindings` aggregates EVERY ship-gate + book-gate
 * major and `effectiveDisposition` made every one of them blocking-until-waived.
 * That had two costs the owner asked to remove:
 *   1. A major is INVISIBLE to `qc-converge` (the cheap deterministic gate is
 *      blockers-only), so it first surfaced at QC finalize → `qc-diagnose` printed
 *      `major-disposition` → the autopilot GOVERNANCE-HALTED ("never auto-waives").
 *      A human waive/fix decision is exactly the intervention an autonomous run
 *      must not require.
 *   2. Several majors fire on the clean + gold REFERENCE corpus (E1, C2, E4, E7,
 *      A13, BP16 — confirmed empirically; the `ENFORCED_MAJOR` doc-comment records
 *      the same SC9-reversal refutation). A finding that flags reference-quality
 *      shipped books cannot be a hard gate: "fixing" it degrades a clean chapter and
 *      spins the gate-converge loop.
 *
 * THE TIERS (consistent across the write self-gate AND the QC gate):
 *   - BLOCKING majors  — high-confidence, ZERO on the reference corpus, and
 *     deterministically FIXABLE by re-authoring. The gate phase converges these
 *     before QC; QC finalize / publish still gate on them. This is the
 *     `ENFORCED_MAJOR` ∪ write-barrier ∪ mechanical (answer-balance, phrase-budget,
 *     venue/opener structural-sameness, scaffold-leak, cadence) set.
 *   - ADVISORY majors  — the FP-prone / reference-firing / calibration-pending set
 *     below. They KEEP "major" severity (so they surface everywhere a major is
 *     listed) but do not block QC/publish and are not chased by the gate-converge
 *     loop. The semantic bar/sweep reviewers remain the real quality gate for these
 *     dimensions (scene concreteness, reading level, outcome realism, cast size, …).
 *
 * Calibration source: `scratch/major-calibration.ts` (reference-corpus firing tally)
 * + the per-id SHADOW rationales in critics/finalGate.ts SEVERITY_FROM_CATALOG.
 * Matching is by exact catalogId OR its bare prefix, so both "C2" and a future
 * "C2.specific_scene" resolve identically. (Blocker-severity ids that share a prefix
 * never reach the major path — currentMajorFindings only snapshots `gate.majors` —
 * so a prefix match can never demote a blocker.)
 */

/** Bare catalog prefixes whose MAJOR-severity findings are ADVISORY (surface, do not
 *  hard-gate the autonomous pipeline). */
export const ADVISORY_MAJOR_PREFIXES = new Set<string>([
  // ── Style/pedagogy-frequency majors that FIRE on the clean + gold reference
  //    corpus (the SC9-reversal trap — documented in ENFORCED_MAJOR + measured by
  //    scratch/major-calibration.ts). The semantic bar reviewer judges these. ──
  "C2",   // specific-scene anchor presence (fires on every reference book)
  "C3",   // decision-point presence (grouped style-frequency; refuted)
  "E1",   // reading-level target (fires on every reference book)
  "E4",   // concrete paragraph openers (50% on a clean stillness chapter)
  "E7",   // long-sentence / dense-headline plain-language (refuted style-frequency)
  "A13",  // sentence sanity (refuted style-frequency)
  "A17",  // tryThisNow too complex — documented advisory
  "BP16", // quiz answer-length ratio MAJOR (fired on 3/5 reference books)
  // ── Documented SHADOW / calibration-pending / high-FP majors (NOT in
  //    ENFORCED_MAJOR; each carries a "surfaces as QC debt but does not block"
  //    rationale in SEVERITY_FROM_CATALOG). ──
  "C15",  // role/domain mismatch (semantic; FP-prone)
  "C23",  // same protagonist leads multiple scenes (legit recurring figures — Edison)
  "C24",  // cast overflow >6 (constructed-cast signal; disruptive to "fix")
  "C25",  // example↔quiz cast shuffle
  "C28",  // uniform success (outcome realism — judgment call; semantic WT-E gates)
  "D4",   // recycled quiz scenario (pedagogy judgment)
  "D6",   // quiz key references chapter entity (pedagogy judgment)
  "BP32", // quiz pronoun/referent mismatch (semantic)
  "SC9",  // example not source-grounded (reverted from blocker; FP-prone)
  "SC11", // SC11.0 no-source-run (v2-gated; about missing artifacts, not content)
  "GN1",  // ungrounded number (high FP: writer legitimately derives/rounds)
  "NE1",  // named-enumeration miscount (only 1 TP; needs a 2nd before enforcing)
]);

/** Exact catalog ids that are ADVISORY even though their bare prefix is NOT (none
 *  today — kept for precision if a prefix ever carries mixed tiers). */
export const ADVISORY_MAJOR_IDS = new Set<string>([]);

/** True when a MAJOR-severity finding is ADVISORY (surfaced, never a hard gate). */
export function isAdvisoryMajor(catalogId: string): boolean {
  if (!catalogId) return false;
  if (ADVISORY_MAJOR_IDS.has(catalogId)) return true;
  if (ADVISORY_MAJOR_PREFIXES.has(catalogId)) return true;
  const prefix = catalogId.split(".")[0];
  return ADVISORY_MAJOR_PREFIXES.has(prefix);
}

/** True when a MAJOR-severity finding HARD-GATES the autonomous pipeline (QC finalize,
 *  publish, and the gate-phase major convergence). The complement of advisory. */
export function isQcBlockingMajor(catalogId: string): boolean {
  return !isAdvisoryMajor(catalogId);
}
