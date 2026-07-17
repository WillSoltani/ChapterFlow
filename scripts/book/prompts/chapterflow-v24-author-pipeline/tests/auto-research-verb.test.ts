/**
 * WP-701b — the `auto-research` stage verb.
 *
 * Every test is MODEL-FREE (ledger L-14/L-22: no live calls). The compliant research phase
 * (doResearch, spawning a real codex session on the production path) is driven through an
 * injected `deps.spawn` double, exactly as the autopilot's own research tests do. The verb's
 * whole point is proven structurally: it runs ONLY the research phase and STOPS — the spawn
 * call log shows nothing but role "research", and no write/author phase is ever reachable.
 *
 * Coverage map (WP charter a–f):
 *  (a) happy path → index+sidecar artifacts produced, exit 0, WP-503 ledger entries appended
 *      (capturing sink), NO author/write spawn ever issued;
 *  (b) retry cap → a freshness failure retries EXACTLY once more, then a truthful 'content'
 *      halt (cap 2 total);
 *  (c) a concurrent second invocation is lock-refused with a distinct non-zero exit;
 *  (d) routes via modelPolicy → the double receives role "research" with NO model pin, and
 *      resolveRoute proves that resolves gpt-5.6-sol@high (tier normal-profile);
 *  (e) the fail-closed no-index path → a session that never writes the index halts 'progress'
 *      (no index committed). NOTE: the COMPLIANT research phase has NO separate semantic
 *      "coherence" gate — that is the legacy `research` verb's concept (researcher.ts). Its
 *      fail-closed halts are freshness-restore → 'content' (b), session-exit → 'infra', and
 *      no-index-after-cap → 'progress' (e). We assert the REAL behavior truthfully;
 *  (f) autopilot regression → covered by re-running the existing autopilot/research suites
 *      (named in the WP report), plus the routing/ledger invariants asserted here.
 */

import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { test } from "./harness.js";
import { PIPELINE_DIR } from "./helpers.js";
import {
  runAutoResearch,
  doResearch,
  acquireBookLock,
  type AutopilotDeps,
  type AutoResearchOutcome,
} from "../src/orchestrator/autopilot.js";
import { callLedgerDir, readCallLedgerEntries } from "../src/telemetry/runCallLedger.js";
import { resolveRoute } from "../src/orchestrator/modelPolicy.js";
import {
  AUTO_RESEARCH_EXIT,
  parseAutoResearchArgs,
  classifyAutoResearchExit,
  autoResearchCommand,
  defaultAutoResearchDeps,
  type AutoResearchDeps,
} from "../src/orchestrator/autoResearchCommand.js";
import { runGeneratePreflightChecks } from "../src/lifecycle/doctor.js";
import type { DoctorFinding } from "../src/lifecycle/doctor.js";

// ── harness: an injected research-phase spawn double ────────────────────────────

type SpawnCall = { role?: string; model?: string; effort?: string; sessionId: string; sandbox?: string };

/** Build a Partial<AutopilotDeps> that drives doResearch WITHOUT a real codex binary,
 *  a real CLI subprocess (runVerb), or a real prompt-file read (readTask). `researched`
 *  is a mutable disk-fixture flag so researchProgressMade sees the "index" appear. */
