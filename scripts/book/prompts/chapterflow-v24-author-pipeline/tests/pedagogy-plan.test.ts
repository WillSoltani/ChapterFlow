/**
 * Pedagogy-slot plan (catalog campaign Phase B2) — prevention for hook,
 * tryThisNow, and quiz-opener monoculture before parallel authoring starts.
 */

import assert from "node:assert/strict";
import { readFileSync, readdirSync, rmSync } from "fs";
import { resolve } from "path";

import { classifyHook, type HookShape } from "../src/critics/catalogAudit.js";
import { loadPedagogyPalettes, planPedagogy } from "../src/librarian/pedagogyPlan.js";
import type { BookContentReader } from "../src/books/candidateTypes.js";
import { test } from "./harness.js";
import { makeChapter, runCli, STATE_CHAPTERS, writeFixtureBook } from "./helpers.js";

const BOOK = "zz-fixture-pedagogy";
const CANDIDATE = "pedagogy-plan-candidate";

function candidateReader(bookId: string): BookContentReader {
  return { async open() {
    const files = readdirSync(STATE_CHAPTERS)
      .filter((name) => name.toLowerCase().startsWith(`${bookId.toLowerCase()}-ch`))
      .map((name) => ({ kind: "CHAPTER" as const, logicalPath: `state/chapters/${name}`, mediaType: "application/json" as const, byteLength: 0, bytes: Buffer.from(readFileSync(resolve(STATE_CHAPTERS, name))) }));
    return { ok: true, value: { manifest: { schemaVersion: "1", bookId, candidateId: CANDIDATE, createdByRunId: "test", entries: [], manifestDigest: "0".repeat(64), createdAt: new Date(0).toISOString() }, files } };
  } };
}

function planFor(bookId: string, from: number, to: number, opts: { forceFresh?: boolean } = {}) {
  return planPedagogy(bookId, from, to, opts, candidateReader(bookId), CANDIDATE);
}

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
  assert.ok(palettes.tacticFamilies.length >= 24, `tactic family palette has ${palettes.tacticFamilies.length} families`);
  assert.ok(palettes.quizOpeners.length >= 6, `quiz opener palette has ${palettes.quizOpeners.length} openers`);

  assert.equal(new Set(palettes.hookShapes.map((entry) => entry.id)).size, palettes.hookShapes.length, "hook ids must be unique");
  assert.equal(
    new Set(palettes.tryThisNowGrammars.map((entry) => entry.id)).size,
    palettes.tryThisNowGrammars.length,
    "tryThisNow ids must be unique",
  );
  assert.equal(
    new Set(palettes.tacticFamilies.map((entry) => entry.id)).size,
    palettes.tacticFamilies.length,
    "tactic family ids must be unique",
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
    // NON-CIRCULAR ground-truth check (added after adversarial review caught
    // ratio-reversal declaring "numeric" while its own example classified as
    // declarative_image): classify the palette's ACTUAL embedded example, not
    // a test-authored sample. Authors imitate the example — if it lands in
    // the wrong classifyHook bucket, the feature moves catalog-audit's
    // numbers the wrong way.
    // Scene-skeleton-prone shapes (object-in-motion, room-after-action) INTENTIONALLY
    // omit a copyable miniature example: the card prints the definition verbatim, and a
    // concrete "[object] travels A→B" example is exactly the skeleton blind writers copy
    // (the eat-that-frog scene_skeleton failure). For every OTHER shape keep the
    // non-circular ground-truth check — the embedded example must classify as its declared
    // auditClass (authors imitate the example). declarative_image is still ground-truthed
    // via concrete-ironic-image, which is not prone and keeps its example.
    if (entry.sceneSkeletonProne) {
      assert.doesNotMatch(
        entry.definition,
        /Miniature example:/i,
        `${entry.id} is scene-skeleton-prone: it must NOT carry a copyable miniature example (writers copy it → scene_skeleton)`,
      );
    } else {
      const embedded = entry.definition.match(/Miniature example: ["“](.+?)["”]/);
      assert.ok(embedded, `${entry.id}'s definition must embed a 'Miniature example: "…"'`);
      assert.equal(
        classifyHook(embedded![1]),
        entry.auditClass,
        `${entry.id}'s OWN example ("${embedded![1].slice(0, 60)}…") classifies as ${classifyHook(embedded![1])}, not its declared ${entry.auditClass}`,
      );
    }
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
  for (const entry of palettes.tacticFamilies) {
    assert.ok(entry.definition.length > 60, `${entry.id} needs a paste-able tactic family definition`);
    assert.ok(entry.example.length > 40, `${entry.id} needs an illustrative example`);
  }
  for (const entry of palettes.quizOpeners) {
    assert.ok(entry.definition.length > 50, `${entry.id} needs a paste-able opener definition`);
    assert.ok(entry.example.length > 30, `${entry.id} needs a concrete example`);
  }
});

