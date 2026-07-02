/**
 * findingRouting — the loader + resolver for config/finding-routing.json (P10, F3).
 *
 * QC repair used to do exactly one thing to every finding: hand a repair agent the assembled
 * chapter JSON and let it freehand-edit. That leaves the CAUSE of a templating finding intact —
 * the shared DEALT slot (a scene frame, a stamped venue, a reused name) is in the blueprint, so
 * the edit fights a symptom the next re-assembly would resurrect. This module classifies a finding
 * into a repair LEVER:
 *   - `redeal:*`        — the cause is a dealt slot; bump that slot's blueprint salt and regenerate
 *                         the owning section artifact (redealAndRegenerate).
 *   - `surgical`        — the cause is prose-local (a bar-axis miss, an alignment nit); edit the
 *                         chapter, then sync the edit back into its section artifacts.
 *   - `escalate:research` — the cause is a TEMPLATED SOURCE (every chapter dealt the same boilerplate
 *                         fact); no chapter edit fixes it — halt for re-research (mirrors the existing
 *                         SP14 templated-source halt).
 *
 * Loader convention mirrors src/lib/bookScars.ts / src/metrics/rubricThresholds.ts: read the JSON,
 * hand-validate the shape, THROW on drift (no ajv here). The config is a LEAF input — this module
 * imports only the sweep family ids + section kinds, so repairRouting.ts and autopilot.ts can import
 * the resolver without a cycle.
 */

