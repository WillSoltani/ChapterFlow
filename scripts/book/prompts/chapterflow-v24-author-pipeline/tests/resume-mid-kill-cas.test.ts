/**
 * WP-103 — run-state/resume audit + mid-kill CAS integration test.
 *
 * Proves two things about the author-first run-state seam:
 *
 *  1. Killing a book run mid-chapter never corrupts canonical bytes. The
 *     kill windows inside `commitChapterCandidate` (chapterTransaction.ts:303)
 *     are simulated via MANIFEST-STATE INJECTION (never a real signal, never a
 *     sleep-until-pass) — writing exactly the on-disk artifacts a real SIGKILL
 *     at that instant would leave, then asserting `recoverIncompleteCommits`
 *     resolves deterministically and canonical bytes are never lost or
 *     silently rolled back.
 *  2. Resume re-authors EXACTLY the missing chapters and nothing else: a run
 *     over a book with N-1 CAS-committed chapters and 1 missing chapter calls
 *     the writer for the missing chapter only, and the committed chapters'
 *     bytes are hash-stable (byte-for-byte unchanged) across the resumed run
 *     (`doAuthorWrite`'s `missing = expected.filter(n => !io.chapterExists(...))`,
 *     authorRun.ts:1712).
 *
 * `injectMidKillManifest` below is a small reusable interrupt harness — WP-601
 * names this file as the resume interrupt harness its SIGKILL-mid-chapter
 * terminal-command test reuses.
 *
 * AUDIT FINDING (no source defect): `io.chapterExists` is a plain
 * `existsSync` check against the canonical path (authorRun.ts:205-206), and
 * every canonical write goes through the atomic tmp+rename primitive
 * (`writeFileAtomic`) — so canonical is either absent, the fully-written PRIOR
 * file, or the fully-written NEW file; a torn/partial file is unreachable by
 * construction (the existing static scan in chapter-transaction.test.ts pins
 * "exactly one canonical write site, and it is the atomic primitive"). Given
 * that invariant, the missing-chapter predicate is correct: "exists" can never
 * mean "half-written". No resume-predicate defect found; no source edit made.
 *
 * The v23 compiler's `generateChapter` cache-resume path (generateBook.ts /
 * generateChapter.ts) is a SEPARATE resume mechanism (existsSync + a
 * stage-cache manifest, not the CAS protocol) that this WP does not audit
 * further: the target architecture (master plan §5) retires the legacy/
 * compiler path from the ship path, and its removal is WP-207's scope, not
 * this WP's (out of scope: "changing the default architecture (WP-201)").
 *
 * All state is in-memory (injectable io) + a tmp attempts root — no real
 * state/ writes: the reader-budget check receives a briefLookup built on the
 * injected io (WP-103 red-team NOTE 1 fix), so the CHB6 opener check never
 * touches the canonical artifact store. No dependency on WP-201 (author-first
 * is exercised here exactly as it runs today, default-flip or not).
 */

import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { test } from "./harness.js";
import { TMP_DIR } from "./helpers.js";
import {
  commitChapterCandidate,
  finalizeAttempt,
  importCandidate,
  mintChapterAttempt,
  recoverIncompleteCommits,
  type ChapterAttempt,
  type ChapterCanonicalIo,
} from "../src/orchestrator/chapterTransaction.js";
import { sha256Hex } from "../src/contracts/contractUtil.js";
import {
  doAuthorWrite,
  type AuthorIo,
} from "../src/orchestrator/authorRun.js";
import type { AutopilotDeps } from "../src/orchestrator/autopilot.js";
import type { ChapterV21 } from "../src/types.js";
import type { ChapterBriefV1, SourcePacketV1 } from "../src/artifacts/artifactTypes.js";
import { CHAPTER_BRIEF_SCHEMA_VERSION } from "../src/artifacts/artifactTypes.js";
import { estimatedRenderedChars } from "../src/critics/readerBudgets.js";

// ── shared in-memory rig (mirrors tests/chapter-transaction.test.ts's `rig`) ──

let seq = 0;
function rig(bookId: string): { io: ChapterCanonicalIo & { bytes: Map<string, string> }; root: string } {
  const bytes = new Map<string, string>();
  const root = join(TMP_DIR, `resume-mid-kill-${process.pid}-${seq++}`);
  return {
    root,
    io: {
      bytes,
      readChapterFile: (b, n) => bytes.get(`${b}:${n}`) ?? null,
      writeChapterFile: (b, n, v) => { bytes.set(`${b}:${n}`, v); },
    },
  };
}

