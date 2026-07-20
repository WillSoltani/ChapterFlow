import assert from "node:assert/strict";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, sep } from "node:path";

import type { PlannedArtifact } from "../../src/contracts/v4Core.js";
import { createBookWriteLock } from "../../src/books/bookLease.js";
import { createBookContentReader } from "../../src/books/bookContentReader.js";
import { candidateManifestDigest } from "../../src/books/candidateDigest.js";
import { createCandidateStore, type CandidateInputFile, type CandidateStoreSeams } from "../../src/books/candidateStore.js";
import { candidatePaths } from "../../src/books/bookPaths.js";
import { createCurrentPointerStore } from "../../src/books/currentPointer.js";
import { finishV25Tests, requiredTest } from "./harness.js";

const INVENTORY = [
  { kind: "CHAPTER", logicalPath: "chapters/ch01.md", mediaType: "text/markdown" },
  { kind: "PROVENANCE", logicalPath: "provenance/ch01.json", mediaType: "application/json" },
  { kind: "SIDECAR", logicalPath: "notes/readme.txt", mediaType: "text/plain" },
] as const satisfies readonly PlannedArtifact[];

function fixtureFiles(suffix = ""): CandidateInputFile[] {
  return [
    { ...INVENTORY[0], bytes: Buffer.from(`# Chapter${suffix}\n`, "utf8") },
    { ...INVENTORY[1], bytes: Buffer.from(`{"source":"fixture${suffix}"}\n`, "utf8") },
    { ...INVENTORY[2], bytes: Buffer.from(`notes${suffix}\n`, "utf8") },
  ];
}

function setup(booksRoot: string, seams?: CandidateStoreSeams) {
  const lock = createBookWriteLock({ booksRoot, timeoutMs: 1_000, pollMs: 1 });
  const pointerStore = createCurrentPointerStore({ booksRoot, writeLock: lock });
  const candidateStore = createCandidateStore({ booksRoot, writeLock: lock, currentPointerStore: pointerStore, seams });
  const reader = createBookContentReader({ booksRoot, currentPointerStore: pointerStore });
  return { lock, pointerStore, candidateStore, reader };
}

function stageInput(bookId: string, candidateId: string, files = fixtureFiles()) {
  return {
    bookId,
    candidateId,
    createdByRunId: "run-fixture",
    expectedInventory: INVENTORY,
    files,
    createdAt: "2026-07-20T12:00:00.000Z",
  } as const;
}

type SnapshotEntry = {
  readonly type: "directory" | "file" | "symlink" | "other";
  readonly mode: number;
  readonly mtimeNs: string;
  readonly bytes?: string;
};

function snapshotTree(root: string): Record<string, SnapshotEntry> {
  const result: Record<string, SnapshotEntry> = {};
  const visit = (path: string): void => {
    const stat = lstatSync(path, { bigint: true });
    const key = relative(root, path).split(sep).join("/") || ".";
    const type = stat.isDirectory() ? "directory" : stat.isFile() ? "file" : stat.isSymbolicLink() ? "symlink" : "other";
    result[key] = {
      type,
      mode: Number(stat.mode),
      mtimeNs: stat.mtimeNs.toString(),
      ...(stat.isFile() ? { bytes: readFileSync(path).toString("base64") } : {}),
    };
    if (stat.isDirectory()) {
      for (const name of readdirSync(path).sort((left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right)))) {
        visit(join(path, name));
      }
    }
  };
  visit(root);
  return result;
}

requiredTest("complete candidate stages and reopens with stable ordered bytes and checksum", async ({ roots }) => {
  const { candidateStore } = setup(roots.booksRoot);
  const input = stageInput("candidate-book", "candidate-1");
  const staged = await candidateStore.stage(input);
  assert.equal(staged.ok, true);
  assert.ok(staged.ok);
  const reopened = await candidateStore.open({
    bookId: input.bookId,
    selector: { kind: "CANDIDATE", candidateId: input.candidateId },
  });
  assert.equal(reopened.ok, true);
  assert.ok(reopened.ok);
  assert.equal(reopened.value.manifest.manifestDigest, staged.value.manifestDigest);
  assert.deepEqual(reopened.value.files.map(({ bytes: _bytes, ...entry }) => entry), staged.value.entries);
  assert.deepEqual(
    reopened.value.files.map((file) => Buffer.from(file.bytes)),
    input.files.map((file) => Buffer.from(file.bytes)),
  );

  const { manifestDigest: _digest, ...metadata } = staged.value;
  const stableA = candidateManifestDigest(metadata, input.files);
  const stableB = candidateManifestDigest(metadata, input.files.map((file) => ({ bytes: Buffer.from(file.bytes) })));
  assert.equal(stableA, stableB);
  assert.notEqual(stableA, candidateManifestDigest({ ...metadata, createdAt: "2026-07-20T12:00:01.000Z" }, input.files));
  const changedBytes = fixtureFiles();
  changedBytes[0] = { ...changedBytes[0], bytes: Buffer.from("changed\n") };
  const changedEntries = metadata.entries.map((entry, index) => index === 0 ? { ...entry, byteLength: changedBytes[0].bytes.byteLength } : entry);
  assert.notEqual(stableA, candidateManifestDigest({ ...metadata, entries: changedEntries }, changedBytes));
  const reversedEntries = [...metadata.entries].reverse();
  assert.notEqual(stableA, candidateManifestDigest({ ...metadata, entries: reversedEntries }, [...input.files].reverse()));
});