function researchDeps(opts: {
  spawns: SpawnCall[];
  /** true once the research double has "written" the chapter index this run. */
  produceIndex?: boolean;
  /** injected freshness verdict (null = fresh; string = a restore/stale violation). */
  freshness?: string | null;
  /** the double's exit result (default ok/0). */
  spawnResult?: (o: { sessionId: string; role?: string; model?: string; reasoningEffort?: string }) => Record<string, unknown>;
  /** captures the produced artifact paths so the test can assert "artifacts land". */
  artifacts?: { indexFile: string; sidecarFile: string };
  logSession?: AutopilotDeps["logSession"];
  acquireLock?: AutopilotDeps["acquireLock"];
  logs?: string[];
}): Partial<AutopilotDeps> {
  let indexWritten = false;
  const spawn = (async (o: { sessionId: string; role?: string; model?: string; reasoningEffort?: string; sandbox?: string }) => {
    opts.spawns.push({ role: o.role, model: o.model, effort: o.reasoningEffort, sessionId: o.sessionId, sandbox: o.sandbox });
    // Simulate the research session producing the handoff artifacts (index + a source
    // sidecar) when configured to. Writing REAL files to a temp dir lets the test assert
    // the artifacts land, without touching pipeline state.
    if (opts.produceIndex && opts.artifacts) {
      writeFileSync(opts.artifacts.indexFile, JSON.stringify({ bookId: "zz", chapters: [{ number: 1 }, { number: 2 }] }));
      writeFileSync(opts.artifacts.sidecarFile, JSON.stringify({ ch: 1, testableFacts: [] }));
      indexWritten = true;
    }
    const base = {
      ok: true, exitCode: 0, finalMessage: "handoff satisfied", stdout: "", stderr: "",
      durationMs: 7, sessionId: o.sessionId,
      ...(o.role ? { role: o.role } : {}),
      // Simulate spawnCodexAgent stamping the RESOLVED route model/effort on the result
      // (the double is given no model, so we mirror what modelPolicy would resolve).
      model: o.model ?? "gpt-5.6-sol",
      effort: o.reasoningEffort ?? "high",
      outcome: "content_completed",
    };
    return opts.spawnResult ? { ...base, ...opts.spawnResult(o) } : base;
  }) as unknown as AutopilotDeps["spawn"];

  return {
    spawn,
    runVerb: async () => ({ code: 0, stdout: "", stderr: "" }),
    readTask: () => "RESEARCH-CODEX-SESSION prompt (stub)",
    expectedChapterNumbers: () => (indexWritten ? [1, 2] : []),
    researchFreshness: () => opts.freshness ?? null,
    acquireLock: opts.acquireLock ?? (() => ({ ok: true, release: () => {} })),
    log: (m: string) => { opts.logs?.push(m); },
    // Default the session sink to a no-op so tests don't leak per-session disk logs; the
    // WP-503 unified-ledger append lives in buildLedgeredDeps (wrapping THIS), so it still
    // runs. Test (a) overrides this with a capturing sink.
    logSession: (opts.logSession ?? (() => {})) as AutopilotDeps["logSession"],
  };
}

/** Remove the per-book telemetry a real runAutoResearch writes (WP-503 call ledger +
 *  SessionLedger cost report), so the suite stays hermetic. */
function cleanupBookTelemetry(bookId: string): void {
  try { rmSync(callLedgerDir(PIPELINE_DIR, bookId), { recursive: true, force: true }); } catch { /* best-effort */ }
  try { rmSync(join(PIPELINE_DIR, "state", "autopilot-logs", bookId), { recursive: true, force: true }); } catch { /* best-effort */ }
}

// ── (a) happy path ─────────────────────────────────────────────────────────────

