/**
 * WP-E71 red-team — ATTACK 6: the readabilityMeasureOnly flag must be unreachable
 * from any ship verb.
 *
 * WP-E31/AUD-01 lets the bakeoff/screening lane RECORD a readability floor failure
 * instead of blocking on it (severity "measure-only"). That demotion must never
 * leak into the production ship path, where a low-ease chapter must still be
 * BLOCKED. This proves two things:
 *
 *   1. Production sectionGate output is byte-identical with the flag off vs the
 *      3-arg default, and carries NO "measure-only" severity — SEC12 readability is
 *      a hard blocker by default.
 *   2. Flag-flow containment: the ONLY source files that reference
 *      `readabilityMeasureOnly` are the flag's definition (sectionGate) and the
 *      bakeoff/screening lane (candidates, runBakeoff, the bakeoff manifest type).
 *      No ship verb (promote / publish-after-qc / bakeoff promotion / the CLI
 *      dispatcher) references it, so no ship path can set it.
 *
 * Hermetic: pure gate calls + source reads; no disk writes.
 */

import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { test } from "./harness.js";
import {
  validateSectionPack,
  validateSummaryPack,
  type SectionFinding,
} from "../src/sections/sectionGate.js";
import type { ChapterBlueprintV1, SourcePacketV1, SummaryPackV1 } from "../src/artifacts/artifactTypes.js";

const PIPELINE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC_ROOT = join(PIPELINE_ROOT, "src");

// ── The faithful low-ease breakdown (ease 61.9 < 70 floor) ──────────────────────
const AGG_FAST = "Pay before the snapshot. Lower the visible balance. Make the signal match the care you already show.";
const AGG_DEEP =
  "A card system records account information. It does not read your intent. The useful move is to reduce what the system sees before the signal travels to lenders.";
const AGG_FULL =
  "The reader-facing move is practical. Make the balance visible to yourself. Reduce avoidable utilization. Set a trigger before the reportable moment. This keeps the source idea intact without promising an exact score jump.";

const EMPTY_PACKET = { allowedAnchors: [], facts: [], namedCases: [] } as unknown as SourcePacketV1;
function blueprint(): ChapterBlueprintV1 {
  return { chapterNumber: 1, chapterId: "zz-ro-ch01", sections: { quiz: [], cards: [] } } as unknown as ChapterBlueprintV1;
}
function lowEaseSummaryPack(): SummaryPackV1 {
  return {
    schemaVersion: "section-artifact-v1",
    artifactType: "summary-pack",
    chapterId: "zz-ro-ch01",
    hook: { hook: "A short hook that is long enough to exist for the fixture only.", sourceAnchorIds: [] },
    breakdown: { fastRead: AGG_FAST, deepRead: AGG_DEEP, fullRead: AGG_FULL, sourceAnchorIds: { fastRead: [], deepRead: [], fullRead: [] } },
    keyTakeaway: "Change what the system can see rather than trusting that intention will be read.",
    keyTakeawaySourceAnchorIds: [],
  } as unknown as SummaryPackV1;
}
const sec12 = (findings: SectionFinding[]): SectionFinding[] => findings.filter((f) => f.checkId === "SEC12.summary_readability");

// ── 1. production output is byte-identical without the flag, and never measure-only ─

test("attack6: production sectionGate output is byte-identical with the flag off vs the default (no measure-only leak)", () => {
  const summaryDefault = validateSummaryPack(lowEaseSummaryPack(), blueprint(), EMPTY_PACKET);
  const summaryFalse = validateSummaryPack(lowEaseSummaryPack(), blueprint(), EMPTY_PACKET, false);
  assert.deepEqual(summaryDefault, summaryFalse, "explicit false must equal the 3-arg default byte-for-byte");

  const sectionDefault = validateSectionPack(lowEaseSummaryPack(), blueprint(), EMPTY_PACKET);
  const sectionFalse = validateSectionPack(lowEaseSummaryPack(), blueprint(), EMPTY_PACKET, false);
  assert.deepEqual(sectionDefault, sectionFalse);

  // NO finding in the production path is ever demoted to measure-only …
  for (const f of [...summaryDefault, ...sectionDefault]) {
    assert.notEqual(f.severity, "measure-only", `production finding ${f.checkId} must never be measure-only`);
  }
  // … and SEC12 readability fires as a BLOCKER (the floor is real in production).
  const s12 = sec12(summaryDefault);
  assert.ok(s12.length >= 1, "the assembled ease floor fires on a 61.9-ease breakdown");
  for (const f of s12) assert.equal(f.severity, "blocker");
});

test("attack6: only under an EXPLICIT true does SEC12 demote — production never reaches that branch", () => {
  const on = sec12(validateSummaryPack(lowEaseSummaryPack(), blueprint(), EMPTY_PACKET, true));
  assert.ok(on.length >= 1 && on.every((f) => f.severity === "measure-only"), "the demotion exists, but only behind an explicit true");
});

// ── 2. flag-flow containment (static import/reference proof) ─────────────────────

function walkTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    const st = statSync(abs);
    if (st.isDirectory()) out.push(...walkTsFiles(abs));
    else if (name.endsWith(".ts")) out.push(abs);
  }
  return out;
}

test("attack6: readabilityMeasureOnly is referenced ONLY by the flag definition and the bakeoff/screening lane", () => {
  // The complete allowlist of files permitted to know about the flag.
  const allowed = new Set([
    "src/sections/sectionGate.ts", // defines the "measure-only" severity + the flag param
    "src/bakeoff/candidates.ts",   // the bakeoff candidate validator/generator threads it
    "src/bakeoff/runBakeoff.ts",   // the bakeoff runner reads it from the manifest
    "src/bakeoff/types.ts",        // BakeoffManifestV1.readabilityMeasureOnly
  ]);
  const offenders: string[] = [];
  for (const abs of walkTsFiles(SRC_ROOT)) {
    const rel = relative(PIPELINE_ROOT, abs).split("\\").join("/");
    if (readFileSync(abs, "utf8").includes("readabilityMeasureOnly") && !allowed.has(rel)) offenders.push(rel);
  }
  assert.deepEqual(offenders, [], `readabilityMeasureOnly leaked outside the bakeoff/screening lane: ${offenders.join(", ")}`);
});

test("attack6: no ship verb references the measure-only flag (promote / publish / promotion / cli)", () => {
  const shipFiles = [
    "src/promoteBook.ts",
    "src/qc/publishAfterQc.ts",
    "src/bakeoff/promotion.ts",
    "src/cli.ts",
  ];
  for (const rel of shipFiles) {
    const src = readFileSync(join(PIPELINE_ROOT, rel), "utf8");
    assert.ok(!src.includes("readabilityMeasureOnly"), `${rel} must not reference readabilityMeasureOnly`);
    assert.ok(!/\bmeasure-only\b/.test(src), `${rel} must not reference the measure-only severity`);
  }
});
