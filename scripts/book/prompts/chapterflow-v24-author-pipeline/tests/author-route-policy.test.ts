/**
 * WP-301 — the author write + repair route through the ONE central model policy
 * (`resolveRoute`), NOT the deleted `CHAPTERFLOW_AUTHOR_MODEL`/`CHAPTERFLOW_AUTHOR_EFFORT`
 * env surface (the V25-04 parallel routing-decision bypass).
 *
 * These tests capture the EXACT model/effort that authorWriteOneChapter /
 * doRepairOneChapter hand to the spawn, then feed those captured values back
 * through `resolveRoute` — the very call `spawnCodexAgent` (codexAgent.ts) makes
 * to stamp the per-spawn route sidecar. So "the captured spawn args resolve to
 * tier X" is a faithful end-to-end proof of the tier the sidecar would record.
 *
 * Invariants proven:
 *   (a) a production author write passes NO explicit model/effort → the spawn
 *       resolves the normal-profile matrix cell (gpt-5.6-sol @ xhigh, tier
 *       "normal-profile").
 *   (b) the deleted env vars are INERT — setting them changes nothing.
 *   (c) an explicit opts.model/opts.effort (tests + bakeoff candidate writes)
 *       still wins and records tier "call-explicit".
 *   (d) author-repair routes through the same policy (routine-repair cell,
 *       tier "normal-profile") with no explicit pin.
 *   (e) an invalid resolved effort fails closed via RoutePreflightError — no
 *       silent fallback.
 *
 * All io is in-memory (injectable AuthorIo hooks) + a tmp attempts root — no
 * real state/ writes and (per CHAPTERFLOW_NO_API_CODEX_QC) no live model calls.
 */

import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { test } from "./harness.js";
import { authorWriteOneChapter, type AuthorIo, resolveAuthorIo } from "../src/orchestrator/authorRun.js";
import { doRepairOneChapter } from "../src/orchestrator/authorRepair.js";
import { resolveRoute, RoutePreflightError } from "../src/orchestrator/modelPolicy.js";
import type { AutopilotDeps } from "../src/orchestrator/autopilot.js";
import { chapterFileName } from "../src/lib/chapterPaths.js";
import { CHAPTER_BRIEF_SCHEMA_VERSION, type ChapterBriefV1, type SourcePacketV1 } from "../src/artifacts/artifactTypes.js";
import type { ChapterV21 } from "../src/types.js";

const TMP = mkdtempSync(join(tmpdir(), "author-route-policy-"));
const PACKET = { facts: [], allowedNumbers: [] } as unknown as SourcePacketV1;
const DRAFT = JSON.stringify({ chapterId: "zz-route-ch01", number: 1, title: "A draft" }) + "\n";

function mkBrief(n: number): ChapterBriefV1 {
  return {
    schemaVersion: CHAPTER_BRIEF_SCHEMA_VERSION,
    chapterId: `zz-route-ch${String(n).padStart(2, "0")}`,
    chapterNumber: n,
    title: `Fixture Chapter ${n}`,
    coreMove: "One move.",
    thesis: "One thesis.",
    readerPromise: "One promise.",
    ownedCases: [],
    notYours: [],
    cast: [],
    answerIndexPattern: [0, 1, 2, 0, 1, 2, 0, 1, 2],
    avoid: [],
    lengthBudget: { renderedChars: 16000, tolerance: 0.2 },
    flavor: [],
    openerType: "question",
    challengeFrame: "before-your-next-X",
    practiceShape: "single-imperative",
  };
}

type SpawnCapture = { role?: string; model?: string; reasoningEffort?: string };

/** A write rig whose fake spawn records every (role, model, effort) it receives
 *  and lands a draft in the attempt workspace. The gate FAILS so the flow stops
 *  right after the spawn(s) — the capture is complete either way. */
function mkWriteRig(): { deps: AutopilotDeps; io: Partial<AuthorIo>; spawns: SpawnCapture[] } {
  const spawns: SpawnCapture[] = [];
  const files = new Map<number, string>();
  let sid = 0;
  const deps = {
    runVerb: async () => ({ code: 0, stdout: "", stderr: "" }),
    spawn: (async (o: { sessionId: string; cwd?: string; role?: string; model?: string; reasoningEffort?: string }) => {
      spawns.push({ role: o.role, model: o.model, reasoningEffort: o.reasoningEffort });
      if (o.cwd) writeFileSync(join(o.cwd, chapterFileName("zz-route-ch01")), DRAFT);
      return { ok: true, exitCode: 0, finalMessage: "done", stdout: "", stderr: "", durationMs: 1, sessionId: o.sessionId };
    }) as unknown as AutopilotDeps["spawn"],
    mkSessionId: (label: string) => `${label}#${++sid}`,
    expectedChapterNumbers: () => [1],
    logSession: () => {},
    log: () => {},
  } as unknown as AutopilotDeps;
  const io: Partial<AuthorIo> = {
    chapterExists: (_b, n) => files.has(n),
    readChapterFile: (_b, n) => files.get(n) ?? null,
    writeChapterFile: (_b, n, bytes) => { files.set(n, bytes); },
    removeChapterFile: (_b, n) => { files.delete(n); },
    readBriefMd: () => "# brief\n",
    readBrief: () => mkBrief(1),
    readPacket: () => PACKET,
    loadChapters: () => [...files.values()].map((f) => JSON.parse(f)),
    nameBankOk: () => true,
    voiceCard: () => null,
    authorSessionOf: () => undefined,
    recordProvenance: () => {},
    readLeadOverride: () => null,
    writeLeadOverride: () => {},
    attemptsRoot: () => join(TMP, "attempts-write"),
    gateCandidate: async () => ({ code: 1, stdout: "[BLOCKER A12] ch: fixture halts after spawn", stderr: "" }),
    rubricWithCandidate: async () => ({ code: 0, stdout: "", stderr: "" }),
  };
  return { deps, io, spawns };
}

