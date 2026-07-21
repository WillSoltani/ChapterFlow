import assert from "node:assert/strict";
import { lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { createBookWriteLock } from "../../src/books/bookLease.js";
import { createBookContentReader } from "../../src/books/bookContentReader.js";
import { candidatePaths } from "../../src/books/bookPaths.js";
import { createCandidateStore, type CandidateInputFile } from "../../src/books/candidateStore.js";
import { createCurrentPointerStore } from "../../src/books/currentPointer.js";
import type { PlannedArtifact } from "../../src/contracts/v4Core.js";
import type { TestRoots } from "../testRoots.js";
import { loadActionMechanismPlan } from "../../src/librarian/actionMechanismPlan.js";
import { loadAnswerKeyPlan } from "../../src/librarian/answerKeyPlan.js";
import { loadCadencePlan } from "../../src/librarian/chapterArchetypePlan.js";
import { loadFullReadSkeletonPlan } from "../../src/librarian/fullReadSkeletonPlan.js";
import { loadWeeklyPracticePlan } from "../../src/librarian/weeklyPracticePlan.js";
import { finishV25Tests, requiredTest } from "./harness.js";

const BOOK = "librarian-book";
const CANDIDATE = "candidate-history-1";
const VALUES = {
  action: { schemaVersion: "action-mechanism-plan-v1", bookId: BOOK, createdAt: "candidate", allocation: {}, diagnostics: { mechanismCounts: {} } },
  answer: { schemaVersion: "answer-key-plan-v1", bookId: BOOK, createdAt: "candidate", questionsPerChapter: 3, positions: 3, allocation: { 1: [0, 1, 2] }, aggregate: { counts: [1, 1, 1], maxFraction: 1 / 3 } },
  cadence: { schemaVersion: "cadence-plan-v1", bookId: BOOK, createdAt: "candidate", allocation: {} },
  skeleton: { schemaVersion: "fullread-skeleton-plan-v1", bookId: BOOK, createdAt: "candidate", allocation: {}, diagnostics: { beatCounts: {} } },
  weekly: { schemaVersion: "weekly-practice-plan-v1", bookId: BOOK, createdAt: "candidate", allocation: {}, diagnostics: { formCounts: {} } },
} as const;

const PATHS = {
  action: `state/action-mechanism-plans/${BOOK}.action-mechanism-plan.json`,
  answer: `state/answer-key-plans/${BOOK}.answer-key-plan.json`,
  cadence: `state/cadence-plans/${BOOK}.cadence-plan.json`,
  skeleton: `state/fullread-skeleton-plans/${BOOK}.fullread-skeleton-plan.json`,
  weekly: `state/weekly-practice-plans/${BOOK}.weekly-practice-plan.json`,
} as const;

function fixtureFiles(overrides: Partial<Record<keyof typeof VALUES, unknown>> = {}): CandidateInputFile[] {
  return Object.entries(PATHS).map(([key, logicalPath]) => {
    const bytes = Buffer.from(JSON.stringify(overrides[key as keyof typeof VALUES] ?? VALUES[key as keyof typeof VALUES]));
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
  const result = await store.stage({ bookId: BOOK, candidateId, createdByRunId: "run-1", expectedInventory, files, createdAt: "2026-07-20T12:00:00.000Z" });
  assert.equal(result.ok, true, result.ok ? "" : result.error.message);
}

function tree(root: string): Record<string, { bytes?: string; mode: number; mtime: number; kind: string }> {
  const out: Record<string, { bytes?: string; mode: number; mtime: number; kind: string }> = {};
  const visit = (path: string): void => {
    const stat = lstatSync(path);
    const key = relative(root, path).split(sep).join("/") || ".";
    out[key] = { ...(stat.isFile() ? { bytes: readFileSync(path).toString("base64") } : {}), mode: stat.mode, mtime: stat.mtimeMs, kind: stat.isFile() ? "file" : "directory" };
    if (stat.isDirectory()) for (const name of readdirSync(path).sort()) visit(join(path, name));
  };
  visit(root);
  return out;
}

requiredTest("instructional loaders select candidate bytes over differing legacy files", async ({ roots }) => {
  for (const logicalPath of Object.values(PATHS)) {
    const path = join(roots.stateRoot, logicalPath.replace(/^state\//, ""));
    mkdirSync(join(path, ".."), { recursive: true });
    writeFileSync(path, JSON.stringify({ bookId: BOOK, createdAt: "legacy" }));
  }
  const subject = setup(roots);
  await stage(subject.store, CANDIDATE, fixtureFiles());
  assert.deepEqual(await loadActionMechanismPlan(BOOK, subject.reader, CANDIDATE), VALUES.action);
  assert.deepEqual(await loadAnswerKeyPlan(BOOK, subject.reader, CANDIDATE), VALUES.answer);
  assert.deepEqual(await loadCadencePlan(BOOK, subject.reader, CANDIDATE), VALUES.cadence);
  assert.deepEqual(await loadFullReadSkeletonPlan(BOOK, subject.reader, CANDIDATE), VALUES.skeleton);
  assert.deepEqual(await loadWeeklyPracticePlan(BOOK, subject.reader, CANDIDATE), VALUES.weekly);
});

requiredTest("historical selector never consults CURRENT", async ({ roots }) => {
  const subject = setup(roots);
  await stage(subject.store, CANDIDATE, fixtureFiles());
  assert.deepEqual(await loadAnswerKeyPlan(BOOK, subject.reader, CANDIDATE), VALUES.answer);
});

requiredTest("missing corrupt and digest reader failures block without fallback", async ({ roots }) => {
  writeFileSync(join(roots.stateRoot, "fallback.json"), JSON.stringify(VALUES.action));
  const subject = setup(roots);
  await assert.rejects(loadActionMechanismPlan(BOOK, subject.reader, "not-staged"), /CANDIDATE_NOT_FOUND/);
  await stage(subject.store, "missing-entry", fixtureFiles().slice(1));
  await assert.rejects(loadActionMechanismPlan(BOOK, subject.reader, "missing-entry"), /CANDIDATE_ENTRY_MISSING/);
  const malformed = fixtureFiles();
  malformed[0] = { ...malformed[0], bytes: Buffer.from("{") };
  await stage(subject.store, "malformed-json", malformed);
  await assert.rejects(loadActionMechanismPlan(BOOK, subject.reader, "malformed-json"), /CANDIDATE_ENTRY_MALFORMED/);
  await stage(subject.store, "digest-tamper", fixtureFiles());
  writeFileSync(join(candidatePaths(roots.booksRoot, BOOK, "digest-tamper").contentRoot, PATHS.action), JSON.stringify({ altered: true }));
  await assert.rejects(loadActionMechanismPlan(BOOK, subject.reader, "digest-tamper"), /CANDIDATE_MISMATCH/);
  assert.throws(() => loadActionMechanismPlan(BOOK), /CANDIDATE_READER_REQUIRED/);
});

requiredTest("independent instructional fixture stays semantically equal and read-only", async ({ roots }) => {
  const expected = JSON.parse('{"schemaVersion":"answer-key-plan-v1","bookId":"librarian-book","createdAt":"candidate","questionsPerChapter":3,"positions":3,"allocation":{"1":[0,1,2]},"aggregate":{"counts":[1,1,1],"maxFraction":0.3333333333333333}}');
  writeFileSync(join(roots.stateRoot, "sentinel"), "unchanged", { mode: 0o640 });
  const subject = setup(roots);
  await stage(subject.store, CANDIDATE, fixtureFiles());
  const before = tree(roots.base);
  await loadActionMechanismPlan(BOOK, subject.reader, CANDIDATE);
  assert.deepEqual(await loadAnswerKeyPlan(BOOK, subject.reader, CANDIDATE), expected);
  await loadCadencePlan(BOOK, subject.reader, CANDIDATE);
  await loadFullReadSkeletonPlan(BOOK, subject.reader, CANDIDATE);
  await loadWeeklyPracticePlan(BOOK, subject.reader, CANDIDATE);
  assert.deepEqual(tree(roots.base), before);
});

finishV25Tests().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