test("(a) happy path: research double produces index+sidecars → research-complete, ONLY a research spawn, WP-503 ledger appended", async () => {
  const bookId = "zz-auto-research-happy";
  const runId = "run-auto-research-happy-wp503";
  const tmp = mkdtempSync(join(tmpdir(), "auto-research-a-"));
  const artifacts = { indexFile: join(tmp, "index.json"), sidecarFile: join(tmp, "ch01.source.json") };
  const spawns: SpawnCall[] = [];
  const loggedResults: Array<{ ok: boolean; sessionId: string; role?: string }> = [];
  try {
    const outcome = await runAutoResearch({
      bookId,
      title: "The Test Book",
      author: "A. Author",
      runId,
      deps: researchDeps({
        spawns,
        produceIndex: true,
        freshness: null,
        artifacts,
        logSession: ((_b: string, _l: string, r: { ok: boolean; sessionId: string; role?: string }) => { loggedResults.push(r); }) as unknown as AutopilotDeps["logSession"],
      }),
    });

    // research complete, stopped before authoring
    assert.equal(outcome.status, "research-complete");
    if (outcome.status === "research-complete") {
      assert.match(outcome.message, /STOPPED before authoring/);
      assert.match(outcome.indexPath, new RegExp(`indexes.*${bookId}`));
    }
    // exit code 0
    assert.equal(classifyAutoResearchExit(outcome).code, AUTO_RESEARCH_EXIT.OK);

    // artifacts landed (the research double produced index + source sidecar)
    assert.ok(existsSync(artifacts.indexFile), "chapter index artifact produced");
    assert.ok(existsSync(artifacts.sidecarFile), "source-v2 sidecar artifact produced");

    // ONLY a research spawn was ever issued — NO author/write/gate/qc spawn (structural stop)
    assert.equal(spawns.length, 1, "exactly one research spawn (single pass, handoff satisfied)");
    assert.ok(spawns.every((s) => s.role === "research"), "every spawn is role=research; no author-writer/reviewer/repair spawn");

    // capturing sink saw the research session logged
    assert.ok(loggedResults.some((r) => r.ok && r.role === "research"), "the research session was logged through the (wrapped) sink");

    // WP-503: the unified per-run call ledger has the research entry appended
    const entries = readCallLedgerEntries(PIPELINE_DIR, bookId, runId);
    assert.ok(entries.length >= 1, "the research session is appended to the unified call ledger");
    assert.ok(entries.every((e) => e.family === "codex-exec"));
    assert.ok(entries.some((e) => e.role === "research"), "the ledger entry carries role=research (the authoritative role field)");
    // NOTE: the unified-ledger `stage` is derived from the sessionId (`auto-<label>-…`), a
    // PRE-EXISTING WP-503 quirk preserved byte-identically from runAutopilot's logSession
    // wrapper — so it is "other" here, not "research". The SessionLedger's OWN classification
    // (by the mint label) is the one that reads "research". We assert the real behavior.
    assert.ok(entries.every((e) => typeof e.stage === "string"), "every entry carries a stage classification");
  } finally {
    rmSync(tmp, { recursive: true, force: true });
    cleanupBookTelemetry(bookId);
  }
});

// ── (b) retry cap ────────────────────────────────────────────────────────────────

test("(b) retry cap: a freshness failure retries EXACTLY once more, then a truthful 'content' halt (cap 2)", async () => {
  const bookId = "zz-auto-research-retrycap";
  const tmp = mkdtempSync(join(tmpdir(), "auto-research-b-"));
  const artifacts = { indexFile: join(tmp, "index.json"), sidecarFile: join(tmp, "ch01.source.json") };
  const spawns: SpawnCall[] = [];
  try {
    // handoff contract satisfied every pass (index produced) BUT freshness fails every pass →
    // the restore-detection content halt after the 2-pass cap.
    const outcome = await runAutoResearch({
      bookId,
      runId: "run-b",
      deps: researchDeps({
        spawns,
        produceIndex: true,
        freshness: "newest research run is a byte-identical restore of an archived backup — restoring an archived run is not research",
        artifacts,
      }),
    });

    assert.equal(outcome.status, "halt");
    if (outcome.status === "halt") {
      assert.equal(outcome.phase, "research");
      assert.equal(outcome.category, "content");
      assert.match(outcome.reason, /restored an archived run|freshness/i);
    }
    // EXACTLY RESEARCH_MAX_PASSES=2 spawns — one retry, then halt (never a third).
    assert.equal(spawns.length, 2, "one initial pass + exactly one retry (cap 2)");
    assert.ok(spawns.every((s) => s.role === "research"), "both passes are role=research; no write phase");

    // truthful, distinct exit code for a content halt
    assert.equal(classifyAutoResearchExit(outcome).code, AUTO_RESEARCH_EXIT.HALT_CONTENT);
    assert.equal(classifyAutoResearchExit(outcome).label, "HALT_CONTENT");
  } finally {
    rmSync(tmp, { recursive: true, force: true });
    cleanupBookTelemetry(bookId);
  }
});

// ── (c) concurrent lock refusal ─────────────────────────────────────────────────