test("WP-301 (a): a production author write passes NO explicit model/effort → the spawn resolves gpt-5.6-sol @ xhigh, tier normal-profile", async () => {
  const rig = mkWriteRig();
  const r = await authorWriteOneChapter("zz-route", 1, rig.deps, { io: rig.io, totalChapters: 2 });
  assert.equal(r.ok, false, "the fixture halts at the gate (spawn already ran)");
  assert.ok(rig.spawns.length >= 1, "the writer spawned");
  for (const s of rig.spawns) {
    assert.equal(s.role, "author-writer", "the write spawn uses the author-writer role");
    assert.equal(s.model, undefined, "production passes NO explicit model — the matrix decides");
    assert.equal(s.reasoningEffort, undefined, "production passes NO explicit effort — the matrix decides");
    // Faithful to codexAgent.ts: resolveRoute(role, requestedModel, requestedEffort).
    const sidecar = resolveRoute({ role: "author-writer", requestedModel: s.model, requestedEffort: s.reasoningEffort });
    assert.equal(sidecar.model, "gpt-5.6-sol");
    assert.equal(sidecar.effort, "xhigh");
    assert.equal(sidecar.tier, "normal-profile", "production authoring is recorded as normal-profile, NOT call-explicit");
  }
});

test("WP-301 (b): the deleted CHAPTERFLOW_AUTHOR_MODEL/EFFORT env vars are INERT — setting them changes nothing", async () => {
  const priorModel = process.env.CHAPTERFLOW_AUTHOR_MODEL;
  const priorEffort = process.env.CHAPTERFLOW_AUTHOR_EFFORT;
  process.env.CHAPTERFLOW_AUTHOR_MODEL = "tampered-evil-model";
  process.env.CHAPTERFLOW_AUTHOR_EFFORT = "minimal";
  try {
    const rig = mkWriteRig();
    await authorWriteOneChapter("zz-route", 1, rig.deps, { io: rig.io, totalChapters: 2 });
    assert.ok(rig.spawns.length >= 1, "the writer spawned");
    for (const s of rig.spawns) {
      assert.notEqual(s.model, "tampered-evil-model", "the env pin is dead — it never reaches the spawn");
      assert.equal(s.model, undefined, "the write still passes no explicit model");
      assert.equal(s.reasoningEffort, undefined, "the write still passes no explicit effort");
      const sidecar = resolveRoute({ role: "author-writer", requestedModel: s.model, requestedEffort: s.reasoningEffort });
      assert.equal(sidecar.model, "gpt-5.6-sol", "the resolved model is the policy default, not the env value");
      assert.equal(sidecar.effort, "xhigh", "the resolved effort is the policy default, not the env value");
      assert.equal(sidecar.tier, "normal-profile");
    }
  } finally {
    if (priorModel === undefined) delete process.env.CHAPTERFLOW_AUTHOR_MODEL; else process.env.CHAPTERFLOW_AUTHOR_MODEL = priorModel;
    if (priorEffort === undefined) delete process.env.CHAPTERFLOW_AUTHOR_EFFORT; else process.env.CHAPTERFLOW_AUTHOR_EFFORT = priorEffort;
  }
});

test("WP-301 (c): an explicit opts.model/opts.effort override still wins and records tier call-explicit", async () => {
  const rig = mkWriteRig();
  await authorWriteOneChapter("zz-route", 1, rig.deps, { io: rig.io, totalChapters: 2, model: "gpt-5.6-terra", effort: "high" });
  assert.ok(rig.spawns.length >= 1, "the writer spawned");
  for (const s of rig.spawns) {
    assert.equal(s.model, "gpt-5.6-terra", "the explicit opts.model reaches the spawn verbatim");
    assert.equal(s.reasoningEffort, "high", "the explicit opts.effort reaches the spawn verbatim");
    const sidecar = resolveRoute({ role: "author-writer", requestedModel: s.model, requestedEffort: s.reasoningEffort });
    assert.equal(sidecar.model, "gpt-5.6-terra");
    assert.equal(sidecar.effort, "high");
    assert.equal(sidecar.tier, "call-explicit", "an explicit per-call pin is recorded as call-explicit");
  }
});