requiredTest("invalid exact inventory and paths create no visible candidate", async ({ roots }) => {
  const { candidateStore } = setup(roots.booksRoot);
  const bookId = "invalid-inventory-book";
  const cases: Array<{ id: string; expected: readonly PlannedArtifact[]; files: readonly CandidateInputFile[] }> = [
    { id: "missing", expected: INVENTORY, files: fixtureFiles().slice(0, 2) },
    { id: "extra", expected: INVENTORY.slice(0, 2), files: fixtureFiles() },
    { id: "reordered", expected: INVENTORY, files: [fixtureFiles()[1], fixtureFiles()[0], fixtureFiles()[2]] },
    {
      id: "metadata-mismatch",
      expected: INVENTORY,
      files: [{ ...fixtureFiles()[0], mediaType: "text/plain" }, fixtureFiles()[1], fixtureFiles()[2]],
    },
    {
      id: "duplicate",
      expected: [INVENTORY[0], INVENTORY[0]],
      files: [fixtureFiles()[0], fixtureFiles()[0]],
    },
    {
      id: "invalid-path",
      expected: [{ kind: "CHAPTER", logicalPath: "../escape.md", mediaType: "text/markdown" }],
      files: [{ kind: "CHAPTER", logicalPath: "../escape.md", mediaType: "text/markdown", bytes: Buffer.from("x") }],
    },
  ];
  for (const item of cases) {
    const result = await candidateStore.stage({
      bookId,
      candidateId: item.id,
      createdByRunId: "run-fixture",
      expectedInventory: item.expected,
      files: item.files,
      createdAt: "2026-07-20T12:00:00.000Z",
    });
    assert.equal(result.ok, false, item.id);
    if (!result.ok) assert.equal(result.error.code, "CANDIDATE_INVALID", item.id);
    assert.equal(existsSync(candidatePaths(roots.booksRoot, bookId, item.id).candidateRoot), false, item.id);
  }
});

requiredTest("candidate crash seams expose absent or fully openable directory", async ({ roots }) => {
  let armed: "before" | "after" | null = null;
  const { candidateStore } = setup(roots.booksRoot, {
    atomic: {
      point: (name) => {
        if (armed === "before" && name === "candidate.before-finalize") throw new Error("crash before candidate finalize");
        if (armed === "after" && name === "candidate.after-finalize") throw new Error("crash after candidate finalize");
      },
    },
  });
  const bookId = "candidate-crash-book";

  armed = "before";
  const before = await candidateStore.stage(stageInput(bookId, "before-crash"));
  assert.equal(before.ok, false);
  if (!before.ok) assert.equal(before.error.code, "CANDIDATE_IO");
  assert.equal(existsSync(candidatePaths(roots.booksRoot, bookId, "before-crash").candidateRoot), false);
  const stagingNames = readdirSync(join(roots.booksRoot, bookId, "candidates"));
  assert.ok(stagingNames.some((name) => name.startsWith(".before-crash.tmp-")), "failed crash fixture must remain non-visible");

  armed = "after";
  const after = await candidateStore.stage(stageInput(bookId, "after-crash"));
  assert.equal(after.ok, false);
  if (!after.ok) assert.equal(after.error.code, "CANDIDATE_IO");
  const opened = await candidateStore.open({ bookId, selector: { kind: "CANDIDATE", candidateId: "after-crash" } });
  assert.equal(opened.ok, true);
});