test("(c) a concurrent second invocation is lock-refused with a distinct non-zero exit (exit 3)", async () => {
  const bookId = "zz-auto-research-lock";
  const lockDir = mkdtempSync(join(tmpdir(), "auto-research-lock-"));
  const tmp = mkdtempSync(join(tmpdir(), "auto-research-c-"));
  const artifacts = { indexFile: join(tmp, "index.json"), sidecarFile: join(tmp, "ch01.source.json") };
  const spawns1: SpawnCall[] = [];
  const spawns2: SpawnCall[] = [];
  let releaseFirst: () => void = () => {};
  const firstBlocked = new Promise<void>((res) => { releaseFirst = res; });
  let firstSpawnStartedResolve: () => void = () => {};
  const firstSpawnStarted = new Promise<void>((res) => { firstSpawnStartedResolve = res; });

  // Both invocations race the SAME real lock (acquireBookLock) against a temp dir — the
  // production lock impl, not a stub — so the refusal is genuine.
  const acquireLock = (b: string) => acquireBookLock(lockDir, b);

  const deps1 = researchDeps({ spawns: spawns1, produceIndex: true, freshness: null, artifacts, acquireLock });
  // Make invocation #1's research spawn BLOCK until we've observed #2 get refused.
  deps1.spawn = (async (o: { sessionId: string; role?: string; reasoningEffort?: string }) => {
    spawns1.push({ role: o.role, effort: o.reasoningEffort, sessionId: o.sessionId });
    writeFileSync(artifacts.indexFile, JSON.stringify({ chapters: [{ number: 1 }] }));
    firstSpawnStartedResolve();
    await firstBlocked;
    return { ok: true, exitCode: 0, finalMessage: "", stdout: "", stderr: "", durationMs: 1, sessionId: o.sessionId, role: o.role, model: "gpt-5.6-sol", effort: "high", outcome: "content_completed" };
  }) as unknown as AutopilotDeps["spawn"];
  // #1's expectedChapterNumbers must see the index it just wrote → progress made → complete.
  deps1.expectedChapterNumbers = () => (existsSync(artifacts.indexFile) ? [1] : []);

  const deps2 = researchDeps({ spawns: spawns2, produceIndex: true, freshness: null, artifacts, acquireLock });

  try {
    const p1 = runAutoResearch({ bookId, runId: "run-c1", deps: deps1 });
    await firstSpawnStarted; // #1 now holds the lock and is mid-research

    const o2 = await runAutoResearch({ bookId, runId: "run-c2", deps: deps2 });
    assert.equal(o2.status, "halt", "the concurrent second invocation is refused");
    if (o2.status === "halt") {
      assert.equal(o2.category, "infra");
      assert.match(o2.reason, /could not acquire the run lock/);
    }
    // #2 never spawned any research — it was refused BEFORE doResearch.
    assert.equal(spawns2.length, 0, "the refused invocation issued no codex spawn");
    // distinct exit code: LOCK_REFUSED (3), not a generic infra halt (4).
    const cls = classifyAutoResearchExit(o2);
    assert.equal(cls.code, AUTO_RESEARCH_EXIT.LOCK_REFUSED);
    assert.equal(cls.label, "LOCK_REFUSED");

    releaseFirst();
    const o1 = await p1;
    assert.equal(o1.status, "research-complete", "the first invocation completes normally after releasing");
  } finally {
    releaseFirst();
    rmSync(lockDir, { recursive: true, force: true });
    rmSync(tmp, { recursive: true, force: true });
    cleanupBookTelemetry(bookId);
  }
});

// ── (d) routes via modelPolicy, no env pin ──────────────────────────────────────