// ── (d) author-repair ─────────────────────────────────────────────────────────

function mkRepairChapter(): ChapterV21 {
  return {
    schemaVersion: "chapterflow-v21-authored",
    chapterId: "zz-route-ch01",
    number: 1,
    title: "Deliberate Practice",
    quiz: {
      passingScorePercent: 70,
      questions: [
        { questionId: "q01", prompt: "Q1?", choices: ["Right move.", "Wrong move.", "Other move."], correctIndex: 0, explanation: "Because the mechanism says so at length." },
        { questionId: "q02", prompt: "Q2?", choices: ["A.", "B is right.", "C."], correctIndex: 1, explanation: "Because the deep read grounds it mechanically." },
      ],
    },
  } as unknown as ChapterV21;
}

test("WP-301 (d): author-repair routes through the policy — no explicit pin → routine-repair cell, tier normal-profile", async () => {
  const spawns: SpawnCapture[] = [];
  const files = new Map<number, string>([[1, JSON.stringify(mkRepairChapter(), null, 2) + "\n"]]);
  const deps = {
    runVerb: async () => ({ code: 0, stdout: "", stderr: "" }),
    spawn: (async (o: { sessionId: string; cwd?: string; role?: string; model?: string; reasoningEffort?: string }) => {
      spawns.push({ role: o.role, model: o.model, reasoningEffort: o.reasoningEffort });
      if (o.cwd) writeFileSync(join(o.cwd, "patch.json"), JSON.stringify({ schema: "chapter-patch-v1" }, null, 2) + "\n");
      return { ok: true, exitCode: 0, finalMessage: "done", stdout: "", stderr: "", durationMs: 1, sessionId: o.sessionId };
    }) as unknown as AutopilotDeps["spawn"],
    mkSessionId: (label: string) => label,
    expectedChapterNumbers: () => [1],
    logSession: () => {},
    log: () => {},
  } as unknown as AutopilotDeps;
  const io = resolveAuthorIo({
    chapterExists: (_b, n) => files.has(n),
    readChapterFile: (_b, n) => files.get(n) ?? null,
    writeChapterFile: (_b, n, bytes) => { files.set(n, bytes); },
    removeChapterFile: (_b, n) => { files.delete(n); },
    readBriefMd: () => "# brief\n",
    readBrief: () => null,
    readPacket: () => null,
    readSourcePlan: () => null,
    loadChapters: () => [JSON.parse(files.get(1)!)],
    nameBankOk: () => true,
    voiceCard: () => null,
    authorSessionOf: () => undefined,
    recordProvenance: () => {},
    readLeadOverride: () => null,
    writeLeadOverride: () => {},
    attemptsRoot: () => join(TMP, "attempts-repair"),
    gateCandidate: async () => ({ code: 0, stdout: "Gate verdict: PASS — 0 blockers", stderr: "" }),
    rubricWithCandidate: async () => ({ code: 0, stdout: "ch01: PASS", stderr: "" }),
  });
  // The stub patch is later rejected (that is fine) — the repair SPAWN runs first
  // and is what we capture. (a source-blind legacy path: readSourcePlan → null.)
  await doRepairOneChapter("zz-route", 1, deps, { io, scopes: ["quiz"], complaints: ["quiz Q2: the key echoes the prose"] });
  assert.ok(spawns.length >= 1, "the repair spawned");
  for (const s of spawns) {
    assert.equal(s.role, "author-repair", "the repair spawn uses the author-repair role");
    assert.equal(s.model, undefined, "repair passes NO explicit model — the routine-repair cell decides");
    assert.equal(s.reasoningEffort, undefined, "repair passes NO explicit effort — the routine-repair cell decides");
    const sidecar = resolveRoute({ role: "author-repair", requestedModel: s.model, requestedEffort: s.reasoningEffort });
    assert.equal(sidecar.taskClass, "routine-repair");
    assert.equal(sidecar.model, "gpt-5.6-sol");
    assert.equal(sidecar.effort, "xhigh");
    assert.equal(sidecar.tier, "normal-profile", "production repair is recorded as normal-profile, NOT call-explicit");
  }
});

// ── (e) fail-closed ───────────────────────────────────────────────────────────

test("WP-301 (e): an invalid resolved effort fails closed via RoutePreflightError — no silent fallback", async () => {
  // Unit: the central authority refuses an out-of-union effort.
  assert.throws(
    () => resolveRoute({ role: "author-writer", requestedEffort: "bogus" }),
    RoutePreflightError,
    "resolveRoute refuses an invalid effort",
  );
  // End-to-end: a write handed an invalid effort fails closed (rejects) rather
  // than silently falling back to a default model/effort.
  const rig = mkWriteRig();
  await assert.rejects(
    () => authorWriteOneChapter("zz-route", 1, rig.deps, { io: rig.io, totalChapters: 2, effort: "bogus" as never }),
    RoutePreflightError,
    "the author write fails closed on an invalid effort",
  );
  assert.equal(rig.spawns.length, 0, "no spawn ran — the route was refused before any provider call");
});
