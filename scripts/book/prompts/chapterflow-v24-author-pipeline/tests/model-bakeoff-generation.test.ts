/**
 * Model bake-off — candidate isolation, generation telemetry, resume
 * verification. V4 candidate migration and screening authority are covered by
 * v25/v4-bakeoff-state-migration.test.ts.
 */

import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { test } from "./harness.js";
import type { AutopilotDeps } from "../src/orchestrator/autopilot.js";
import { chapterContentHash } from "../src/critics/qcAttestation.js";
import { bakeoffRoots, PIPELINE_DIR } from "../src/bakeoff/paths.js";
import {
  chapterReusable,
  generateCandidate,
  loadSlotChapters,
  slotChapterAbsPath,
} from "../src/bakeoff/candidates.js";
import type { CandidateSpec, CandidateStateV1 } from "../src/bakeoff/types.js";
import { fixtureChapter, fixturePacket, tmpRoot, fakeAutopilotDeps, writerSpawn } from "./model-bakeoff-helpers.js";
import type { SpawnCodexAgentOptions } from "../src/orchestrator/codexAgent.js";

const SOL: CandidateSpec = { model: "gpt-5.6-sol", slug: "gpt-5-6-sol", slot: "w1", effort: "xhigh" };
const TERRA: CandidateSpec = { model: "gpt-5.6-terra", slug: "gpt-5-6-terra", slot: "w2", effort: "xhigh" };

function genOpts(bookId: string, chapterNumbers: number[], over?: Record<string, unknown> & { ioOverrides?: Record<string, unknown> }) {
  const { ioOverrides: ioOver, ...rest } = over ?? {};
  return {
    chapterNumbers,
    chapterParallel: 1,
    log: () => {},
    rubricVerb: async () => ({ code: 0, stdout: chapterNumbers.map((n) => `ch${String(n).padStart(2, "0")}: PASS`).join("\n"), stderr: "" }),
    ioOverrides: {
      readBriefMd: () => "# BRIEF",
      readBrief: () => null,
      readPacket: () => fixturePacket(bookId, 1),
      voiceCard: () => null,
      // IMP-01: the gate runs in-process on the candidate — stub PASS here (the
      // minimal fixtures would fail the REAL ship gate; gate behavior is pinned
      // in its own suites, not these isolation/telemetry tests).
      gateCandidate: async () => ({ code: 0, stdout: "Gate verdict: PASS — 0 blockers", stderr: "" }),
      ...(ioOver ?? {}),
    },
    ...rest,
  };
}

// ── 2. three-candidate isolation ──────────────────────────────────────────────

test("candidates generate into isolated opaque slots — distinct bytes, slot-local provenance, no cross-contamination", async () => {
  const bookId = "zz-bakeoff-iso";
  const roots = bakeoffRoots(bookId, "r1", tmpRoot("cf-bakeoff-iso-"));
  const spawns: SpawnCodexAgentOptions[] = [];
  const spawn = writerSpawn(
    spawns,
    (relPath, _task, o) => {
      // IMP-01: the OUTPUT path is the candidate file name — derive the slot
      // from the session prefix (bakeoff-w1-/bakeoff-w2-) instead.
      const slot = o.sessionId.includes("bakeoff-w2-") ? "w2" : "w1";
      const n = Number(relPath.match(/ch(\d+)\./)?.[1] ?? 1);
      return JSON.stringify(fixtureChapter(bookId, n, slot), null, 2);
    },
    (relPath) => resolve(PIPELINE_DIR, relPath),
  );
  const deps = fakeAutopilotDeps({ spawn: spawn as unknown as AutopilotDeps["spawn"] }) as AutopilotDeps;

  const states: Record<string, CandidateStateV1> = {};
  for (const spec of [SOL, TERRA]) {
    states[spec.slot] = await generateCandidate(bookId, spec, deps, roots, genOpts(bookId, [1, 2]) as never, () => {});
  }

  for (const spec of [SOL, TERRA]) {
    assert.equal(states[spec.slot].status, "complete");
    assert.equal(states[spec.slot].firstAttemptPasses, 2);
    for (const n of [1, 2]) {
      const abs = slotChapterAbsPath(roots, spec.slot, bookId, n);
      assert.ok(existsSync(abs), `${spec.slot} ch${n} exists`);
      assert.ok(readFileSync(abs, "utf8").includes(`"${spec.slot}"`) || readFileSync(abs, "utf8").includes(spec.slot), `${spec.slot} bytes are its own`);
    }
    assert.ok(existsSync(join(roots.workDir, spec.slot, "provenance", `${bookId}-ch01.json`)), `${spec.slot} provenance is slot-local`);
  }
  // Distinct content across slots; sessions carry the slot prefix (independence).
  assert.notEqual(
    readFileSync(slotChapterAbsPath(roots, "w1", bookId, 1), "utf8"),
    readFileSync(slotChapterAbsPath(roots, "w2", bookId, 1), "utf8"),
  );
  const writerSessions = spawns.filter((s) => s.task.includes("Write EXACTLY one file")).map((s) => s.sessionId);
  assert.ok(writerSessions.some((s) => s.includes("bakeoff-w1-")) && writerSessions.some((s) => s.includes("bakeoff-w2-")));
  // The model pin rode every writer spawn.
  const models = new Set(spawns.filter((s) => s.task.includes("Write EXACTLY one file")).map((s) => s.model));
  assert.deepEqual([...models].sort(), ["gpt-5.6-sol", "gpt-5.6-terra"]);
});