function mint(io: ChapterCanonicalIo, root: string, bookId: string, chapterNumber: number): ChapterAttempt {
  const nn = String(chapterNumber).padStart(2, "0");
  return mintChapterAttempt({
    bookId,
    chapterNumber,
    chapterId: `${bookId}-ch${nn}`,
    attemptKind: "author-initial",
    attemptSequence: 1,
    promptSha256: "p".repeat(64),
    io,
    attemptsRoot: root,
  });
}

function readManifest(attempt: ChapterAttempt): Record<string, unknown> {
  return JSON.parse(readFileSync(join(attempt.attemptDir, "commit-manifest.json"), "utf8")) as Record<string, unknown>;
}

// ── reusable interrupt harness (WP-601 reuses this for its resume test) ──────

export type KillWindow =
  /** Crash BEFORE the canonical rename lands (pending manifest only). */
  | "before_canonical_write"
  /** Crash AFTER the canonical rename lands but BEFORE the bracket closes
   *  (the manifest never flips from "pending" to "committed"). */
  | "after_canonical_write_before_bracket_close"
  /** Crash while a required-evidence bracket is open (canonical landed;
   *  companion provenance/lead-override not yet durable/read-back). */
  | "pending_required_evidence_bracket_open";

/**
 * Simulate a conductor crash at a named point inside `commitChapterCandidate`'s
 * bracket (chapterTransaction.ts:303) by writing exactly the on-disk artifacts
 * a real SIGKILL at that instant would leave — never a real signal, never a
 * sleep-until-pass (WP-103 instruction 4). Mirrors `buildCommitManifest`'s
 * shape exactly (chapterTransaction.ts:589-608).
 */
export function injectMidKillManifest(args: {
  attempt: ChapterAttempt;
  io: ChapterCanonicalIo;
  bookId: string;
  chapterNumber: number;
  previousSha256: string | null;
  committedBytes: string;
  window: KillWindow;
}): { manifestPath: string; committedSha256: string } {
  const { attempt, io, bookId, chapterNumber, previousSha256, committedBytes, window } = args;
  const committedSha256 = sha256Hex(committedBytes);
  const phase = window === "pending_required_evidence_bracket_open" ? "pending_required_evidence" : "pending";
  const manifest = {
    schema: "commit-manifest-v1",
    attemptId: attempt.identity.attemptId,
    bookId,
    chapterNumber,
    previousSha256,
    committedSha256,
    committedGeneration: attempt.identity.expectedBaseGeneration + 1,
    invalidated: [],
    committedAtIso: new Date().toISOString(),
    phase,
    ...(window === "pending_required_evidence_bracket_open"
      ? { requiredEvidence: { authorProvenanceBindingSha256: "a".repeat(64), leadOverrideSha256: null } }
      : {}),
  };
  const manifestPath = join(attempt.attemptDir, "commit-manifest.json");
  // commitChapterCandidate writes the pending manifest FIRST (line 337), then
  // performs the canonical write (line 348) — so "before_canonical_write"
  // leaves canonical exactly as it was; both other windows are AFTER the
  // (atomic) canonical write landed.
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  if (window !== "before_canonical_write") {
    io.writeChapterFile(bookId, chapterNumber, committedBytes);
  }
  return { manifestPath, committedSha256 };
}

const PRIOR = JSON.stringify({ chapterId: "zz-mk-ch01", number: 1, title: "prior committed" }) + "\n";
const CAND = JSON.stringify({ chapterId: "zz-mk-ch01", number: 1, title: "new candidate" }) + "\n";

// ── window 1: crash before the canonical rename ──────────────────────────────