import { existsSync, readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { isSweepFamily, type SweepFamily } from "./sweepSpec.js";
import type { SectionKind } from "../artifacts/artifactTypes.js";
import type { ChapterSlotSalts } from "../compiler/chapterBlueprint.js";

const __dirname = dirname(fileURLToPath(import.meta.url)); // .../src/qc
const ROUTING_CONFIG_PATH = resolve(__dirname, "../../config/finding-routing.json");

export const REDEAL_LEVERS = ["redeal:example-slot", "redeal:venue", "redeal:quiz-slot", "redeal:card-slot", "redeal:names"] as const;
export type RedealLever = typeof REDEAL_LEVERS[number];
export const REPAIR_LEVERS = [...REDEAL_LEVERS, "surgical", "escalate:research"] as const;
export type RepairLever = typeof REPAIR_LEVERS[number];

/** Slot unit kinds a repeated_unit finding can name — used to pick between example/quiz/card levers. */
export type FindingUnitKind = "example" | "quiz" | "card" | "unknown";

/** What a redeal lever actually bumps: the blueprint slot-salt field, and the ONE section artifact
 *  whose slots that salt drives (delete + regenerate exactly that artifact). exampleFrames / venues /
 *  names all live in the example pack's slots; quizShapes drives the learning pack's quiz + cards. */
export const REDEAL_LEVER_TARGETS: Record<RedealLever, { salt: keyof ChapterSlotSalts; kind: SectionKind }> = {
  "redeal:example-slot": { salt: "exampleFrames", kind: "example-pack" },
  "redeal:venue": { salt: "venues", kind: "example-pack" },
  "redeal:names": { salt: "names", kind: "example-pack" },
  "redeal:quiz-slot": { salt: "quizShapes", kind: "learning-pack" },
  "redeal:card-slot": { salt: "quizShapes", kind: "learning-pack" },
};

export function isRedealLever(lever: RepairLever): lever is RedealLever {
  return (REDEAL_LEVERS as readonly string[]).includes(lever);
}

export type FindingRoutingConfig = {
  schemaVersion: "finding-routing-v1";
  default: RepairLever;
  families: Partial<Record<SweepFamily, { lever: RepairLever; byUnit?: Partial<Record<Exclude<FindingUnitKind, "unknown">, RepairLever>> }>>;
  escalate: { lever: RepairLever; match: string[] };
  unitPatterns: Record<Exclude<FindingUnitKind, "unknown">, RegExp[]>;
};

/** The minimal finding fields the router reads. Works for a sweep finding (family + unitId) and a
 *  ledger finding (repairClass + unitId); either identifier may be absent. */
export type RoutableFinding = { family?: string | null; repairClass?: string | null; unitId?: string | null };

function fail(msg: string): never {
  throw new Error(`finding-routing.json invalid: ${msg}`);
}

function asLever(value: unknown, where: string): RepairLever {
  if (typeof value !== "string" || !(REPAIR_LEVERS as readonly string[]).includes(value)) {
    fail(`${where} must be one of ${REPAIR_LEVERS.join(", ")}, got ${JSON.stringify(value)}`);
  }
  return value as RepairLever;
}

/** Validate a parsed routing object, throwing on drift. Exported so a test can validate a synthetic
 *  config without touching disk. Compiles the unitPattern strings to anchored, case-insensitive RegExp. */
export function validateFindingRoutingConfig(raw: unknown): FindingRoutingConfig {
  if (!raw || typeof raw !== "object") fail("must be a JSON object");
  const r = raw as Record<string, unknown>;
  if (r.schemaVersion !== "finding-routing-v1") fail("schemaVersion must be finding-routing-v1");
  const def = asLever(r.default, "default");
  const familiesRaw = (r.families ?? {}) as Record<string, unknown>;
  const families: FindingRoutingConfig["families"] = {};
  for (const [family, spec] of Object.entries(familiesRaw)) {
    if (!isSweepFamily(family)) fail(`families.${family} is not a known sweep family`);
    if (!spec || typeof spec !== "object") fail(`families.${family} must be an object`);
    const s = spec as Record<string, unknown>;
    const entry: { lever: RepairLever; byUnit?: Partial<Record<"example" | "quiz" | "card", RepairLever>> } = {
      lever: asLever(s.lever, `families.${family}.lever`),
    };
    if (s.byUnit !== undefined) {
      if (!s.byUnit || typeof s.byUnit !== "object") fail(`families.${family}.byUnit must be an object`);
      const byUnit: Partial<Record<"example" | "quiz" | "card", RepairLever>> = {};
      for (const [unit, lever] of Object.entries(s.byUnit as Record<string, unknown>)) {
        if (unit !== "example" && unit !== "quiz" && unit !== "card") fail(`families.${family}.byUnit.${unit} must be example/quiz/card`);
        byUnit[unit] = asLever(lever, `families.${family}.byUnit.${unit}`);
      }
      entry.byUnit = byUnit;
    }
    families[family] = entry;
  }
  const escRaw = (r.escalate ?? {}) as Record<string, unknown>;
  const escalate = {
    lever: asLever(escRaw.lever ?? "escalate:research", "escalate.lever"),
    match: Array.isArray(escRaw.match) ? escRaw.match.map((m) => String(m).toLowerCase()).filter(Boolean) : [],
  };
  const upRaw = (r.unitPatterns ?? {}) as Record<string, unknown>;
  const unitPatterns = {} as FindingRoutingConfig["unitPatterns"];
  for (const unit of ["example", "quiz", "card"] as const) {
    const patterns = upRaw[unit];
    if (patterns !== undefined && !Array.isArray(patterns)) fail(`unitPatterns.${unit} must be an array of strings`);
    unitPatterns[unit] = ((patterns as unknown[]) ?? []).map((p) => new RegExp(String(p), "i"));
  }
  return { schemaVersion: "finding-routing-v1", default: def, families, escalate, unitPatterns };
}

let cached: FindingRoutingConfig | null = null;

/** Load + cache the routing config. A MISSING file is a hard error (the config is code-shipped, not
 *  per-book optional): routing must never silently fall back to freehand-edit-everything. */
export function loadFindingRoutingConfig(): FindingRoutingConfig {
  if (cached) return cached;
  if (!existsSync(ROUTING_CONFIG_PATH)) fail(`missing config file at ${ROUTING_CONFIG_PATH}`);
  cached = validateFindingRoutingConfig(JSON.parse(readFileSync(ROUTING_CONFIG_PATH, "utf8")));
  return cached;
}

/** Classify a unitId into the slot unit it names (example / quiz / card), or "unknown". */
export function classifyFindingUnit(unitId: string | null | undefined, config = loadFindingRoutingConfig()): FindingUnitKind {
  const u = String(unitId ?? "").trim();
  if (!u) return "unknown";
  for (const unit of ["example", "quiz", "card"] as const) {
    if (config.unitPatterns[unit].some((re) => re.test(u))) return unit;
  }
  return "unknown";
}

/** Resolve a finding to its repair lever. Precedence:
 *   1. a templated-SOURCE match on family OR repairClass  → escalate:research
 *   2. a known sweep family                                → the family lever (repeated_unit refines
 *      by unit: example/quiz/card, falling back to the family's own lever when the unit is unknown)
 *   3. anything else (bar-axis / alignment / unknown)      → the default (surgical). */
export function routeFinding(finding: RoutableFinding, config = loadFindingRoutingConfig()): RepairLever {
  const family = String(finding.family ?? "").trim();
  const repairClass = String(finding.repairClass ?? "").trim().toLowerCase();
  const familyLc = family.toLowerCase();
  // (1) source-template escalation — checked first, on either identifier.
  if (config.escalate.match.some((m) => repairClass.includes(m) || familyLc.includes(m))) {
    return config.escalate.lever;
  }
  // (2) sweep family route.
  if (isSweepFamily(family)) {
    const spec = config.families[family];
    if (!spec) return config.default;
    if (spec.byUnit) {
      const unit = classifyFindingUnit(finding.unitId, config);
      if (unit !== "unknown" && spec.byUnit[unit]) return spec.byUnit[unit]!;
    }
    return spec.lever;
  }
  // (3) default.
  return config.default;
}
