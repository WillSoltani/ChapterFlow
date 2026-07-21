/**
 * Scene-shape plan (Phase 3) — prevention for the one defect class with NO
 * viable deterministic gate (the cross-chapter scene skeleton). The math
 * guarantees structural variety BEFORE parallel blind authoring can converge
 * on one frame; these tests pin the guarantees the header math claims.
 */

import assert from "node:assert/strict";
import { readFileSync, readdirSync, rmSync } from "fs";
import { resolve } from "path";

import { loadSceneShapes, planShapes } from "../src/librarian/shapePlan.js";
import type { BookContentReader } from "../src/books/candidateTypes.js";
import { test } from "./harness.js";
import { makeChapter, runCli, STATE_CHAPTERS, writeFixtureBook } from "./helpers.js";

const BOOK = "zz-fixture-shapes";
const CANDIDATE = "shape-plan-candidate";

function candidateReader(bookId: string): BookContentReader {
  return {
    async open() {
      const files = readdirSync(STATE_CHAPTERS)
        .filter((name) => name.toLowerCase().startsWith(`${bookId.toLowerCase()}-ch`))
        .map((name) => ({ kind: "CHAPTER" as const, logicalPath: `state/chapters/${name}`, mediaType: "application/json" as const, byteLength: 0, bytes: Buffer.from(readFileSync(resolve(STATE_CHAPTERS, name))) }));
      return { ok: true, value: { manifest: { schemaVersion: "1", bookId, candidateId: CANDIDATE, createdByRunId: "test", entries: [], manifestDigest: "0".repeat(64), createdAt: new Date(0).toISOString() }, files } };
    },
  };
}

test("palette loads with ≥16 distinct, defined shapes", () => {
  const shapes = loadSceneShapes();
  assert.ok(shapes.length >= 16, `palette has ${shapes.length} shapes`);
  assert.equal(new Set(shapes.map((s) => s.id)).size, shapes.length, "ids must be unique");
  for (const s of shapes) assert.ok(s.definition.length > 40, `${s.id} needs a paste-able definition`);
});

test("within a chapter: all 6 slots get DISTINCT shapes", async () => {
  const plan = await planShapes(BOOK, 1, 20, 6, {}, candidateReader(BOOK), CANDIDATE);
  for (const [n, ids] of Object.entries(plan.allocation)) {
    assert.equal(new Set(ids).size, ids.length, `ch${n} has duplicate shapes: ${ids.join(", ")}`);
  }
});

test("consecutive chapters share ZERO shapes and never repeat a slot", async () => {
  const plan = await planShapes(BOOK, 1, 20, 6, {}, candidateReader(BOOK), CANDIDATE);
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

test("deterministic per book, different across books", async () => {
  const a1 = await planShapes("zz-book-alpha", 1, 5, 6, {}, candidateReader("zz-book-alpha"), CANDIDATE);
  const a2 = await planShapes("zz-book-alpha", 1, 5, 6, {}, candidateReader("zz-book-alpha"), CANDIDATE);
  assert.deepEqual(a1.allocation, a2.allocation, "re-plan must be reproducible");
  const b = await planShapes("zz-book-beta", 1, 5, 6, {}, candidateReader("zz-book-beta"), CANDIDATE);
  assert.notDeepEqual(a1.allocation[1], b.allocation[1], "different books should get different casts of shapes");
});

test("idempotent re-plan: an authored chapter carries its REAL on-disk formats", async () => {
  try {
    const ch2 = makeChapter(BOOK, 2);
    ch2.examples.forEach((e, i) => { e.planSpec.format = i % 2 === 0 ? "postmortem" : "text_thread"; });
    writeFixtureBook(STATE_CHAPTERS, [ch2]);
    const plan = await planShapes(BOOK, 1, 3, 6, {}, candidateReader(BOOK), CANDIDATE);
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

test("shape-plan CLI blocks without explicit candidate selector", () => {
  const { status, out } = runCli(["shape-plan", BOOK, "--from", "1", "--to", "3"]);
  assert.equal(status, 2, out.slice(-400));
  assert.match(out, /V25_CANDIDATE_READER_REQUIRED/);
});