test("mid-kill BEFORE canonical write lands: recoverIncompleteCommits resolves aborted_recovered; canonical untouched (no data loss)", () => {
  const bookId = "zz-mk";
  const { io, root } = rig(bookId);
  io.bytes.set(`${bookId}:1`, PRIOR);
  const attempt = mint(io, root, bookId, 1);
  injectMidKillManifest({
    attempt, io, bookId, chapterNumber: 1,
    previousSha256: sha256Hex(PRIOR), committedBytes: CAND,
    window: "before_canonical_write",
  });
  assert.equal(io.bytes.get(`${bookId}:1`), PRIOR, "canonical never changed — the crash predates the rename");

  const chapterRoot = join(root, bookId, "ch01");
  const resolutions = recoverIncompleteCommits(chapterRoot, io, bookId, 1);
  assert.deepEqual(resolutions, [{ attemptId: attempt.identity.attemptId, resolution: "aborted_recovered" }]);
  assert.equal(io.bytes.get(`${bookId}:1`), PRIOR, "recovery itself never mutates canonical");
  assert.equal(readManifest(attempt).phase, "aborted_recovered");
});

// ── window 2: crash after the canonical rename, before the bracket closes ───

test("mid-kill AFTER the atomic rename but BEFORE bracket-close: recoverIncompleteCommits resolves committed, no data loss; a subsequent mint recovers before minting", () => {
  const bookId = "zz-mk";
  const { io, root } = rig(bookId);
  io.bytes.set(`${bookId}:1`, PRIOR);
  const attempt = mint(io, root, bookId, 1);
  const { committedSha256 } = injectMidKillManifest({
    attempt, io, bookId, chapterNumber: 1,
    previousSha256: sha256Hex(PRIOR), committedBytes: CAND,
    window: "after_canonical_write_before_bracket_close",
  });
  assert.equal(io.bytes.get(`${bookId}:1`), CAND, "the atomic rename already landed the new bytes before the kill");

  const chapterRoot = join(root, bookId, "ch01");
  const resolutions = recoverIncompleteCommits(chapterRoot, io, bookId, 1);
  assert.deepEqual(resolutions, [{ attemptId: attempt.identity.attemptId, resolution: "committed" }]);
  assert.equal(sha256Hex(io.bytes.get(`${bookId}:1`)!), committedSha256, "no data loss: recovery finishes the bracket, never rewrites canonical");
  assert.equal(readManifest(attempt).phase, "committed");

  // A subsequent mint for the SAME chapter must recover this bracket BEFORE
  // capturing its own expected base (mintChapterAttempt calls
  // recoverIncompleteCommits internally, chapterTransaction.ts:126) — proving
  // the next entry never mints against a stale/ambiguous pending bracket.
  const next = mint(io, root, bookId, 1);
  assert.equal(next.identity.expectedBaseSha256, committedSha256, "the next attempt's base reflects the recovered commit, not a stale pre-crash hash");
});

// ── window 3: crash while a required-evidence bracket is open ───────────────

test("mid-kill during an OPEN required-evidence bracket: recoverIncompleteCommits resolves reconciliation_required, never silently committed; canonical bytes preserved", () => {
  const bookId = "zz-mk";
  const { io, root } = rig(bookId);
  io.bytes.set(`${bookId}:1`, PRIOR);
  const attempt = mint(io, root, bookId, 1);
  const { committedSha256 } = injectMidKillManifest({
    attempt, io, bookId, chapterNumber: 1,
    previousSha256: sha256Hex(PRIOR), committedBytes: CAND,
    window: "pending_required_evidence_bracket_open",
  });
  assert.equal(io.bytes.get(`${bookId}:1`), CAND, "canonical already landed while the companion-evidence bracket was open");

  const chapterRoot = join(root, bookId, "ch01");
  const resolutions = recoverIncompleteCommits(chapterRoot, io, bookId, 1);
  assert.deepEqual(resolutions, [{ attemptId: attempt.identity.attemptId, resolution: "reconciliation_required" }], "a required-evidence bracket left open is NEVER auto-promoted to committed");
  assert.equal(sha256Hex(io.bytes.get(`${bookId}:1`)!), committedSha256, "recovery does not roll back canonical on its own — operator reconciliation owns that decision");
  assert.equal(readManifest(attempt).phase, "reconciliation_required");
});

// ── stale_base: canonical changed under the attempt ──────────────────────────