test("(d) routes via modelPolicy: the research spawn carries NO model pin, effort=high; resolveRoute → gpt-5.6-sol@high (tier normal-profile)", async () => {
  const bookId = "zz-auto-research-route";
  const tmp = mkdtempSync(join(tmpdir(), "auto-research-d-"));
  const artifacts = { indexFile: join(tmp, "index.json"), sidecarFile: join(tmp, "ch01.source.json") };
  const spawns: SpawnCall[] = [];
  try {
    const outcome = await runAutoResearch({
      bookId,
      runId: "run-d",
      deps: researchDeps({ spawns, produceIndex: true, freshness: null, artifacts }),
    });
    assert.equal(outcome.status, "research-complete");

    // The spawn the verb issued declares role "research" and pins NO model/effort of its own
    // (env-pin absent) — it defers the model DECISION to modelPolicy inside spawnCodexAgent.
    assert.equal(spawns.length, 1);
    assert.equal(spawns[0].role, "research");
    assert.equal(spawns[0].model, undefined, "no model is pinned on the spawn opts (no env pin) — modelPolicy resolves it");
    assert.equal(spawns[0].effort, "high", "research runs at reasoningEffort high");

    // …and modelPolicy resolves the research role to the sol normal-profile route, so a real
    // spawnCodexAgent (which calls resolveRoute internally) routes gpt-5.6-sol@high.
    const route = resolveRoute({ role: "research" });
    assert.equal(route.model, "gpt-5.6-sol");
    assert.equal(route.effort, "high");
    assert.equal(route.tier, "normal-profile", "normal-profile tier — NOT a call-explicit env pin");
    assert.equal(route.taskClass, "research-synthesis");
  } finally {
    rmSync(tmp, { recursive: true, force: true });
    cleanupBookTelemetry(bookId);
  }
});

// ── (e) fail-closed: no index committed → 'progress' halt ───────────────────────

test("(e) fail-closed: a session that exits 0 but never writes the index halts 'progress' with NO index committed (no coherence gate exists in the compliant phase)", async () => {
  const bookId = "zz-auto-research-noindex";
  const spawns: SpawnCall[] = [];
  try {
    // produceIndex:false → the double exits 0 but the chapter index never appears →
    // researchProgressMade stays false every pass → a 'progress' bootstrap halt after the cap.
    const outcome = await runAutoResearch({
      bookId,
      runId: "run-e",
      deps: researchDeps({ spawns, produceIndex: false, freshness: null }),
    });

    assert.equal(outcome.status, "halt");
    if (outcome.status === "halt") {
      assert.equal(outcome.phase, "research");
      assert.equal(outcome.category, "progress");
      assert.match(outcome.reason, /did not create the canonical chapter index|research bootstrap failure/i);
    }
    // fail-closed: NO write/author phase ran; only research spawns, and no index was committed.
    assert.equal(spawns.length, 2, "both passes were research (cap 2), then fail-closed");
    assert.ok(spawns.every((s) => s.role === "research"));
    const cls = classifyAutoResearchExit(outcome);
    assert.equal(cls.code, AUTO_RESEARCH_EXIT.HALT_PROGRESS);
    assert.equal(cls.label, "HALT_PROGRESS");
  } finally {
    cleanupBookTelemetry(bookId);
  }
});

test("(e2) fail-closed: a research session that EXITS NONZERO halts 'infra' immediately (one spawn, distinct exit 4)", async () => {
  const bookId = "zz-auto-research-infra";
  const spawns: SpawnCall[] = [];
  try {
    const outcome = await runAutoResearch({
      bookId,
      runId: "run-e2",
      deps: researchDeps({
        spawns,
        produceIndex: false,
        spawnResult: () => ({ ok: false, exitCode: 37, stderr: "codex session crashed", outcome: "infrastructure_failure" }),
      }),
    });
    assert.equal(outcome.status, "halt");
    if (outcome.status === "halt") {
      assert.equal(outcome.category, "infra");
      assert.match(outcome.reason, /research Codex session exited 37/);
    }
    assert.equal(spawns.length, 1, "an infra exit halts immediately — no retry, no write phase");
    assert.equal(classifyAutoResearchExit(outcome).code, AUTO_RESEARCH_EXIT.HALT_INFRA);
  } finally {
    cleanupBookTelemetry(bookId);
  }
});

test("runAutoResearch refuses a non-canonical bookId with a governance halt (→ usage exit 2), before any lock/spawn", async () => {
  const spawns: SpawnCall[] = [];
  const outcome = await runAutoResearch({
    bookId: "Not--Canonical",
    deps: researchDeps({ spawns, produceIndex: false }),
  });
  assert.equal(outcome.status, "halt");
  if (outcome.status === "halt") {
    assert.equal(outcome.category, "governance");
    assert.match(outcome.reason, /canonical lowercase slug/);
  }
  assert.equal(spawns.length, 0, "an invalid bookId never spawns research");
  assert.equal(classifyAutoResearchExit(outcome).code, AUTO_RESEARCH_EXIT.USAGE);
});

