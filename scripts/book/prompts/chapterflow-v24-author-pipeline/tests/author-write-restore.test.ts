/**
 * F-2 — canonical-safety fixtures for failed author writes.
 *
 * HISTORY: these originally pinned the 2026-07-08 restore lane (writer sessions
 * landed drafts at the CANONICAL path before self-checks; a fully-failed call
 * restored the pre-write bytes / removed the orphan). IMP-01 (GPT-5.6 SOL
 * migration, F-001/F-020) made that lane structurally unnecessary: the writer
 * only ever writes a CANDIDATE inside an isolated attempt workspace, and the
 * canonical path changes ONLY via a validated compare-and-swap commit. The
 * live consequence these guard against is unchanged (high-output-management
 * ch14: an 87-composite original overwritten by a failing draft and LOST) —
 * the guarantee is now stronger: a failed call performs ZERO canonical writes,
 * so there is nothing to restore and no cleanup that can itself fail.
 *
 * All io here is in-memory (injectable AuthorIo hooks) + a tmp attempts root —
 * no real state/ writes.
 */

import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { test } from "./harness.js";
import {
  authorWriteOneChapter,
  type AuthorIo,
} from "../src/orchestrator/authorRun.js";
import type { AutopilotDeps } from "../src/orchestrator/autopilot.js";
import { chapterFileName } from "../src/lib/chapterPaths.js";
import { CHAPTER_BRIEF_SCHEMA_VERSION, type ChapterBriefV1, type SourcePacketV1 } from "../src/artifacts/artifactTypes.js";

// A packet is only projected into the card here (the gate fails before any
// contract check reads it) — minimal is fine and keeps the fixture self-owned.
const PACKET = { facts: [], allowedNumbers: [] } as unknown as SourcePacketV1;

