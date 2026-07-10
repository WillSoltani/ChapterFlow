/**
 * Structural-sameness enforcement mode (F-06, 2026-07-08).
 *
 * The deterministic anti-sameness critics — architectureMonoculture (ARCH0) and
 * contentMachinery (CM0) — are ADVISORY BY DEFAULT. The semantic book-acceptance
 * panel is the standing true gate (owner calibration 2026-07-04), and the
 * regex-coarse skeleton/device detectors are too blunt to hard-fail a book on
 * their own. This flag lets an operator opt SEVERE monoculture into the hard gate
 * for a PRE-PUBLISH AUDIT pass, without changing any default outcome:
 *
 *   CHAPTERFLOW_STRUCTURAL_SAMENESS=advisory   (default) — ARCH0/CM0 stay `major`
 *       (surfaced advisory). bookGate.passed is byte-identical to before this flag
 *       existed; the semantic panel remains the only gate on the live loop.
 *   CHAPTERFLOW_STRUCTURAL_SAMENESS=enforce    — a SEVERE aggregate (ARCH0 with
 *       axes ≥ axesBlock, or CM0 with over-cap devices ≥ axesBlock) emits
 *       `blocker`, which fails bookGate. A non-severe aggregate (below axesBlock)
 *       stays `major` even under enforce.
 *
 * ⚠ Enforcement is a PRE-PUBLISH AUDIT TOOL, not a mid-campaign switch. bookGate
 * does NOT run on the author-acceptance / conductor loop, and the conductor has no
 * lane that consumes a bookGate blocker. Enabling `enforce` mid-book therefore
 * cannot deadlock the live loop (it never reads this) — it only changes the
 * verdict of a standalone bookGate audit run. The intended use is: run the audit
 * with `enforce`, read the named chapters off ARCH0/CM0, then route them through
 * the book-sameness / content-deal repair verbs offline. Do not expect the
 * autopilot to repair a severe book to green just because the flag is set.
 */
export type StructuralSamenessMode = "enforce" | "advisory";

/** Resolve the enforcement mode from the environment. Anything other than the
 *  exact literal `enforce` (unset, empty, typo) resolves to `advisory` — the flag
 *  ships OFF and fails safe toward today's default behavior. */
export function resolveStructuralSamenessMode(): StructuralSamenessMode {
  return process.env.CHAPTERFLOW_STRUCTURAL_SAMENESS === "enforce" ? "enforce" : "advisory";
}
