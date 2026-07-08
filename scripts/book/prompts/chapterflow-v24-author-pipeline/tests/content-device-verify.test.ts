/**
 * Device-verify repair driver (Prompt 2) — diversifyOne + doContentDeviceRepair.
 *
 * Proves the honest-compliance contract:
 *   - a re-authored draft that CLEARS review but still uses a banned device is
 *     REVERTED with a distinct `devices-persisted` status, never a fake success;
 *   - prior bytes are restored byte-identically; the grant is consumed exactly once
 *     (a persisted-device revert does NOT refund it);
 *   - a compliant draft that introduces a NEW non-banned device is KEPT, with the
 *     substitution recorded (balloon-effect telemetry, never a revert);
 *   - the existing below-band quality revert still works and is distinguishable.
 *
 * All writer/reviewer calls are STUBS — no live model generation (per the prompt).
 */

import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { test } from "./harness.js";
import type { ChapterV21 } from "../src/types.js";
import type { ChapterReviewV1 } from "../src/artifacts/artifactTypes.js";
import type { AutopilotDeps } from "../src/orchestrator/autopilot.js";
import {
  diversifyOne,
  doContentDeviceRepair,
  type DiversifyCtx,
  type WriteChapterFn,
} from "../src/orchestrator/bookSamenessRun.js";
import { authorChapterId, resolveAuthorIo, type AuthorWriteOneResult } from "../src/orchestrator/authorRun.js";
import { resolveAuthorReviewIo } from "../src/orchestrator/authorReview.js";
import { chapterFileName } from "../src/lib/chapterPaths.js";
import { chapterBriefPath, sourcePacketPath } from "../src/artifacts/artifactStore.js";
import { chapterContentHash } from "../src/critics/qcAttestation.js";
import { loadAuthorProvenance, provenancePath, recordAuthorProvenance } from "../src/qc/sessionProvenance.js";
import {
  loadAuthorRegenLedger,
  contentRepairConsumedFor,
  computeRegenLineage,
} from "../src/orchestrator/authorRegenLedger.js";

const BOOK = "zz-fixture-device-verify";
const BAR = 80;
const RETURN_PROOF = "The proof has to come back before you trust it.";
const SECOND_SETTING = "A second company tried the same move and it worked again.";

const DEPS = { log: () => {} } as unknown as AutopilotDeps;

/** A minimal on-disk chapter; `deviceText` (in the body) trips exactly one detector. */
function chJson(n: number, deviceText = ""): Record<string, unknown> {
  return {
    number: n,
    hook: "A team faced a plain choice one quiet afternoon.",
    counterintuition: "The obvious read misleads.",
    keyTakeaway: `Lesson ${n}: do the work and learn from it. ${deviceText}`.trim(),
    breakdown: { fastRead: "The team acts.", deepRead: "The idea unfolds cleanly.", fullRead: "One point, followed through." },
    examples: [],
    reviewCards: [],
    quiz: { passingScorePercent: 70, questions: [] },
    memorableLines: [],
    implementationPlan: { weeklyPractice: "Practice the move." },
  };
}

/** A tmp state root with an injectable chapter dir + lineage artifacts, plus the
 *  ctx factory the driver uses. Returns everything a test needs. */
