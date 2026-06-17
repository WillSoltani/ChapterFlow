/**
 * Name plan source-figure exclusion — source figures are not available as
 * fictional protagonist names for the same book.
 */

import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "fs";
import { resolve } from "path";

import { loadNameBank, planNames } from "../src/librarian/namePlan.js";
import { test } from "./harness.js";
import { PIPELINE_DIR } from "./helpers.js";

const BOOK = "zz-fixture-source-name";
const REPO_ROOT = resolve(PIPELINE_DIR, "../../../..");
const RUN_BOOK_DIR = resolve(REPO_ROOT, ".chapterflow", "runs", BOOK);
const RUN_DIR = resolve(RUN_BOOK_DIR, "99999999-test");

function resetFixture(): void {
  rmSync(RUN_BOOK_DIR, { recursive: true, force: true });
}

function writeSourceSidecar(): void {
  const dir = resolve(RUN_DIR, "sidecars", "source");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    resolve(dir, "ch01.source.json"),
    JSON.stringify(
      {
        namedExamples: [
          {
            label: "Benjamin Franklin lightning lesson",
            summary: "Benjamin Franklin is the source figure, not a fictional consultant.",
            teachesWhat: "source names stay out of the protagonist pool",
            hardSpecifics: ["Benjamin Franklin", "Philadelphia"],
          },
        ],
        properNouns: ["Benjamin Franklin"],
      },
      null,
      2,
    ),
    "utf8",
  );
}

function quietWarn<T>(fn: () => T): T {
  const oldWarn = console.warn;
  console.warn = () => {};
  try {
    return fn();
  } finally {
    console.warn = oldWarn;
  }
}

test("name-plan excludes source-figure first names from the dealt pool", () => {
  try {
    resetFixture();
    const bankSize = loadNameBank().length;
    const withoutSidecar = quietWarn(() => planNames(BOOK, 1, 1, bankSize, { forceFresh: true }));
    assert.ok(Object.values(withoutSidecar.allocation).flat().includes("Benjamin"), "fixture must prove Benjamin is otherwise dealable");

    writeSourceSidecar();
    const plan = quietWarn(() => planNames(BOOK, 1, 1, bankSize, { forceFresh: true }));
    const dealt = Object.values(plan.allocation).flat();
    assert.equal(plan.diagnostics.sourceFigureExcluded, 1);
    assert.ok(!dealt.includes("Benjamin"), "Benjamin Franklin's first name must not be dealt as a protagonist name");
  } finally {
    resetFixture();
  }
});

test("forceFresh per-chapter re-dispatches dealt in SEPARATE calls are DISJOINT (no F1 reintroduction)", () => {
  try {
    resetFixture();
    // The barrier prints per-chapter `fanout --from N --to N --all` commands; an
    // orchestrator that deals all offender cards up-front (before any writer rewrites)
    // must NOT get the same available[0:perChapter] window for two different chapters.
    const ch3 = quietWarn(() => planNames(BOOK, 3, 3, 7, { forceFresh: true })).allocation[3];
    const ch5 = quietWarn(() => planNames(BOOK, 5, 5, 7, { forceFresh: true })).allocation[5];
    assert.equal(ch3.length, 7);
    assert.equal(ch5.length, 7);
    const overlap = ch3.filter((n) => ch5.includes(n));
    assert.deepEqual(overlap, [], `ch3 and ch5 re-dispatches must not share names; overlap=${overlap.join(",")}`);
    // And a per-chapter deal matches the slice that chapter gets in a whole-book deal.
    const whole = quietWarn(() => planNames(BOOK, 1, 12, 7, { forceFresh: true })).allocation;
    assert.deepEqual(whole[3], ch3, "per-chapter ch3 must match its whole-book slice");
    assert.deepEqual(whole[5], ch5, "per-chapter ch5 must match its whole-book slice");
  } finally {
    resetFixture();
  }
});

test("WS-6: a whole-book NON-forceFresh deal gives unauthored chapters DISJOINT pools (what fanout now derives)", () => {
  try {
    resetFixture();
    // No chapters authored yet = fanout's INITIAL deal. Deriving over the whole book
    // advances the cursor per chapter, so every chapter gets a distinct slice — the
    // property the fanout whole-book derivation relies on to avoid the F1 collision.
    const whole = quietWarn(() => planNames(BOOK, 1, 6, 7, { forceFresh: false })).allocation;
    const seen = new Set<string>();
    for (let n = 1; n <= 6; n++) {
      for (const name of whole[n]) {
        assert.ok(!seen.has(name), `name "${name}" dealt to two chapters in the whole-book deal`);
        seen.add(name);
      }
    }
    // The BUG the whole-book derivation avoids: a per-chapter NON-forceFresh deal starts
    // the cursor at 0 for every UNAUTHORED chapter, so two SEPARATE per-chapter calls
    // (the operator workaround when the full fanout output was too large) collide on
    // available[0:7]. This is the digital-minimalism ch1..ch6 F1 collision.
    const ch1 = quietWarn(() => planNames(BOOK, 1, 1, 7, { forceFresh: false })).allocation[1];
    const ch2 = quietWarn(() => planNames(BOOK, 2, 2, 7, { forceFresh: false })).allocation[2];
    const overlap = ch1.filter((n) => ch2.includes(n));
    assert.ok(overlap.length > 0, "per-chapter non-forceFresh deals collide (cursor 0) — exactly why fanout must derive whole-book");
  } finally {
    resetFixture();
  }
});

test("name-plan warns and proceeds when a source sidecar is missing", () => {
  try {
    resetFixture();
    const warnings: string[] = [];
    const oldWarn = console.warn;
    console.warn = (message?: unknown) => { warnings.push(String(message)); };
    try {
      const plan = planNames(BOOK, 1, 1, 3, { forceFresh: true });
      assert.equal(plan.diagnostics.sourceFigureExcluded, 0);
      assert.equal(plan.allocation[1].length, 3);
    } finally {
      console.warn = oldWarn;
    }
    assert.ok(warnings.some((line) => line.includes("source sidecar")), `expected missing-sidecar warning, got ${warnings.join("\n")}`);
  } finally {
    resetFixture();
  }
});
