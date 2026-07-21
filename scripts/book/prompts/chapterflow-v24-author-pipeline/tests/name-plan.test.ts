/**
 * Name plan source-figure exclusion — source figures are not available as
 * fictional protagonist names for the same book.
 */

import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { resolve } from "path";

import { loadNameBank, planNames } from "../src/librarian/namePlan.js";
import type { BookContentReader } from "../src/books/candidateTypes.js";
import { C7_BANNED_NAMES } from "../src/critics/finalGate.js";
import { test } from "./harness.js";
import { PIPELINE_DIR, writeResearchRunManifestFixture } from "./helpers.js";

const BOOK = "zz-fixture-source-name";
const REPO_ROOT = PIPELINE_DIR;
const RUN_BOOK_DIR = resolve(REPO_ROOT, ".chapterflow", "runs", BOOK);
const RUN_DIR = resolve(RUN_BOOK_DIR, "99999999-test");
const CANDIDATE = "name-plan-candidate";

function candidateReader(bookId: string, missingSidecars = new Set<number>()): BookContentReader {
  return { async open() {
    const files = [] as Array<{ kind: "SIDECAR"; logicalPath: string; mediaType: "application/json"; byteLength: number; bytes: Buffer }>;
    const sourcePath = resolve(RUN_DIR, "sidecars", "source", "ch01.source.json");
    for (let chapter = 1; chapter <= 100; chapter++) {
      if (missingSidecars.has(chapter)) continue;
      const bytes = chapter === 1 && existsSync(sourcePath) ? Buffer.from(readFileSync(sourcePath)) : Buffer.from("{}");
      files.push({ kind: "SIDECAR", logicalPath: `sidecars/ch${String(chapter).padStart(2, "0")}.json`, mediaType: "application/json", byteLength: bytes.length, bytes });
    }
    const ledger = Buffer.from('{"version":"2.0.0","lastUpdatedAt":"1970-01-01T00:00:00.000Z","revision":0,"policy":{"namePolicyVersion":"name-policy-v1","namePolicyId":"catalog-cooldown-v1"},"books":{},"globalNameUsage":{},"globalPhraseUsage":{},"globalAnswerPositionCounts":[0,0,0]}');
    files.push({ kind: "SIDECAR", logicalPath: "state/library-state.json", mediaType: "application/json", byteLength: ledger.length, bytes: ledger });
    return { ok: true, value: { manifest: { schemaVersion: "1", bookId, candidateId: CANDIDATE, createdByRunId: "test", entries: [], manifestDigest: "0".repeat(64), createdAt: new Date(0).toISOString() }, files } };
  } };
}

function planFor(bookId: string, from: number, to: number, perChapter = 7, forceFresh = false, reader = candidateReader(bookId)) {
  return planNames(bookId, from, to, perChapter, { forceFresh }, reader, CANDIDATE);
}

function resetFixture(): void {
  rmSync(RUN_BOOK_DIR, { recursive: true, force: true });
}

function writeSourceSidecar(): void {
  const dir = resolve(RUN_DIR, "sidecars", "source");
  mkdirSync(dir, { recursive: true });
  writeResearchRunManifestFixture({
    runDir: RUN_DIR,
    bookId: BOOK,
    chapters: [{ number: 1, title: "Source Name" }],
  });
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

async function quietWarn<T>(fn: () => Promise<T>): Promise<T> {
  const oldWarn = console.warn;
  console.warn = () => {};
  try {
    return await fn();
  } finally {
    console.warn = oldWarn;
  }
}

test("name-plan excludes source-figure first names from the dealt pool", async () => {
  try {
    resetFixture();
    const bankSize = loadNameBank().length;
    const withoutSidecar = await quietWarn(() => planFor(BOOK, 1, 1, bankSize, true));
    assert.ok(Object.values(withoutSidecar.allocation).flat().includes("Benjamin"), "fixture must prove Benjamin is otherwise dealable");

    writeSourceSidecar();
    const plan = await quietWarn(() => planFor(BOOK, 1, 1, bankSize, true));
    const dealt = Object.values(plan.allocation).flat();
    assert.equal(plan.diagnostics.sourceFigureExcluded, 1);
    assert.ok(!dealt.includes("Benjamin"), "Benjamin Franklin's first name must not be dealt as a protagonist name");
  } finally {
    resetFixture();
  }
});

test("C7 deal↔gate consistency: the allocator NEVER deals a name the C7 ship-gate bans", async () => {
  try {
    resetFixture();
    const banned = new Set(C7_BANNED_NAMES);
    // Whole-book deal across a wide range — every dealt name must avoid the banned pool,
    // so a writer is never handed a name the gate then blocks (the Owen incident class).
    const dealt = Object.values((await quietWarn(() => planFor(BOOK, 1, 20, 7, true))).allocation).flat();
    const offenders = [...new Set(dealt.filter((n) => banned.has(n)))];
    assert.deepEqual(offenders, [], `allocator dealt C7-banned name(s): ${offenders.join(", ")}`);
  } finally {
    resetFixture();
  }
});

test("forceFresh per-chapter re-dispatches dealt in SEPARATE calls are DISJOINT (no F1 reintroduction)", async () => {
  try {
    resetFixture();
    // The barrier prints per-chapter `fanout --from N --to N --all` commands; an
    // orchestrator that deals all offender cards up-front (before any writer rewrites)
    // must NOT get the same available[0:perChapter] window for two different chapters.
    const ch3 = (await quietWarn(() => planFor(BOOK, 3, 3, 7, true))).allocation[3];
    const ch5 = (await quietWarn(() => planFor(BOOK, 5, 5, 7, true))).allocation[5];
    assert.equal(ch3.length, 7);
    assert.equal(ch5.length, 7);
    const overlap = ch3.filter((n) => ch5.includes(n));
    assert.deepEqual(overlap, [], `ch3 and ch5 re-dispatches must not share names; overlap=${overlap.join(",")}`);
    // And a per-chapter deal matches the slice that chapter gets in a whole-book deal.
    const whole = (await quietWarn(() => planFor(BOOK, 1, 12, 7, true))).allocation;
    assert.deepEqual(whole[3], ch3, "per-chapter ch3 must match its whole-book slice");
    assert.deepEqual(whole[5], ch5, "per-chapter ch5 must match its whole-book slice");
  } finally {
    resetFixture();
  }
});

test("WS-6: a whole-book NON-forceFresh deal gives unauthored chapters DISJOINT pools (what fanout now derives)", async () => {
  try {
    resetFixture();
    // No chapters authored yet = fanout's INITIAL deal. Deriving over the whole book
    // advances the cursor per chapter, so every chapter gets a distinct slice — the
    // property the fanout whole-book derivation relies on to avoid the F1 collision.
    const whole = (await quietWarn(() => planFor(BOOK, 1, 6, 7, false))).allocation;
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
    const ch1 = (await quietWarn(() => planFor(BOOK, 1, 1, 7, false))).allocation[1];
    const ch2 = (await quietWarn(() => planFor(BOOK, 2, 2, 7, false))).allocation[2];
    const overlap = ch1.filter((n) => ch2.includes(n));
    assert.ok(overlap.length > 0, "per-chapter non-forceFresh deals collide (cursor 0) — exactly why fanout must derive whole-book");
  } finally {
    resetFixture();
  }
});

test("name-plan blocks when a candidate source sidecar is missing", async () => {
  try {
    resetFixture();
    await assert.rejects(
      planFor(BOOK, 1, 1, 3, true, candidateReader(BOOK, new Set([1]))),
      /CANDIDATE_ENTRY_MISSING/,
    );
  } finally {
    resetFixture();
  }
});