test("pedagogy planning is byte-deterministic and scatters dominant hook shapes across books", async () => {
  const a1 = JSON.stringify(await planFor("zz-fixture-ped-alpha", 1, 5, { forceFresh: true }));
  const a2 = JSON.stringify(await planFor("zz-fixture-ped-alpha", 1, 5, { forceFresh: true }));
  assert.equal(a1, a2, "re-plan must be byte-identical");

  const bookIds = [
    "zz-fixture-ped-alpha",
    "zz-fixture-ped-beta",
    "zz-fixture-ped-gamma",
    "zz-fixture-ped-delta",
    "zz-fixture-ped-epsilon",
  ];
  const dominants = new Set((await Promise.all(bookIds.map((bookId) => planFor(bookId, 1, 5, { forceFresh: true })))).map((plan) => plan.bookMix.dominantHookShape));
  assert.ok(dominants.size >= 3, `expected at least 3 distinct dominant hooks, got ${Array.from(dominants).join(", ")}`);
});

test("no two consecutive chapters get the same hook shape in a 20-chapter plan", async () => {
  const plan = await planFor(BOOK, 1, 20, { forceFresh: true });
  for (let chapterNumber = 1; chapterNumber < 20; chapterNumber++) {
    assert.notEqual(
      plan.allocation[chapterNumber].hookShape,
      plan.allocation[chapterNumber + 1].hookShape,
      `hook repeats across ch${chapterNumber}->ch${chapterNumber + 1}`,
    );
  }
});

test("tactic families do not repeat within a 12-chapter window and cap at 2 in 34 chapters", async () => {
  const plan = await planFor(BOOK, 1, 34, { forceFresh: true });
  const counts = new Map<string, number>();
  for (let chapterNumber = 1; chapterNumber <= 34; chapterNumber++) {
    const family = plan.allocation[chapterNumber].tacticFamily;
    counts.set(family, (counts.get(family) ?? 0) + 1);
    for (let other = chapterNumber + 1; other < chapterNumber + 12 && other <= 34; other++) {
      assert.notEqual(
        family,
        plan.allocation[other].tacticFamily,
        `${family} repeats within a 12-chapter window (ch${chapterNumber}->ch${other})`,
      );
    }
  }
  const over = Array.from(counts.entries()).filter(([, count]) => count > 2);
  assert.deepEqual(over, [], `families over cap: ${over.map(([family, count]) => `${family}:${count}`).join(", ")}`);
});

test("authored chapters are carried unless forceFresh is set, with case-tolerant file detection", async () => {
  try {
    const ch2 = makeChapter("Zz-Fixture-Pedagogy", 2);
    writeFixtureBook(STATE_CHAPTERS, [ch2]);

    const carried = await planFor(BOOK, 1, 3);
    assert.deepEqual(carried.carriedChapters, [2]);

    const fresh = await planFor(BOOK, 1, 3, { forceFresh: true });
    assert.deepEqual(fresh.carriedChapters, []);
  } finally {
    for (const file of readdirSync(STATE_CHAPTERS)) {
      if (file.toLowerCase().startsWith(`${BOOK}-ch`)) rmSync(resolve(STATE_CHAPTERS, file), { force: true });
    }
  }
});

test("ten fresh books stay below 50% dominant hook audit-class share", async () => {
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
    const plan = await planFor(bookId, 1, 20, { forceFresh: true });
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

test("pedagogy-plan CLI blocks without explicit candidate selector", () => {
  const { status, out } = runCli(["pedagogy-plan", BOOK, "--from", "1", "--to", "3"]);
  assert.equal(status, 2, out.slice(-400));
  assert.match(out, /V25_CANDIDATE_READER_REQUIRED/);
});
