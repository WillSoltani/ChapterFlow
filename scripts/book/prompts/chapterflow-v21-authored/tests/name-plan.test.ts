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