test("stale_base: a canonical change after mint leaves the CAS commit rejected — no overwrite, no auto-retry, canonical untouched", () => {
  const bookId = "zz-mk";
  const { io, root } = rig(bookId);
  io.bytes.set(`${bookId}:1`, PRIOR);
  const attempt = mint(io, root, bookId, 1);
  const interloper = JSON.stringify({ chapterId: "zz-mk-ch01", number: 1, title: "someone else committed first" }) + "\n";
  io.bytes.set(`${bookId}:1`, interloper); // a sibling attempt commits underneath this one

  const r1 = commitChapterCandidate({ attempt, bytes: CAND, io });
  assert.ok(!r1.ok && r1.outcome === "stale_base", "the stale attempt is rejected deterministically");
  assert.equal(io.bytes.get(`${bookId}:1`), interloper, "canonical still holds the interloper's bytes — never overwritten");

  // No auto-retry: calling commit again with the SAME (now doubly-stale)
  // attempt is still rejected, and still never touches canonical.
  const r2 = commitChapterCandidate({ attempt, bytes: CAND, io });
  assert.ok(!r2.ok && r2.outcome === "stale_base", "a bounded policy owns any retry — the primitive itself never auto-retries");
  assert.equal(io.bytes.get(`${bookId}:1`), interloper, "still untouched after the second rejected attempt");
});

// ── resume: doAuthorWrite authors only the missing chapter ──────────────────

/** Two-chapter fixture proven to clear the reader-budget checks (CHB1-5) with
 *  zero blockers — content deliberately distinct per chapter (no shared
 *  scenario/practice-format text) so no CHB4/CHB5 sameness finding fires. */
function mkResumeChapter(n: number, bookId: string): ChapterV21 {
  const nn = String(n).padStart(2, "0");
  const one = n === 1;
  return {
    schemaVersion: "chapterflow-v21-authored",
    chapterId: `${bookId}-ch${nn}`,
    number: n,
    title: one ? "Fixture Resume Chapter One Anchors" : "Fixture Resume Chapter Two Momentum",
    readingTimeMinutes: 6,
    hook: `Hook line ${n}: a small change compounds into the whole result.`,
    counterintuition: `Counterintuition ${n}: the obvious fix points the wrong way here.`,
    tryThisNow: one
      ? "Write one sentence naming the next physical step you will take, then do only that."
      : "Close the single oldest open loop on your desk before you read anything else.",
    keyTakeaway: `Key takeaway ${n}: the mechanism you practice daily beats the plan you admire weekly, so keep the move concrete and small enough to repeat without willpower.`,
    breakdown: {
      fastRead: one
        ? "Fast read one: begin with the smallest visible action and repeat it until it stops needing a decision. The rule earns trust by being run, not by being explained."
        : "Fast read two: momentum comes from finishing one bounded thing before opening the next. A closed loop pays attention back; an open loop keeps charging interest.",
      deepRead: one
        ? "Deep read one: the anchor works because a fixed cue removes negotiation. When the cue fires, the action runs, and each run lowers the cost of the next one. That is the whole engine — friction falls with repetition, not with motivation."
        : "Deep read two: the finish-first rule works because unfinished work occupies working memory. Closing a loop releases that hold, so the next task starts cleaner. The gain is mechanical, not motivational, which is why it survives bad days.",
      fullRead: one
        ? "Full read one: run the anchor for two weeks before judging it. Expect the third day to feel pointless, that is the negotiation dying, not the method failing. The limit is real: an anchor cannot carry a task that needs an hour of setup, and it fails when the cue itself is rare."
        : "Full read two: apply the finish-first rule to the smallest open loop first, not the biggest. The limit is real: some loops should stay open because closing them early produces rework, and the rule fails on tasks whose finish line you cannot see from the start.",
    },
    examples: [
      {
        exampleId: "ex01",
        title: one ? "The Analyst Backlog" : "The Night Shift Chart",
        tags: ["work"],
        planSpec: { domain: "work", audience: "practitioner", stakes: "deadline", format: "scene", requiredBeat: "decision" },
        scenario: one
          ? "Monday morning a data analyst opens a backlog of forty tickets and freezes at the size of it, rereading the list instead of starting anywhere."
          : "A nurse ends a twelve-hour shift and still faces charting that piled up all afternoon, with handoff notes due in twenty minutes.",
        whatToDo: one
          ? "Pick the single oldest ticket and resolve only it before looking at the list again."
          : "Chart the one patient whose handoff happens first, completely, before touching any other record.",
        whyItMatters: one
          ? "Starting one bounded item converts a paralyzing list into a sequence of finishable moves."
          : "Finishing one record fully protects the handoff and releases the mental hold of the rest.",
      },
    ],
    quiz: {
      passingScorePercent: 70,
      questions: [
        {
          questionId: "q01",
          prompt: `Chapter ${n} Q1: which move does the chapter prescribe first?`,
          choices: one
            ? ["Resolve the single oldest ticket before rereading the list.", "Sort the full backlog by priority.", "Ask a teammate to split the list."]
            : ["Chart the first-handoff patient completely.", "Skim every chart to triage.", "Delay charting until after handoff."],
          correctIndex: 0,
          explanation: `The prose says to finish one bounded item first, that is chapter ${n}'s core move, and the other choices reopen the negotiation the rule exists to remove.`,
          bloomsLevel: "apply",
          depthLevel: "standard",
        },
        {
          questionId: "q02",
          prompt: `Chapter ${n} Q2: why does the mechanism survive low-motivation days?`,
          choices: one
            ? ["Because motivation compounds.", "Because a fixed cue removes negotiation, so friction falls with repetition.", "Because the list gets shorter."]
            : ["Because deadlines force focus.", "Because closing a loop releases working memory, a mechanical gain.", "Because charts are short."],
          correctIndex: 1,
          explanation: "The deep read grounds it: the gain is mechanical (cue/loop), not motivational, so it does not depend on how the day feels.",
          bloomsLevel: "understand",
          depthLevel: "standard",
        },
      ],
    },
    reviewCards: [
      { cardId: "c01", front: `What is chapter ${n}'s core move?`, back: one ? "Run the smallest anchored action on its fixed cue until it needs no decision." : "Finish the first bounded loop completely before opening the next.", difficulty: "medium" },
    ],
    implementationPlan: {
      title: one ? "Anchor One Daily Action" : "Close One Loop First",
      coreSkill: one ? "Attach one small action to one fixed cue and run it without negotiation." : "Finish the single most time-bound item completely before starting anything else.",
      ifThenPlans: [
        { context: one ? "sitting down at your desk" : "ending a shift", plan: one ? "If I sit down at my desk, then I resolve the oldest open item before opening mail." : "If my shift ends, then I chart the first-handoff patient before any other record." },
      ],
      twentyFourHourChallenge: one
        ? "Before lunch tomorrow, resolve the single oldest item in your queue and note how long it actually took."
        : "Tonight after handoff, complete one full patient record first and mark the time you finished it.",
      weeklyPractice: one
        ? "Every Monday, run the anchor before email and tally whether it fired on its cue."
        : "Each Friday, count the loops you closed completely versus the ones you left open.",
    },
    memorableLines: [],
  } as ChapterV21;
}

