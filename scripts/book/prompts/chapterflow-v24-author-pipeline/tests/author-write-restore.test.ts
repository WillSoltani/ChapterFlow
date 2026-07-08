/**
 * F-2 — failed-write draft restore/removal fixtures (fresh-gold live finding,
 * 2026-07-08).
 *
 * The bug these pin: writer sessions land their draft on disk BEFORE the
 * gate/rubric/contract self-checks in authorWriteOneChapter — a fully-failed call
 * used to leave that UNREVIEWED failing draft in place. Live consequence:
 * high-output-management ch14's 87-composite original was overwritten by a
 * lead-contract-failing draft and LOST (disk hash 553e81ec… vs the review-bound
 * 3d10c422…). The fix snapshots the pre-write bytes and, on total failure,
 * restores them byte-for-byte (or removes the orphan when no chapter existed).
 *
 * The review-lane call-site restore (prior review pointer + provenance) is pinned
 * in author-arch.test.ts next to the acceptance-lane R2 tests — it needs that
 * file's real-file doAuthorReview harness.
 *
 * All io here is in-memory (injectable AuthorIo hooks) — no real state/ writes.
 */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import {
  AUTHOR_WRITE_GATE_RETRIES,
  authorWriteOneChapter,
  type AuthorIo,
} from "../src/orchestrator/authorRun.js";
import type { AutopilotDeps } from "../src/orchestrator/autopilot.js";
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

type Rig = {
  deps: AutopilotDeps;
  logs: string[];
  io: Partial<AuthorIo>;
  files: Map<number, string>;
  writes: string[];   // bytes passed through io.writeChapterFile (the RESTORE path)
  removed: number[];  // chapters passed through io.removeChapterFile
};

function mkRig(opts: {
  n: number;
  priorBytes?: string;
  draftBytes: string;
  writeThrows?: boolean;
}): Rig {
  const logs: string[] = [];
  const files = new Map<number, string>();
  const writes: string[] = [];
  const removed: number[] = [];
  if (opts.priorBytes !== undefined) files.set(opts.n, opts.priorBytes);
  let sid = 0;
  const deps = {
    // The gate blocks EVERY attempt — the total-failure path is the subject here.
    runVerb: async (args: string[]) => args[0] === "gate-chapter"
      ? { code: 1, stdout: "[BLOCKER A12] ch: lowercase sentence boundary", stderr: "" }
      : { code: 0, stdout: "", stderr: "" },
    // The writer stub LANDS its draft (exactly like the real session writes the
    // file before any self-check runs) — deliberately NOT via io.writeChapterFile,
    // so any writeChapterFile call below is provably the restore.
    spawn: (async (o: { sessionId: string }) => {
      files.set(opts.n, opts.draftBytes);
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
  };
  return { deps, logs, io, files, writes, removed };
}

const PRIOR = JSON.stringify({ chapterId: "zz-write-restore-ch01", number: 1, title: "The reviewed original" }) + "\n";
const DRAFT = JSON.stringify({ chapterId: "zz-write-restore-ch01", number: 1, title: "A failing draft that must not survive" }) + "\n";

test("F-2 (a): a fully-failed MISSING-chapter write leaves NO file behind — the orphan draft is removed, loudly", async () => {
  const rig = mkRig({ n: 1, draftBytes: DRAFT });
  const r = await authorWriteOneChapter("zz-write-restore", 1, rig.deps, { io: rig.io, totalChapters: 2 });
  assert.ok(!r.ok, "fails closed");
  if (!r.ok) assert.match(r.reason, /A12/, "the real failure reason survives");
  assert.equal(rig.files.has(1), false, "no orphan draft on disk — the next entry must re-WRITE, not review");
  assert.deepEqual(rig.removed, [1], "removed via the io hook");
  assert.ok(rig.logs.some((l) => l.includes("removed the unreviewed failed draft")), "loud removal log");
});

test("F-2 (b): a fully-failed EXISTING-chapter regen restores the prior bytes BYTE-FOR-BYTE (draft differs — restore is provable)", async () => {
  assert.notEqual(PRIOR, DRAFT, "precondition: the draft differs from the prior bytes");
  const rig = mkRig({ n: 1, priorBytes: PRIOR, draftBytes: DRAFT });
  const r = await authorWriteOneChapter("zz-write-restore", 1, rig.deps, {
    io: rig.io, totalChapters: 2,
    complaints: ["reader complaint: the hook is generic"], // regen semantics
  });
  assert.ok(!r.ok, "fails closed");
  assert.equal(rig.files.get(1), PRIOR, "disk holds the prior reviewed bytes, byte-identical");
  assert.deepEqual(rig.writes, [PRIOR], "exactly one restore write, with the snapshot bytes");
  assert.ok(rig.logs.some((l) => l.includes("restored the pre-write chapter bytes")), "loud restore log");
  assert.deepEqual(rig.removed, [], "an existing chapter is never removed");
});

test("F-2 (b) guard: a failed call whose writer never changed the bytes does NOT rewrite the file (no spurious restore)", async () => {
  const rig = mkRig({ n: 1, priorBytes: PRIOR, draftBytes: PRIOR }); // writer lands identical bytes
  const r = await authorWriteOneChapter("zz-write-restore", 1, rig.deps, { io: rig.io, totalChapters: 2 });
  assert.ok(!r.ok);
  assert.deepEqual(rig.writes, [], "bytes already match the snapshot — nothing to restore");
  assert.equal(rig.files.get(1), PRIOR);
});

test("F-2 (d): a cleanup error during restore NEVER masks the real failure reason — it logs and returns the original failure", async () => {
  const rig = mkRig({ n: 1, priorBytes: PRIOR, draftBytes: DRAFT, writeThrows: true });
  const r = await authorWriteOneChapter("zz-write-restore", 1, rig.deps, { io: rig.io, totalChapters: 2 });
  assert.ok(!r.ok, "fails closed");
  if (!r.ok) {
    assert.match(r.reason, /A12/, "the ORIGINAL gate failure is the returned reason");
    assert.doesNotMatch(r.reason, /EACCES/, "the cleanup error does not replace it");
  }
  assert.ok(rig.logs.some((l) => l.includes("write-failure cleanup itself failed") && l.includes("EACCES")), "the cleanup failure is loudly logged with its own error");
  assert.equal(rig.files.get(1), DRAFT, "honest state: disk still holds the failed draft (the log said so)");
});
