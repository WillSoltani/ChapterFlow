/**
 * Artifact-store lock compatibility remains covered for retained readers. Compiler writes now
 * use an injected CompilerApplicationPort with explicit candidate identity; retired CLI verbs
 * and agent spawns must remain unreachable from doCompilerWrite.
 */

import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { hostname, tmpdir } from "node:os";
import { dirname, resolve } from "node:path";

import { test } from "./harness.js";
import {
  acquireCompilerWriteLock,
  compilerRunLockPath,
  COMPILER_RUN_OWNER_ENV,
  ensureCompilerRun,
} from "../src/artifacts/artifactStore.js";
import type { CompilerApplicationPort } from "../src/app/compilerApplicationPort.js";
import { MODEL_CALLER_PROFILES } from "../src/app/modelTaskRunner.js";
import { doCompilerWrite } from "../src/orchestrator/compilerRun.js";
import { resolveDeps, type AutopilotDeps, type VerbResult } from "../src/orchestrator/autopilot.js";

function tmpStateRoot(label: string): string {
  return resolve(tmpdir(), `cf-v23-artifact-store-${label}-${process.pid}-${Date.now()}`);
}

test("ensureCompilerRun no-ops under a live foreign lock when CHAPTERFLOW_COMPILER_RUN_OWNER marks this process as part of that run", () => {
  const stateRoot = tmpStateRoot("owner-env");
  const roots = { stateRoot };
  const lockPath = compilerRunLockPath("money-book", roots);
  const prevOwner = process.env[COMPILER_RUN_OWNER_ENV];
  try {
    mkdirSync(dirname(lockPath), { recursive: true });
    writeFileSync(lockPath, JSON.stringify({ pid: process.pid, host: hostname(), at: new Date(0).toISOString(), owner: "the-owning-run" }), { flag: "wx" });

    // No owner env yet — same live foreign lock, still throws (matches existing coverage).
    assert.throws(() => ensureCompilerRun("money-book", roots), /already in progress/);

    // A child spawned by doCompilerWrite carries this env — it must sail through the SAME lock.
    process.env[COMPILER_RUN_OWNER_ENV] = "money-book";
    assert.doesNotThrow(
      () => ensureCompilerRun("money-book", roots),
      "a process marked via CHAPTERFLOW_COMPILER_RUN_OWNER must not be treated as a competing independent run",
    );
  } finally {
    if (prevOwner === undefined) delete process.env[COMPILER_RUN_OWNER_ENV];
    else process.env[COMPILER_RUN_OWNER_ENV] = prevOwner;
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("acquireCompilerWriteLock re-entering the SAME book+roots within one process never self-deadlocks, and a DIFFERENT book/roots is never blocked by it", () => {
  const stateRootA = tmpStateRoot("reentry-a");
  const stateRootB = tmpStateRoot("reentry-b");
  try {
    assert.doesNotThrow(() => acquireCompilerWriteLock("money-book", { stateRoot: stateRootA }));
    assert.doesNotThrow(
      () => acquireCompilerWriteLock("money-book", { stateRoot: stateRootA }),
      "re-acquiring the same book+roots within one process (as a retried doCompilerWrite would) must not throw",
    );
    assert.doesNotThrow(
      () => acquireCompilerWriteLock("money-book", { stateRoot: stateRootB }),
      "a distinct book/roots must never be blocked by another book's compiler-write lock",
    );
  } finally {
    rmSync(stateRootA, { recursive: true, force: true });
    rmSync(stateRootB, { recursive: true, force: true });
  }
});

// ── doCompilerWrite: selected application port + explicit candidate inputs ──

function fakeDeps(overrides: {
  runVerb: AutopilotDeps["runVerb"];
  spawn: AutopilotDeps["spawn"];
}): AutopilotDeps {
  return resolveDeps({
    ...overrides,
    mkSessionId: (label: string) => label,
    logSession: () => {},
    log: () => {},
  });
}

test("doCompilerWrite invokes the injected CompilerApplicationPort with explicit candidate inputs", async () => {
  const BOOK = "zz-fixture-compiler-application-port";
  let request: Record<string, unknown> | undefined;
  const port = {
    run: async (value: Record<string, unknown>) => {
      request = value;
      return { candidateId: "successor-1", manifestDigest: "successor-digest" };
    },
  } as unknown as CompilerApplicationPort;
  let legacyCalls = 0;
  const deps = fakeDeps({
    runVerb: async (): Promise<VerbResult> => { legacyCalls++; return { code: 0, stdout: "", stderr: "" }; },
    spawn: (async () => { legacyCalls++; throw new Error("legacy spawn must stay unreachable"); }) as unknown as AutopilotDeps["spawn"],
  });
  const compilerRequest = {
    candidateId: "candidate-1",
    manifestDigest: "candidate-digest",
    attemptRoot: resolve(tmpdir(), "compiler-application-port-attempt"),
    indexLogicalPath: "index.json",
    sectionTaskContextLogicalPath: "section-context.json",
    sources: [],
    profileId: MODEL_CALLER_PROFILES["compiler-section"],
    signal: new AbortController().signal,
  };

  const outcome = await doCompilerWrite(BOOK, deps, { maxParallel: 2, compiler: { port, request: compilerRequest } });

  assert.deepEqual(request, { ...compilerRequest, bookId: BOOK });
  assert.equal(legacyCalls, 0, "selected compiler route must not invoke retired verbs or spawns");
  assert.deepEqual(outcome, {
    status: "ready",
    bookId: BOOK,
    message: "compiler successor candidate successor-1/successor-digest staged; downstream review/QC required",
  });
});

test("doCompilerWrite blocks missing explicit candidate binding before any legacy verb or spawn", async () => {
  const BOOK = "zz-fixture-compiler-candidate-required";
  let calls = 0;
  const deps = fakeDeps({
    runVerb: async (): Promise<VerbResult> => { calls++; return { code: 0, stdout: "", stderr: "" }; },
    spawn: (async () => { calls++; throw new Error("spawn must stay unreachable"); }) as unknown as AutopilotDeps["spawn"],
  });

  const outcome = await doCompilerWrite(BOOK, deps, { maxParallel: 2 });

  assert.deepEqual(outcome, {
    status: "halt",
    bookId: BOOK,
    phase: "write",
    category: "infra",
    reason: "compiler application port and explicit candidate inputs are required",
  });
  assert.equal(calls, 0, "explicit candidate blocker must fire before retired execution surfaces");
});