// ── command layer: parse / preflight / exit wiring ──────────────────────────────

test("parse: missing bookId → usage exit 2", () => {
  const r = parseAutoResearchArgs([], { title: "T", author: "A" });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, AUTO_RESEARCH_EXIT.USAGE);
});

test("parse: missing --title/--author → usage exit 2", () => {
  const r1 = parseAutoResearchArgs(["zz-book"], { author: "A" });
  assert.equal(r1.ok, false);
  if (!r1.ok) assert.equal(r1.code, AUTO_RESEARCH_EXIT.USAGE);
  const r2 = parseAutoResearchArgs(["zz-book"], { title: "T" });
  assert.equal(r2.ok, false);
  if (!r2.ok) assert.equal(r2.code, AUTO_RESEARCH_EXIT.USAGE);
  const ok = parseAutoResearchArgs(["zz-book"], { title: "T", author: "A" });
  assert.equal(ok.ok, true);
});

test("command: a FATAL preflight finding refuses to spawn (exit 2, PREFLIGHT_FATAL, conductor never called)", async () => {
  let conductorCalled = false;
  const logs: string[] = [];
  const deps: Partial<AutoResearchDeps> = {
    runPreflight: async () => [{ level: "fatal", check: "shadow-state-dir", message: "forbidden shadow state dir present" } as DoctorFinding],
    runConductor: async () => { conductorCalled = true; return { status: "research-complete", bookId: "zz-book", indexPath: "x", sidecarsDir: null, message: "" }; },
    log: (l) => logs.push(l),
    env: {},
    now: () => 1,
  };
  const result = await autoResearchCommand({ bookId: "zz-book", title: "T", author: "A" }, deps);
  assert.equal(result.code, AUTO_RESEARCH_EXIT.USAGE);
  assert.equal(result.label, "PREFLIGHT_FATAL");
  assert.equal(result.ranConductor, false);
  assert.equal(conductorCalled, false, "a fatal preflight NEVER reaches the research spawn");
});

test("command: happy → exit 0, prints index + sidecar locations + the SEPARATE owner-gated authoring next step", async () => {
  const calls: Array<{ bookId: string; title?: string; author?: string; runId?: string }> = [];
  const logs: string[] = [];
  const deps: Partial<AutoResearchDeps> = {
    runPreflight: async () => [{ level: "ok", check: "stub", message: "clear" }],
    runConductor: async (o) => { calls.push(o); return { status: "research-complete", bookId: o.bookId, indexPath: "state/indexes/zz-book.json", sidecarsDir: "/x/.chapterflow/runs/zz-book", message: "research complete for zz-book" }; },
    log: (l) => logs.push(l),
    env: {},
    now: () => 42,
  };
  const result = await autoResearchCommand({ bookId: "zz-book", title: "The Book", author: "Jane Doe" }, deps);
  assert.equal(result.code, AUTO_RESEARCH_EXIT.OK);
  assert.equal(result.label, "RESEARCH_COMPLETE");
  assert.equal(result.ranConductor, true);
  assert.equal(calls.length, 1, "the conductor ran exactly once");
  assert.equal(calls[0].title, "The Book");
  assert.equal(calls[0].runId, result.runId, "the printed run id is the one handed to the conductor");
  const out = logs.join("\n");
  assert.match(out, /state\/indexes\/zz-book\.json/);
  assert.match(out, /sidecars\/source/);
  assert.match(out, /generate-book zz-book .*--resume/, "the authoring next step is a SEPARATE, owner-gated command");
});

test("command: a lock-refused conductor outcome maps to exit 3 (LOCK_REFUSED)", async () => {
  const deps: Partial<AutoResearchDeps> = {
    runPreflight: async () => [{ level: "ok", check: "stub", message: "clear" }],
    runConductor: async (): Promise<AutoResearchOutcome> => ({ status: "halt", bookId: "zz-book", phase: "research", category: "infra", reason: "could not acquire the run lock for zz-book (pid 1@h)" }),
    log: () => {},
    env: {},
    now: () => 1,
  };
  const result = await autoResearchCommand({ bookId: "zz-book", title: "T", author: "A" }, deps);
  assert.equal(result.code, AUTO_RESEARCH_EXIT.LOCK_REFUSED);
  assert.equal(result.label, "LOCK_REFUSED");
});

