import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "fs";
import { resolve } from "path";

import { test } from "./harness.js";
import { makeChapter, PIPELINE_DIR } from "./helpers.js";
import { checkPlanEnforcement } from "../src/qc/planEnforcement.js";
import { stripInternalFields } from "../src/promoteBook.js";

const BOOK = "zz-fixture-plan-enforcement";

function planPath(kind: string, suffix: string): string {
  return resolve(PIPELINE_DIR, "state", kind, `${BOOK}.${suffix}.json`);
}

function cleanup(): void {
  rmSync(planPath("shape-plans", "shape-plan"), { force: true });
  rmSync(planPath("venue-plans", "venue-plan"), { force: true });
  rmSync(planPath("exemplar-plans", "exemplar-plan"), { force: true });
}

function writePlans(): { shapes: string[]; venues: string[] } {
  const shapes = ["dialogue", "postmortem", "number_first", "aftermath", "dilemma", "field_note"];
  const venues = ["a clinic desk", "an archive table", "a repair bay", "a school hallway", "a library counter", "a ferry terminal"];
  mkdirSync(resolve(PIPELINE_DIR, "state", "shape-plans"), { recursive: true });
  mkdirSync(resolve(PIPELINE_DIR, "state", "venue-plans"), { recursive: true });
  mkdirSync(resolve(PIPELINE_DIR, "state", "exemplar-plans"), { recursive: true });
  writeFileSync(planPath("shape-plans", "shape-plan"), JSON.stringify({ schemaVersion: "shape-plan-v1", bookId: BOOK, allocation: { 1: shapes }, carriedChapters: [] }, null, 2), "utf8");
  writeFileSync(planPath("venue-plans", "venue-plan"), JSON.stringify({ schemaVersion: "venue-plan-v1", bookId: BOOK, allocation: { 1: venues } }, null, 2), "utf8");
  writeFileSync(planPath("exemplar-plans", "exemplar-plan"), JSON.stringify({
    schemaVersion: "exemplar-plan-v1",
    bookId: BOOK,
    allocation: { 1: { assigned: ["Case Alpha"], forbidden: [{ name: "Case Beta", ownerChapter: 2 }] } },
    diagnostics: { contested: 1, chaptersWithoutSidecar: [] },
  }, null, 2), "utf8");
  return { shapes, venues };
}

test("SP plan enforcement blocks shape/venue/exemplar planSpec mismatches", () => {
  try {
    const { shapes, venues } = writePlans();
    const ch = makeChapter(BOOK, 1);
    ch.examples.forEach((ex: any, i) => {
      ex.planSpec.format = shapes[i];
      ex.planSpec.venue = venues[i];
      ex.planSpec.exemplar = "";
    });
    assert.deepEqual(checkPlanEnforcement(BOOK, [ch]), [], "matching planSpec should pass");

    (ch.examples[2] as any).planSpec.format = "wrong-shape";
    (ch.examples[3] as any).planSpec.venue = "wrong venue";
    (ch.examples[4] as any).planSpec.exemplar = "Case Beta";
    const ids = checkPlanEnforcement(BOOK, [ch]).map((f) => f.checkId);
    assert.ok(ids.includes("SP2.shape_plan_mismatch"), ids.join(", "));
    assert.ok(ids.includes("SP4.venue_plan_mismatch"), ids.join(", "));
    assert.ok(ids.includes("SP5.exemplar_ownership_violation"), ids.join(", "));
  } finally {
    cleanup();
  }
});

test("a book with no dealt shape/venue plan (next-task flow) is not blocked on plan bookkeeping", () => {
  try {
    cleanup(); // no shape-plan / venue-plan on disk
    const ch = makeChapter(BOOK, 1);
    // next-task authoring leaves planSpec.venue unset and never deals a plan.
    ch.examples.forEach((ex: any, i) => {
      ex.planSpec.format = `shape_${i}`; // distinct shapes per example
      delete ex.planSpec.venue;
      ex.planSpec.exemplar = "";
    });
    assert.deepEqual(checkPlanEnforcement(BOOK, [ch]), [], "unstamped, undealt book should not block at publish");

    // SP3 (within-chapter shape reuse) is a real quality check and still fires.
    (ch.examples[1] as any).planSpec.format = (ch.examples[0] as any).planSpec.format;
    const ids = checkPlanEnforcement(BOOK, [ch]).map((f) => f.checkId);
    assert.ok(ids.includes("SP3.shape_slot_reused"), ids.join(", "));
    assert.ok(!ids.includes("SP4.venue_plan_mismatch"), `venue must stay opt-in: ${ids.join(", ")}`);
  } finally {
    cleanup();
  }
});

test("promote stripping still removes planSpec, including no-api venue/exemplar scaffolding", () => {
  const ch = makeChapter(BOOK, 1);
  (ch.examples[0] as any).planSpec.venue = "a clinic desk";
  (ch.examples[0] as any).planSpec.exemplar = "Case Alpha";
  const shipped = stripInternalFields(ch);
  assert.doesNotMatch(JSON.stringify(shipped), /planSpec/);
  assert.equal(shipped.examples[0].scenario, ch.examples[0].scenario);
});

