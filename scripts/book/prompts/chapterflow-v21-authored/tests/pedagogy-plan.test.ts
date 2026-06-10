/**
 * Pedagogy-slot plan (catalog campaign Phase B2) — prevention for hook,
 * tryThisNow, and quiz-opener monoculture before parallel authoring starts.
 */

import assert from "node:assert/strict";
import { readdirSync, rmSync } from "fs";
import { resolve } from "path";

import { classifyHook, type HookShape } from "../src/critics/catalogAudit.js";
import { loadPedagogyPalettes, planPedagogy } from "../src/librarian/pedagogyPlan.js";
import { test } from "./harness.js";
import { makeChapter, PIPELINE_DIR, runCli, STATE_CHAPTERS, writeFixtureBook } from "./helpers.js";

const BOOK = "zz-fixture-pedagogy";

const VALID_HOOK_CLASSES = new Set<HookShape>([
  "question",
  "direct_address",
  "numeric",
  "first_person",
  "declarative_image",
]);

function sampleHookFor(auditClass: HookShape): string {
  if (auditClass === "question") return "What changes first when the routine starts to slip?";
  if (auditClass === "direct_address") return "You notice the skipped review before anyone else does.";
  if (auditClass === "numeric") return "3 missed handoffs explain the whole delay.";
  if (auditClass === "first_person") return "I trusted the shortcut until the repair took all afternoon.";
  return "The notebook stayed open beside the unfinished checklist.";
}

test("pedagogy palettes load with unique ids, substantial definitions, and valid hook audit classes", () => {
  const palettes = loadPedagogyPalettes();
  assert.ok(palettes.hookShapes.length >= 10, `hook palette has ${palettes.hookShapes.length} shapes`);
  assert.ok(palettes.tryThisNowGrammars.length >= 8, `tryThisNow palette has ${palettes.tryThisNowGrammars.length} grammars`);
  assert.ok(palettes.quizOpeners.length >= 6, `quiz opener palette has ${palettes.quizOpeners.length} openers`);

  assert.equal(new Set(palettes.hookShapes.map((entry) => entry.id)).size, palettes.hookShapes.length, "hook ids must be unique");
  assert.equal(
    new Set(palettes.tryThisNowGrammars.map((entry) => entry.id)).size,
    palettes.tryThisNowGrammars.length,
    "tryThisNow ids must be unique",
  );
  assert.equal(new Set(palettes.quizOpeners.map((entry) => entry.id)).size, palettes.quizOpeners.length, "quiz opener ids must be unique");

  const hookClassCounts: Record<HookShape, number> = {
    question: 0,
    direct_address: 0,
    numeric: 0,
    first_person: 0,
    declarative_image: 0,
  };
  for (const entry of palettes.hookShapes) {
    assert.ok(entry.definition.length > 80, `${entry.id} needs a paste-able hook definition`);
    assert.ok(VALID_HOOK_CLASSES.has(entry.auditClass), `${entry.id} has invalid auditClass ${entry.auditClass}`);
    hookClassCounts[entry.auditClass]++;
    assert.equal(classifyHook(sampleHookFor(entry.auditClass)), entry.auditClass, `${entry.auditClass} sample must match catalogAudit`);
  }
  assert.ok(hookClassCounts.question >= 2, "need at least 2 question hook shapes");
  assert.ok(hookClassCounts.direct_address >= 2, "need at least 2 direct-address hook shapes");
  assert.ok(hookClassCounts.numeric >= 1, "need at least 1 numeric hook shape");
  assert.ok(hookClassCounts.first_person >= 1, "need at least 1 first-person hook shape");
  assert.ok(hookClassCounts.declarative_image <= 3, "declarative_image hook shapes are capped at 3");

  for (const entry of palettes.tryThisNowGrammars) {
    assert.ok(entry.definition.length > 50, `${entry.id} needs a paste-able grammar definition`);
    assert.ok(entry.example.length > 30, `${entry.id} needs a concrete example`);
  }
  for (const entry of palettes.quizOpeners) {
    assert.ok(entry.definition.length > 50, `${entry.id} needs a paste-able opener definition`);
    assert.ok(entry.example.length > 30, `${entry.id} needs a concrete example`);
  }
});

