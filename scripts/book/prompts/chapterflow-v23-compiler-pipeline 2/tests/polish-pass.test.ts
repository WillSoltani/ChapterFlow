/**
 * P06 — the v23 compiler polish pass (craft layer).
 *
 * Covers, with STUBBED deps (the compilerRun/autopilot DI pattern) and the
 * `opts.tasks` test seam (section artifacts written to a tmp dir, so no
 * source-sidecar scaffolding is needed):
 *   - failing metrics → exactly one spawn per failing artifact, each naming ITS path
 *   - passing metrics → zero spawns; a passing artifact is never touched
 *   - mode `never` → zero spawns (and the wiring is a byte-for-byte no-op)
 *   - a polish session sidecar is written (provenance includes the polisher)
 *   - the retry is capped at 1
 *   - the polish task text carries the preserve-list + the scoped validate command
 */

import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { test } from "./harness.js";
import type { AutopilotDeps } from "../src/orchestrator/autopilot.js";
import type { CodexAgentResult } from "../src/orchestrator/codexAgent.js";
import type { ExamplePackV1, SectionKind, SummaryPackV1 } from "../src/artifacts/artifactTypes.js";
import type { SectionTask } from "../src/sections/sectionTasks.js";
import {
  buildPolishTask,
  compilerPolishMode,
  convergePolish,
  selectPolishTargets,
  summaryPackMetrics,
  type PolishTarget,
} from "../src/orchestrator/polishPass.js";
import { runPolishStage } from "../src/orchestrator/compilerRun.js";
import { writeSectionSessionRecord, recordPolishSession, sectionSessionSidecarPath } from "../src/orchestrator/sectionSessionRecord.js";
import { loadRubricThresholds } from "../src/metrics/rubricThresholds.js";

const T = loadRubricThresholds();

const DENSE =
  "The organizational implementation necessitated comprehensive documentation regarding administrative " +
  "accountability throughout the departmental reconfiguration initiative, whereupon subsequent authorization " +
  "requirements substantially complicated interdepartmental communication effectiveness and organizational productivity.";

// Short, plain sentences: high Flesch ease AND ≥2 clean (≤14-word) memorable lines.
const EASY =
  "You check the last entry before you add a new one. " +
  "The early check is the only cheap one you get. " +
  "Small drift grows into costly rework later on. " +
  "Start with the record you expect to be wrong.";

function denseSummary(chapterId: string): SummaryPackV1 {
  return {
    schemaVersion: "section-artifact-v1",
    artifactType: "summary-pack",
    chapterId,
    hook: { hook: "A short hook goes here.", sourceAnchorIds: ["a1"] },
    breakdown: { fastRead: DENSE, deepRead: `${DENSE} ${DENSE}`, fullRead: `${DENSE} ${DENSE} ${DENSE}`, sourceAnchorIds: { fastRead: ["a1"], deepRead: ["a1"], fullRead: ["a1"] } },
    keyTakeaway: "A short takeaway sentence that carries the single idea forward for the reader today.",
    keyTakeawaySourceAnchorIds: ["a1"],
    sourceFactIds: ["f1"],
  };
}

function easySummary(chapterId: string): SummaryPackV1 {
  return {
    ...denseSummary(chapterId),
    breakdown: { fastRead: EASY, deepRead: `${EASY} ${EASY}`, fullRead: `${EASY} ${EASY} ${EASY}`, sourceAnchorIds: { fastRead: ["a1"], deepRead: ["a1"], fullRead: ["a1"] } },
  };
}

function denseExample(chapterId: string): ExamplePackV1 {
  return {
    schemaVersion: "section-artifact-v1",
    artifactType: "example-pack",
    chapterId,
    examples: [1, 2, 3].map((i) => ({
      exampleId: `ex0${i}`,
      title: `Example ${i}`,
      scenario: DENSE,
      whatToDo: "Do the concrete thing described here without adding anything new to the record today.",
      whyItMatters: "Small drift becomes expensive rework later when nobody compares the totals in time here.",
      sourceAnchorIds: ["a1"],
      sourceFactIds: ["f1"],
      namedCaseIds: ["c1"],
    })),
  };
}

function easyExample(chapterId: string): ExamplePackV1 {
  const d = denseExample(chapterId);
  return { ...d, examples: d.examples.map((e) => ({ ...e, scenario: EASY })) };
}