function mkResumeBrief(n: number, bookId: string): ChapterBriefV1 {
  const RCH1 = mkResumeChapter(1, bookId);
  const RCH2 = mkResumeChapter(2, bookId);
  const budget = Math.round((estimatedRenderedChars(RCH1) + estimatedRenderedChars(RCH2)) / 2);
  const one = n === 1;
  return {
    schemaVersion: CHAPTER_BRIEF_SCHEMA_VERSION,
    chapterId: `${bookId}-ch${String(n).padStart(2, "0")}`,
    chapterNumber: n,
    title: `Fixture Resume Chapter ${n}`,
    coreMove: "Anchor one small action to one fixed cue and run it without negotiation.",
    thesis: "Focused repetition on a fixed cue improves skill within two weeks.",
    readerPromise: "After this chapter, a reader can anchor one small action to one fixed cue.",
    ownedCases: [{ id: `ch${n}.case.1`, label: one ? "Ericsson violin study" : "Popsicle Hotline" }],
    notYours: one ? ["Popsicle Hotline", "Emerson Electric"] : ["Ericsson violin study"],
    cast: one ? ["Marisol", "Deshawn"] : ["Priya", "Tomas"],
    answerIndexPattern: [0, 1, 2, 0, 1, 2, 0, 1, 2],
    avoid: [],
    lengthBudget: { renderedChars: budget, tolerance: 0.2 },
    flavor: [],
    openerType: one ? "question" : "scene",
    challengeFrame: one ? "before-your-next-X" : "replace-one-Y",
    practiceShape: one ? "single-imperative" : "if-then-trigger",
  };
}