// Retry telemetry: first-attempt quality vs post-retry quality are both recorded.

test("generation records first-attempt pass vs retries (same bounded budget for every candidate)", async () => {
  const bookId = "zz-bakeoff-retry";
  const roots = bakeoffRoots(bookId, "r1", tmpRoot("cf-bakeoff-retry-"));
  const spawns: SpawnCodexAgentOptions[] = [];
  const spawn = writerSpawn(
    spawns,
    () => JSON.stringify(fixtureChapter(bookId, 1, `attempt${spawns.length}`), null, 2),
    (relPath) => resolve(PIPELINE_DIR, relPath),
  );
  let gateCalls = 0;
  const deps = fakeAutopilotDeps({ spawn: spawn as unknown as AutopilotDeps["spawn"] }) as AutopilotDeps;

  const state = await generateCandidate(bookId, SOL, deps, roots, genOpts(bookId, [1], {
    ioOverrides: {
      // IMP-01: the gate script moves to the io candidate-validation seam.
      gateCandidate: async () => {
        gateCalls += 1;
        return gateCalls === 1 ? { code: 1, stdout: "BLOCK: [B1] too templated", stderr: "" } : { code: 0, stdout: "", stderr: "" };
      },
    },
  }) as never, () => {});
  assert.equal(state.status, "complete");
  assert.equal(state.chapters[0].firstAttemptPass, false, "gate blocker on attempt 1 → not a first-attempt pass");
  assert.equal(state.chapters[0].attempts.length, 2, "one bounded retry consumed");
  assert.equal(state.totalRetries, 1);
});

// ── 13 (unit). resume reuses only VERIFIED completed chapters ─────────────────

test("chapterReusable verifies recorded content hash against on-disk bytes before reuse", async () => {
  const bookId = "zz-bakeoff-reuse";
  const roots = bakeoffRoots(bookId, "r1", tmpRoot("cf-bakeoff-reuse-"));
  const spawn = writerSpawn([], () => JSON.stringify(fixtureChapter(bookId, 1, "w1"), null, 2), (relPath) => resolve(PIPELINE_DIR, relPath));
  const deps = fakeAutopilotDeps({ spawn: spawn as unknown as AutopilotDeps["spawn"] }) as AutopilotDeps;
  const state = await generateCandidate(bookId, SOL, deps, roots, genOpts(bookId, [1]) as never, () => {});
  assert.equal(chapterReusable(roots, SOL, bookId, state.chapters[0]), true, "verified chapter is reusable");
  // Tamper with the bytes → the record no longer verifies → regenerate.
  const abs = slotChapterAbsPath(roots, "w1", bookId, 1);
  writeFileSync(abs, JSON.stringify(fixtureChapter(bookId, 1, "tampered"), null, 2));
  assert.equal(chapterReusable(roots, SOL, bookId, state.chapters[0]), false, "drifted bytes are never blindly reused");
});