test("classifyAutoResearchExit maps every research halt category to a distinct truthful exit code", () => {
  const mk = (category: "infra" | "content" | "progress" | "governance" | "integrity", reason = "x"): AutoResearchOutcome =>
    ({ status: "halt", bookId: "zz", phase: "research", category, reason });
  assert.equal(classifyAutoResearchExit(mk("infra")).code, AUTO_RESEARCH_EXIT.HALT_INFRA);
  assert.equal(classifyAutoResearchExit(mk("content")).code, AUTO_RESEARCH_EXIT.HALT_CONTENT);
  assert.equal(classifyAutoResearchExit(mk("progress")).code, AUTO_RESEARCH_EXIT.HALT_PROGRESS);
  assert.equal(classifyAutoResearchExit(mk("governance")).code, AUTO_RESEARCH_EXIT.USAGE);
  assert.equal(classifyAutoResearchExit(mk("integrity")).code, AUTO_RESEARCH_EXIT.HALT);
  // a lock phrase in an infra halt is upgraded to the LOCK_REFUSED class
  assert.equal(classifyAutoResearchExit(mk("infra", "could not acquire the run lock for zz")).code, AUTO_RESEARCH_EXIT.LOCK_REFUSED);
  // success
  assert.equal(classifyAutoResearchExit({ status: "research-complete", bookId: "zz", indexPath: "i", sidecarsDir: null, message: "m" }).code, AUTO_RESEARCH_EXIT.OK);
});

test("the command's default conductor IS runAutoResearch and its default preflight IS the WP-602b fresh-book battery (no re-implementation)", () => {
  const deps = defaultAutoResearchDeps();
  assert.equal(deps.runConductor, runAutoResearch, "the verb delegates to the exported research entrypoint");
  assert.equal(deps.runPreflight, runGeneratePreflightChecks, "the verb reuses the existing fresh-book preflight — no new checks invented");
});

// ── preflight discipline: a genuinely fresh bookId PASSES (WP contract point 4) ──

test("preflight: a FRESH bookId passes the global fresh-book battery (0 fatal) — the verb can start a new book", async () => {
  const findings = await runGeneratePreflightChecks({ bookId: "zz-auto-research-freshprobe" });
  const fatal = findings.filter((f) => f.level === "fatal");
  assert.equal(fatal.length, 0, `a fresh new book must pass preflight; got fatals: ${JSON.stringify(fatal.map((f) => f.check))}`);
});

// ── structural guarantee: doResearch is the ONLY phase reachable ─────────────────

test("structural: doResearch is exported and is EXACTLY what the verb runs (no write/gate/qc/ready phase is reachable from auto-research)", async () => {
  // doResearch is the sole phase runAutoResearch invokes. Proven here by calling doResearch
  // directly with a produce-nothing double and observing it returns a research-phase outcome
  // (null on success / a research halt) — never a write/gate/qc transition. The verb wraps
  // ONLY this, so the write/author phase is unreachable by construction, not by flag order.
  assert.equal(typeof doResearch, "function");
  const spawns: SpawnCall[] = [];
  const tmp = mkdtempSync(join(tmpdir(), "ar-struct-"));
  try {
    const base = researchDeps({ spawns, produceIndex: true, freshness: null, artifacts: { indexFile: join(tmp, "i.json"), sidecarFile: join(tmp, "s.json") } });
    // Build a full deps set the way runAutopilot would (resolveDeps fills the rest).
    const { resolveDeps } = await import("../src/orchestrator/autopilot.js");
    const deps = resolveDeps(base);
    const result = await doResearch("zz-struct", deps);
    assert.equal(result, null, "doResearch returns null (phase complete) — its ONLY non-null return is a research-phase halt");
    assert.ok(spawns.every((s) => s.role === "research"), "doResearch spawns nothing but role=research");
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
