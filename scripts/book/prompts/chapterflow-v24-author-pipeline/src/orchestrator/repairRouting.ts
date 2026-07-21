import { routeFinding, type RepairLever } from "../qc/findingRouting.js";

export const REPAIR_ROUTING_ENV = "CHAPTERFLOW_REPAIR_ROUTING";
export type RepairRoutingMode = "enforce" | "surgical-only";

/** Safe fallback preserves historical surgical classification without invoking legacy artifacts. */
export function repairRoutingMode(env: NodeJS.ProcessEnv = process.env): RepairRoutingMode {
  return env[REPAIR_ROUTING_ENV] === "surgical-only" ? "surgical-only" : "enforce";
}

export type RoutableRepairFinding = Readonly<{
  findingId: string;
  family?: string | null;
  repairClass?: string | null;
  unitId?: string | null;
  chapterNumber: number;
}>;

export type ClassifiedRepairFinding = Readonly<{
  finding: RoutableRepairFinding;
  lever: RepairLever;
}>;

/**
 * Pure classification only. V4 candidate-bound QC owns repair execution and successor staging.
 * `surgical-only` remains deterministic fallback: every finding stays surgical, with no I/O.
 */
export function classifyRepairFindings(
  findings: readonly RoutableRepairFinding[],
  mode: RepairRoutingMode = repairRoutingMode(),
): ClassifiedRepairFinding[] {
  return findings.map((finding) => ({
    finding,
    lever: mode === "surgical-only"
      ? "surgical"
      : routeFinding({ family: finding.family, repairClass: finding.repairClass, unitId: finding.unitId }),
  }));
}