requiredTest("immutable candidate rejects overwrite, inventory drift, and byte drift without repair", async ({ roots }) => {
  const { candidateStore } = setup(roots.booksRoot);
  const bookId = "immutable-book";
  const original = await candidateStore.stage(stageInput(bookId, "original"));
  assert.ok(original.ok);
  const overwrite = await candidateStore.stage(stageInput(bookId, "original", fixtureFiles(" changed")));
  assert.equal(overwrite.ok, false);
  if (!overwrite.ok) assert.equal(overwrite.error.code, "CANDIDATE_EXISTS");
  const unchanged = await candidateStore.open({ bookId, selector: { kind: "CANDIDATE", candidateId: "original" } });
  assert.ok(unchanged.ok);
  assert.deepEqual(Buffer.from(unchanged.value.files[0].bytes), Buffer.from(fixtureFiles()[0].bytes));

  const extra = await candidateStore.stage(stageInput(bookId, "extra-drift"));
  assert.ok(extra.ok);
  const extraPath = join(candidatePaths(roots.booksRoot, bookId, "extra-drift").contentRoot, "extra.txt");
  writeFileSync(extraPath, "extra\n");
  const extraOpen = await candidateStore.open({ bookId, selector: { kind: "CANDIDATE", candidateId: "extra-drift" } });
  assert.equal(extraOpen.ok, false);
  if (!extraOpen.ok) assert.equal(extraOpen.error.code, "CANDIDATE_MISMATCH");

  const drift = await candidateStore.stage(stageInput(bookId, "byte-drift"));
  assert.ok(drift.ok);
  const driftPath = join(candidatePaths(roots.booksRoot, bookId, "byte-drift").contentRoot, INVENTORY[0].logicalPath);
  writeFileSync(driftPath, Buffer.alloc(fixtureFiles()[0].bytes.byteLength, 0x78));
  const beforeOpen = snapshotTree(candidatePaths(roots.booksRoot, bookId, "byte-drift").candidateRoot);
  const driftOpen = await candidateStore.open({ bookId, selector: { kind: "CANDIDATE", candidateId: "byte-drift" } });
  assert.equal(driftOpen.ok, false);
  if (!driftOpen.ok) assert.equal(driftOpen.error.code, "CANDIDATE_MISMATCH");
  assert.deepEqual(snapshotTree(candidatePaths(roots.booksRoot, bookId, "byte-drift").candidateRoot), beforeOpen);
});

requiredTest("pure CURRENT read preserves path byte mode mtime inventory and never falls back", async ({ roots }) => {
  const { pointerStore, candidateStore, reader } = setup(roots.booksRoot);
  const bookId = "pure-reader-book";
  const staged = await candidateStore.stage(stageInput(bookId, "candidate-current"));
  assert.ok(staged.ok);
  const pointed = await pointerStore.compareAndSet({
    bookId,
    expectedRevision: 0,
    next: {
      schemaVersion: "1",
      bookId,
      candidateId: staged.value.candidateId,
      manifestDigest: staged.value.manifestDigest,
      revision: 1,
      updatedAt: "2026-07-20T12:00:01.000Z",
    },
  });
  assert.ok(pointed.ok);
  const bookRoot = join(roots.booksRoot, bookId);
  const before = snapshotTree(bookRoot);
  const current = await reader.open({ bookId, selector: { kind: "CURRENT" } });
  assert.ok(current.ok);
  assert.equal(current.value.currentRevision, 1);
  assert.equal(current.value.manifest.candidateId, "candidate-current");
  assert.deepEqual(snapshotTree(bookRoot), before);

  const fallbackBook = "no-fallback-book";
  const visible = await candidateStore.stage(stageInput(fallbackBook, "visible-candidate"));
  assert.ok(visible.ok);
  const missingPointer = await pointerStore.compareAndSet({
    bookId: fallbackBook,
    expectedRevision: 0,
    next: {
      schemaVersion: "1",
      bookId: fallbackBook,
      candidateId: "missing-candidate",
      manifestDigest: "f".repeat(64),
      revision: 1,
      updatedAt: "2026-07-20T12:00:01.000Z",
    },
  });
  assert.ok(missingPointer.ok);
  const fallbackRoot = join(roots.booksRoot, fallbackBook);
  const beforeMissing = snapshotTree(fallbackRoot);
  const missing = await reader.open({ bookId: fallbackBook, selector: { kind: "CURRENT" } });
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.equal(missing.error.code, "CANDIDATE_NOT_FOUND");
  assert.deepEqual(snapshotTree(fallbackRoot), beforeMissing);
});

finishV25Tests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