let SEQ = 0;
function tmpDir(): string {
  const dir = resolve(tmpdir(), `polish-pass-${process.pid}-${SEQ++}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function mkTask(dir: string, bookId: string, n: number, kind: SectionKind): SectionTask {
  const pad = String(n).padStart(2, "0");
  return {
    bookId,
    chapterNumber: n,
    chapterId: `${bookId}-ch${pad}`,
    kind,
    taskPath: resolve(dir, `ch${pad}.${kind}.md`),
    outputPath: resolve(dir, `ch${pad}.${kind}.json`),
    exists: true,
  };
}

function writePack(task: SectionTask, pack: SummaryPackV1 | ExamplePackV1): void {
  writeFileSync(task.outputPath, JSON.stringify(pack, null, 2));
}

function okResult(sessionId: string): CodexAgentResult {
  return { ok: true, exitCode: 0, finalMessage: "done", stdout: "", stderr: "", durationMs: 1, sessionId };
}

/** A deps stub that records every spawn's task text and session, and optionally
 *  rewrites the artifact named in the task to a PASSING pack (so re-measure clears
 *  and no retry fires). */
function stubDeps(opts: { rewriteToPass?: boolean } = {}): {
  deps: AutopilotDeps;
  spawns: { task: string; sessionId: string }[];
  logs: string[];
} {
  const spawns: { task: string; sessionId: string }[] = [];
  const logs: string[] = [];
  let n = 0;
  const deps = {
    mkSessionId: (label: string) => `${label}#${++n}`,
    log: (m: string) => logs.push(m),
    logSession: () => {},
    spawn: (async (o: { task: string; sessionId: string }) => {
      spawns.push({ task: o.task, sessionId: o.sessionId });
      if (opts.rewriteToPass) {
        const m = o.task.match(/\n- (\S+\.json)\n/);
        if (m) {
          const outputPath = m[1];
          const chapterId = "rewritten";
          const pass = /example-pack/.test(o.task) ? easyExample(chapterId) : easySummary(chapterId);
          writeFileSync(outputPath, JSON.stringify(pass, null, 2));
        }
      }
      return okResult(o.sessionId);
    }) as unknown as AutopilotDeps["spawn"],
  } as unknown as AutopilotDeps;
  return { deps, spawns, logs };
}

// ── 1. env mode parsing ──────────────────────────────────────────────────────
test("compilerPolishMode: defaults to risk; only literal never/always override", () => {
  assert.equal(compilerPolishMode({}), "risk");
  assert.equal(compilerPolishMode({ CHAPTERFLOW_COMPILER_POLISH: "risk" }), "risk");
  assert.equal(compilerPolishMode({ CHAPTERFLOW_COMPILER_POLISH: "1" }), "risk");
  assert.equal(compilerPolishMode({ CHAPTERFLOW_COMPILER_POLISH: "never" }), "never");
  assert.equal(compilerPolishMode({ CHAPTERFLOW_COMPILER_POLISH: "always" }), "always");
});

// ── 2. metrics: dense fails, easy passes ─────────────────────────────────────
test("summaryPackMetrics: dense breakdown FAILS (ease), easy breakdown PASSES with clean memorable lines", () => {
  const dense = summaryPackMetrics(denseSummary("zz-ch01"), T);
  assert.equal(dense.fail, true);
  assert.ok(dense.failingReasons.some((r) => /dense/.test(r)), dense.failingReasons.join(" | "));

  const easy = summaryPackMetrics(easySummary("zz-ch01"), T);
  assert.equal(easy.fail, false, `easy breakdown should pass (reasons=${easy.failingReasons.join(" | ")})`);
  const mem = easy.metrics.find((m) => m.key === "memorableClean");
  assert.ok(mem && (mem.value as number) >= T.memorableCleanMin, `easy prose must seed ≥${T.memorableCleanMin} clean memorable lines (got ${mem?.value})`);
});

