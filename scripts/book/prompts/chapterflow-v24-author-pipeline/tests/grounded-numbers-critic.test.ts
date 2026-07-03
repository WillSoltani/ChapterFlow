/**
 * Grounded-numbers critic (GN1) — invented precision in reader prose must trace to
 * the chapter's source notes.
 *
 * This is the executable calibration contract (Shared Law §7):
 *  - TRUE POSITIVES fire (a gate that flags nothing is useless): fabricated
 *    percentages/multipliers/magnitudes lifted from the Atomic-Habits regen defect.
 *  - MUST-NOT-FIRE stays silent: grounded figures (value in the source notes) and the
 *    trivially-safe classes the unit-gating excludes by construction (a bare quantity,
 *    a year, a clock time, a list ordinal, a duration).
 *  - A wiring test asserts the planted defect surfaces via runShipGate(...).majors
 *    (GN1 is SHADOW=major), with a real on-disk source-v2 sidecar so loadChapterSidecar
 *    resolves it.
 *  - GOLD zero-FP: checkGroundedNumbers is v2-gated, and the gold corpus is rich-v1 /
 *    sidecar-absent, so it emits ZERO by construction — the calibration-safe default.
 *
 * NOTE: tests/grounded-numbers.test.ts already exists and covers a DIFFERENT thing
 * (`groundedNumbersForChapter`, the VERIFIED-number bar-pack provenance). This file is
 * the deterministic CRITIC's contract — hence the `-critic` suffix.
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, rmSync } from "fs";
import { resolve } from "path";

import { test, skip } from "./harness.js";
import { makeChapter, makeGateCleanChapter, makeSourceV2SidecarFixture, goldChapterFiles, STATE_CHAPTERS, RUNS_DIR, writeSourceEvidenceFixture } from "./helpers.js";
import {
  findUngroundedNumbers,
  groundedNumberTokens,
  checkGroundedNumbers,
} from "../src/critics/groundedNumbers.js";
import { runShipGate } from "../src/critics/finalGate.js";
import type { ChapterV21 } from "../src/types.js";

// ── The real defect (the Atomic-Habits regen + regen-style fabricated figures) ─
const TRUE_POSITIVES: Array<[string, string]> = [
  ["spelled percent (the Atomic line)", "The notebook gets opened ninety percent of the time."],
  ["second fabricated percent in the same defect", "That makes it roughly ninety percent more often than the old planner."],
  ["regen figure: spelled percent", "Her focus score jumped seventy-three percent in a single week."],
  ["digit percent", "Sales rose 40% the month after the change."],
  ["digit multiplier", "The new routine is 3x faster than the one it replaced."],
  ["spelled multiplier (fold)", "Output rose tenfold once the checkpoint went live."],
  ["digit magnitude", "By spring the fund was managing 2 billion dollars."],
];

test("GN1: findUngroundedNumbers fires on every fabricated figure (empty allow)", () => {
  for (const [label, sentence] of TRUE_POSITIVES) {
    const hits = findUngroundedNumbers(sentence, new Set());
    assert.ok(hits.length >= 1, `expected a hit for ${label}: "${sentence}"`);
  }
});

// ── Clean / grounded constructions a real chapter legitimately uses ────────────
// Each [label, sentence, allow] — `allow` carries the numbers the source notes ground.
const MUST_NOT_FIRE: Array<[string, string, string[]]> = [
  // Grounded figures (value present in the chapter's source notes) → silent.
  ["grounded percent (digit)", "Reopenings fell 41 percent after the intake checkpoint.", ["41"]],
  ["grounded percent (spelled, sidecar has digit form)", "Handoff errors dropped forty-one percent that quarter.", ["41"]],
  ["grounded multiplier", "The pilot cut errors threefold, exactly as the log shows.", ["3"]],
  ["grounded magnitude", "Atlas Foods moved 9 million units before the recall.", ["9"]],
  // Trivially-safe classes the unit-gating excludes by construction (allow is irrelevant).
  ["bare quantity, no statistical unit", "The court issued 1,112 rulings that year.", []],
  ["a year", "In 1939 she closed every workshop except the perfume operation.", []],
  ["a clock time", "Kavya is the triage attending at 2:40 a.m. when the chart arrives.", []],
  ["a list ordinal", "She picked one of three folders and opened it.", []],
  ["a duration", "Two weeks later the totals finally matched the source note.", []],
  ["a counted total", "The team kept a 24-hour repair log so context survived overnight.", []],
  // Words ending in "fold" are not numbers → never a multiplier.
  ["a non-number -fold word", "The scaffold held while the crew checked the manifold.", []],
];

test("GN1: findUngroundedNumbers stays silent on grounded + trivially-safe constructions", () => {
  for (const [label, sentence, allow] of MUST_NOT_FIRE) {
    const hits = findUngroundedNumbers(sentence, new Set(allow));
    assert.equal(hits.length, 0, `false positive on ${label}: "${sentence}" → ${JSON.stringify(hits)}`);
  }
});

test("GN1: groundedNumberTokens collects every source-note number (digit + spelled)", () => {
  const sidecar = {
    schemaVersion: "source-v2",
    testableFacts: [{ id: "ch01.fact.1", claim: "Reopenings fell from 37 to 12 after the May 2026 checkpoint." }],
    namedExamples: [{ id: "ch01.ex.a", label: "case", hardSpecifics: ["a sixty-eight percent drop", "by 1948"], realWorld: true }],
  };
  const tokens = groundedNumberTokens(sidecar);
  for (const t of ["37", "12", "2026", "68", "1948"]) {
    assert.ok(tokens.has(t), `expected grounded token ${t} (got ${[...tokens].join(",")})`);
  }
});

test("GN1: a number grounded in the sidecar is silent; an invented one fires", () => {
  const sidecar = {
    schemaVersion: "source-v2",
    testableFacts: [{ id: "ch01.fact.1", claim: "The team cut reopenings by 41 percent." }],
  };
  const allow = groundedNumberTokens(sidecar);
  // 41% is grounded → silent.
  assert.equal(findUngroundedNumbers("Reopenings fell 41 percent after the change.", allow).length, 0);
  // 90% is nowhere in the sidecar → fires.
  assert.ok(findUngroundedNumbers("Reopenings fell ninety percent after the change.", allow).length >= 1);
});

test("GN1: checkGroundedNumbers flags a planted figure (v2 sidecarOverride) and is silent on a v1 sidecar", () => {
  const ch = makeChapter("zz-gn-plant", 1, {
    overrides: {
      breakdown: {
        fastRead: "A short clean opening tier with ordinary prose and no figures at all here, just plain language.",
        deepRead: "The longer tier expands the idea with neutral exposition. Then it claims the notebook gets opened ninety percent of the time, a number nobody measured. The rest continues without statistics across the remaining sentences so the tier clears its length floor comfortably.",
        fullRead: "The longest tier stays qualitative throughout, with scenes and named people and zero invented precision, running well past its floor so the stub check never trips while the prose carries the idea forward in plain words across several unhurried paragraphs that never reach for a fake statistic to sound rigorous.",
      } as any,
    },
  });
  const v2 = { schemaVersion: "source-v2", chapterNumber: 1, testableFacts: [], namedExamples: [] };
  const fired = checkGroundedNumbers(ch, v2);
  assert.ok(fired.some((f) => f.checkId === "GN1.ungrounded_number"), "expected a GN1 finding under a v2 sidecar");
  assert.ok(fired.every((f) => f.severity === "major"), "GN1 findings must be majors (shadow)");
  // v1 sidecar → v2-gated skip → zero (cannot brick the 1581 existing v1 sidecars).
  const v1 = { namedExamples: [{ label: "x" }], keyClaims: ["y"] };
  assert.equal(checkGroundedNumbers(ch, v1).length, 0, "a v1 sidecar must skip GN1 entirely");
  // No sidecar at all → skip → zero.
  assert.equal(checkGroundedNumbers(ch, null).length, 0, "a missing sidecar must skip GN1 entirely");
});

test("GN1: a clean chapter under a real v2 sidecar emits ZERO (positive control)", () => {
  const ch = makeGateCleanChapter("zz-gn-clean", 1);
  const sidecar = makeSourceV2SidecarFixture({ chapterNumber: 1, chapterTitle: ch.title });
  const hits = checkGroundedNumbers(ch, sidecar);
  assert.equal(hits.length, 0, `unexpected GN1 on a clean v2 chapter: ${hits.map((h) => h.message.slice(0, 120)).join(" | ")}`);
});

// ── Wiring: the ship gate surfaces a planted figure as a MAJOR ─────────────────
const WIRE_BOOK = "zz-gn-critic-wire";

test("GN1: the ship gate surfaces a planted figure as a major (wiring + severity)", () => {
  const ch = makeChapter(WIRE_BOOK, 1);
  // Plant a fabricated percentage in a reader field.
  ch.breakdown.deepRead = `${ch.breakdown.deepRead} The new routine got opened ninety percent of the time, a number nobody measured.`;
  // Write a real source-v2 sidecar to disk so loadChapterSidecar resolves it (90% is not in it).
  writeSourceEvidenceFixture(WIRE_BOOK, [{ number: 1, title: ch.title }]);
  try {
    const report = runShipGate(ch);
    assert.ok(
      report.majors.some((m) => m.catalogId === "GN1.ungrounded_number"),
      `expected a GN1 ship-gate major; got majors: ${report.majors.map((m) => m.catalogId).join(", ")}`,
    );
  } finally {
    rmSync(resolve(RUNS_DIR, WIRE_BOOK), { recursive: true, force: true });
  }
});

// ── Gold-corpus zero-FP calibration ────────────────────────────────────────────
// checkGroundedNumbers is v2-gated; the gold corpus is rich-v1 (real books) or has no
// on-disk sidecar (synthetic gold), so GN1 emits ZERO by construction. This pins that
// the v2-gate cannot regress into firing on reference-quality v1 content.

test("GN1: synthetic gold corpus has ZERO GN1 findings", () => {
  for (const { bookId, files } of goldChapterFiles()) {
    for (const file of files) {
      const ch = JSON.parse(readFileSync(file, "utf8")) as ChapterV21;
      const hits = checkGroundedNumbers(ch);
      assert.equal(hits.length, 0, `GN1 false positive on synthetic gold ${bookId} ${ch.chapterId}: ${hits.map((h) => h.message.slice(0, 100)).join(" | ")}`);
    }
  }
});

for (const bookId of ["daring-greatly", "start-with-why"]) {
  const files = existsSync(STATE_CHAPTERS)
    ? readdirSync(STATE_CHAPTERS).filter((f) => f.startsWith(`${bookId}-ch`) && f.endsWith(".v21-native.chapter.json"))
    : [];
  if (files.length === 0) {
    skip(`GN1 gold zero-FP: ${bookId}`, `no ${bookId} chapters in state/chapters/ on this machine`);
    continue;
  }
  test(`GN1: real gold corpus ${bookId} (${files.length} ch) emits ZERO GN1 findings`, () => {
    const offenders: string[] = [];
    for (const f of files) {
      const ch = JSON.parse(readFileSync(resolve(STATE_CHAPTERS, f), "utf8")) as ChapterV21;
      for (const hit of checkGroundedNumbers(ch)) offenders.push(`${ch.chapterId}: ${hit.message.slice(0, 120)}`);
    }
    assert.equal(offenders.length, 0, `GN1 false-positives on reference-quality ${bookId} (miscalibrated):\n${offenders.join("\n")}`);
  });
}
