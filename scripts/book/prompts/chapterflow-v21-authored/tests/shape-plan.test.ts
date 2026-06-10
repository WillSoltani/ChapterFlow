/**
 * Scene-shape plan (Phase 3) — prevention for the one defect class with NO
 * viable deterministic gate (the cross-chapter scene skeleton). The math
 * guarantees structural variety BEFORE parallel blind authoring can converge
 * on one frame; these tests pin the guarantees the header math claims.
 */

import assert from "node:assert/strict";
import { readdirSync, rmSync } from "fs";
import { resolve } from "path";

import { loadSceneShapes, planShapes } from "../src/librarian/shapePlan.js";
import { test } from "./harness.js";
import { makeChapter, PIPELINE_DIR, runCli, STATE_CHAPTERS, writeFixtureBook } from "./helpers.js";

const BOOK = "zz-fixture-shapes";

test("palette loads with ≥16 distinct, defined shapes", () => {
  const shapes = loadSceneShapes();
  assert.ok(shapes.length >= 16, `palette has ${shapes.length} shapes`);
  assert.equal(new Set(shapes.map((s) => s.id)).size, shapes.length, "ids must be unique");
  for (const s of shapes) assert.ok(s.definition.length > 40, `${s.id} needs a paste-able definition`);
});

test("within a chapter: all 6 slots get DISTINCT shapes", () => {
  const plan = planShapes(BOOK, 1, 20);
  for (const [n, ids] of Object.entries(plan.allocation)) {
    assert.equal(new Set(ids).size, ids.length, `ch${n} has duplicate shapes: ${ids.join(", ")}`);
  }
});

test("consecutive chapters share ZERO shapes and never repeat a slot", () => {
  const plan = planShapes(BOOK, 1, 20);
  for (let n = 1; n < 20; n++) {
    const a = plan.allocation[n];
    const b = plan.allocation[n + 1];
    const shared = a.filter((id) => b.includes(id));
    assert.deepEqual(shared, [], `ch${n}→ch${n + 1} share shapes: ${shared.join(", ")}`);
    for (let i = 0; i < a.length; i++) {
      assert.notEqual(a[i], b[i], `slot ${i} repeats "${a[i]}" across ch${n}→ch${n + 1}`);
    }
  }
});

test("deterministic per book, different across books", () => {
  const a1 = planShapes("zz-book-alpha", 1, 5);
  const a2 = planShapes("zz-book-alpha", 1, 5);
  assert.deepEqual(a1.allocation, a2.allocation, "re-plan must be reproducible");
  const b = planShapes("zz-book-beta", 1, 5);
  assert.notDeepEqual(a1.allocation[1], b.allocation[1], "different books should get different casts of shapes");
});

test("idempotent re-plan: an authored chapter carries its REAL on-disk formats", () => {
  try {
    const ch2 = makeChapter(BOOK, 2);
    ch2.examples.forEach((e, i) => { e.planSpec.format = i % 2 === 0 ? "postmortem" : "text_thread"; });
    writeFixtureBook(STATE_CHAPTERS, [ch2]);
    const plan = planShapes(BOOK, 1, 3);
    assert.deepEqual(plan.carriedChapters, [2]);
    assert.deepEqual(
      plan.allocation[2],
      ["postmortem", "text_thread", "postmortem", "text_thread", "postmortem", "text_thread"],
      "authored chapters keep what is actually on disk — a re-plan must not pretend they used the dealt shapes",
    );
    assert.equal(new Set(plan.allocation[1]).size, 6, "unauthored neighbors still get dealt fresh distinct shapes");
  } finally {
    for (const f of readdirSync(STATE_CHAPTERS)) {
      if (f.startsWith(`${BOOK}-ch`)) rmSync(resolve(STATE_CHAPTERS, f), { force: true });
    }
  }
});

test("shape-plan CLI writes the plan and prints the allocation", () => {
  const planPath = resolve(PIPELINE_DIR, "state", "shape-plans", `${BOOK}.shape-plan.json`);
  try {
    const { status, out } = runCli(["shape-plan", BOOK, "--from", "1", "--to", "3"]);
    assert.equal(status, 0, out.slice(-400));
    assert.match(out, /ch01:/);
    assert.match(out, /Definitions:/);
  } finally {
    rmSync(planPath, { force: true });
  }
});