function mkBrief(n: number): ChapterBriefV1 {
  return {
    schemaVersion: CHAPTER_BRIEF_SCHEMA_VERSION,
    chapterId: `zz-write-restore-ch${String(n).padStart(2, "0")}`,
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

const TMP = mkdtempSync(join(tmpdir(), "author-write-restore-"));

type Rig = {
  deps: AutopilotDeps;
  logs: string[];
  io: Partial<AuthorIo>;
  files: Map<number, string>;
  writes: string[];   // bytes passed through io.writeChapterFile (the COMMIT path — the only canonical writer)
  removed: number[];  // chapters passed through io.removeChapterFile (must stay empty)
};

function mkRig(opts: {
  n: number;
  priorBytes?: string;
  draftBytes: string;
  gatePasses?: boolean;
  writeThrows?: boolean;
}): Rig {
  const logs: string[] = [];
  const files = new Map<number, string>();
  const writes: string[] = [];
  const removed: number[] = [];
  if (opts.priorBytes !== undefined) files.set(opts.n, opts.priorBytes);
  let sid = 0;
  const deps = {
    runVerb: async () => ({ code: 0, stdout: "", stderr: "" }),
    // IMP-01: the writer stub lands its draft as the CANDIDATE in the attempt
    // workspace (the spawn's cwd) — it has no path to the canonical store at all.
    spawn: (async (o: { sessionId: string; cwd?: string }) => {
      if (o.cwd) writeFileSync(join(o.cwd, chapterFileName(`zz-write-restore-ch${String(opts.n).padStart(2, "0")}`)), opts.draftBytes);
      return { ok: true, exitCode: 0, finalMessage: "done", stdout: "", stderr: "", durationMs: 1, sessionId: o.sessionId };
    }) as unknown as AutopilotDeps["spawn"],
    mkSessionId: (label: string) => `${label}#${++sid}`,
    expectedChapterNumbers: () => [opts.n],
    logSession: () => {},
    log: (m: string) => { logs.push(m); },
  } as unknown as AutopilotDeps;
  const io: Partial<AuthorIo> = {
    chapterExists: (_b, n) => files.has(n),
    readChapterFile: (_b, n) => files.get(n) ?? null,
    writeChapterFile: (_b, n, bytes) => {
      if (opts.writeThrows) throw new Error("EACCES: fixture write failure");
      writes.push(bytes);
      files.set(n, bytes);
    },
    removeChapterFile: (_b, n) => { removed.push(n); files.delete(n); },
    readBriefMd: () => "# brief\n",
    readBrief: () => mkBrief(opts.n),
    readPacket: () => PACKET,
    loadChapters: () => [...files.values()].map((f) => JSON.parse(f)),
    nameBankOk: () => true,
    voiceCard: () => null,
    authorSessionOf: () => undefined,
    recordProvenance: () => {},
    readLeadOverride: () => null,
    writeLeadOverride: () => {},
    attemptsRoot: () => join(TMP, "attempts"),
    gateCandidate: async () => opts.gatePasses
      ? { code: 0, stdout: "Gate verdict: PASS — 0 blockers", stderr: "" }
      : { code: 1, stdout: "[BLOCKER A12] ch: lowercase sentence boundary", stderr: "" },
    rubricWithCandidate: async () => ({ code: 0, stdout: "", stderr: "" }),
  };
  return { deps, logs, io, files, writes, removed };
}

const PRIOR = JSON.stringify({ chapterId: "zz-write-restore-ch01", number: 1, title: "The reviewed original" }) + "\n";
const DRAFT = JSON.stringify({ chapterId: "zz-write-restore-ch01", number: 1, title: "A failing draft that must not survive" }) + "\n";

test("F-2 (a): a fully-failed MISSING-chapter write leaves NO file behind — no candidate ever reaches canonical", async () => {
  const rig = mkRig({ n: 1, draftBytes: DRAFT });
  const r = await authorWriteOneChapter("zz-write-restore", 1, rig.deps, { io: rig.io, totalChapters: 2 });
  assert.ok(!r.ok, "fails closed");
  if (!r.ok) assert.match(r.reason, /A12/, "the real failure reason survives");
  assert.equal(rig.files.has(1), false, "no orphan draft on disk — the next entry must re-WRITE, not review");
  assert.deepEqual(rig.writes, [], "zero canonical writes — the candidate lived and died in its workspace");
  assert.deepEqual(rig.removed, [], "nothing to remove either (nothing was ever created)");
  assert.ok(rig.logs.some((l) => l.includes("canonical bytes untouched")), "loud canonical-untouched log");
});

test("F-2 (b): a fully-failed EXISTING-chapter regen leaves the prior bytes UNTOUCHED byte-for-byte (no restore needed — nothing was written)", async () => {
  assert.notEqual(PRIOR, DRAFT, "precondition: the draft differs from the prior bytes");
  const rig = mkRig({ n: 1, priorBytes: PRIOR, draftBytes: DRAFT });
  const r = await authorWriteOneChapter("zz-write-restore", 1, rig.deps, {
    io: rig.io, totalChapters: 2,
    complaints: ["reader complaint: the hook is generic"], // regen semantics
  });
  assert.ok(!r.ok, "fails closed");
  assert.equal(rig.files.get(1), PRIOR, "disk holds the prior reviewed bytes, byte-identical");
  assert.deepEqual(rig.writes, [], "ZERO canonical writes — stronger than the old restore (no window at all)");
  assert.deepEqual(rig.removed, [], "an existing chapter is never removed");
});

test("F-2 (b) guard: a failed call whose writer landed identical bytes still performs zero canonical writes", async () => {
  const rig = mkRig({ n: 1, priorBytes: PRIOR, draftBytes: PRIOR }); // writer lands identical bytes
  const r = await authorWriteOneChapter("zz-write-restore", 1, rig.deps, { io: rig.io, totalChapters: 2 });
  assert.ok(!r.ok);
  assert.deepEqual(rig.writes, [], "no canonical write on any failure path");
  assert.equal(rig.files.get(1), PRIOR);
});

test("F-2 (d): a COMMIT-write failure throws (infra) and the prior canonical bytes survive — never a silent divergence", async () => {
  // gatePasses → the flow reaches the compare-and-swap commit, whose canonical
  // write THROWS. That must escape as an infrastructure error (the conductor's
  // halt taxonomy owns it) — and the canonical store must be exactly as before.
  const rig = mkRig({ n: 1, priorBytes: PRIOR, draftBytes: DRAFT, gatePasses: true, writeThrows: true });
  await assert.rejects(
    authorWriteOneChapter("zz-write-restore", 1, rig.deps, { io: rig.io, totalChapters: 2 }),
    /EACCES/,
    "a commit-write failure is an infrastructure error, never a swallowed content failure",
  );
  assert.equal(rig.files.get(1), PRIOR, "the prior reviewed bytes survive a failed commit write");
});
