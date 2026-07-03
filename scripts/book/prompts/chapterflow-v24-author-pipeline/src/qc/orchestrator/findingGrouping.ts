/**
 * Shared CLASS-DEFECT grouping for the repair surfaces.
 *
 * A defect repeated across sibling units — plan_actionability on
 * `ifThenPlans[1]`/`[2]`/`[3]`, or the same gate catalogId firing on
 * `example[2]`/`[4]` — is ONE root cause, not N. Grouping by
 * (repairClass, unit-container) lets every repair surface say "fix ALL instances
 * at the source" instead of whacking one mole per round (the whack-a-mole stall
 * observed on the-daily-stoic ch3 across three QC rounds).
 *
 * Extracted so the QC repair prompt (renderRepairPromptMarkdown) AND the
 * `qc-converge` deterministic preflight frame the SAME defect identically — the
 * banner wording is defined exactly once, here.
 */

/** The unit "container" — the unitId with any trailing array subscript removed, so
 *  `implementationPlan.ifThenPlans[2]` and `[3]` (or `chapter:8:example[4]` and `[5]`)
 *  collapse to one container. */
export function unitContainer(unitId: string): string {
  return String(unitId ?? "").replace(/\[\d+\]\s*$/, "");
}

export type ClassDefectGroup<T> = {
  repairClass: string;
  container: string;
  items: T[];
  /** True when >= 2 sibling units share one (class, container) — a class defect. */
  isClassDefect: boolean;
};

/** Group items by (repairClass, unit-container), preserving first-seen order. A
 *  group with >= 2 members is a CLASS DEFECT. Pure — the caller supplies how to
 *  read the class + unit off each item, so it works for ledger findings and
 *  deterministic gate findings alike. */
export function groupByClassDefect<T>(
  items: readonly T[],
  classOf: (t: T) => string,
  unitOf: (t: T) => string,
): ClassDefectGroup<T>[] {
  const groups = new Map<string, ClassDefectGroup<T>>();
  for (const item of items) {
    const repairClass = classOf(item);
    const container = unitContainer(unitOf(item));
    const key = `${repairClass} ${container}`;
    let g = groups.get(key);
    if (!g) {
      g = { repairClass, container, items: [], isClassDefect: false };
      groups.set(key, g);
    }
    g.items.push(item);
  }
  for (const g of groups.values()) g.isClassDefect = g.items.length >= 2;
  return [...groups.values()];
}

/** The single CLASS-DEFECT banner wording, shared by every repair surface. */
export function classDefectBanner(repairClass: string, count: number, container: string): string {
  return `CLASS DEFECT: ${repairClass} × ${count} on \`${container}\` — fix ALL instances of this pattern at the source, not only the units quoted below. The findings are EVIDENCE of ONE defect; re-authoring just the quoted units leaves the siblings to re-fail next round.`;
}
