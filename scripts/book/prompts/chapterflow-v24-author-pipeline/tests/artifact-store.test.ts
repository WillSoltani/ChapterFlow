/**
 * Regression coverage for moving the compiler-write same-book concurrency guard out of
 * ensureCompilerRun()/artifactDir() and into the single write entry point.
 *
 * The guard previously acquired INSIDE ensureCompilerRun()/artifactDir() — every artifact path
 * resolution funnels through those, including the read-only `validate-sections` verb the v23
 * compiler runs as its own subprocess for EACH parallel section writer (compilerRun.ts's
 * mapWithConcurrency + sectionTasks.ts's task card, which tells the writer to shell out to
 * `validate-sections` itself). Acquiring on every call meant the 2nd+ concurrent validator for
 * the SAME book threw "already in progress" against its own parent's lock, breaking parallel
 * section validation (proven: two concurrent ensureCompilerRun() calls for one book → the
 * second throws).
 *
 * The fix: the lock is acquired EXACTLY ONCE, at the single compiler write entry point
 * (doCompilerWrite in orchestrator/compilerRun.ts), before any section work is spawned.
 * ensureCompilerRun()/artifactDir() only CHECK — they no-op for the process that holds the
 * lock and for any child process the owning run marked via CHAPTERFLOW_COMPILER_RUN_OWNER
 * (set on every subprocess/agent env doCompilerWrite spawns) — and still fail loud for a
 * genuinely independent second run. Existing coverage for the unchanged parts (a live foreign
 * lock still blocking a plain ensureCompilerRun() call; currentRunId's corrupt-pointer warning)
 * already lives in compiler-pipeline.test.ts — this file covers only the NEW behavior.
 */

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { hostname, tmpdir } from "node:os";
import { dirname, resolve } from "node:path";

import { test } from "./harness.js";
import { PIPELINE_DIR } from "./helpers.js";
import {
  acquireCompilerWriteLock,
  compilerRunLockPath,
  COMPILER_RUN_OWNER_ENV,
  ensureCompilerRun,
} from "../src/artifacts/artifactStore.js";
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

// ── doCompilerWrite: acquires once, threads the owner env, fails loud for an independent run ──

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

test("doCompilerWrite sets CHAPTERFLOW_COMPILER_RUN_OWNER on every CLI verb and every agent it spawns", async () => {
  const BOOK = "zz-fixture-compiler-owner-env";
  const lockPath = compilerRunLockPath(BOOK);
  rmSync(lockPath, { force: true });
  try {
    const verbEnvsByVerb = new Map<string, Array<Record<string, string> | undefined>>();
    const spawnEnvs: Array<Record<string, string> | undefined> = [];
    let sourceGateCalls = 0;

    const deps = fakeDeps({
      runVerb: async (args, env): Promise<VerbResult> => {
        const verb = args[0];
        const list = verbEnvsByVerb.get(verb) ?? [];
        list.push(env);
        verbEnvsByVerb.set(verb, list);
        if (verb === "source-v2-gate") {
          sourceGateCalls++;
          // Fail once so convergeSourceReadiness spawns a repair agent — exercising the
          // deps.spawn() env-threading path too, not just deps.runVerb().
          if (sourceGateCalls === 1) return { code: 1, stdout: "", stderr: "blocked" };
        }
        return { code: 0, stdout: "PASS", stderr: "" };
      },
      spawn: (async (o: { env?: Record<string, string>; sessionId: string }) => {
        spawnEnvs.push(o.env);
        return { ok: true, exitCode: 0, finalMessage: "fixed", stdout: "", stderr: "", durationMs: 1, sessionId: o.sessionId };
      }) as unknown as AutopilotDeps["spawn"],
    });

    const outcome = await doCompilerWrite(BOOK, deps, { maxParallel: 2 });
    assert.equal(outcome, null, "the stubbed run should converge with no halt");

    for (const verb of [
      "source-v2-gate",
      "compile-source-packets",
      "source-packet-gate",
      "compile-blueprints",
      "blueprint-gate",
      "deal-section-tasks",
      "validate-sections",
      "assemble-sections",
      "build-evidence-maps",
      "evidence-gate",
      "risk-score",
    ]) {
      const envs = verbEnvsByVerb.get(verb) ?? [];
      assert.ok(envs.length > 0, `expected verb "${verb}" to have been invoked`);
      for (const env of envs) {
        assert.equal(env?.[COMPILER_RUN_OWNER_ENV], BOOK, `runVerb("${verb}") must carry ${COMPILER_RUN_OWNER_ENV}=${BOOK}`);
      }
    }

    assert.ok(spawnEnvs.length > 0, "the source-repair agent spawn should have fired at least once");
    for (const env of spawnEnvs) {
      assert.equal(env?.[COMPILER_RUN_OWNER_ENV], BOOK, `every spawned agent must carry ${COMPILER_RUN_OWNER_ENV}=${BOOK}`);
    }
  } finally {
    rmSync(lockPath, { force: true });
  }
});