function makeHarness(chapterNumbers: number[]) {
  const root = mkdtempSync(join(tmpdir(), "device-verify-"));
  const chaptersDir = resolve(root, "chapters");
  mkdirSync(chaptersDir, { recursive: true });
  const pathFor = (bookId: string, n: number) => resolve(chaptersDir, chapterFileName(authorChapterId(bookId, n)));
  const loadChapters = (): ChapterV21[] =>
    readdirSync(chaptersDir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => JSON.parse(readFileSync(resolve(chaptersDir, f), "utf8")) as ChapterV21);
  // Seed brief + packet so computeRegenLineage is non-null (the grant is counted).
  for (const n of chapterNumbers) {
    for (const p of [chapterBriefPath(BOOK, n, { stateRoot: root }), sourcePacketPath(BOOK, n, { stateRoot: root })]) {
      writeFileSync(p, "{}\n");
    }
    assert.ok(computeRegenLineage(BOOK, n, root) != null, `lineage computable for ch${n}`);
  }
  const io = resolveAuthorIo({ loadChapters, chapterExists: (_b, n) => existsSync(pathFor(BOOK, n)) });
  const reviewIo = resolveAuthorReviewIo({ loadChapters });
  const passReview: DiversifyCtx["reviewChapter"] = async () =>
    ({ composite: 88, ship84: true, pass: true, valid: true, keyCheck: { matches: 9, of: 9 }, complaints: [] } as unknown as ChapterReviewV1);
  const failReview: DiversifyCtx["reviewChapter"] = async () =>
    ({ composite: 60, ship84: false, pass: false, valid: true, keyCheck: { matches: 9, of: 9 }, complaints: [] } as unknown as ChapterReviewV1);
  const ctx = (over: Partial<DiversifyCtx>): DiversifyCtx => ({
    io, reviewIo, bar: BAR, lane: "content", ledgerRoot: root, chapterPathFor: pathFor,
    writeChapter: async () => ({ ok: true, sessionId: "stub" } as AuthorWriteOneResult),
    reviewChapter: passReview,
    ...over,
  });
  const writeChapterFile = (n: number, body: string) => writeFileSync(pathFor(BOOK, n), body);
  return { root, chaptersDir, pathFor, loadChapters, io, reviewIo, passReview, failReview, ctx, writeChapterFile,
    cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

/** A writer stub that overwrites the chapter file with `draft` and reports ok. */
function stubWriter(pathFor: (b: string, n: number) => string, draftFor: (n: number) => Record<string, unknown>): WriteChapterFn {
  return async (bookId, n) => {
    writeFileSync(pathFor(bookId, n), JSON.stringify(draftFor(n)));
    return { ok: true, sessionId: "stub" };
  };
}

test("diversifyOne: a draft that clears review but KEEPS a banned device → devices-persisted, prior bytes restored, grant consumed once", async () => {
  const h = makeHarness([3]);
  try {
    const priorBytes = JSON.stringify(chJson(3)); // clean of the banned device
    h.writeChapterFile(3, priorBytes);
    const lineage = computeRegenLineage(BOOK, 3, h.root)!;

    const outcome = await diversifyOne(
      BOOK,
      { chapterNumber: 3, directive: "drop the return-proof device", label: "content-deal", bannedDevices: ["return-proof"] },
      DEPS,
      h.ctx({ writeChapter: stubWriter(h.pathFor, () => chJson(3, RETURN_PROOF)) }), // writer does NOT comply
    );

    assert.equal(outcome.status, "devices-persisted", "a still-present banned device reverts with the distinct status");
    assert.deepEqual(outcome.persistedDevices, ["return-proof"], "names the persisted device");
    assert.deepEqual(outcome.substitutedDevices, [], "nothing substituted");
    // Prior bytes restored byte-identically.
    assert.equal(readFileSync(h.pathFor(BOOK, 3), "utf8"), priorBytes, "prior bytes restored exactly");
    // Grant consumed EXACTLY once — the revert does not refund it.
    assert.equal(contentRepairConsumedFor(loadAuthorRegenLedger(BOOK, h.root), 3, lineage), 1, "grant spent once");
  } finally { h.cleanup(); }
});

test("diversifyOne (R2): a devices-persisted revert rolls author provenance back to the restored bytes' true author", async () => {
  const h = makeHarness([3]);
  const chapterId = authorChapterId(BOOK, 3);
  try {
    const priorObj = chJson(3);                       // the restored (prior passing) bytes
    const discardedObj = chJson(3, RETURN_PROOF);     // the discarded re-author (keeps the banned device)
    const hashPrior = chapterContentHash(priorObj as unknown as ChapterV21);
    const hashDiscarded = chapterContentHash(discardedObj as unknown as ChapterV21);
    assert.notEqual(hashPrior, hashDiscarded, "fixture sanity: the two drafts hash differently");

    h.writeChapterFile(3, JSON.stringify(priorObj));
    // Seed the STALE record the re-author would leave behind: content bound to the
    // DISCARDED draft (session-B), with the prior author (session-A) recorded in the
    // transition. This is exactly what recordAuthorProvenance stamps on a re-author.
    recordAuthorProvenance(chapterId, "author-session-A", hashPrior);
    recordAuthorProvenance(chapterId, "reauthor-session-B", hashDiscarded);
    assert.equal(loadAuthorProvenance(chapterId)?.authorSessionId, "reauthor-session-B", "precondition: record points at the discarded draft");

    const outcome = await diversifyOne(
      BOOK,
      { chapterNumber: 3, directive: "drop the return-proof device", label: "content-deal", bannedDevices: ["return-proof"] },
      DEPS,
      h.ctx({ writeChapter: stubWriter(h.pathFor, () => discardedObj) }), // writer does NOT comply → devices-persisted revert
    );

    assert.equal(outcome.status, "devices-persisted", "the persisted banned device reverts");
    const rec = loadAuthorProvenance(chapterId);
    assert.equal(rec?.contentHash, hashPrior, "provenance content hash rolled back to the restored bytes");
    assert.equal(rec?.authorSessionId, "author-session-A", "provenance author rolled back to the true prior author");
  } finally {
    rmSync(provenancePath(chapterId), { force: true });
    h.cleanup();
  }
});

test("diversifyOne: a draft that sheds the banned device but adds a NEW non-banned device → kept, substitution recorded (no revert)", async () => {
  const h = makeHarness([3]);
  try {
    h.writeChapterFile(3, JSON.stringify(chJson(3, RETURN_PROOF))); // prior USES the banned device
    const outcome = await diversifyOne(
      BOOK,
      { chapterNumber: 3, directive: "drop the return-proof device", label: "content-deal", bannedDevices: ["return-proof"] },
      DEPS,
      h.ctx({ writeChapter: stubWriter(h.pathFor, () => chJson(3, SECOND_SETTING)) }), // sheds return-proof, adds second-setting
    );
    assert.equal(outcome.status, "diversified", "shedding the banned device is a success even with a substitution");
    assert.deepEqual(outcome.persistedDevices, [], "the banned device is gone");
    assert.deepEqual(outcome.substitutedDevices, ["second-setting"], "the NEW non-banned device is recorded as substitution");
    // The kept draft's bytes stay on disk (not reverted).
    const onDisk = JSON.parse(readFileSync(h.pathFor(BOOK, 3), "utf8")) as ChapterV21;
    assert.ok(String(onDisk.keyTakeaway).includes("second company"), "the fresh draft is kept");
  } finally { h.cleanup(); }
});

test("diversifyOne: a below-band draft still reverts as `reverted` (quality), distinct from devices-persisted", async () => {
  const h = makeHarness([3]);
  try {
    const priorBytes = JSON.stringify(chJson(3));
    h.writeChapterFile(3, priorBytes);
    const outcome = await diversifyOne(
      BOOK,
      { chapterNumber: 3, directive: "drop the return-proof device", label: "content-deal", bannedDevices: ["return-proof"] },
      DEPS,
      // Draft also keeps a banned device, but quality FAILS FIRST → reverted (not devices-persisted).
      h.ctx({ writeChapter: stubWriter(h.pathFor, () => chJson(3, RETURN_PROOF)), reviewChapter: h.failReview }),
    );
    assert.equal(outcome.status, "reverted", "below-band composite reverts on quality");
    assert.notEqual(outcome.status, "devices-persisted", "quality revert is a distinct status");
    assert.equal(readFileSync(h.pathFor(BOOK, 3), "utf8"), priorBytes, "prior bytes restored");
  } finally { h.cleanup(); }
});

test("doContentDeviceRepair: 4-ch fixture, writer complies on ch1/ch2 but not ch3 → 2 kept, 1 devices-persisted, preserved byte-stable", async () => {
  const h = makeHarness([1, 2, 3, 4]);
  try {
    // Every chapter uses return-proof → over the ubiquity cap (present 4/4). ch4 is preserved.
    for (const n of [1, 2, 3, 4]) h.writeChapterFile(n, JSON.stringify(chJson(n, RETURN_PROOF)));
    const ch4Before = readFileSync(h.pathFor(BOOK, 4), "utf8");

    // Writer: ch1/ch2 shed the banned devices (clean); ch3 keeps return-proof.
    const writer: WriteChapterFn = async (bookId, n) => {
      const draft = n === 3 ? chJson(n, RETURN_PROOF) : chJson(n); // ch3 does NOT comply
      writeFileSync(h.pathFor(bookId, n), JSON.stringify(draft));
      return { ok: true, sessionId: "stub" };
    };

    const result = await doContentDeviceRepair(BOOK, DEPS, {
      io: { loadChapters: h.loadChapters, chapterExists: (_b, n) => existsSync(h.pathFor(BOOK, n)) },
      ledgerRoot: h.root,
      chapterPathFor: h.pathFor,
      onlyChapters: [1, 2, 3],       // force exactly these targets, preserve ch4
      preserveChapters: [4],
      writeChapter: writer,
      reviewChapter: async () => ({ composite: 88, ship84: true, pass: true, valid: true, keyCheck: { matches: 9, of: 9 }, complaints: [] } as unknown as ChapterReviewV1),
    });

    assert.ok(result.fired, "repair fired");
    const byCh = new Map(result.outcomes.map((o) => [o.chapterNumber, o.status]));
    assert.equal(byCh.get(1), "diversified", "ch1 kept-and-clean");
    assert.equal(byCh.get(2), "diversified", "ch2 kept-and-clean");
    assert.equal(byCh.get(3), "devices-persisted", "ch3 reverted for a persisted banned device");
    assert.equal(result.outcomes.filter((o) => o.status === "diversified").length, 2, "exactly 2 kept");
    assert.equal(result.outcomes.filter((o) => o.status === "devices-persisted").length, 1, "exactly 1 devices-persisted");
    // ch3 reverted to its original bytes; ch4 (preserved) byte-stable; no preserved violations.
    assert.deepEqual(result.preservedViolations, [], "no preserved-chapter violation");
    assert.equal(readFileSync(h.pathFor(BOOK, 4), "utf8"), ch4Before, "preserved ch4 byte-stable");
    assert.ok(String((JSON.parse(readFileSync(h.pathFor(BOOK, 3), "utf8")) as ChapterV21).keyTakeaway).includes("come back"), "ch3 restored to its prior (return-proof) bytes");
  } finally { h.cleanup(); }
});
