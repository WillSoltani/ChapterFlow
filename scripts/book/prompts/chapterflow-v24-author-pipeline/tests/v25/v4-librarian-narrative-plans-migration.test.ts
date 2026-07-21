import assert from "node:assert/strict";
import { lstatSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { createBookWriteLock } from "../../src/books/bookLease.js";
import { createBookContentReader } from "../../src/books/bookContentReader.js";
import { createCandidateStore, type CandidateInputFile } from "../../src/books/candidateStore.js";
import { createCurrentPointerStore } from "../../src/books/currentPointer.js";
import type { PlannedArtifact } from "../../src/contracts/v4Core.js";
import type { TestRoots } from "../testRoots.js";
import { loadCallbackPlan } from "../../src/librarian/callbackPlan.js";
import { planExemplars } from "../../src/librarian/exemplarPlan.js";
import { createEmptyLibraryState } from "../../src/librarian/libraryState.js";
import { planNames } from "../../src/librarian/namePlan.js";
import { planPedagogy } from "../../src/librarian/pedagogyPlan.js";
import { loadRhetoricPlan } from "../../src/librarian/rhetoricPlan.js";
import { loadSceneMechanismPlan } from "../../src/librarian/sceneMechanismPlan.js";
import { loadSceneModePlan } from "../../src/librarian/sceneModePlan.js";
import { planShapes } from "../../src/librarian/shapePlan.js";
import { loadTimingPlan } from "../../src/librarian/timingPlan.js";
import { finishV25Tests, requiredTest } from "./harness.js";

const BOOK = "librarian-book";
const CANDIDATE = "candidate-history-2";
const PLAN_VALUES = {
  callback: { schemaVersion: "callback-plan-v1", bookId: BOOK, createdAt: "candidate", allocation: {}, diagnostics: { frameCounts: {} } },
  rhetoric: { schemaVersion: "rhetoric-plan-v1", bookId: BOOK, createdAt: "candidate", allocation: {}, diagnostics: { counterShapeCounts: {}, hookOpenerClassCounts: {} } },
  mechanism: { schemaVersion: "scene-mechanism-plan-v1", bookId: BOOK, createdAt: "candidate", allocation: {}, diagnostics: { mechanismCounts: {} } },
  mode: { schemaVersion: "scene-mode-plan-v1", bookId: BOOK, createdAt: "candidate", allocation: {}, diagnostics: { stanceCounts: {} } },
  timing: { schemaVersion: "timing-plan-v1", bookId: BOOK, createdAt: "candidate", allocation: {}, diagnostics: { triggerCounts: {} } },
} as const;

function fixtureFiles(): CandidateInputFile[] {
  const libraryState = createEmptyLibraryState({ now: () => 0 });
  const raw: Array<[string, unknown]> = [
    [`state/callback-plans/${BOOK}.callback-plan.json`, PLAN_VALUES.callback],
    [`state/rhetoric-plans/${BOOK}.rhetoric-plan.json`, PLAN_VALUES.rhetoric],
    [`state/scene-mechanism-plans/${BOOK}.scene-mechanism-plan.json`, PLAN_VALUES.mechanism],
    [`state/scene-mode-plans/${BOOK}.scene-mode-plan.json`, PLAN_VALUES.mode],
    [`state/timing-plans/${BOOK}.timing-plan.json`, PLAN_VALUES.timing],
    ["sidecars/ch01.json", { chapterNumber: 1, namedExamples: [{ label: "Ada Lovelace", summary: "Ada Lovelace built an analytical engine." }], properNouns: ["Ada Lovelace"] }],
    ["state/library-state.json", libraryState],
    [`state/chapters/${BOOK}-ch01.v21-native.chapter.json`, { chapterId: `${BOOK}-ch01`, number: 1, title: "One", examples: [{ scenario: "Mira enters the workshop.", planSpec: { format: "dialogue" } }] }],
  ];
  return raw.map(([logicalPath, value]) => {
    const bytes = Buffer.from(JSON.stringify(value));
    return { kind: "SIDECAR" as const, logicalPath, mediaType: "application/json" as const, bytes };
  });
}

function setup(roots: TestRoots) {
  const lock = createBookWriteLock({ booksRoot: roots.booksRoot, timeoutMs: 1_000, pollMs: 1 });
  const pointer = createCurrentPointerStore({ booksRoot: roots.booksRoot, writeLock: lock });
  return {
    store: createCandidateStore({ booksRoot: roots.booksRoot, writeLock: lock, currentPointerStore: pointer }),
    reader: createBookContentReader({ booksRoot: roots.booksRoot, currentPointerStore: pointer }),
  };
}

async function stage(store: ReturnType<typeof setup>["store"], candidateId: string, files: CandidateInputFile[]): Promise<void> {
  const expectedInventory: PlannedArtifact[] = files.map(({ bytes: _bytes, ...entry }) => entry);
  const result = await store.stage({ bookId: BOOK, candidateId, createdByRunId: "run-2", expectedInventory, files, createdAt: "2026-07-20T12:00:00.000Z" });
  assert.equal(result.ok, true, result.ok ? "" : result.error.message);
}

function tree(root: string): Record<string, string> {
  const out: Record<string, string> = {};
  const visit = (path: string): void => {
    const stat = lstatSync(path);
    const key = relative(root, path).split(sep).join("/") || ".";
    out[key] = `${stat.mode}:${stat.mtimeMs}:${stat.isFile() ? readFileSync(path).toString("base64") : "directory"}`;
    if (stat.isDirectory()) for (const name of readdirSync(path).sort()) visit(join(path, name));
  };
  visit(root);
  return out;
}

requiredTest("narrative loaders use only explicit historical candidate", async ({ roots }) => {
  const subject = setup(roots);
  await stage(subject.store, CANDIDATE, fixtureFiles());
  const before = tree(roots.base);
  assert.deepEqual(await loadCallbackPlan(BOOK, subject.reader, CANDIDATE), PLAN_VALUES.callback);
  assert.deepEqual(await loadRhetoricPlan(BOOK, subject.reader, CANDIDATE), PLAN_VALUES.rhetoric);
  assert.deepEqual(await loadSceneMechanismPlan(BOOK, subject.reader, CANDIDATE), PLAN_VALUES.mechanism);
  assert.deepEqual(await loadSceneModePlan(BOOK, subject.reader, CANDIDATE), PLAN_VALUES.mode);
  assert.deepEqual(await loadTimingPlan(BOOK, subject.reader, CANDIDATE), PLAN_VALUES.timing);
  assert.deepEqual(tree(roots.base), before);
});

requiredTest("candidate narrative inputs preserve independent legacy calculations", async ({ roots }) => {
  writeFileSync(join(roots.stateRoot, "legacy-difference"), "must-not-be-read");
  const subject = setup(roots);
  await stage(subject.store, CANDIDATE, fixtureFiles());
  const before = tree(roots.base);
  const exemplar = await planExemplars(BOOK, 1, 1, subject.reader, CANDIDATE);
  assert.deepEqual(exemplar.allocation[1], { assigned: ["Ada Lovelace", "Lovelace"], forbidden: [] });
  const shapes = await planShapes(BOOK, 1, 1, 6, { forceFresh: false }, subject.reader, CANDIDATE);
  assert.deepEqual(shapes.allocation[1], ["dialogue"]);
  assert.deepEqual(shapes.carriedChapters, [1]);
  const pedagogy = await planPedagogy(BOOK, 1, 1, { forceFresh: false }, subject.reader, CANDIDATE);
  assert.deepEqual(pedagogy.carriedChapters, [1]);
  const names = await planNames(BOOK, 1, 1, 2, { forceFresh: true }, subject.reader, CANDIDATE);
  assert.equal(names.bookId, BOOK);
  assert.equal(names.allocation[1].length, 2);
  assert.deepEqual(tree(roots.base), before);
});

requiredTest("all narrative routes block absent reader or entries and preserve filesystem", async ({ roots }) => {
  assert.throws(() => loadCallbackPlan(BOOK), /CANDIDATE_READER_REQUIRED/);
  assert.throws(() => planExemplars(BOOK, 1, 1), /CANDIDATE_READER_REQUIRED/);
  assert.throws(() => planNames(BOOK, 1, 1), /CANDIDATE_READER_REQUIRED/);
  assert.throws(() => planPedagogy(BOOK, 1, 1), /CANDIDATE_READER_REQUIRED/);
  assert.throws(() => planShapes(BOOK, 1, 1), /CANDIDATE_READER_REQUIRED/);
  const subject = setup(roots);
  await stage(subject.store, "missing-sidecar", fixtureFiles().filter((file) => file.logicalPath !== "sidecars/ch01.json"));
  const before = tree(roots.base);
  await assert.rejects(planExemplars(BOOK, 1, 1, subject.reader, "missing-sidecar"), /CANDIDATE_ENTRY_MISSING/);
  assert.deepEqual(tree(roots.base), before);
});

finishV25Tests().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
