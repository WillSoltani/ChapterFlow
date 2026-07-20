import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, statSync } from "fs";
import { tmpdir } from "os";
import { join, resolve } from "path";

import type { BookContentReader, CandidateManifest, CandidateStore } from "../../src/books/candidateTypes.js";
import type { Result } from "../../src/contracts/v4Core.js";
import {
  LEGACY_AUTHOR_STATE_CATEGORIES,
  LegacyAuthorStateAdapter,
} from "../../src/contracts/legacyAuthorStateAdapter.js";
import { FileRunStore } from "../../src/run-state/fileRunStore.js";
import { FileStageCoordinator } from "../../src/run-state/stageCoordinator.js";
import type { AttemptAdmission, RunDefinition } from "../../src/run-state/runTypes.js";

function ok<T>(value: T): Result<T> { return { ok: true, value }; }

function filesUnder(root: string): string[] {
  try {
    const out: string[] = [];
    const walk = (dir: string): void => {
      for (const name of readdirSync(dir).sort()) {
        const path = join(dir, name);
        const stat = statSync(path);
        if (stat.isDirectory()) walk(path);
        else out.push(`${path.slice(root.length)}:${stat.size}:${stat.mtimeMs}`);
      }
    };
    walk(root);
    return out;
  } catch {
    return [];
  }
}