test("pedagogy planning is byte-deterministic and scatters dominant hook shapes across books", () => {
  const a1 = JSON.stringify(planPedagogy("zz-fixture-ped-alpha", 1, 5, { forceFresh: true }));
  const a2 = JSON.stringify(planPedagogy("zz-fixture-ped-alpha", 1, 5, { forceFresh: true }));
  assert.equal(a1, a2, "re-plan must be byte-identical");

  const bookIds = [
    "zz-fixture-ped-alpha",
    "zz-fixture-ped-beta",
    "zz-fixture-ped-gamma",
    "zz-fixture-ped-delta",
    "zz-fixture-ped-epsilon",
  ];
  const dominants = new Set(bookIds.map((bookId) => planPedagogy(bookId, 1, 5, { forceFresh: true }).bookMix.dominantHookShape));
  assert.ok(dominants.size >= 3, `expected at least 3 distinct dominant hooks, got ${Array.from(dominants).join(", ")}`);
});

test("no two consecutive chapters get the same hook shape in a 20-chapter plan", () => {
  const plan = planPedagogy(BOOK, 1, 20, { forceFresh: true });
  for (let chapterNumber = 1; chapterNumber < 20; chapterNumber++) {
    assert.notEqual(
      plan.allocation[chapterNumber].hookShape,
      plan.allocation[chapterNumber + 1].hookShape,
      `hook repeats across ch${chapterNumber}->ch${chapterNumber + 1}`,
    );
  }
});

test("authored chapters are carried unless forceFresh is set, with case-tolerant file detection", () => {
  try {
    const ch2 = makeChapter("Zz-Fixture-Pedagogy", 2);
    writeFixtureBook(STATE_CHAPTERS, [ch2]);

    const carried = planPedagogy(BOOK, 1, 3);
    assert.deepEqual(carried.carriedChapters, [2]);

    const fresh = planPedagogy(BOOK, 1, 3, { forceFresh: true });
    assert.deepEqual(fresh.carriedChapters, []);
  } finally {
    for (const file of readdirSync(STATE_CHAPTERS)) {
      if (file.toLowerCase().startsWith(`${BOOK}-ch`)) rmSync(resolve(STATE_CHAPTERS, file), { force: true });
    }
  }
});

test("ten fresh books stay below 50% dominant hook audit-class share", () => {
  const palettes = loadPedagogyPalettes();
  const auditClassById = new Map<string, HookShape>();
  for (const entry of palettes.hookShapes) auditClassById.set(entry.id, entry.auditClass);
  const counts: Record<HookShape, number> = {
    question: 0,
    direct_address: 0,
    numeric: 0,
    first_person: 0,
    declarative_image: 0,
  };
  const bookIds = [
    "zz-fixture-ped-catalog-01",
    "zz-fixture-ped-catalog-02",
    "zz-fixture-ped-catalog-03",
    "zz-fixture-ped-catalog-04",
    "zz-fixture-ped-catalog-05",
    "zz-fixture-ped-catalog-06",
    "zz-fixture-ped-catalog-07",
    "zz-fixture-ped-catalog-08",
    "zz-fixture-ped-catalog-09",
    "zz-fixture-ped-catalog-10",
  ];
  for (const bookId of bookIds) {
    const plan = planPedagogy(bookId, 1, 20, { forceFresh: true });
    for (const allocation of Object.values(plan.allocation)) {
      const auditClass = auditClassById.get(allocation.hookShape);
      assert.ok(auditClass, `${allocation.hookShape} must exist in palette`);
      counts[classifyHook(sampleHookFor(auditClass))]++;
    }
  }
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  const dominantShare = Math.max(...Object.values(counts)) / total;
  assert.ok(dominantShare < 0.5, `dominant hook class share ${(dominantShare * 100).toFixed(1)}% from ${JSON.stringify(counts)}`);
});

test("pedagogy-plan CLI writes the plan and prints allocations", () => {
  const planPath = resolve(PIPELINE_DIR, "state", "pedagogy-plans", `${BOOK}.pedagogy-plan.json`);
  try {
    const { status, out } = runCli(["pedagogy-plan", BOOK, "--from", "1", "--to", "3"]);
    assert.equal(status, 0, out.slice(-400));
    assert.match(out, /Pedagogy plan/);
    assert.match(out, /ch01:/);
    assert.match(out, /Hook definitions:/);
  } finally {
    rmSync(planPath, { force: true });
  }
});