// ── 3. selection: risk selects only failing; always selects all; never none ──
test("selectPolishTargets: risk selects only failing artifacts, always selects all, never selects none", () => {
  const dir = tmpDir();
  try {
    const s1 = mkTask(dir, "zz", 1, "summary-pack"); writePack(s1, denseSummary(s1.chapterId));
    const s2 = mkTask(dir, "zz", 2, "summary-pack"); writePack(s2, easySummary(s2.chapterId));
    const e1 = mkTask(dir, "zz", 1, "example-pack"); writePack(e1, denseExample(e1.chapterId));
    // learning/action are out of scope even if present
    const l1 = mkTask(dir, "zz", 1, "learning-pack"); writeFileSync(l1.outputPath, "{}");
    const tasks = [s1, s2, e1, l1];

    const risk = selectPolishTargets(tasks, T, "risk").map((t) => `${t.kind}#${t.task.chapterNumber}`).sort();
    assert.deepEqual(risk, ["example-pack#1", "summary-pack#1"], "risk selects only the two failing polishable artifacts");

    const always = selectPolishTargets(tasks, T, "always").map((t) => `${t.kind}#${t.task.chapterNumber}`).sort();
    assert.deepEqual(always, ["example-pack#1", "summary-pack#1", "summary-pack#2"], "always selects all polishable artifacts, learning-pack excluded");

    assert.deepEqual(selectPolishTargets(tasks, T, "never"), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── 4. convergePolish: one spawn per failing artifact, each names its path ────
test("convergePolish (risk): exactly one spawn per failing artifact, naming ONLY that path; passing artifact untouched", async () => {
  const dir = tmpDir();
  try {
    const s1 = mkTask(dir, "zz", 1, "summary-pack"); writePack(s1, denseSummary(s1.chapterId));
    const s2 = mkTask(dir, "zz", 2, "summary-pack"); writePack(s2, easySummary(s2.chapterId));
    const e1 = mkTask(dir, "zz", 1, "example-pack"); writePack(e1, denseExample(e1.chapterId));
    const tasks = [s1, s2, e1];

    const { deps, spawns } = stubDeps({ rewriteToPass: true });
    const out = await convergePolish("zz", deps, { maxParallel: 4, mode: "risk", thresholds: T, tasks });
    assert.equal(out, null, "polish is best-effort — never halts on quality");
    assert.equal(spawns.length, 2, `exactly one spawn per failing artifact (got ${spawns.length})`);

    const spawnedPaths = spawns.map((s) => s.task.match(/\n- (\S+\.json)\n/)?.[1]);
    assert.ok(spawnedPaths.includes(s1.outputPath), "dense summary artifact must be polished");
    assert.ok(spawnedPaths.includes(e1.outputPath), "dense example artifact must be polished");
    // the passing artifact is never named in any spawn task
    for (const s of spawns) assert.ok(!s.task.includes(s2.outputPath), "the passing summary artifact must not be touched");
    // each spawn names ONLY its own artifact as editable
    assert.ok(spawns.every((s) => /edit ONLY this file/.test(s.task)));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── 5. passing metrics → zero spawns ─────────────────────────────────────────
test("convergePolish (risk): a book of passing artifacts spawns nothing", async () => {
  const dir = tmpDir();
  try {
    const s1 = mkTask(dir, "zz", 1, "summary-pack"); writePack(s1, easySummary(s1.chapterId));
    const e1 = mkTask(dir, "zz", 1, "example-pack"); writePack(e1, easyExample(e1.chapterId));
    const { deps, spawns } = stubDeps();
    const out = await convergePolish("zz", deps, { maxParallel: 4, mode: "risk", thresholds: T, tasks: [s1, e1] });
    assert.equal(out, null);
    assert.equal(spawns.length, 0, "no failing artifacts → no spawns");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── 6. mode never → zero spawns ──────────────────────────────────────────────
test("convergePolish (never): spawns nothing even with a failing artifact", async () => {
  const dir = tmpDir();
  try {
    const s1 = mkTask(dir, "zz", 1, "summary-pack"); writePack(s1, denseSummary(s1.chapterId));
    const { deps, spawns } = stubDeps();
    const out = await convergePolish("zz", deps, { maxParallel: 4, mode: "never", thresholds: T, tasks: [s1] });
    assert.equal(out, null);
    assert.equal(spawns.length, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── 7. session sidecar: provenance includes the polisher ─────────────────────
test("polish session sidecar: recordPolishSession appends the polisher WITHOUT losing the writer", async () => {
  const dir = tmpDir();
  try {
    const s1 = mkTask(dir, "zz", 1, "summary-pack"); writePack(s1, denseSummary(s1.chapterId));
    // the section writer stamps first
    writeSectionSessionRecord(s1, "writer-session");
    const { deps, spawns } = stubDeps({ rewriteToPass: true });
    await convergePolish("zz", deps, { maxParallel: 4, mode: "risk", thresholds: T, tasks: [s1] });
    assert.equal(spawns.length, 1);

    const sidecar = sectionSessionSidecarPath(s1);
    assert.ok(existsSync(sidecar), "a session sidecar must exist after polish");
    const rec = JSON.parse(readFileSync(sidecar, "utf8"));
    assert.equal(rec.sectionSessionId, "writer-session", "the original writer stays the primary author");
    assert.ok(Array.isArray(rec.contributorSessionIds) && rec.contributorSessionIds.length >= 1, "the polisher joins contributorSessionIds");
    assert.ok(rec.contributorSessionIds.some((id: string) => id === spawns[0].sessionId), "the exact polish session id is recorded");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("recordPolishSession: idempotent-ish merge, does not double-count the primary author", () => {
  const dir = tmpDir();
  try {
    const s1 = mkTask(dir, "zz", 1, "summary-pack"); writePack(s1, denseSummary(s1.chapterId));
    writeSectionSessionRecord(s1, "writer");
    recordPolishSession(s1, "writer"); // same id as primary → not duplicated
    recordPolishSession(s1, "polish-a");
    recordPolishSession(s1, "polish-b");
    const rec = JSON.parse(readFileSync(sectionSessionSidecarPath(s1), "utf8"));
    assert.equal(rec.sectionSessionId, "writer");
    assert.deepEqual(rec.contributorSessionIds, ["polish-a", "polish-b"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── 8. retry capped at 1 ─────────────────────────────────────────────────────
test("convergePolish (risk): a persistently-failing artifact is retried at most once (2 spawns, never 3)", async () => {
  const dir = tmpDir();
  try {
    const s1 = mkTask(dir, "zz", 1, "summary-pack"); writePack(s1, denseSummary(s1.chapterId));
    // stub does NOT fix the file → the artifact stays failing on re-measure
    const { deps, spawns } = stubDeps();
    const out = await convergePolish("zz", deps, { maxParallel: 4, mode: "risk", thresholds: T, tasks: [s1] });
    assert.equal(out, null);
    assert.equal(spawns.length, 2, `first pass + one retry = 2 spawns, never more (got ${spawns.length})`);
    assert.ok(spawns.some((s) => /retry1/.test(s.sessionId)), "the retry session id is labelled");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── 9. polish task template: preserve-list + validate command ────────────────
test("buildPolishTask: names only the artifact, carries the preserve-list + DO NOT block + scoped validate command", () => {
  const dir = tmpDir();
  try {
    const s1 = mkTask(dir, "money", 3, "summary-pack"); writePack(s1, denseSummary(s1.chapterId));
    const target: PolishTarget = { task: s1, kind: "summary-pack", metrics: summaryPackMetrics(denseSummary(s1.chapterId), T) };
    const taskText = buildPolishTask(target);
    assert.match(taskText, /edit ONLY this file/);
    assert.ok(taskText.includes(s1.outputPath), "the exact artifact path must appear");
    assert.match(taskText, /PRESERVE VERBATIM every provenance field/);
    assert.match(taskText, /sourceAnchorIds/);
    assert.match(taskText, /keyTakeaway/);
    assert.match(taskText, /Do not weaken schemas, gates, source sidecars, QC artifacts, or other chapters\./, "reuses the section DO NOT block");
    assert.match(taskText, /npx tsx src\/cli\.ts validate-sections money --chapters 3 --section summary-pack/);

    const e1 = mkTask(dir, "money", 4, "example-pack"); writePack(e1, denseExample(e1.chapterId));
    const exText = buildPolishTask({ task: e1, kind: "example-pack", metrics: summaryPackMetrics(denseSummary(e1.chapterId), T) });
    assert.match(exText, /PRESERVE the SEMANTICS of each whatToDo/);
    assert.match(exText, /--section example-pack/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── 10. wiring: never = byte-for-byte no-op (no polish, no extra validation) ──
test("runPolishStage (never): returns null WITHOUT spawning or running any verb — byte-for-byte no-op", async () => {
  const spawns: string[] = [];
  const verbs: string[][] = [];
  const deps = {
    spawn: (async (o: { sessionId: string }) => { spawns.push(o.sessionId); return okResult(o.sessionId); }) as unknown as AutopilotDeps["spawn"],
    runVerb: async (args: string[]) => { verbs.push(args); return { code: 0, stdout: "", stderr: "" }; },
    log: () => {},
    logSession: () => {},
    mkSessionId: (l: string) => l,
  } as unknown as AutopilotDeps;
  const out = await runPolishStage("zz", deps, 4, () => true, {}, "never");
  assert.equal(out, null);
  assert.equal(spawns.length, 0, "never mode spawns nothing");
  assert.equal(verbs.length, 0, "never mode runs no verb — no extra validate-sections, so behavior is unchanged");
});