async function main(): Promise<void> {
const temp = mkdtempSync(join(tmpdir(), "chapterflow-v4-author-state-"));
const legacyRoot = join(temp, "legacy");
const shadowRoot = join(temp, "shadow");
const productionRoot = resolve("state");
const productionBefore = filesUnder(productionRoot);
const runStore = new FileRunStore(shadowRoot);
const stageCoordinator = new FileStageCoordinator(shadowRoot);
let candidateStageCalls = 0;
let stagedInput: Parameters<CandidateStore["stage"]>[0] | null = null;
const candidateStore: CandidateStore = {
  async stage(input) {
    candidateStageCalls += 1;
    stagedInput = input;
    const manifest: CandidateManifest = {
      schemaVersion: "1",
      bookId: input.bookId,
      candidateId: input.candidateId,
      createdByRunId: input.createdByRunId,
      entries: input.files.map(({ bytes, ...entry }) => ({ ...entry, byteLength: bytes.byteLength })),
      manifestDigest: "opaque-test-digest",
      createdAt: input.createdAt,
    };
    return ok(manifest);
  },
  async open() { return { ok: false, error: { code: "NOT_USED", message: "not used" } }; },
};
const contentReader: BookContentReader = {
  async open() { return { ok: false, error: { code: "NOT_USED", message: "not used" } }; },
};
const adapter = new LegacyAuthorStateAdapter({
  legacyRoot,
  shadowRoot,
  runStore,
  stageCoordinator,
  candidateStore,
  contentReader,
});

const definition: RunDefinition = {
  schemaVersion: "1",
  bookId: "fixture-book",
  runId: "fixture-run",
  commandId: "author-write",
  sourceGitSha: "37f9c798d3cd7c8dddfaf5bf2b11fbb32ea89fe6",
  requiredStages: ["author"],
  requiredInventory: [{ kind: "CHAPTER", logicalPath: "chapters/ch01.json", mediaType: "application/json" }],
  attemptLimits: { run: 2, byStage: { author: 2 } },
  createdAt: "2026-07-20T12:00:00.000Z",
};
assert.equal((await adapter.createShadowRun(definition)).ok, true);
const admission: AttemptAdmission = {
  bookId: definition.bookId,
  runId: definition.runId,
  attemptId: "attempt-1",
  stageId: "author",
  operationId: "write-ch01",
  admittedAt: "2026-07-20T12:00:01.000Z",
  staleAt: "2026-07-20T12:00:10.000Z",
};
assert.equal((await adapter.startShadowAttempt(admission)).ok, true);
assert.equal((await adapter.startShadowAttempt(admission)).ok, true);
assert.equal((await adapter.finishShadowAttempt({
  bookId: definition.bookId, runId: definition.runId, attemptId: admission.attemptId,
  outcome: "SUCCEEDED", finishedAt: "2026-07-20T12:00:05.000Z",
})).ok, true);
assert.equal((await adapter.finishShadowAttempt({
  bookId: definition.bookId, runId: definition.runId, attemptId: admission.attemptId,
  outcome: "SUCCEEDED", finishedAt: "2026-07-20T12:00:05.000Z",
})).ok, true);
const terminalConflict = await adapter.finishShadowAttempt({
  bookId: definition.bookId, runId: definition.runId, attemptId: admission.attemptId,
  outcome: "FAILED", finishedAt: "2026-07-20T12:00:06.000Z",
});
assert.equal(terminalConflict.ok, false);
const firstRun = await adapter.readShadowRun(definition.bookId, definition.runId, "2026-07-20T12:00:20.000Z");
assert.equal(firstRun.ok && firstRun.value.attempts.length, 1);
console.log("PASS 1/6 duplicate admission + terminal idempotency/conflict");

const staleDefinition: RunDefinition = { ...definition, runId: "stale-run", createdAt: "2026-07-20T12:01:00.000Z" };
assert.equal((await adapter.createShadowRun(staleDefinition)).ok, true);
assert.equal((await adapter.startShadowAttempt({
  ...admission,
  runId: staleDefinition.runId,
  attemptId: "stale-attempt",
  admittedAt: "2026-07-20T12:01:01.000Z",
  staleAt: "2026-07-20T12:01:10.000Z",
})).ok, true);
const stale = await adapter.readShadowRun(staleDefinition.bookId, staleDefinition.runId, "2026-07-20T12:01:11.000Z");
assert.equal(stale.ok && stale.value.attempts[0]?.status, "STALE");
const resume = await adapter.planShadowResume(staleDefinition);
assert.equal(resume.ok && resume.value.pendingStages.includes("author"), true);
assert.equal(stale.ok && stale.value.attempts.length, 1);
const cancelDefinition: RunDefinition = { ...definition, runId: "cancel-run", createdAt: "2026-07-20T12:02:00.000Z" };
assert.equal((await adapter.createShadowRun(cancelDefinition)).ok, true);
assert.equal((await adapter.requestShadowCancel({
  bookId: cancelDefinition.bookId,
  runId: cancelDefinition.runId,
  reason: "operator stop",
  requestedAt: "2026-07-20T12:02:01.000Z",
})).ok, true);
const cancelResume = await adapter.planShadowResume(cancelDefinition);
assert.equal(cancelResume.ok && cancelResume.value.cancelled, true);
console.log("PASS 2/6 stale admission consumed + zero automatic replay");

const shadowBeforeLegacyRecords = filesUnder(shadowRoot);
for (const [index, category] of LEGACY_AUTHOR_STATE_CATEGORIES.entries()) {
  const relativePath = `fixtures/${category.toLowerCase()}.json`;
  const bytes = Buffer.from(` {\n  \"category\": \"${category}\", \"index\": ${index}\n}\n`, "utf8");
  assert.equal(adapter.writeLegacyBytes({ category, relativePath }, bytes).ok, true);
  const read = adapter.readLegacy({ category, relativePath }, (raw) => JSON.parse(Buffer.from(raw).toString("utf8")) as { category: string });
  assert.equal(read.ok, true);
  if (read.ok) {
    assert.deepEqual(Buffer.from(read.value.bytes), bytes);
    assert.equal(read.value.parsed.category, category);
  }
}
assert.deepEqual(filesUnder(shadowRoot), shadowBeforeLegacyRecords);
console.log("PASS 3/6 all declared categories exact-byte round-trip + parser result");

const beforeBlockedRead = filesUnder(legacyRoot);
const unsupported = adapter.readLegacy({ category: "UNKNOWN", relativePath: "fixtures/nope.json" }, () => null);
assert.equal(!unsupported.ok && unsupported.error.code, "UNSUPPORTED_CATEGORY");
const missing = adapter.readLegacy({ category: "RUN_MANIFEST", relativePath: "fixtures/missing.json" }, () => null);
assert.equal(!missing.ok && missing.error.code, "MISSING_RECORD");
assert.equal(adapter.writeLegacyBytes({ category: "UNKNOWN", relativePath: "fixtures/nope.json" }, Buffer.from("x")).ok, false);
assert.deepEqual(filesUnder(legacyRoot), beforeBlockedRead);
assert.equal(adapter.writeLegacyBytes({ category: "RUN_MANIFEST", relativePath: "fixtures/corrupt.json" }, Buffer.from("{bad json\n")).ok, true);
const beforeCorruptRead = filesUnder(legacyRoot);
const corrupt = adapter.readLegacy({ category: "RUN_MANIFEST", relativePath: "fixtures/corrupt.json" }, (raw) => JSON.parse(Buffer.from(raw).toString("utf8")));
assert.equal(!corrupt.ok && corrupt.error.code, "CORRUPT_RECORD");
assert.deepEqual(filesUnder(legacyRoot), beforeCorruptRead);
console.log("PASS 4/6 unsupported/corrupt typed blocker + zero read mutation");

const planned = definition.requiredInventory;
const files = [{ ...planned[0]!, bytes: new Uint8Array(Buffer.from("{\"chapter\":1}\n")) }];
const partial = await adapter.stageCompleteCandidate({
  bookId: definition.bookId, candidateId: "partial", createdByRunId: definition.runId,
  expectedInventory: planned, files: [], createdAt: "2026-07-20T12:02:00.000Z",
});
assert.equal(partial.ok, false);
assert.equal(candidateStageCalls, 0);
const complete = await adapter.stageCompleteCandidate({
  bookId: definition.bookId, candidateId: "complete", createdByRunId: definition.runId,
  expectedInventory: planned, files, createdAt: "2026-07-20T12:02:01.000Z",
});
assert.equal(complete.ok, true);
assert.equal(candidateStageCalls, 1);
const capturedStage = stagedInput as Parameters<CandidateStore["stage"]>[0] | null;
assert.deepEqual(capturedStage?.expectedInventory, planned);
assert.deepEqual(capturedStage?.files, files);
console.log("PASS 5/6 complete candidate exact inventory staged + partial invisible");

const order: string[] = [];
const comparison = await adapter.compareLegacyFirst({
  legacy: () => { order.push("legacy"); return { accepted: false, reason: "legacy threshold" }; },
  shadow: () => { order.push("shadow"); return { accepted: true, reason: "normalized difference" }; },
  normalizeLegacy: (value) => ({ accepted: value.accepted }),
  normalizeShadow: (value) => ({ accepted: value.accepted }),
});
assert.deepEqual(order, ["legacy", "shadow"]);
assert.equal(comparison.authority, "LEGACY");
assert.equal(comparison.legacy.accepted, false);
assert.equal(comparison.matches, false);
assert.deepEqual(filesUnder(productionRoot), productionBefore);
console.log("PASS 6/6 mismatch reported + legacy authoritative + production diff zero");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