// A REAL, contract-valid source packet (the same fixture proven to clear
// checkReaderBudgets end-to-end in tests/author-arch.test.ts) — a hand-rolled
// partial packet is missing fields (allowedEntities, allowedPlaces, ...) that
// readerBudgets' CHB1/CHB3 checks dereference unconditionally.
const HERE = dirname(fileURLToPath(import.meta.url));
const RESUME_PACKET = JSON.parse(
  readFileSync(resolve(HERE, "fixtures", "fact-ranking-legacy-packet.json"), "utf8"),
) as SourcePacketV1;

test("resume: doAuthorWrite over N-1 committed chapters + 1 missing authors ONLY the missing chapter; committed bytes are hash-stable across the run", async () => {
  const bookId = "zz-mk-resume";
  const { io: canonicalIo, root } = rig(bookId);

  // Seed chapter 1 as ALREADY COMMITTED via a real CAS commit (mint → import
  // → commit → finalize) — exactly the machinery a prior, uninterrupted run
  // would have used. Chapter 2 is left missing.
  const ch1Bytes = JSON.stringify(mkResumeChapter(1, bookId), null, 2) + "\n";
  const seedAttempt = mint(canonicalIo, root, bookId, 1);
  writeFileSync(seedAttempt.candidatePath, ch1Bytes);
  const imported = importCandidate(seedAttempt);
  assert.ok(imported.ok, "seed candidate imports cleanly");
  const seeded = commitChapterCandidate({ attempt: seedAttempt, bytes: ch1Bytes, io: canonicalIo });
  assert.ok(seeded.ok, "seed chapter 1 commits cleanly");
  finalizeAttempt(seedAttempt, "committed");
  const ch1HashBefore = sha256Hex(canonicalIo.bytes.get(`${bookId}:1`)!);

  const writeCalls: number[] = [];
  const authorIo: Partial<AuthorIo> = {
    chapterExists: (_b, n) => canonicalIo.bytes.has(`${bookId}:${n}`),
    readChapterFile: canonicalIo.readChapterFile,
    writeChapterFile: canonicalIo.writeChapterFile,
    loadChapters: () => [...canonicalIo.bytes.values()].map((b) => JSON.parse(b) as ChapterV21),
    readBrief: (_b, n) => mkResumeBrief(n, bookId),
    readPacket: () => RESUME_PACKET,
    // IMP-03 legacy path: absence grants nothing and blocks nothing (authorRun.ts
    // doAuthorWrite comment). Overridden explicitly (rather than left to
    // resolveAuthorIo's disk-reading default) so this hermetic test never
    // touches the real pipeline state/ tree even to resolve a path.
    readSourcePlan: () => null,
    nameBankOk: () => true,
    authorSessionOf: () => undefined,
  };

  const deps = {
    runVerb: async () => ({ code: 0, stdout: "PASS", stderr: "" }),
    expectedChapterNumbers: () => [1, 2],
    log: () => {},
  } as unknown as AutopilotDeps;

  const halt = await doAuthorWrite(bookId, deps, {
    maxParallel: 2,
    io: authorIo,
    writeOneChapter: async (bId, n, _deps, _opts) => {
      writeCalls.push(n);
      const attempt = mint(canonicalIo, root, bId, n);
      const bytes = JSON.stringify(mkResumeChapter(n, bId), null, 2) + "\n";
      writeFileSync(attempt.candidatePath, bytes);
      const importResult = importCandidate(attempt);
      if (!importResult.ok) return { ok: false, reason: importResult.reason };
      const commit = commitChapterCandidate({ attempt, bytes, io: canonicalIo });
      if (!commit.ok) return { ok: false, reason: commit.outcome };
      finalizeAttempt(attempt, "committed");
      return { ok: true, sessionId: `resume-ch${n}`, committed: true };
    },
  });

  assert.equal(halt, null, "the author-write phase completes with no halt (budgets clear)");
  assert.deepEqual(writeCalls, [2], "ONLY the missing chapter (ch02) was (re)authored — the committed ch01 was never passed to the writer");
  assert.equal(
    sha256Hex(canonicalIo.bytes.get(`${bookId}:1`)!),
    ch1HashBefore,
    "the already-committed chapter's canonical bytes are untouched — hash-stable across the resumed run",
  );
  assert.ok(canonicalIo.bytes.has(`${bookId}:2`), "the missing chapter was committed by the resumed run");
});