test("doCompilerWrite fails loud, before spawning any section work, when an independent run already holds the lock", async () => {
  const BOOK = "zz-fixture-compiler-independent-run";
  const lockPath = compilerRunLockPath(BOOK);
  try {
    mkdirSync(dirname(lockPath), { recursive: true });
    writeFileSync(lockPath, JSON.stringify({ pid: process.pid, host: hostname(), at: new Date(0).toISOString(), owner: "an-independent-book-run" }), { flag: "wx" });

    let calls = 0;
    const deps = fakeDeps({
      runVerb: async (): Promise<VerbResult> => { calls++; return { code: 0, stdout: "PASS", stderr: "" }; },
      spawn: (async () => { calls++; return { ok: true, exitCode: 0, finalMessage: "", stdout: "", stderr: "", durationMs: 1, sessionId: "x" }; }) as unknown as AutopilotDeps["spawn"],
    });

    const outcome = await doCompilerWrite(BOOK, deps, { maxParallel: 2 });
    assert.ok(outcome && outcome.status === "halt", "a second independent doCompilerWrite for the same book must halt, not throw or silently proceed");
    if (!outcome || outcome.status !== "halt") return;
    assert.equal(outcome.category, "infra");
    assert.match(outcome.reason, /already in progress/);
    assert.equal(calls, 0, "no CLI verb or agent may be spawned once the lock acquisition itself fails");
  } finally {
    rmSync(lockPath, { force: true });
  }
});

// ── Process-level repro: real concurrent OS subprocesses, not just stubbed in-process deps ──

const OWNER_ENV_RUNNER_SRC = `
import { pathToFileURL } from "node:url";
const [, , artifactStorePath, bookId, stateRoot] = process.argv;
const mod = await import(pathToFileURL(artifactStorePath).href);
try {
  mod.ensureCompilerRun(bookId, { stateRoot });
  process.exit(0);
} catch (err) {
  process.stderr.write(String((err && err.message) || err));
  process.exit(1);
}
`;

function runOwnerEnvChild(runnerPath: string, artifactStorePath: string, bookId: string, stateRoot: string, env: NodeJS.ProcessEnv): Promise<{ code: number; stderr: string }> {
  return new Promise((resolvePromise) => {
    const child = spawn("npx", ["tsx", runnerPath, artifactStorePath, bookId, stateRoot], {
      cwd: PIPELINE_DIR,
      env,
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (d) => { stderr += d.toString(); });
    child.on("close", (code) => resolvePromise({ code: code ?? -1, stderr }));
    child.on("error", (err) => resolvePromise({ code: -1, stderr: String(err) }));
  });
}

test("process-level: concurrent validate-sections-equivalent subprocesses under the owner env all succeed against a live lock; one without it still fails loud", async () => {
  const BOOK = "zz-fixture-owner-env-proc";
  const stateRoot = tmpStateRoot("owner-env-proc");
  const runnerPath = resolve(tmpdir(), `cf-v23-owner-env-runner-${process.pid}-${Date.now()}.mjs`);
  const artifactStorePath = resolve(PIPELINE_DIR, "src/artifacts/artifactStore.ts");
  mkdirSync(stateRoot, { recursive: true });
  writeFileSync(runnerPath, OWNER_ENV_RUNNER_SRC, "utf8");
  try {
    // This process plays the role of doCompilerWrite: it acquires the write lock for the book
    // exactly once, up front, before any "section work" (the child subprocesses below) runs.
    acquireCompilerWriteLock(BOOK, { stateRoot });

    const ownedEnv: NodeJS.ProcessEnv = { ...process.env, [COMPILER_RUN_OWNER_ENV]: BOOK };
    const owned = await Promise.all(
      Array.from({ length: 5 }, () => runOwnerEnvChild(runnerPath, artifactStorePath, BOOK, stateRoot, ownedEnv)),
    );
    for (const r of owned) {
      assert.equal(r.code, 0, `a subprocess carrying ${COMPILER_RUN_OWNER_ENV} must succeed against the live owning lock; stderr: ${r.stderr}`);
    }

    const foreignEnv: NodeJS.ProcessEnv = { ...process.env };
    delete foreignEnv[COMPILER_RUN_OWNER_ENV];
    const foreign = await runOwnerEnvChild(runnerPath, artifactStorePath, BOOK, stateRoot, foreignEnv);
    assert.notEqual(foreign.code, 0, "a subprocess with no owner env must still fail loud against a live foreign lock");
    assert.match(foreign.stderr, /already in progress/);
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
    rmSync(runnerPath, { force: true });
  }
});
