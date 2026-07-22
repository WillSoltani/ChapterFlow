/**
 * B4 — the v24 AUTHOR architecture (whole-chapter writer + review/regeneration
 * conductor). Stubbed deps like tests/autopilot.test.ts (no live codex, no real
 * state writes — every side effect goes through injected AuthorIo/deps).
 *
 * Pins: the author phase ladder (write→gate→review→ready) with the
 * sweepConfirmed substitution ONLY in the author arch; card composition (brief
 * md verbatim + writer projection + schema hint + self-verify) and the <=25k
 * size on the golden fixture packet; complaints section only on regen; the
 * write retry ladder; regen cap (2 write attempts) then a content halt; reader
 * budgets blocking; the name-bank infra halt; acceptance writing the exact
 * records the promote gate reads; acceptance rejection driving a <=3-chapter
 * targeted regen then halting; and compiler/legacy defaults unchanged.
 */
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmdirSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { test } from "./harness.js";
import {
  architectureFromFlags,
  decidePhase,
  runAutopilot,
  type AutopilotDeps,
} from "../src/orchestrator/autopilot.js";
import {
  AUTHOR_CARD_MAX_CHARS,
  AUTHOR_HOUSE_RULES,
  AUTHOR_PRECEDENCE,
  AUTHOR_PREMIUM_BLOCK,
  AUTHOR_QUALITY_BAR,
  authorCardComposition,
  authorCardMetrics,
  authorChapterRelPath,
  authorSchemaHint,
  authorSelfVerify,
  authorWriteOneChapter,
  buildAuthorCard,
  commitPreparedAuthorCandidate,
  doAuthorWrite,
  ROUND_TIMER_MINUTES,
} from "../src/orchestrator/authorRun.js";
import { UNTRUSTED_ARTIFACT_RENDERER_VERSION } from "../src/exec/untrustedArtifact.js";
import { questionKeysOnLineage } from "../src/critics/lineageKeyQuiz.js";
import {
  AUTHOR_REGEN_CAP,
  acceptanceRecordPath,
  acceptanceRoundSegment,
  complaintsOf,
  decideAcceptanceRegenOutcome,
  doAuthorReview,
  mapBookComplaintsToChapters,
  runBookAcceptance,
  trueMedian,
  AUTHOR_BOOK_READERS,
  type AcceptanceWriters,
  type AuthorAcceptanceRecord,
  type AuthorReviewIo,
} from "../src/orchestrator/authorReview.js";
import { renderBriefMd } from "../src/compiler/chapterBrief.js";
import {
  appendReviewHistory,
  carryReviewFor,
  reviewDir,
  reviewHistoryPath,
  type ReopenNote,
} from "../src/orchestrator/authorReviewLedger.js";
import { authorChapterId } from "../src/orchestrator/authorRun.js";
import { loadAuthorProvenance, provenancePath, recordAuthorProvenance, type AuthorProvenance } from "../src/qc/sessionProvenance.js";
import {
  contentRepairConsumedFor,
  loadAuthorRegenLedger,
  recordContentRepairConsumed,
} from "../src/orchestrator/authorRegenLedger.js";
import type { ContentRepairResult, SamenessChapterOutcome } from "../src/orchestrator/bookSamenessRun.js";
import { CHAPTERS_DIR, chapterFileName } from "../src/lib/chapterPaths.js";
import {
  CHAPTER_REVIEW_SCHEMA_VERSION,
  type ChapterReviewV1,
} from "../src/artifacts/artifactTypes.js";
import { chapterReaderDocHash, REVIEW_DOC_HASH_VERSION } from "../src/review/readerReview.js";
import { estimatedRenderedChars } from "../src/critics/readerBudgets.js";
import {
  chapterContentHash,
  isApprovedReviewer,
  isAttestationFresh,
  type QcAttestation,
} from "../src/critics/qcAttestation.js";
import {
  CHAPTER_BRIEF_SCHEMA_VERSION,
  REVIEW_FACTORS,
  type ChapterBriefV1,
  type SourcePacketV1,
} from "../src/artifacts/artifactTypes.js";
import type { ValidatedBarReadSubmission, ValidatedConfirmReadSubmission } from "../src/qc/orchestrator/schemas.js";
import type { ChapterV21 } from "../src/types.js";
import type { BookStatus, ChapterStatus } from "../src/lifecycle/bookStatus.js";
import type { ForwardAutopilotControlV1 } from "../src/orchestrator/forwardLocalAutopilot.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const GOLDEN_PACKET = JSON.parse(
  readFileSync(resolve(HERE, "fixtures", "fact-ranking-legacy-packet.json"), "utf8"),
) as SourcePacketV1;

// ── fixtures ─────────────────────────────────────────────────────────────────

function mkChapter(n: number, bookId = "zz"): ChapterV21 {
  const nn = String(n).padStart(2, "0");
  const one = n === 1;
  return {
    schemaVersion: "chapterflow-v21-authored",
    chapterId: `${bookId}-ch${nn}`,
    number: n,
    title: one ? "Fixture Chapter One Anchors" : "Fixture Chapter Two Momentum",
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
        ? "Full read one: run the anchor for two weeks before judging it. Expect the third day to feel pointless — that is the negotiation dying, not the method failing. The limit is real: an anchor cannot carry a task that needs an hour of setup, and it fails when the cue itself is rare."
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
          explanation: `The prose says to finish one bounded item first — that is chapter ${n}'s core move, and the other choices reopen the negotiation the rule exists to remove.`,
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
          explanation: `The deep read grounds it: the gain is mechanical (cue/loop), not motivational, so it does not depend on how the day feels.`,
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

const CH1 = mkChapter(1);
const CH2 = mkChapter(2);
const FIXTURE_CHAPTERS = [CH1, CH2];

function mkBrief(n: number, over: Partial<ChapterBriefV1> = {}): ChapterBriefV1 {
  const budget = Math.round((estimatedRenderedChars(CH1) + estimatedRenderedChars(CH2)) / 2);
  return {
    schemaVersion: CHAPTER_BRIEF_SCHEMA_VERSION,
    chapterId: `zz-ch${String(n).padStart(2, "0")}`,
    chapterNumber: n,
    title: `Fixture Chapter ${n}`,
    coreMove: "Anchor one small action to one fixed cue and run it without negotiation.",
    thesis: "Focused repetition on a fixed cue improves skill within two weeks.",
    readerPromise: "After this chapter, a reader can anchor one small action to one fixed cue.",
    ownedCases: [{ id: `ch${n}.case.1`, label: n === 1 ? "Ericsson violin study" : "Popsicle Hotline" }],
    notYours: n === 1 ? ["Popsicle Hotline", "Emerson Electric"] : ["Ericsson violin study"],
    cast: n === 1 ? ["Marisol", "Deshawn"] : ["Priya", "Tomas"],
    answerIndexPattern: [0, 1, 2, 0, 1, 2, 0, 1, 2],
    avoid: [],
    lengthBudget: { renderedChars: budget, tolerance: 0.2 },
    flavor: [],
    openerType: n === 1 ? "question" : "scene",
    challengeFrame: n === 1 ? "before-your-next-X" : "replace-one-Y",
    practiceShape: n === 1 ? "single-imperative" : "if-then-trigger",
    ...over,
  };
}

function reviewReply(ch: ChapterV21, over: { ship84?: boolean; score?: number; complaints?: Array<{ unit: string; problem: string; mustFix: boolean }>; quote?: string } = {}): string {
  const answers = ch.quiz.questions.map((q) => "abc"[q.correctIndex]);
  const scores = Object.fromEntries(REVIEW_FACTORS.map((f) => [f, over.score ?? 90]));
  const body = {
    quizDerivation: { answers, keyDisagreements: [], tells: [] },
    scores,
    ship84: over.ship84 ?? true,
    quotes: [{ quote: over.quote ?? ch.title, why: "the strongest concrete moment" }],
    complaints: over.complaints ?? [],
    oneParagraphVerdict: "reads as one authored chapter",
  };
  return "```json\n" + JSON.stringify(body) + "\n```";
}

function bookReply(chapters: ChapterV21[], over: { gate?: string; churn?: string; score?: number; verdictText?: string } = {}): string {
  const scores = Object.fromEntries(REVIEW_FACTORS.map((f) => [f, over.score ?? 90]));
  const quizDerivation = Object.fromEntries(
    chapters.map((ch) => [String(ch.number), { answers: ch.quiz.questions.map((q) => "abc"[q.correctIndex]), keyDisagreements: [] }]),
  );
  const body = {
    gate_verdict: over.gate ?? "PASS",
    book3_churn: over.churn ?? "LOW",
    quizDerivation,
    scores,
    quotes: [{ quote: chapters[0].title, why: "individually authored" }],
    oneParagraphVerdict: over.verdictText ?? "chapters feel individually authored",
  };
  return "```json\n" + JSON.stringify(body) + "\n```";
}

type SpawnRec = { sessionId: string; task: string; sandbox?: string; cwd?: string };

/** Stub deps + a scripted spawn that answers per session-label.
 *
 *  IMP-01: an author-write spawn (label `author-chNN…`) must leave a CANDIDATE
 *  chapter file in its attempt WORKSPACE (the spawn's cwd) — the conductor
 *  imports/validates/commits it; nothing is read from canonical. The fake
 *  spawn drops the matching fixture chapter there by default; a script can
 *  return `candidate` to override the object, or `candidate: null` to simulate
 *  a writer that produced no file. */
function mkDeps(
  spawnScript: (o: { sessionId: string; task: string; cwd?: string }) => { ok?: boolean; finalMessage?: string; candidate?: ChapterV21 | null },
  runVerbScript?: (args: string[]) => { code: number; stdout: string; stderr: string },
): { deps: AutopilotDeps; spawns: SpawnRec[]; verbs: string[][] } {
  const spawns: SpawnRec[] = [];
  const verbs: string[][] = [];
  let n = 0;
  const deps = {
    runVerb: async (args: string[]) => {
      verbs.push(args);
      return runVerbScript ? runVerbScript(args) : { code: 0, stdout: "", stderr: "" };
    },
    spawn: (async (o: { sessionId: string; task: string; sandbox?: string; cwd?: string }) => {
      spawns.push({ sessionId: o.sessionId, task: o.task, sandbox: o.sandbox, cwd: o.cwd });
      const r = spawnScript(o);
      const authorLabel = o.sessionId.match(/^author-ch(\d{2})/);
      if (authorLabel && o.cwd && r.candidate !== null) {
        const candidate = r.candidate ?? FIXTURE_CHAPTERS[parseInt(authorLabel[1], 10) - 1];
        if (candidate) writeFileSync(join(o.cwd, chapterFileName(candidate.chapterId)), JSON.stringify(candidate, null, 2) + "\n");
      }
      return { ok: r.ok ?? true, exitCode: (r.ok ?? true) ? 0 : 1, finalMessage: r.finalMessage ?? "done", stdout: r.finalMessage ?? "", stderr: "", durationMs: 1, sessionId: o.sessionId };
    }) as unknown as AutopilotDeps["spawn"],
    mkSessionId: (label: string) => `${label}#${++n}`,
    expectedChapterNumbers: () => [1, 2],
    logSession: () => {},
    log: () => {},
  } as unknown as AutopilotDeps;
  return { deps, spawns, verbs };
}

const TMP = mkdtempSync(join(tmpdir(), "author-arch-"));
const TEST_PIPELINE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");

type TestFileSnapshot = {
  path: string;
  existed: boolean;
  bytes: Buffer | null;
  atime: Date | null;
  mtime: Date | null;
};

const AUTOPILOT_TEST_TELEMETRY = [
  resolve(TEST_PIPELINE_DIR, "state", "autopilot-logs", "zz", "cost-report.json"),
  resolve(TEST_PIPELINE_DIR, "state", "autopilot-logs", "zz", "run-manifest.json"),
  resolve(TEST_PIPELINE_DIR, "state", "reviews", "zz", "tiebreak-notes.json"),
];

function snapshotTestFile(path: string): TestFileSnapshot {
  if (!existsSync(path)) return { path, existed: false, bytes: null, atime: null, mtime: null };
  const stat = statSync(path);
  return { path, existed: true, bytes: readFileSync(path), atime: stat.atime, mtime: stat.mtime };
}

function restoreTestFile(snapshot: TestFileSnapshot): void {
  if (!snapshot.existed) {
    rmSync(snapshot.path, { force: true });
    return;
  }
  writeFileSync(snapshot.path, snapshot.bytes!);
  utimesSync(snapshot.path, snapshot.atime!, snapshot.mtime!);
}

type TestDirSnapshot = { path: string; existed: boolean; entries: Set<string> };

function snapshotTestDir(path: string): TestDirSnapshot {
  return { path, existed: existsSync(path), entries: new Set(existsSync(path) ? readdirSync(path) : []) };
}

function restoreTestDir(snapshot: TestDirSnapshot): void {
  if (!existsSync(snapshot.path)) return;
  for (const entry of readdirSync(snapshot.path)) {
    if (!snapshot.entries.has(entry)) rmSync(join(snapshot.path, entry), { recursive: true, force: true });
  }
  if (!snapshot.existed && readdirSync(snapshot.path).length === 0) rmdirSync(snapshot.path);
}

async function runAutopilotWithoutProductionTelemetry(
  options: Parameters<typeof runAutopilot>[0],
): ReturnType<typeof runAutopilot> {
  const snapshots = AUTOPILOT_TEST_TELEMETRY.map(snapshotTestFile);
  try {
    return await runAutopilot(options);
  } finally {
    for (const snapshot of snapshots) restoreTestFile(snapshot);
  }
}

// Several legacy acceptance tests intentionally exercise tiebreak persistence,
// whose production API predates injectable state roots. Preserve the exact
// pre-file bytes and mtimes, then restore them in the final registered test so
// this suite remains hermetic under CHAPTERFLOW_LEAK_GUARD=1.
const MODULE_TELEMETRY_SNAPSHOTS = AUTOPILOT_TEST_TELEMETRY.map(snapshotTestFile);
const MODULE_DIR_SNAPSHOTS = [
  resolve(TEST_PIPELINE_DIR, "state", "books", "zz", "runs"),
  resolve(TEST_PIPELINE_DIR, "state", "reviews", "zz"),
].map(snapshotTestDir);

function mkIo(over: Partial<AuthorReviewIo> = {}): Partial<AuthorReviewIo> & { attestations: QcAttestation[]; bars: ValidatedBarReadSubmission[]; confirms: ValidatedConfirmReadSubmission[]; acceptanceRecords: AuthorAcceptanceRecord[]; reopenNotes: ReopenNote[]; gateCandidateCalls: Array<{ attemptKey: string; chapterId: string }>; chapterBytes: Map<string, string> } {
  const attestations: QcAttestation[] = [];
  const bars: ValidatedBarReadSubmission[] = [];
  const confirms: ValidatedConfirmReadSubmission[] = [];
  const acceptanceRecords: AuthorAcceptanceRecord[] = [];
  const reopenNotes: ReopenNote[] = [];
  const regenLedger = new Map<number, number>(); // in-memory E2 regen-cap tracking, per io instance
  // IMP-01: in-memory canonical chapter store + tmp attempts root — the
  // transaction's mint/commit path must never touch the real pipeline tree.
  const chapterBytes = new Map<string, string>();
  const provenanceByChapter = new Map<string, AuthorProvenance>();
  const gateCandidateCalls: Array<{ attemptKey: string; chapterId: string }> = [];
  const acceptance: AcceptanceWriters = {
    openRound: () => ({ roundId: "r20260101000000-abcdef", tokens: {} }),
    writeBar: (s) => { bars.push(s); return "/tmp/bar.json"; },
    writeConfirm: (s) => { confirms.push(s); return "/tmp/confirm.json"; },
    writeAttestation: (a) => { attestations.push(a); return "/tmp/att.json"; },
  };
  const io: Partial<AuthorReviewIo> = {
    chapterExists: () => true,
    readChapterFile: (b, n) => chapterBytes.get(`${b}:${n}`) ?? null,
    writeChapterFile: (b, n, bytes) => { chapterBytes.set(`${b}:${n}`, bytes); },
    removeChapterFile: (b, n) => { chapterBytes.delete(`${b}:${n}`); },
    attemptsRoot: () => join(TMP, "attempts"),
    // IMP-01 candidate validation defaults: PASS (tests scripting gate/rubric
    // failures override these — the old runVerb gate/rubric stubs are inert now).
    gateCandidate: async (candidate, _abs, attemptKey) => {
      gateCandidateCalls.push({ attemptKey, chapterId: candidate.chapterId });
      return { code: 0, stdout: "Gate verdict: PASS — 0 blockers (0 major(s), 0 minor(s) above are non-blocking). (exit 0)", stderr: "" };
    },
    rubricWithCandidate: async () => ({ code: 0, stdout: "", stderr: "" }),
    readBriefMd: (b, ch) => renderBriefMd(mkBrief(ch)),
    readBrief: (_b, ch) => mkBrief(ch),
    readPacket: () => GOLDEN_PACKET,
    loadChapters: () => FIXTURE_CHAPTERS,
    nameBankOk: () => true,
    voiceCard: () => "voice: warm, direct coaching register; second-person; medium cadence",
    authorSessionOf: () => undefined,
    recordProvenance: (chapterId, sessionId, contentHash) => {
      provenanceByChapter.set(chapterId, {
        schemaVersion: "author-provenance-v2",
        chapterId,
        authorSessionId: sessionId,
        stampedAt: "2026-01-01T00:00:00.000Z",
        contentHash,
      });
    },
    readProvenance: (chapterId) => provenanceByChapter.get(chapterId) ?? null,
    restoreProvenance: (chapterId, previous) => {
      if (previous) provenanceByChapter.set(chapterId, previous);
      else provenanceByChapter.delete(chapterId);
    },
    readLeadOverride: () => null,
    writeLeadOverride: () => {},
    removeLeadOverride: () => {},
    writeReviewDoc: (bookId, fileName, text) => {
      const abs = join(TMP, `${bookId}-${fileName}`);
      writeFileSync(abs, text, "utf8");
      return { absPath: abs, relPath: abs };
    },
    persistReview: () => "/tmp/review.json",
    persistAcceptance: (bookId, record) => { acceptanceRecords.push(record); return `/tmp/acceptance.${record.roundLabel || "round1"}.json`; },
    // Multi-read pool (F1/F3): mirror the in-memory persisted records with the
    // same quorum filter the real listAcceptanceReads applies, so cross-read and
    // cross-entry pooling is exercised without touching real state/.
    listAcceptanceReads: (_b, docSha256) =>
      acceptanceRecords.filter(
        (r) => r.docSha256 === docSha256
          && (r.verdict?.validCount ?? 0) >= 3
          && typeof r.verdict?.medianComposite === "number",
      ),
    acceptance,
    // B5 publish evidence is stubbed OK in these unit tests (its real
    // implementations are pinned by tests/author-evidence.test.ts against
    // fixture state + the real promote predicates).
    evidence: {
      runKeyJudge: async () => ({ ok: true as const }),
      runSweep: async () => ({ ok: true as const }),
    },
    // AUTO control-read stubbed: honor the env override exactly as the real
    // resolver does (env-first), else bar-80-only (no shipped package / no git in
    // these unit tests). This keeps the beat-shipped-when-set contract testable
    // without shelling out to git or spawning a control reader.
    resolveBeatShipped: async () => {
      const raw = process.env.CHAPTERFLOW_BEAT_SHIPPED_COMPOSITE;
      if (raw !== undefined && raw !== "") {
        const n = Number(raw);
        return { ok: true as const, composite: Number.isFinite(n) ? n : null, source: "env" as const };
      }
      return { ok: true as const, composite: null, source: "none" as const };
    },
    // E2 regen-cap: in-memory per-io so a test's GLOBAL cap is exercised WITHOUT
    // leaking a durable ledger into real state/ (and without one test's ledger
    // contaminating the next's — the fixture book id is shared).
    regenConsumedFor: (_b, n) => regenLedger.get(n) ?? 0,
    recordRegenConsumed: (_b, n) => { regenLedger.set(n, (regenLedger.get(n) ?? 0) + 1); },
    // F-03: capture reopen notes in memory so the acceptance-regen block never
    // leaks state/reviews/<book>/reopen-notes.json into the real state dir.
    appendReopenNote: (_b, note) => { reopenNotes.push(note); },
    // F-04: default the content-device repair lane to a NO-OP (fired:false) so a
    // churn-HIGH test never accidentally lazy-imports + spawns the real writer.
    // Routing tests override this with a controlled stub.
    contentDeviceRepair: async () => ({ fired: false, targets: [], preserved: [], outcomes: [], preservedViolations: [], overCapDevices: [], residualOverCap: [] }),
    ...over,
  };
  // A custom record hook often asserts/captures the write. Mirror its successful
  // result into the fixture's durable read-back store unless the test explicitly
  // replaces the read seam too.
  if (over.recordProvenance && !over.readProvenance) {
    io.recordProvenance = (chapterId, sessionId, contentHash) => {
      over.recordProvenance!(chapterId, sessionId, contentHash);
      provenanceByChapter.set(chapterId, {
        schemaVersion: "author-provenance-v2", chapterId, authorSessionId: sessionId,
        stampedAt: "2026-01-01T00:00:00.000Z", contentHash,
      });
    };
    io.readProvenance = (chapterId) => provenanceByChapter.get(chapterId) ?? null;
  }
  return Object.assign(io, { attestations, bars, confirms, acceptanceRecords, reopenNotes, gateCandidateCalls, chapterBytes });
}

/** The default spawn script: writers succeed, chapter readers pass, book readers accept. */
function happyScript(o: { sessionId: string }): { finalMessage?: string } {
  if (o.sessionId.includes("author-book-reader")) return { finalMessage: bookReply(FIXTURE_CHAPTERS) };
  const m = o.sessionId.match(/author-review-ch0*(\d+)/);
  if (m) return { finalMessage: reviewReply(Number(m[1]) === 1 ? CH1 : CH2) };
  return {}; // whole-chapter writer: no output needed
}

// ── flags + phase pins (compiler/legacy unchanged) ───────────────────────────

test("architectureFromFlags: --author maps to author; --legacy keeps legacy; default stays compiler", () => {
  assert.equal(architectureFromFlags({ author: true }), "author");
  assert.equal(architectureFromFlags({ legacy: true }), "legacy");
  assert.equal(architectureFromFlags({ "legacy-whole-chapter-writer": true }), "legacy");
  assert.equal(architectureFromFlags({}), "compiler");
  // --legacy wins over --author when both are passed (legacy is checked first, unchanged).
  assert.equal(architectureFromFlags({ legacy: true, author: true }), "legacy");
});

test("decidePhase is byte-unchanged for compiler/legacy callers (same assertions as the autopilot suite)", () => {
  const mk = (o: Partial<BookStatus>): BookStatus => ({
    bookId: "zz", stage: "write-chapter", phase: "", expectedChapters: 2,
    writtenChapters: 0, gatedChapters: 0, qcdChapters: 0, bookGatePass: null,
    bookGateBlockers: 0, deterministicClean: true, packaged: false, publishable: false, guardrails: false,
    variety: null, nextCommand: "", nextLabel: "", chapters: [] as ChapterStatus[], ...o,
  });
  assert.equal(decidePhase(mk({ writtenChapters: 2, expectedChapters: 2, gatedChapters: 2, bookGatePass: true, qcdChapters: 2 })), "ready");
  assert.equal(decidePhase(mk({ writtenChapters: 2, expectedChapters: 2, gatedChapters: 2, bookGatePass: true, qcdChapters: 2 }), false), "qc");
  assert.equal(decidePhase(mk({ writtenChapters: 1, expectedChapters: 2 })), "write");
  assert.equal(decidePhase(mk({ packaged: true })), "shipped");
});

// ── the card ─────────────────────────────────────────────────────────────────

test("author card: brief md verbatim + writer projection + schema hint + self-verify, <= 25k on the golden fixture packet", () => {
  const brief = mkBrief(3, { chapterId: "zz-fixture-fact-ranking-ch03", chapterNumber: 3, title: "Deliberate Practice" });
  const briefMd = renderBriefMd(brief);
  const card = buildAuthorCard({
    bookId: "zz-fixture-fact-ranking",
    chapterNumber: 3,
    briefMd,
    packet: GOLDEN_PACKET,
    voice: "voice: warm, direct coaching register; second-person; medium cadence",
  });
  assert.ok(card.includes(briefMd.trim()), "the rendered brief md is embedded verbatim");
  assert.ok(card.includes('"schemaVersion": "chapterflow-writer-packet-v2"'), "the SLIM writer projection is embedded (not the raw packet)");
  // IMP-03 (F-021): the projection rides INSIDE the typed untrusted-data envelope.
  assert.ok(card.includes('<chapterflow_untrusted_artifact type="source-packet-projection"'), "projection is data-enveloped");
  assert.ok(card.includes("UNTRUSTED ARTIFACT DATA"), "the envelope notice rides the card");
  assert.ok(!card.includes("groundedNumbers"), "projection dropped the grounding inventories (card diet)");
  assert.ok(card.includes(authorSchemaHint("zz-fixture-fact-ranking", 3)), "compact ChapterV21 schema hint present");
  assert.ok(card.includes("SELF-VERIFY"), "self-verify block present");
  assert.ok(card.includes(AUTHOR_HOUSE_RULES), "house-style rules verbatim");
  // IMP-01: the card no longer instructs the writer to run repository commands —
  // the conductor gates the candidate; the self-verify names the consequence.
  assert.ok(card.includes("the conductor gates state/chapters/zz-fixture-fact-ranking-ch03.v21-native.chapter.json the moment you do"), "self-verify names the exact output file + conductor gating");
  assert.ok(!card.includes("npx tsx src/cli.ts"), "no repository-command instruction rides the card (IMP-01 least authority)");
  assert.ok(!card.includes("PRIOR-ATTEMPT COMPLAINTS"), "no complaints section on a first attempt");
  // IMP-05: the precedence contract rides the always-sent card.
  assert.ok(card.includes(AUTHOR_PRECEDENCE), "the precedence order is embedded");
  assert.ok(card.length <= AUTHOR_CARD_MAX_CHARS, `card must be <= ${AUTHOR_CARD_MAX_CHARS} chars, got ${card.length}`);
  assert.ok(authorSelfVerify("zz-fixture-fact-ranking", 3).length <= 900, "self-verify stays <= 900 chars (IMP-05 diet)");
  console.log(`  [measure] author card on the golden fixture packet: ${card.length} chars`);
});

// ── IMP-05: the dieted, precedence-ordered writer card ─────────────────────────
// The CF-A..CF-J / STIER / W1 rule-text pins were consolidated here: IMP-05 moved
// the accumulated incident lessons to their enforcement owners (gates, C31-C35,
// the source-use plan, the blinded reviewers) — see docs/v25/IMP-05-REQUIREMENT-
// LEDGER.md. These tests assert the COMPACT invariants ride the card and each
// protection's enforcement owner is unchanged.
test("IMP-05: control blocks (precedence + invariants + craft targets + reviewer axes) ride the always-sent card, dieted", () => {
  const brief = mkBrief(3, { chapterId: "zz-fixture-fact-ranking-ch03", chapterNumber: 3, title: "Deliberate Practice" });
  const card = buildAuthorCard({ bookId: "zz-fixture-fact-ranking", chapterNumber: 3, briefMd: renderBriefMd(brief), packet: GOLDEN_PACKET, voice: null });
  // All four control blocks are embedded verbatim on the FIRST attempt.
  assert.ok(card.includes(AUTHOR_PRECEDENCE), "precedence contract present");
  assert.ok(card.includes(AUTHOR_HOUSE_RULES), "global invariants present");
  assert.ok(card.includes(AUTHOR_QUALITY_BAR), "craft targets present");
  assert.ok(card.includes(AUTHOR_PREMIUM_BLOCK), "reviewer-scored axes present");
  // Precedence orders safety/source above optional style (instruction 3).
  assert.ok(AUTHOR_PRECEDENCE.indexOf("Safety, source obedience") < AUTHOR_PRECEDENCE.indexOf("Optional style"), "safety/source outranks optional style");
  // The retained global invariants (ledger I1-I5).
  assert.match(AUTHOR_HOUSE_RULES, /COMPLETE:.*every required field/i, "I1 completeness invariant");
  assert.match(AUTHOR_HOUSE_RULES, /FACTUAL:.*SOURCE-USE PLAN/i, "I2 source obedience invariant");
  assert.match(AUTHOR_HOUSE_RULES, /QUIZ:.*tests a MOVE the reader makes, not a source/i, "I3 quiz-is-a-move invariant");
  assert.match(AUTHOR_HOUSE_RULES, /IDENTITY:.*reader never meets the machinery/i, "I4 identity/machinery invariant");
  assert.match(AUTHOR_HOUSE_RULES, /PLAIN & DENSE:.*Flesch ease 72-84/i, "I5 plain+dense invariant");
});

test("IMP-05: the diet actually shrank the card; instruction count fell; budget holds", () => {
  const brief = mkBrief(3, { chapterId: "zz-fixture-fact-ranking-ch03", chapterNumber: 3, title: "Deliberate Practice" });
  const card = buildAuthorCard({ bookId: "zz-fixture-fact-ranking", chapterNumber: 3, briefMd: renderBriefMd(brief), packet: GOLDEN_PACKET, voice: null });
  const m = authorCardMetrics(card);
  // IMP-03 left the fixture card at 19,924; the IMP-05 diet brought it to 14,862
  // (pin 15,000). IMP-04 instruction 4 adds the CAST role-label default + the
  // constructed-lead first-entry framing to the brief render (~230 chars on this
  // fixture, already tightened once) — a required register addition, so the pin
  // moves 15,000 → 15,200. The diet ratchet stands: ~4.7k under the pre-diet card.
  assert.ok(m.chars <= 15200, `dieted card must be <= 15,200 chars, got ${m.chars} (was 19,924 after IMP-03)`);
  assert.ok(m.controlChars <= 4600, `control blocks must be <= 4,600 chars, got ${m.controlChars} (was ~10,900)`);
  // Rule-count dilution signal: the control blocks carry far fewer directive lines.
  assert.ok(m.instructions <= 40, `directive-line count stays low, got ${m.instructions}`);
  console.log(`  [measure] IMP-05 dieted card: ${m.chars} chars, ${m.instructions} directive lines, control ${m.controlChars}`);
});

test("IMP-05: block versioning + composition hash are stable and stamp every control block", () => {
  const comp = authorCardComposition();
  assert.equal(comp.versions.qualityBar, "quality-bar-v2", "quality bar is at the IMP-05 diet version");
  assert.equal(comp.versions.selfVerify, "self-verify-v2", "self-verify is at the IMP-05 diet version");
  assert.equal(comp.versions.dataEnvelope, UNTRUSTED_ARTIFACT_RENDERER_VERSION, "data-envelope version tracks IMP-03");
  assert.equal(comp.controlSha256.length, 64, "composition hash is a full sha256");
  assert.equal(authorCardComposition().controlSha256, comp.controlSha256, "composition hash is deterministic");
});

test("IMP-05: HOOK stake target rides the card (protection retained; C34 doorway critic unchanged)", () => {
  const brief = mkBrief(3, { chapterId: "zz-fixture-fact-ranking-ch03", chapterNumber: 3, title: "Deliberate Practice" });
  const card = buildAuthorCard({ bookId: "zz-fixture-fact-ranking", chapterNumber: 3, briefMd: renderBriefMd(brief), packet: GOLDEN_PACKET, voice: null });
  assert.match(card, /HOOK \[SCORED\]\. Make the stake visible in plain words/i, "the hook-stake craft target is present, compactly");
  // One sparse FAIL/PASS micro-example survives (O3 endorses sparse examples).
  assert.equal(AUTHOR_QUALITY_BAR.split(/\bFAIL:/).length - 1, 1, "exactly one FAIL micro-example");
  assert.equal(AUTHOR_QUALITY_BAR.split(/\bPASS:/).length - 1, 1, "exactly one PASS micro-example");
  // The machinery/register protection moved to invariant I4 + the C32/C33 critics.
  assert.match(AUTHOR_HOUSE_RULES, /no internal artifact or beat label as an acting subject/i, "machinery-register protection lives in invariant I4");
});

test("IMP-05: quiz key-is-a-move protection is on the card AND still enforced by the C35 detector", () => {
  const brief = mkBrief(3, { chapterId: "zz-fixture-fact-ranking-ch03", chapterNumber: 3, title: "Deliberate Practice" });
  const card = buildAuthorCard({ bookId: "zz-fixture-fact-ranking", chapterNumber: 3, briefMd: renderBriefMd(brief), packet: GOLDEN_PACKET, voice: null });
  assert.match(card, /A key tests a move the reader makes, never a source\./, "key-is-a-move invariant present (rule 1)");
  // The enforcement owner (C35 lineageKeyQuiz critic) is UNCHANGED — it still fires
  // on the exact key shape the invariant forbids (proving the protection moved, not vanished).
  const lineageKey = {
    choices: [
      "Tie the move to Getting to Yes and its named authors, so the frame is traceable to a real source.",
      "Ask for the interest under the demand before hardening the counter-position.",
    ],
    correctIndex: 0,
    explanation: "The source lineage matters here: naming the authors makes the frame checkable.",
  };
  assert.equal(questionKeysOnLineage(lineageKey), true, "the C35 detector still fires on a lineage-keyed question");
});

test("IMP-05: schema hint (unchanged) carries the take-home + memorable-line shapes; D9 round-timer set intact", () => {
  const hint = authorSchemaHint("zz-fixture-fact-ranking", 3);
  assert.match(hint, /"coreSkill":"<skill name>\. \.\.\.\(2-4 sentences\)"/, "coreSkill opens with the skill name (schema hint)");
  assert.match(hint, /"memorableLines":\[\{"text":"\.\.\.\(exact sentence from the chapter; >=1 carries the central image\)"/, "memorable-line selection in the schema hint");
  // The take-home craft target compactly names the skill-name shape.
  assert.match(AUTHOR_QUALITY_BAR, /coreSkill opens with a 2-5 word skill name/i, "take-home craft target present");
  // D9 round-timer contract untouched (enforcement owner unchanged).
  for (const m of [5, 10, 15, 20, 25, 30, 45, 60]) assert.ok(ROUND_TIMER_MINUTES.has(m), `D9 round-timer set still contains ${m}`);
});

test("author card: renders the W4 brief-derived VARIETY instructions (opener / 24h-frame / practice) when the machine brief is passed", () => {
  const brief = mkBrief(1, { openerType: "question", challengeFrame: "timebox-N-minutes", practiceShape: "say-aloud-script" });
  const briefMd = renderBriefMd(brief);
  const card = buildAuthorCard({ bookId: "zz", chapterNumber: 1, briefMd, packet: GOLDEN_PACKET, voice: null, brief });
  // the explicit VARIETY block sourced from the machine brief.
  assert.ok(card.includes("VARIETY (dealt for this chapter"), "explicit VARIETY reinforcement block present");
  assert.ok(/Open the hook with a QUESTION/.test(card), "opener instruction rendered for the dealt openerType");
  assert.ok(/Frame it as timebox-N-minutes/.test(card), "24-hour challenge framing rendered");
  assert.ok(card.includes('Do NOT use the "In the next 24 hours," stem.'), "the stem ban is stated");
  assert.ok(/say-aloud script/.test(card), "practice-shape instruction rendered");
  // graceful degradation: no machine brief → no explicit block (the md still carries VARIETY).
  const noBrief = buildAuthorCard({ bookId: "zz", chapterNumber: 1, briefMd, packet: GOLDEN_PACKET, voice: null });
  assert.ok(!noBrief.includes("VARIETY (dealt for this chapter"), "no explicit reinforcement block without the machine brief");
});

test("author card: manual-brief books get the always-on CHAPTER SHAPE (architecture + practice) lines; machine-brief books do NOT double-deal them (F-07/F-08)", () => {
  const briefMd = renderBriefMd(mkBrief(3));
  // Manual-brief: no machine brief passed, book-scale (totalChapters >= 4) → the two
  // always-on rotational levers render.
  const manual = buildAuthorCard({ bookId: "zz-manual", chapterNumber: 3, totalChapters: 14, briefMd, packet: GOLDEN_PACKET, voice: null });
  assert.ok(manual.includes("CHAPTER SHAPE (dealt for this chapter"), "manual-brief card carries the always-on shape section");
  assert.match(manual, /Architecture — [a-z-]+: /, "architecture-family line rendered with its instruction");
  assert.match(manual, /Practice — Shape tryThisNow/, "practice-shape line rendered");
  // and it is deterministic across re-runs / --only retries.
  assert.equal(
    manual,
    buildAuthorCard({ bookId: "zz-manual", chapterNumber: 3, totalChapters: 14, briefMd, packet: GOLDEN_PACKET, voice: null }),
    "manual-brief card is deterministic for the same (bookId, chapter, totalChapters)",
  );

  // Machine-brief: brief passed → the compiled VARIETY block renders INSTEAD; the
  // always-on shape lines must NOT also appear (no double-deal).
  const brief = mkBrief(3);
  const machine = buildAuthorCard({ bookId: "zz-machine", chapterNumber: 3, totalChapters: 14, briefMd: renderBriefMd(brief), packet: GOLDEN_PACKET, voice: null, brief });
  assert.ok(!machine.includes("CHAPTER SHAPE (dealt for this chapter"), "machine-brief card does NOT render the always-on shape lines (its VARIETY block owns that)");
  assert.ok(machine.includes("VARIETY (dealt for this chapter"), "machine-brief keeps its compiled VARIETY block");

  // Below book scale (single-chapter tools): no shape lines, exactly as before.
  const single = buildAuthorCard({ bookId: "zz-manual", chapterNumber: 1, briefMd, packet: GOLDEN_PACKET, voice: null });
  assert.ok(!single.includes("CHAPTER SHAPE (dealt for this chapter"), "no always-on shape lines without a book-scale totalChapters");

  // Card budget (Requirement 5): even the manual-brief card — which carries BOTH the
  // content-device deal AND the new always-on shape lines — stays under the ceiling,
  // and the two always-on sections add a bounded, small amount over the baseline card.
  assert.ok(manual.length <= AUTHOR_CARD_MAX_CHARS, `manual-brief card must be <= ${AUTHOR_CARD_MAX_CHARS} chars, got ${manual.length}`);
  const delta = manual.length - single.length;
  assert.ok(delta > 0 && delta < 1500, `always-on additions are bounded (+${delta} chars over the pre-book-scale card)`);
  console.log(`  [measure] manual-brief card: ${manual.length} chars (ceiling ${AUTHOR_CARD_MAX_CHARS}); always-on additions +${delta} chars`);
});

test("author card: complaints section appears ONLY on regeneration, with the review's bullets", () => {
  const briefMd = renderBriefMd(mkBrief(1));
  const complaints = ["quiz Q2: the key contradicts the prose", "deep read: restates the fast read"];
  const card = buildAuthorCard({ bookId: "zz", chapterNumber: 1, briefMd, packet: GOLDEN_PACKET, voice: null, complaints });
  assert.ok(card.includes("PRIOR-ATTEMPT COMPLAINTS"), "complaints header present on regen");
  assert.ok(card.includes("Fix every defect described in the data block below"), "regeneration framing present (conductor instruction outside the data block)");
  // IMP-03 (F-021): reviewer text is model output — it rides inside the typed
  // untrusted-data envelope; the bullets are byte-preserved as its body.
  assert.ok(card.includes('<chapterflow_untrusted_artifact type="reviewer-finding"'), "complaints are data-enveloped");
  for (const c of complaints) assert.ok(card.includes(`- ${c}`), `complaint bullet present: ${c}`);
  const empty = buildAuthorCard({ bookId: "zz", chapterNumber: 1, briefMd, packet: GOLDEN_PACKET, voice: null, complaints: [] });
  assert.ok(!empty.includes("PRIOR-ATTEMPT COMPLAINTS"), "an EMPTY complaints list adds no section");
});

test("book-sameness directive reaches the writer card for a MANUAL-brief re-author (injected as a complaint)", async () => {
  const { planBookSamenessRepair } = await import("../src/critics/bookSamenessRepair.js");
  // A firing set implicating ch03 by 3 axes → a real per-chapter directive.
  const findings = [
    { catalogId: "ARCH1.practice_shell_monoculture", severity: "minor" as const, message: "", chapters: [3, 6, 8, 9, 11, 12] },
    { catalogId: "ARCH4.lead_anchor_overreuse", severity: "minor" as const, message: "", chapters: [3, 9, 12] },
    { catalogId: "ARCH0.architecture_monoculture", severity: "major" as const, message: "", chapters: [3, 6, 8, 9, 11, 12] },
  ];
  const plan = planBookSamenessRepair(findings, 14, { preserveChapters: [1, 4, 7, 10], targetCap: 6 });
  const target = plan.targets.find((t) => t.chapterNumber === 3)!;
  const briefMd = renderBriefMd(mkBrief(3));
  const card = buildAuthorCard({ bookId: "zz", chapterNumber: 3, briefMd, packet: GOLDEN_PACKET, voice: null, complaints: [target.directive] });
  // The directive is visible in the actual writer payload, with the assigned family
  // + the preserve-facts + prohibit-the-default-mold instructions.
  assert.ok(card.includes("BOOK-SAMENESS REPAIR"), "the sameness directive reaches the card");
  assert.ok(card.includes(target.assignedFamily), `the assigned architecture family is in the card: ${target.assignedFamily}`);
  assert.match(card, /Keep the chapter's WHY\/thesis, its source-supported facts/, "fact/schema preservation instruction present");
  assert.match(card, /do NOT reuse the default named-anchor/, "prohibits the default 3-anchor mold");
});

// ── authorWriteOneChapter ────────────────────────────────────────────────────

test("authorWriteOneChapter: spawns one workspace-write writer, verifies file + gate, records content-bound provenance", async () => {
  const { deps, spawns } = mkDeps(() => ({}));
  const provenance: Array<{ chapterId: string; sessionId: string; contentHash?: string }> = [];
  const io = mkIo({ recordProvenance: (chapterId, sessionId, contentHash) => { provenance.push({ chapterId, sessionId, contentHash }); } });
  const r = await authorWriteOneChapter("zz", 1, deps, { io });
  assert.ok(r.ok, "chapter authored");
  assert.equal(spawns.length, 1, "exactly one writer spawn");
  assert.equal(spawns[0].sandbox, "workspace-write");
  assert.ok(spawns[0].sessionId.startsWith("author-ch01"), "distinct labeled session id");
  // IMP-01: the writer runs in an isolated attempt workspace, never the pipeline root.
  assert.ok(spawns[0].cwd && spawns[0].cwd.includes("workspace"), "writer cwd is the attempt workspace");
  // IMP-01: the gate runs in-process on the CANDIDATE, keyed by the canonical relPath.
  assert.equal(io.gateCandidateCalls.length, 1, "gate ran exactly once");
  assert.equal(io.gateCandidateCalls[0].attemptKey, authorChapterRelPath("zz", 1), "gate history keyed by the canonical relPath");
  assert.equal(io.gateCandidateCalls[0].chapterId, "zz-ch01", "the gate saw the candidate chapter");
  // The commit landed through the io seam (conductor-owned canonical write).
  assert.ok(io.chapterBytes.get("zz:1"), "canonical bytes committed via the io seam");
  assert.equal(provenance.length, 1, "author provenance recorded once");
  assert.equal(provenance[0].chapterId, "zz-ch01");
  assert.equal(provenance[0].contentHash, chapterContentHash(CH1), "provenance bound to the authored content hash");
});

test("authorWriteOneChapter: deferred mode holds a validated candidate noncanonical until the conductor commits it", async () => {
  const { deps } = mkDeps(() => ({}));
  const provenance: Array<{ chapterId: string; sessionId: string; contentHash?: string }> = [];
  const io = mkIo({ recordProvenance: (chapterId, sessionId, contentHash) => { provenance.push({ chapterId, sessionId, contentHash }); } });

  const prepared = await authorWriteOneChapter("zz", 1, deps, { io, deferCommit: true });
  assert.ok(prepared.ok && prepared.committed === false, "returns an explicit pending candidate");
  if (!prepared.ok || prepared.committed !== false) return;
  assert.equal(io.chapterBytes.get("zz:1"), undefined, "canonical chapter remains absent while semantic review is pending");
  assert.equal(provenance.length, 0, "pending candidate cannot claim canonical provenance");

  const committed = commitPreparedAuthorCandidate(prepared.pending, deps);
  assert.ok(committed.ok && committed.committed === true, "conductor can atomically accept the exact prepared candidate");
  assert.ok(io.chapterBytes.get("zz:1"), "accepted candidate becomes canonical exactly once");
  assert.equal(provenance.length, 1, "provenance is recorded only after the accepted commit");
});

test("commitPreparedAuthorCandidate: required provenance failure rolls canonical bytes back and cannot report committed PASS", async () => {
  const { deps } = mkDeps(() => ({}));
  const io = mkIo({ recordProvenance: () => { throw new Error("provenance disk full"); } });
  const prepared = await authorWriteOneChapter("zz", 1, deps, { io, deferCommit: true });
  assert.ok(prepared.ok && prepared.committed === false);
  if (!prepared.ok || prepared.committed !== false) return;

  const result = commitPreparedAuthorCandidate(prepared.pending, deps);
  assert.equal(result.ok, false, "a chapter swap without its required provenance is never acknowledged");
  assert.equal(io.chapterBytes.get("zz:1"), undefined, "first-write rollback restores canonical absence");
  const manifest = JSON.parse(readFileSync(join(prepared.pending.attempt.attemptDir, "commit-manifest.json"), "utf8"));
  assert.equal(manifest.phase, "rolled_back_required_evidence_failure");
  assert.equal(manifest.reconciliation.outcome, "rolled_back");
  const outcome = JSON.parse(readFileSync(join(prepared.pending.attempt.attemptDir, "outcome.json"), "utf8"));
  assert.equal(outcome.outcome, "infrastructure_failure");
});

test("commitPreparedAuthorCandidate: provenance rollback CAS never clobbers an intervening canonical write", async () => {
  const { deps } = mkDeps(() => ({}));
  let io!: ReturnType<typeof mkIo>;
  io = mkIo({
    recordProvenance: () => {
      io.chapterBytes.set("zz:1", "intervening canonical bytes\n");
      throw new Error("provenance write failed after another conductor advanced");
    },
  });
  const prepared = await authorWriteOneChapter("zz", 1, deps, { io, deferCommit: true });
  assert.ok(prepared.ok && prepared.committed === false);
  if (!prepared.ok || prepared.committed !== false) return;

  const result = commitPreparedAuthorCandidate(prepared.pending, deps);
  assert.equal(result.ok, false);
  assert.equal(io.chapterBytes.get("zz:1"), "intervening canonical bytes\n", "intervening writer wins; rollback is compare-and-swap, never restore-by-force");
  const manifest = JSON.parse(readFileSync(join(prepared.pending.attempt.attemptDir, "commit-manifest.json"), "utf8"));
  assert.equal(manifest.phase, "reconciliation_required");
  assert.equal(manifest.reconciliation.outcome, "reconciliation_required");
});

test("authorWriteOneChapter: ONE retry appends the gate blockers to the card, then succeeds", async () => {
  let gateCalls = 0;
  const { deps, spawns } = mkDeps(() => ({}));
  const io = mkIo({
    gateCandidate: async () => ++gateCalls === 1
      ? { code: 1, stdout: "[BLOCKER A12] ch01: lowercase sentence boundary", stderr: "" }
      : { code: 0, stdout: "Gate verdict: PASS — 0 blockers", stderr: "" },
  });
  const r = await authorWriteOneChapter("zz", 1, deps, { io });
  assert.ok(r.ok, "retry converged");
  assert.equal(spawns.length, 2, "initial + exactly one retry");
  assert.ok(spawns[1].task.includes("GATE BLOCKERS FROM YOUR PREVIOUS ATTEMPT"), "retry card carries the gate framing");
  assert.ok(spawns[1].task.includes("[BLOCKER A12]"), "retry card carries the verbatim blocker");
});

test("authorWriteOneChapter: a DIED writer spawn is logged (honest-accounting invariant — start-with-why gold-run bug)", async () => {
  // The cost-report honest-accounting invariant tripped on the gold run: a
  // timed-out ch04 writer spawn was minted (mkSessionId) but the throw skipped
  // the success-path logSession. The catch must now record a synthetic failed
  // session so no minted spawn goes unlogged.
  const logged: Array<{ label: string; ok: boolean }> = [];
  let spawnCall = 0;
  const { deps } = mkDeps(() => {
    if (++spawnCall === 1) throw new Error("timeout SIGKILL");
    return {};
  });
  deps.logSession = ((_b: string, label: string, r: { ok: boolean }) => { logged.push({ label, ok: r.ok }); }) as never;
  const r = await authorWriteOneChapter("zz", 1, deps, { io: mkIo() });
  assert.ok(r.ok, "recovers on the retry after the first spawn dies");
  assert.ok(logged.some((l) => l.label === "author-ch01" && l.ok === false), "the DIED initial spawn was logged as a failed session (no minted-but-unlogged id)");
  assert.ok(logged.some((l) => l.label === "author-ch01-retry1"), "the successful retry was logged too");
});

test("authorWriteOneChapter: fails after the retry budget when gate-chapter keeps blocking", async () => {
  const { deps, spawns } = mkDeps(() => ({}));
  const io = mkIo({
    gateCandidate: async () => ({ code: 1, stdout: "[BLOCKER SEC105] ch01: source label leak", stderr: "" }),
  });
  const r = await authorWriteOneChapter("zz", 1, deps, { io });
  assert.ok(!r.ok, "must fail closed");
  assert.equal(spawns.length, 2, "the budget is the initial spawn + ONE retry");
  if (!r.ok) assert.match(r.reason, /SEC105/, "the failure carries the gate report");
  // IMP-01: every attempt failed → the canonical store is untouched (no draft, no restore).
  assert.equal(io.chapterBytes.get("zz:1"), undefined, "no failed draft ever reaches canonical");
});

// ── doAuthorWrite ────────────────────────────────────────────────────────────

test("doAuthorWrite: runs the six compile/gate verbs in order and halts content on a gate block", async () => {
  const { deps, verbs } = mkDeps(() => ({}), (args) =>
    args[0] === "book-design-gate" ? { code: 1, stdout: "book-design-gate: BLOCK", stderr: "" } : { code: 0, stdout: "PASS", stderr: "" });
  const halt = await doAuthorWrite("zz", deps, { maxParallel: 2, io: mkIo() });
  assert.ok(halt && halt.status === "halt" && halt.category === "content", "exit 1 = content halt");
  assert.deepEqual(verbs.map((v) => v[0]), ["compile-source-packets", "source-packet-gate", "compile-book-design", "book-design-gate"], "verbs run in order, halting at the failing gate");
});

test("doAuthorWrite: a verb erroring (exit >= 2) halts infra, not content", async () => {
  const { deps } = mkDeps(() => ({}), (args) =>
    args[0] === "compile-chapter-briefs" ? { code: 2, stdout: "", stderr: "crash" } : { code: 0, stdout: "PASS", stderr: "" });
  const halt = await doAuthorWrite("zz", deps, { maxParallel: 2, io: mkIo() });
  assert.ok(halt && halt.status === "halt" && halt.category === "infra");
});

test("doAuthorWrite: spawns ONE whole-chapter writer per MISSING chapter only, then passes budgets", async () => {
  const written = new Set<number>([1]); // ch01 already on disk
  const { deps, spawns } = mkDeps((o) => {
    const m = o.sessionId.match(/^author-ch0*(\d+)/);
    if (m) written.add(Number(m[1]));
    return {};
  });
  const io = mkIo({ chapterExists: (_b, n) => written.has(n) });
  const halt = await doAuthorWrite("zz", deps, { maxParallel: 2, io });
  assert.equal(halt, null, "phase completes");
  const writers = spawns.filter((s) => s.sessionId.startsWith("author-ch"));
  assert.equal(writers.length, 1, "only the missing chapter is authored");
  assert.ok(writers[0].sessionId.startsWith("author-ch02"), "ch02 was the missing one");
});

test("doAuthorWrite: the normal book-level author path consults its central chapter-writer hook", async () => {
  const { deps, spawns } = mkDeps(() => ({}));
  const calls: Array<{ bookId: string; chapterNumber: number; ioSame: boolean }> = [];
  const io = mkIo({ chapterExists: () => false });
  const halt = await doAuthorWrite("zz", deps, {
    maxParallel: 2,
    io,
    writeOneChapter: async (bookId, chapterNumber, _authorDeps, opts) => {
      calls.push({ bookId, chapterNumber, ioSame: opts.io === io });
      return { ok: true, sessionId: `central-${chapterNumber}`, committed: true };
    },
  });
  assert.equal(halt, null);
  assert.deepEqual(calls.map((call) => call.chapterNumber).sort(), [1, 2]);
  assert.ok(calls.every((call) => call.bookId === "zz" && call.ioSame), "book coordinate and experiment-local IO pass through unchanged");
  assert.equal(spawns.length, 0, "the baseline writer is not also spawned when the central hook owns the chapter");
});

test("doAuthorWrite: a reader-budget BLOCKER halts content, naming the findings", async () => {
  const { deps } = mkDeps(() => ({}));
  // A budget wildly above the fixtures' real size → every chapter is 'under' → CHB2 blockers.
  const io = mkIo({ readBrief: (_b, ch) => mkBrief(ch, { lengthBudget: { renderedChars: 30000, tolerance: 0.2 } }) });
  const halt = await doAuthorWrite("zz", deps, { maxParallel: 2, io });
  assert.ok(halt && halt.status === "halt" && halt.category === "content", "budget blockers are write-time content defects");
  // STIER-3 rebase (documented): CHB2 findings are now REPAIR-ROUTABLE — the
  // round runs first (these no-op writers fail it), and the halt names either
  // the failed round or the still-blocking check. Fail-closed either way.
  if (halt && halt.status === "halt") assert.match(halt.reason, /CHB2\.length_budget|budget-repair round failed/, "the halt names the failing check or the failed repair round");
});

test("doAuthorWrite: a missing/corrupt name bank halts INFRA (never a silent CHB3 skip)", async () => {
  const { deps } = mkDeps(() => ({}));
  const halt = await doAuthorWrite("zz", deps, { maxParallel: 2, io: mkIo({ nameBankOk: () => false }) });
  assert.ok(halt && halt.status === "halt" && halt.category === "infra", "name-bank unavailability is infra, not content");
  if (halt && halt.status === "halt") assert.match(halt.reason, /name-bank/, "the halt names the name bank");
});

// ── doAuthorReview ───────────────────────────────────────────────────────────

test("doAuthorReview: acceptance writes the exact records the promote gate reads (attestation + bar + confirm per chapter)", async () => {
  const { deps, spawns } = mkDeps(happyScript);
  const io = mkIo();
  const result = await doAuthorReview("zz", deps, { maxParallel: 2, io });
  assert.equal(result, null, "review phase completes (same null-on-success shape as doQcWithRepair)");

  const readerSpawns = spawns.filter((s) => s.sessionId.includes("author-review-ch"));
  assert.equal(readerSpawns.length, 2, "one blinded reader per chapter");
  assert.ok(readerSpawns.every((s) => s.sandbox === "read-only"), "readers are read-only");
  const bookSpawns = spawns.filter((s) => s.sessionId.includes("author-book-reader"));
  assert.equal(bookSpawns.length, 3, "THREE independent book readers (Q5)");

  assert.equal(io.attestations.length, 2, "one attestation per chapter");
  for (const ch of FIXTURE_CHAPTERS) {
    const att = io.attestations.find((a) => a.chapterNumber === ch.number)!;
    assert.equal(att.verdict, "PUBLISHABLE");
    assert.equal(att.hashVersion, "v2");
    assert.equal(att.contentHash, chapterContentHash(ch), "bound to the chapter's content hash");
    assert.ok(isAttestationFresh(att, ch), "fresh by the promote gate's own predicate");
    assert.ok(isApprovedReviewer(att.reviewer), "reviewer role passes the promote gate's allowlist");
    assert.equal(att.roundId, "r20260101000000-abcdef", "backed by the opened QC round");
    assert.equal(att.roundRole, "confirm", "the role finalize stamps for PUBLISHABLE");
    assert.ok(att.reviewerSessionId && att.reviewerSessionId.includes(`author-review-ch0${ch.number}`), "reviewer session id comes from the chapter's review artifact");

    const bar = io.bars.find((b) => b.chapterNumber === ch.number)!;
    assert.equal(bar.contentHash, chapterContentHash(ch), "bar artifact hash-matches (checkBarConfirmArtifactsForPublishable)");
    assert.equal(bar.chapterId, ch.chapterId);
    const confirm = io.confirms.find((c) => c.chapterNumber === ch.number)!;
    assert.equal(confirm.decision, "PUBLISHABLE", "confirm decision the promote gate requires");
    assert.equal(confirm.contentHash, chapterContentHash(ch));
  }
});

test("doAuthorReview: regeneration carries the review complaints; cap = original + ONE regen, then a content halt with the table", async () => {
  const complaints = [{ unit: "quiz Q2", problem: "the key contradicts the prose", mustFix: true }];
  const { deps, spawns } = mkDeps((o) => {
    const m = o.sessionId.match(/author-review-ch0*(\d+)/);
    if (m) return { finalMessage: reviewReply(Number(m[1]) === 1 ? CH1 : CH2, { ship84: false, score: 60, complaints }) };
    if (o.sessionId.includes("author-book-reader")) return { finalMessage: bookReply(FIXTURE_CHAPTERS) };
    return {};
  });
  const result = await doAuthorReview("zz", deps, { maxParallel: 2, io: mkIo() });
  assert.ok(result && result.status === "halt" && result.category === "content", "still-failing chapters halt content");
  if (result && result.status === "halt") {
    assert.match(result.reason, /still fail independent review after the regen cap/);
    assert.match(result.reason, /ch01/);
    // The stub writer leaves the chapter byte-identical, so the no-op regen
    // guard (verifier finding) reports it — the complaint text still reaches
    // the WRITER via the card, asserted below.
    assert.match(result.reason, /byte-identical/, "the halt table carries the no-op regen reason");
  }
  const regens = spawns.filter((s) => s.sessionId.startsWith("author-ch"));
  assert.equal(regens.length, 2, "exactly ONE regen per failing chapter (cap 2 total write attempts)");
  for (const regen of regens) {
    assert.ok(regen.task.includes("PRIOR-ATTEMPT COMPLAINTS"), "regen is regeneration-with-complaints, not blind patching");
    assert.ok(regen.task.includes("quiz Q2: the key contradicts the prose (must fix)"), "the reader's complaint reaches the writer");
  }
  assert.equal(spawns.filter((s) => s.sessionId.includes("author-book-reader")).length, 0, "book acceptance never runs while chapters fail");
});

test("doAuthorReview: acceptance rejection drives ONE targeted regen round (<= 3 chapters), re-runs acceptance ONCE, then halts content", async () => {
  let bookRounds = 0;
  let regenBumps = 0; // regen writers CHANGE bytes (else the no-op guard correctly fails them)
  const chaptersNow = () => FIXTURE_CHAPTERS.map((c) => (regenBumps > 0 && c.number === 1 ? { ...c, hook: `${c.hook} (regen ${regenBumps})` } : c));
  const { deps, spawns } = mkDeps((o) => {
    if (o.sessionId.startsWith("author-ch01")) {
      regenBumps++;
      return { candidate: chaptersNow()[0] }; // the regen writer CHANGES bytes (IMP-01: candidate in workspace)
    }
    if (o.sessionId.includes("author-book-reader")) {
      if (o.sessionId.includes("-r2")) return { finalMessage: "no json here" }; // never parses twice — keep 2 readers/round
      bookRounds++;
      return { finalMessage: bookReply(chaptersNow(), { gate: "FAIL", verdictText: "chapter 1 quiz key is contradicted by its own prose" }) };
    }
    const m = o.sessionId.match(/author-review-ch0*(\d+)/);
    if (m) return { finalMessage: reviewReply(Number(m[1]) === 1 ? chaptersNow()[0] : CH2) };
    return {};
  });
  const result = await doAuthorReview("zz", deps, { maxParallel: 2, io: mkIo({ loadChapters: () => chaptersNow() }) });
  assert.ok(result && result.status === "halt" && result.category === "content", "a twice-rejected acceptance halts content");
  if (result && result.status === "halt") assert.match(result.reason, /still REJECTED after the one targeted regen round/);
  const regens = spawns.filter((s) => s.sessionId.startsWith("author-ch"));
  assert.ok(regens.length >= 1 && regens.length <= 3, `targeted regen round is capped at 3 chapters (got ${regens.length})`);
  assert.ok(regens.every((s) => s.sessionId.startsWith("author-ch01")), "the book complaint was mapped to ITS chapter (ch01)");
  assert.ok(regens[0].task.includes("book reader verdict"), "regen complaints come from the book readers");
  const acceptanceSpawns = spawns.filter((s) => s.sessionId.includes("author-book-reader") && !s.sessionId.includes("-r2"));
  assert.equal(acceptanceSpawns.length, 6, "exactly two acceptance rounds (3 readers each, Q5) — re-run ONCE");
});

// ── F-03: acceptance-regen regression safety ─────────────────────────────────

test("decideAcceptanceRegenOutcome: FAIL/write-fail restore; pass-below-band restores; pass-within-band + boundary keep", () => {
  const band = 4;
  const prior = 85;
  // write failed → restore (regardless of any review numbers).
  assert.equal(decideAcceptanceRegenOutcome({ regenOk: false, reviewPass: false, composite: 0, priorComposite: prior, band }), "restore-fail");
  // regen wrote but its review FAILs → restore.
  assert.equal(decideAcceptanceRegenOutcome({ regenOk: true, reviewPass: false, composite: 88, priorComposite: prior, band }), "restore-fail");
  // passes but composite fell MORE than a band below prior → restore-regress.
  assert.equal(decideAcceptanceRegenOutcome({ regenOk: true, reviewPass: true, composite: prior - band - 0.1, priorComposite: prior, band }), "restore-regress");
  // passes within the band (dipped, but tolerated) → keep.
  assert.equal(decideAcceptanceRegenOutcome({ regenOk: true, reviewPass: true, composite: prior - band + 0.1, priorComposite: prior, band }), "keep");
  // BOUNDARY: composite exactly prior − band is WITHIN band → keep (not strictly-better).
  assert.equal(decideAcceptanceRegenOutcome({ regenOk: true, reviewPass: true, composite: prior - band, priorComposite: prior, band }), "keep");
  // passes above prior → keep.
  assert.equal(decideAcceptanceRegenOutcome({ regenOk: true, reviewPass: true, composite: prior + 3, priorComposite: prior, band }), "keep");
  // unknown prior composite → regression cannot be judged, a PASS is kept.
  assert.equal(decideAcceptanceRegenOutcome({ regenOk: true, reviewPass: true, composite: 10, priorComposite: undefined, band }), "keep");
  // per-round comparison uses the caller's pre-reopen prior — a band-6 default
  // over a prior 84 keeps 79 (79 >= 84-6=78) but restores 77.
  assert.equal(decideAcceptanceRegenOutcome({ regenOk: true, reviewPass: true, composite: 79, priorComposite: 84, band: 6 }), "keep");
  assert.equal(decideAcceptanceRegenOutcome({ regenOk: true, reviewPass: true, composite: 77, priorComposite: 84, band: 6 }), "restore-regress");
});

test("doAuthorReview: an acceptance regen whose review FAILs is RESTORED — reopen note attributed, grant consumed, halt category unchanged", async () => {
  // ch01 review passes; book acceptance REJECTS (churn LOW → non-churn routing,
  // maps the named complaint to ch01); the regen CHANGES bytes but its review
  // FAILs → the prior passing chapter must be restored, not left failing.
  let regenBumps = 0;
  const chaptersNow = () => FIXTURE_CHAPTERS.map((c) => (regenBumps > 0 && c.number === 1 ? { ...c, hook: `${c.hook} (regen ${regenBumps})` } : c));
  const { deps, spawns } = mkDeps((o) => {
    if (o.sessionId.startsWith("author-ch01")) regenBumps++;
    if (o.sessionId.includes("author-book-reader")) {
      if (o.sessionId.includes("-r2")) return { finalMessage: "no json here" };
      return { finalMessage: bookReply(chaptersNow(), { gate: "FAIL", churn: "LOW", verdictText: "chapter 1 quiz key is contradicted by its own prose" }) };
    }
    const m = o.sessionId.match(/author-review-ch0*(\d+)/);
    if (m) {
      // The post-regen review of ch01 FAILs hard (well below the near-bar band).
      if (o.sessionId.includes("bookregen")) {
        return { finalMessage: reviewReply(chaptersNow()[0], { ship84: false, score: 52, complaints: [{ unit: "quiz Q2", problem: "the derived answer contradicts the stated key", mustFix: true }] }) };
      }
      return { finalMessage: reviewReply(Number(m[1]) === 1 ? chaptersNow()[0] : CH2) };
    }
    return {};
  });
  const io = mkIo({ loadChapters: () => chaptersNow() });
  const result = await doAuthorReview("zz", deps, { maxParallel: 2, io });
  assert.ok(result && result.status === "halt" && result.category === "content", "a still-failing regen halts content (category unchanged)");
  if (result && result.status === "halt") assert.match(result.reason, /targeted regen round failed/, "the restore path routes into the existing failed-regen halt");
  // The intent to reopen a passing chapter is attributed durably.
  const note = io.reopenNotes.find((n) => n.chapterNumber === 1);
  assert.ok(note, "a reopen note was appended for the reopened chapter");
  assert.equal(note!.trigger, "acceptance-regen", "trigger names the acceptance lane");
  assert.equal(note!.decision, "reopened-for-acceptance");
  assert.ok((note!.detail ?? "").length > 0, "the reopen note carries the reader complaint that selected the chapter");
  // The grant is consumed at spawn and a restore does NOT refund it.
  assert.equal(io.regenConsumedFor!("zz", 1), 1, "the acceptance regen consumed its global-cap grant (restore does not refund)");
  const regens = spawns.filter((s) => s.sessionId.startsWith("author-ch01"));
  assert.equal(regens.length, 1, "exactly one regen write spawned for the reopened chapter");
});

// Real on-disk chapter file path (identical to the source's chapterFilePath).
function realChapterPath(bookId: string, n: number): string {
  return join(CHAPTERS_DIR, chapterFileName(authorChapterId(bookId, n)));
}
const CH_BYTES = (ch: ChapterV21) => JSON.stringify(ch, null, 2) + "\n";

/** Drive doAuthorReview to the acceptance-regen block over REAL chapter files on
 *  disk. The writer spawn writes `regressedCh1` to disk (a genuine byte change);
 *  the post-regen review scores `regenScore` (pass gated at bar 80). Returns the
 *  halt + the io (with captured reopen notes) + the final on-disk ch01 bytes. */
async function driveRealFileAcceptanceRegen(opts: {
  bookId: string;
  initialCh1Score: number;
  regenScore: number;
  regressedCh1: ChapterV21;
}): Promise<{ result: Awaited<ReturnType<typeof doAuthorReview>>; io: ReturnType<typeof mkIo>; ch1Bytes: string; originalBytes: string }> {
  const { bookId } = opts;
  const p1 = realChapterPath(bookId, 1);
  const p2 = realChapterPath(bookId, 2);
  const originalBytes = CH_BYTES(CH1);
  rmSync(reviewDir(bookId), { recursive: true, force: true }); // no stale carry
  mkdirSync(dirname(p1), { recursive: true });
  writeFileSync(p1, originalBytes, "utf8");
  writeFileSync(p2, CH_BYTES(CH2), "utf8");
  const readDisk = (): ChapterV21[] => [JSON.parse(readFileSync(p1, "utf8")), JSON.parse(readFileSync(p2, "utf8"))];
  const { deps } = mkDeps((o) => {
    if (o.sessionId.startsWith("author-ch01")) {
      // Simulate the whole-chapter writer: persist a CHANGED draft to disk.
      writeFileSync(p1, CH_BYTES(opts.regressedCh1), "utf8");
      return {};
    }
    if (o.sessionId.includes("author-book-reader")) {
      if (o.sessionId.includes("-r2")) return { finalMessage: "no json here" };
      return { finalMessage: bookReply(readDisk(), { gate: "FAIL", churn: "LOW", verdictText: "chapter 1 quiz key is contradicted by its own prose" }) };
    }
    const m = o.sessionId.match(/author-review-ch0*(\d+)/);
    if (m) {
      const disk = readDisk();
      if (o.sessionId.includes("bookregen")) {
        return { finalMessage: reviewReply(disk[0], { score: opts.regenScore, ship84: opts.regenScore >= 80 }) };
      }
      return { finalMessage: reviewReply(Number(m[1]) === 1 ? disk[0] : disk[1], { score: Number(m[1]) === 1 ? opts.initialCh1Score : 90 }) };
    }
    return {};
  });
  const io = mkIo({ loadChapters: readDisk, chapterExists: () => true });
  const result = await doAuthorReview(bookId, deps, { maxParallel: 2, io });
  return { result, io, ch1Bytes: readFileSync(p1, "utf8"), originalBytes };
}

test("doAuthorReview (real files): an acceptance regen whose review FAILs restores the prior bytes BYTE-FOR-BYTE + rolls provenance back (R2)", async () => {
  const bookId = "zz-fixture-regen-fail";
  const p1 = realChapterPath(bookId, 1), p2 = realChapterPath(bookId, 2);
  const chapterId = authorChapterId(bookId, 1);
  try {
    // Seed the STALE record the acceptance regen leaves behind: content bound to the
    // discarded regen draft (regen-B), with the true prior author (author-A) recorded.
    const regressedCh1 = { ...CH1, hook: `${CH1.hook} (regressed regen draft that fails review)` };
    const hashPrior = chapterContentHash(CH1);
    const hashDiscarded = chapterContentHash(regressedCh1);
    recordAuthorProvenance(chapterId, "author-A", hashPrior);
    recordAuthorProvenance(chapterId, "regen-B", hashDiscarded);
    assert.equal(loadAuthorProvenance(chapterId)?.authorSessionId, "regen-B", "precondition: record points at the discarded regen draft");

    const { result, io, ch1Bytes, originalBytes } = await driveRealFileAcceptanceRegen({
      bookId,
      initialCh1Score: 90,
      regenScore: 55, // < bar 80 → the regen review FAILs
      regressedCh1,
    });
    assert.ok(result && result.status === "halt" && result.category === "content", "a still-failing regen halts content");
    assert.equal(ch1Bytes, originalBytes, "the failing regen was restored to the prior passing bytes, byte-for-byte");
    assert.ok(io.reopenNotes.some((n) => n.chapterNumber === 1 && n.trigger === "acceptance-regen"), "the reopen was attributed");
    const rec = loadAuthorProvenance(chapterId);
    assert.equal(rec?.contentHash, hashPrior, "provenance content hash rolled back to the restored bytes");
    assert.equal(rec?.authorSessionId, "author-A", "provenance author rolled back to the true prior author");
  } finally {
    rmSync(p1, { force: true }); rmSync(p2, { force: true }); rmSync(reviewDir(bookId), { recursive: true, force: true });
    rmSync(provenancePath(chapterId), { force: true });
  }
});

test("doAuthorReview (real files): a regen that PASSES but scores a band+ below prior is RESTORED (no silent quality slide)", async () => {
  const bookId = "zz-fixture-regen-regress";
  const p1 = realChapterPath(bookId, 1), p2 = realChapterPath(bookId, 2);
  try {
    // prior 95, regen passes at 82 (>= bar 80) but 82 < 95 − 3.7 = 91.3 → restore-regress.
    const { result, io, ch1Bytes, originalBytes } = await driveRealFileAcceptanceRegen({
      bookId,
      initialCh1Score: 95,
      regenScore: 82,
      regressedCh1: { ...CH1, hook: `${CH1.hook} (passing but lower-quality regen draft)` },
    });
    assert.ok(result && result.status === "halt" && result.category === "content", "a below-band PASS is counted as a failure and halts (the rejection stands)");
    assert.equal(ch1Bytes, originalBytes, "the regressed-quality PASS was restored to the higher-scoring prior bytes");
    assert.ok(io.reopenNotes.some((n) => n.chapterNumber === 1 && n.trigger === "acceptance-regen"));
  } finally {
    rmSync(p1, { force: true }); rmSync(p2, { force: true }); rmSync(reviewDir(bookId), { recursive: true, force: true });
  }
});

test("doAuthorReview (real files): a REVIEW-LANE regen whose WRITE fails restores prior bytes + rolls provenance back (F-2 case c — the ch14 loss)", async () => {
  // The live loss this pins: a failing chapter's regen writer landed a draft that
  // then failed its own write self-checks (gate/contract); the unreviewed draft
  // replaced the reviewed original on disk (high-output-management ch14 — the
  // 87-composite original was lost). The review-lane call-site must restore the
  // prior bytes AND re-bind provenance to them.
  const bookId = "zz-fixture-reviewregen-fail";
  const p1 = realChapterPath(bookId, 1), p2 = realChapterPath(bookId, 2);
  const chapterId = authorChapterId(bookId, 1);
  try {
    const originalBytes = CH_BYTES(CH1);
    rmSync(reviewDir(bookId), { recursive: true, force: true });
    mkdirSync(dirname(p1), { recursive: true });
    writeFileSync(p1, originalBytes, "utf8");
    writeFileSync(p2, CH_BYTES(CH2), "utf8");
    const readDisk = (): ChapterV21[] => [JSON.parse(readFileSync(p1, "utf8")), JSON.parse(readFileSync(p2, "utf8"))];
    const regressed = { ...CH1, hook: `${CH1.hook} (regen draft that will fail its own write gate)` };
    // Seed a STALE provenance record (bound to the draft that will be discarded)
    // over the true prior author — the rollback must land on author-A@prior.
    const hashPrior = chapterContentHash(CH1);
    recordAuthorProvenance(chapterId, "author-A", hashPrior);
    recordAuthorProvenance(chapterId, "regen-B", chapterContentHash(regressed));
    const logs: string[] = [];
    const { deps } = mkDeps(
      (o) => {
        if (o.sessionId.startsWith("author-ch01")) {
          writeFileSync(p1, CH_BYTES(regressed), "utf8"); // the writer LANDS its draft pre-check
          return {};
        }
        const m = o.sessionId.match(/author-review-ch0*(\d+)/);
        if (m) return { finalMessage: reviewReply(Number(m[1]) === 1 ? readDisk()[0] : readDisk()[1], { score: Number(m[1]) === 1 ? 55 : 90, ship84: Number(m[1]) !== 1 }) };
        return {};
      },
      // The regen writer's own gate blocks every attempt → total write failure.
      (args) => args[0] === "gate-chapter" ? { code: 1, stdout: "[BLOCKER A12] ch01: fixture gate block", stderr: "" } : { code: 0, stdout: "", stderr: "" },
    );
    deps.log = ((m: string) => { logs.push(m); }) as never;
    const io = mkIo({ loadChapters: readDisk, chapterExists: () => true });
    const result = await doAuthorReview(bookId, deps, { maxParallel: 2, io });
    assert.ok(result && result.status === "halt" && result.category === "content", "the failed regen halts content — review/PASS state is NOT advanced");
    assert.equal(readFileSync(p1, "utf8"), originalBytes, "prior reviewed bytes restored byte-for-byte");
    assert.ok(logs.some((l) => l.includes("regen write failed") && l.includes("restored prior reviewed bytes")), "the review-lane restore is loudly logged");
    const rec = loadAuthorProvenance(chapterId);
    assert.equal(rec?.contentHash, hashPrior, "provenance content hash re-bound to the restored bytes");
    assert.equal(rec?.authorSessionId, "author-A", "provenance author rolled back to the true prior author");
  } finally {
    rmSync(p1, { force: true }); rmSync(p2, { force: true }); rmSync(reviewDir(bookId), { recursive: true, force: true });
    rmSync(provenancePath(chapterId), { force: true });
  }
});

test("acceptance-regen carry invariant: restored bytes (== prior) still CARRY their durable PASS — no re-review needed", () => {
  const bookId = "zz-fixture-regen-carry";
  const scores = Object.fromEntries(REVIEW_FACTORS.map((f) => [f, 88]));
  const priorReview: ChapterReviewV1 = {
    schemaVersion: CHAPTER_REVIEW_SCHEMA_VERSION,
    chapterId: CH1.chapterId, chapterNumber: 1,
    contentHash: chapterContentHash(CH1),
    reviewerSessionId: "indep-reviewer-x",
    scores: scores as never, composite: 88, ship84: true, pass: true, valid: true,
    keyCheck: { derived: [], matches: 9, of: 9, disagreements: [] },
    quotes: [{ quote: CH1.title, why: "ok", verified: true }],
    tells: [], complaints: [], oneParagraphVerdict: "ships",
    bar: 80, docHash: chapterReaderDocHash(CH1), hashVersion: REVIEW_DOC_HASH_VERSION,
    reviewedAt: new Date().toISOString(),
  };
  try {
    // The prior PASS lives in the content-keyed history; a restore puts the exact
    // prior bytes back, so a later entry re-verifies the SAME contentHash + doc.
    appendReviewHistory(bookId, priorReview);
    const carry = carryReviewFor(bookId, CH1, 80, "some-current-author");
    assert.ok(carry.hit, "restored (== prior) bytes carry their durable PASS — no fresh reader spawned");
    if (carry.hit) assert.equal(carry.review.composite, 88);
    // A different-author independence guard still holds (reviewer ≠ author).
    const collide = carryReviewFor(bookId, CH1, 80, "indep-reviewer-x");
    assert.equal(collide.hit, false, "the prior review never carries for a same-session author (independence preserved)");
  } finally {
    rmSync(reviewDir(bookId), { recursive: true, force: true });
  }
});

// ── F-04: churn-HIGH acceptance rejections route to the bounded content lane FIRST ──

function mkContentOutcome(n: number, status: SamenessChapterOutcome["status"]): SamenessChapterOutcome {
  return { chapterNumber: n, assignedFamily: "content-deal", status, detail: `stub ${status}` };
}
function mkContentResult(outcomes: SamenessChapterOutcome[], fired = true): ContentRepairResult {
  return {
    fired,
    targets: outcomes.map((o) => o.chapterNumber),
    preserved: [],
    outcomes,
    preservedViolations: [],
    overCapDevices: fired ? ["returnProof"] : [],
    residualOverCap: [],
  };
}

test("F-04: churn-HIGH rejection runs the content lane FIRST — kept chapters record contentRepairConsumed and never touch the regen lane", async () => {
  const tmpRoot = mkdtempSync(join(tmpdir(), "p4-ledger-"));
  const LIN = "p4-test-lineage";
  const calls: string[] = [];
  let contentRan = false;
  // Once the content lane fires, the book's bytes change → round-2 sees a fresh docSha.
  const chaptersNow = () => FIXTURE_CHAPTERS.map((c) => (contentRan ? { ...c, hook: `${c.hook} (content-repaired)` } : c));
  const contentDeviceRepair: AuthorReviewIo["contentDeviceRepair"] = async (b) => {
    calls.push(b);
    // Mirror the real lane's bounded side effect: consume ONE content-repair grant per target.
    for (const n of [1, 2]) recordContentRepairConsumed(b, n, LIN, tmpRoot);
    contentRan = true;
    return mkContentResult([mkContentOutcome(1, "diversified"), mkContentOutcome(2, "diversified")]);
  };
  const { deps, spawns } = mkDeps((o) => {
    if (o.sessionId.includes("author-book-reader")) {
      const round2 = o.sessionId.includes("-round2");
      return { finalMessage: bookReply(chaptersNow(), round2 ? { gate: "PASS", churn: "LOW" } : { gate: "FAIL", churn: "HIGH", verdictText: "one template stamped across every chapter" }) };
    }
    const m = o.sessionId.match(/author-review-ch0*(\d+)/);
    if (m) return { finalMessage: reviewReply(chaptersNow()[Number(m[1]) - 1]) };
    return {};
  });
  const io = mkIo({ loadChapters: () => chaptersNow(), contentDeviceRepair });
  const result = await doAuthorReview("zz", deps, { maxParallel: 2, io });

  assert.equal(result, null, "the content lane's kept re-authors flip the sticky same-bytes FAIL — accepted on the new docSha");
  assert.equal(calls.length, 1, "the content lane ran exactly once, before any regen");
  assert.equal(contentRepairConsumedFor(loadAuthorRegenLedger("zz", tmpRoot), 1, LIN), 1, "ch01 recorded its content-repair grant");
  assert.equal(contentRepairConsumedFor(loadAuthorRegenLedger("zz", tmpRoot), 2, LIN), 1, "ch02 recorded its content-repair grant");
  assert.equal(io.regenConsumedFor!("zz", 1), 0, "the GLOBAL regen lane was NOT spent on a content-fixed chapter");
  assert.equal(io.regenConsumedFor!("zz", 2), 0, "the GLOBAL regen lane was NOT spent on a content-fixed chapter");
  assert.equal(spawns.filter((s) => /^author-ch\d/.test(s.sessionId)).length, 0, "no regen WRITER spawned — the content lane handled the round");
  rmSync(tmpRoot, { recursive: true, force: true });
});

test("F-04: a content-lane devices-persisted chapter (and ONLY it) falls through to the F-03-guarded regen; content-fixed chapters do not", async () => {
  let contentRan = false;
  let ch1Regen = 0;
  const chaptersNow = () => FIXTURE_CHAPTERS.map((c) => {
    if (c.number === 1 && ch1Regen > 0) return { ...c, hook: `${c.hook} (regen ${ch1Regen})` };
    if (contentRan) return { ...c, hook: `${c.hook} (content)` };
    return c;
  });
  const contentDeviceRepair: AuthorReviewIo["contentDeviceRepair"] = async () => {
    contentRan = true;
    // ch1 still uses a banned device (unfixed → regen fallthrough); ch2 diversified (fixed).
    return mkContentResult([mkContentOutcome(1, "devices-persisted"), mkContentOutcome(2, "diversified")]);
  };
  const { deps, spawns } = mkDeps((o) => {
    if (o.sessionId.startsWith("author-ch01")) ch1Regen++;
    if (o.sessionId.includes("author-book-reader")) {
      const round2 = o.sessionId.includes("-round2");
      return { finalMessage: bookReply(chaptersNow(), round2 ? { gate: "PASS", churn: "LOW" } : { gate: "FAIL", churn: "HIGH", verdictText: "one template stamped repeatedly" }) };
    }
    const m = o.sessionId.match(/author-review-ch0*(\d+)/);
    if (m) return { finalMessage: reviewReply(chaptersNow()[Number(m[1]) - 1], { score: 84 }) }; // passes, but < 87 (not strong-pass)
    return {};
  });
  const io = mkIo({ loadChapters: () => chaptersNow(), contentDeviceRepair });
  const result = await doAuthorReview("zz", deps, { maxParallel: 2, io });

  assert.equal(result, null, "ch1 regen + ch2 content-fix flip the round → accepted on round 2");
  assert.equal(io.regenConsumedFor!("zz", 1), 1, "the devices-persisted ch01 fell through and spent ONE regen");
  assert.equal(io.regenConsumedFor!("zz", 2), 0, "the content-fixed ch02 never entered the regen lane");
  const regenWriters = spawns.filter((s) => /^author-ch\d/.test(s.sessionId));
  assert.equal(regenWriters.length, 1, "exactly one regen writer spawned");
  assert.ok(regenWriters.every((s) => s.sessionId.startsWith("author-ch01")), "and it was ch01 (the unfixed chapter), never ch02");
  const note = io.reopenNotes.find((n) => n.chapterNumber === 1);
  assert.ok(note && note.trigger === "acceptance-regen", "F-03 reopen note attributed for the fallthrough regen");
});

test("F-04: churn HIGH with BOTH lanes spent for every target halts content with the content-repair-book escape hatch", async () => {
  const contentDeviceRepair: AuthorReviewIo["contentDeviceRepair"] = async () =>
    mkContentResult([mkContentOutcome(1, "skipped-cap"), mkContentOutcome(2, "skipped-cap")]);
  const { deps, spawns } = mkDeps((o) => {
    if (o.sessionId.includes("author-book-reader")) {
      return { finalMessage: bookReply(FIXTURE_CHAPTERS, { gate: "FAIL", churn: "HIGH", verdictText: "one template stamped repeatedly" }) };
    }
    const m = o.sessionId.match(/author-review-ch0*(\d+)/);
    if (m) return { finalMessage: reviewReply(FIXTURE_CHAPTERS[Number(m[1]) - 1], { score: 84 }) };
    return {};
  });
  // Regen already exhausted for every chapter (a prior conductor entry spent them).
  const io = mkIo({ contentDeviceRepair, regenConsumedFor: () => AUTHOR_REGEN_CAP - 1 });
  const result = await doAuthorReview("zz", deps, { maxParallel: 2, io });

  assert.ok(result && result.status === "halt" && result.category === "content", "both lanes spent → content halt");
  if (result && result.status === "halt") {
    assert.match(result.reason, /BOTH bounded repair lanes are spent/, "the halt names the both-lanes-spent state");
    assert.match(result.reason, /content-repair-book zz --only/, "the halt names the manual escape hatch");
  }
  assert.equal(spawns.filter((s) => /^author-ch\d/.test(s.sessionId)).length, 0, "no regen writer burned — halted instead of spending unrelated regen");
});

test("F-04 kill switch: CHAPTERFLOW_CHURN_CONTENT_REPAIR=0 never calls the content lane and restores pre-P4 regen routing", async () => {
  const prev = process.env.CHAPTERFLOW_CHURN_CONTENT_REPAIR;
  process.env.CHAPTERFLOW_CHURN_CONTENT_REPAIR = "0";
  try {
    let called = 0;
    const contentDeviceRepair: AuthorReviewIo["contentDeviceRepair"] = async () => { called++; return mkContentResult([]); };
    const { deps, spawns } = mkDeps((o) => {
      if (o.sessionId.includes("author-book-reader")) {
        if (o.sessionId.includes("-round2")) return { finalMessage: "no json here" };
        return { finalMessage: bookReply(FIXTURE_CHAPTERS, { gate: "FAIL", churn: "HIGH", verdictText: "chapter 1 reads stamped" }) };
      }
      const m = o.sessionId.match(/author-review-ch0*(\d+)/);
      if (m) return { finalMessage: reviewReply(FIXTURE_CHAPTERS[Number(m[1]) - 1]) };
      return {};
    });
    const io = mkIo({ contentDeviceRepair });
    const result = await doAuthorReview("zz", deps, { maxParallel: 2, io });
    assert.equal(called, 0, "the content lane is NEVER called when the kill switch is off");
    assert.ok(spawns.some((s) => /^author-ch\d/.test(s.sessionId)), "pre-P4 named+saturation churn routing spent a regen writer (old behavior restored)");
    assert.ok(result && result.status === "halt", "the pre-P4 path reaches its halt");
  } finally {
    if (prev === undefined) delete process.env.CHAPTERFLOW_CHURN_CONTENT_REPAIR;
    else process.env.CHAPTERFLOW_CHURN_CONTENT_REPAIR = prev;
  }
});

test("F-04: a NON-churn acceptance rejection never calls the content lane (routing unchanged)", async () => {
  let called = 0;
  const contentDeviceRepair: AuthorReviewIo["contentDeviceRepair"] = async () => { called++; return mkContentResult([]); };
  const { deps } = mkDeps((o) => {
    if (o.sessionId.includes("author-book-reader")) {
      if (o.sessionId.includes("-round2")) return { finalMessage: "no json here" };
      return { finalMessage: bookReply(FIXTURE_CHAPTERS, { gate: "FAIL", churn: "LOW", verdictText: "chapter 1 quiz key contradicts its prose" }) };
    }
    const m = o.sessionId.match(/author-review-ch0*(\d+)/);
    if (m) return { finalMessage: reviewReply(FIXTURE_CHAPTERS[Number(m[1]) - 1]) };
    return {};
  });
  const io = mkIo({ contentDeviceRepair });
  const result = await doAuthorReview("zz", deps, { maxParallel: 2, io });
  assert.equal(called, 0, "churn LOW → the content lane is never engaged");
  assert.ok(result && result.status === "halt" && result.category === "content", "non-churn routing halts content as before");
});

test("mapBookComplaintsToChapters: chapter-specific lines route to their chapters; cap 3; generic rejections fall back to the sample", () => {
  const mk = (o: { disagreements?: string[]; verdict?: string }) => ({
    keyCheck: { matches: 0, of: 0, disagreements: o.disagreements ?? [] },
    oneParagraphVerdict: o.verdict ?? "",
    gateVerdict: "FAIL" as const,
    churn: "HIGH" as const,
  });
  const routed = mapBookComplaintsToChapters(
    [mk({ disagreements: ["ch3 Q1: derived a vs key b"], verdict: "chapter 7 feels stamped" })],
    [1, 3, 7, 9],
  );
  assert.deepEqual([...routed.keys()], [3, 7], "named chapters routed; unmentioned sampled chapters excluded");
  const capped = mapBookComplaintsToChapters(
    [mk({ verdict: "chapter 1, chapter 3, chapter 7 and chapter 9 all share one skeleton" })],
    [1, 3, 7, 9],
  );
  assert.equal(capped.size, 3, "capped at 3 chapters");
  assert.deepEqual([...capped.keys()], [1, 3, 7], "deterministic: lowest chapter numbers first");
  const fallback = mapBookComplaintsToChapters([mk({ verdict: "one template stamped twelve times" })], [2, 5, 8, 11]);
  assert.deepEqual([...fallback.keys()], [2, 5, 8], "no chapter named → first 3 sampled chapters");
  assert.ok([...fallback.values()].every((lines) => lines.some((l) => l.includes("one template stamped"))), "fallback carries the readers' verdicts as complaints");
});

test("complaintsOf: explicit complaints win; else quote whys + key disagreements; never empty", () => {
  const base = {
    schemaVersion: "chapterflow-review-v1", chapterId: "zz-ch01", chapterNumber: 1, contentHash: "x",
    reviewerSessionId: "s", scores: {} as never, composite: 70, ship84: false, pass: false, valid: true,
    keyCheck: { derived: [], matches: 1, of: 2, disagreements: ["Q2: reader=a key=b"] },
    quotes: [{ quote: "q", why: "the deep read restates the fast read", verified: true }],
    tells: [], complaints: [], oneParagraphVerdict: "",
  } as never;
  const fromFallback = complaintsOf(base);
  assert.ok(fromFallback.some((c) => c.includes("restates the fast read")));
  assert.ok(fromFallback.some((c) => c.includes("Q2: reader=a key=b")));
  const explicit = complaintsOf({ ...(base as object), complaints: [{ unit: "hook", problem: "generic", mustFix: false }] } as never);
  assert.deepEqual(explicit, ["hook: generic"]);
  const generic = complaintsOf({ ...(base as object), quotes: [], keyCheck: { derived: [], matches: 0, of: 0, disagreements: [] } } as never);
  assert.equal(generic.length, 1, "a bare refusal still produces one actionable line");
});

// ── the full author ladder through runAutopilot ──────────────────────────────

test("author arch ladder: write→gate→review→ready; sweepConfirmed is SUBSTITUTED by book acceptance (deps.sweepConfirmed never consulted)", async () => {
  const mkStatus = (o: Partial<BookStatus>): BookStatus => ({
    bookId: "zz", stage: "write-chapter", phase: "", expectedChapters: 2,
    writtenChapters: 0, gatedChapters: 0, qcdChapters: 0, bookGatePass: null,
    bookGateBlockers: 0, deterministicClean: true, packaged: false, publishable: false, guardrails: false,
    variety: null, nextCommand: "", nextLabel: "", chapters: [] as ChapterStatus[],
    ...o,
  });
  const ch = (n: number, qc: ChapterStatus["qcVerdict"] = "NONE", fresh = false): ChapterStatus =>
    ({ number: n, chapterId: `zz-ch0${n}`, written: true, shipGatePass: true, shipBlockers: 0, qcVerdict: qc, qcFresh: fresh });
  const statuses = [
    mkStatus({ writtenChapters: 0, expectedChapters: 2 }), // write
    mkStatus({ writtenChapters: 2, expectedChapters: 2, gatedChapters: 1, bookGatePass: false, chapters: [ch(1), ch(2)] }), // gate
    mkStatus({ writtenChapters: 2, expectedChapters: 2, gatedChapters: 2, bookGatePass: true, qcdChapters: 0, chapters: [ch(1), ch(2)] }), // qc → doAuthorReview
    mkStatus({ writtenChapters: 2, expectedChapters: 2, gatedChapters: 2, bookGatePass: true, qcdChapters: 2, publishable: true, chapters: [ch(1, "PUBLISHABLE", true), ch(2, "PUBLISHABLE", true)] }), // ready (iff substituted confirm)
  ];
  let si = 0;
  let sweepConfirmedCalls = 0;
  const logs: string[] = [];
  const written = new Set<number>();
  const { deps, spawns, verbs } = mkDeps((o) => {
    const w = o.sessionId.match(/^author-ch0*(\d+)/);
    if (w) written.add(Number(w[1]));
    return happyScript(o);
  });
  const io = mkIo({ chapterExists: (_b, n) => written.has(n) });
  const fullDeps: Partial<AutopilotDeps> = {
    ...deps,
    statusOf: () => statuses[Math.min(si++, statuses.length - 1)],
    sweepConfirmed: () => { sweepConfirmedCalls++; return false; }, // would BLOCK ready if consulted
    blockingMajors: () => [],
    bookRisk: () => ({ schemaVersion: "chapterflow-risk-score-v1", bookId: "zz", generatedAt: "", lane: "low", chapters: [], bookWideRisks: [] }) as never,
    acquireLock: () => ({ ok: true, release: () => {} }),
    latestRoundId: () => null,
    log: (m: string) => logs.push(m),
  };
  let centralWriterCalls = 0;
  const outcome = await runAutopilotWithoutProductionTelemetry({
    bookId: "zz",
    architecture: "author",
    deps: fullDeps,
    authorIo: io,
    authorWriteOneChapter: async (...args) => {
      centralWriterCalls++;
      return authorWriteOneChapter(...args);
    },
  });

  assert.equal(outcome.status, "ready", "the ladder converges to ready WITHOUT deps.sweepConfirmed ever corroborating");
  assert.equal(sweepConfirmedCalls, 0, "author arch substitutes book acceptance at the decidePhase call site — deps.sweepConfirmed is never consulted");
  assert.ok(verbs.some((v) => v[0] === "compile-chapter-briefs"), "author write compiled chapter briefs");
  assert.ok(verbs.some((v) => v[0] === "chapter-brief-gate"), "author write gated the briefs");
  assert.ok(!verbs.some((v) => v[0] === "fanout"), "legacy write fanout never runs in the author arch");
  assert.ok(!verbs.some((v) => v[0] === "deal-section-tasks"), "compiler section dealing never runs in the author arch");
  assert.ok(logs.some((l) => l.includes("skipping legacy broad pre-QC scouts")), "gate ran with preQcScouts:false (the existing skip path)");
  assert.equal(spawns.filter((s) => s.sessionId.startsWith("author-ch")).length, 2, "one whole-chapter writer per chapter");
  assert.equal(centralWriterCalls, 2, "runAutopilot threads the central chapter-writer hook into every missing author chapter");
  assert.equal(spawns.filter((s) => s.sessionId.includes("author-book-reader")).length, 3, "three book readers confirmed (Q5)");
  assert.equal(io.attestations.length, 2, "acceptance wrote the promote-gate attestations");
  const ids = spawns.map((s) => s.sessionId);
  assert.equal(new Set(ids).size, ids.length, "every spawn gets a DISTINCT session id");
});

test("ACTIVE forward author path uses one read-only gate and never calls legacy repair/doAuthorReview/ship84", async () => {
  const status: BookStatus = {
    bookId: "zz", stage: "qc", phase: "", expectedChapters: 2,
    writtenChapters: 2, gatedChapters: 2, qcdChapters: 0, bookGatePass: true,
    bookGateBlockers: 0, deterministicClean: true, packaged: false, publishable: false, guardrails: false,
    variety: null, nextCommand: "", nextLabel: "", chapters: [],
  };
  const { deps, spawns, verbs } = mkDeps(() => ({}));
  let legacyAcceptedReads = 0;
  const fullDeps: Partial<AutopilotDeps> = {
    ...deps,
    statusOf: () => status,
    authorAccepted: () => { legacyAcceptedReads++; return true; },
    acquireLock: () => ({ ok: true, release: () => {}, refresh: () => true }),
  };
  const forwardControl = {
    runtime: { schema: "forward-local-author-runtime-v1", mode: "FORWARD_ACTIVE" },
    writeOneChapter: async () => ({ ok: false as const, reason: "not reached" }),
    readBookAcceptance: () => ({ accepted: false, reason: "forward book sweep pending", artifactPath: "/forward/acceptance.json" }),
    finalizeBookAcceptance: async () => ({ accepted: false, reason: "forward book sweep pending", artifactPath: "/forward/acceptance.json" }),
    activationPolicyPath: "/forward/activation-policy.json",
    runtimeBindingPath: "/forward/runtime-binding.json",
  } as unknown as ForwardAutopilotControlV1;
  const outcome = await runAutopilotWithoutProductionTelemetry({
    bookId: "zz",
    architecture: "author",
    autoPublish: true,
    deps: fullDeps,
    forwardAutopilotControl: forwardControl,
    authorWriteOneChapter: forwardControl.writeOneChapter,
  });
  assert.equal(outcome.status, "halt");
  if (outcome.status === "halt") {
    assert.equal(outcome.phase, "gate");
    assert.match(outcome.reason, /forward book sweep pending/);
  }
  assert.equal(legacyAcceptedReads, 0, "legacy durable ship84/acceptance state is never consulted");
  assert.equal(spawns.length, 0, "legacy chapter/book readers never spawn");
  assert.equal(verbs.filter((verb) => verb[0] === "qc-converge").length, 1, "ACTIVE runs one deterministic read-only gate check");
  assert.ok(!verbs.some((verb) => verb[0] === "qc-diagnose"), "legacy gate-repair diagnostics never run");
  assert.ok(!verbs.some((verb) => verb[0] === "publish-final"), "autoPublish cannot escape the ACTIVE local-only policy");
});

test("ACTIVE forward acceptance reaches local READY while autoPublish remains forcibly disabled", async () => {
  const status: BookStatus = {
    bookId: "zz", stage: "qc", phase: "", expectedChapters: 2,
    writtenChapters: 2, gatedChapters: 2, qcdChapters: 0, bookGatePass: true,
    bookGateBlockers: 0, deterministicClean: true, packaged: false, publishable: false, guardrails: false,
    variety: null, nextCommand: "", nextLabel: "", chapters: [],
  };
  const { deps, spawns, verbs } = mkDeps(() => ({}));
  const forwardControl = {
    runtime: { schema: "forward-local-author-runtime-v1", mode: "FORWARD_ACTIVE" },
    writeOneChapter: async () => ({ ok: false as const, reason: "not reached" }),
    readBookAcceptance: () => ({ accepted: true, reason: "fresh forward sweep PASS", artifactPath: "/forward/acceptance.json" }),
    activationPolicyPath: "/forward/activation-policy.json",
    runtimeBindingPath: "/forward/runtime-binding.json",
  } as unknown as ForwardAutopilotControlV1;
  const outcome = await runAutopilotWithoutProductionTelemetry({
    bookId: "zz",
    architecture: "author",
    autoPublish: true,
    deps: {
      ...deps,
      statusOf: () => status,
      authorAccepted: () => { throw new Error("legacy acceptance must not run"); },
      acquireLock: () => ({ ok: true, release: () => {}, refresh: () => true }),
    },
    forwardAutopilotControl: forwardControl,
    authorWriteOneChapter: forwardControl.writeOneChapter,
  });
  assert.equal(outcome.status, "ready");
  if (outcome.status === "ready") {
    assert.match(outcome.message, /FORWARD LOCAL READY/);
    assert.match(outcome.message, /push remain disabled/);
  }
  assert.equal(spawns.length, 0);
  assert.ok(!verbs.some((verb) => verb[0] === "publish-final"), "ACTIVE readiness never publishes even when autoPublish=true");
});

test("ACTIVE dirty deterministic gate spends one durable deferred correction and then finalizes without legacy repair", async () => {
  const status: BookStatus = {
    bookId: "zz", stage: "gate", phase: "", expectedChapters: 2,
    writtenChapters: 2, gatedChapters: 1, qcdChapters: 0, bookGatePass: false,
    bookGateBlockers: 1, deterministicClean: false, packaged: false, publishable: false, guardrails: false,
    variety: null, nextCommand: "", nextLabel: "", chapters: [],
  };
  let gateReads = 0;
  const { deps, spawns, verbs } = mkDeps(
    () => ({}),
    (args) => args[0] === "qc-converge" && gateReads++ === 0
      ? { code: 1, stdout: "ch01: SEC83 repeated unit must be regenerated", stderr: "" }
      : { code: 0, stdout: "clean", stderr: "" },
  );
  let accepted = false;
  let correctionCalls = 0;
  let claimCalls = 0;
  const forwardControl = {
    runtime: { schema: "forward-local-author-runtime-v1", mode: "FORWARD_ACTIVE" },
    writeOneChapter: async (_bookId: string, chapterNumber: number) => {
      correctionCalls += 1;
      assert.equal(chapterNumber, 1);
      return { ok: true as const, sessionId: "forward-gate-correction", committed: true as const };
    },
    readBookAcceptance: () => ({ accepted, reason: accepted ? "fresh" : "pending", artifactPath: "/forward/acceptance.json" }),
    finalizeBookAcceptance: async () => {
      accepted = true;
      return { accepted: true, reason: "fresh", artifactPath: "/forward/acceptance.json" };
    },
    claimGateCorrection: () => { claimCalls += 1; return { claimed: true, reason: "claimed" }; },
    activationPolicyPath: "/forward/activation-policy.json",
    runtimeBindingPath: "/forward/runtime-binding.json",
  } as unknown as ForwardAutopilotControlV1;
  const outcome = await runAutopilotWithoutProductionTelemetry({
    bookId: "zz",
    architecture: "author",
    deps: {
      ...deps,
      statusOf: () => status,
      acquireLock: () => ({ ok: true, release: () => {}, refresh: () => true }),
      authorAccepted: () => { throw new Error("legacy acceptance must not run"); },
    },
    forwardAutopilotControl: forwardControl,
    authorWriteOneChapter: forwardControl.writeOneChapter,
  });
  assert.equal(outcome.status, "ready");
  assert.equal(claimCalls, 1);
  assert.equal(correctionCalls, 1);
  assert.equal(verbs.filter((verb) => verb[0] === "qc-converge").length, 2);
  assert.equal(spawns.length, 0, "no legacy gate repair or book reader was spawned");
});

test("legacy arch still consults deps.sweepConfirmed (the substitution is author-only)", async () => {
  const mkStatus = (o: Partial<BookStatus>): BookStatus => ({
    bookId: "zz", stage: "write-chapter", phase: "", expectedChapters: 2,
    writtenChapters: 2, gatedChapters: 2, qcdChapters: 2, bookGatePass: true,
    bookGateBlockers: 0, deterministicClean: true, packaged: false, publishable: true, guardrails: false,
    variety: null, nextCommand: "", nextLabel: "",
    chapters: [
      { number: 1, chapterId: "zz-ch01", written: true, shipGatePass: true, shipBlockers: 0, qcVerdict: "PUBLISHABLE", qcFresh: true },
      { number: 2, chapterId: "zz-ch02", written: true, shipGatePass: true, shipBlockers: 0, qcVerdict: "PUBLISHABLE", qcFresh: true },
    ],
    ...o,
  });
  let sweepConfirmedCalls = 0;
  const { deps } = mkDeps(() => ({}));
  const outcome = await runAutopilotWithoutProductionTelemetry({
    bookId: "zz",
    architecture: "legacy",
    deps: {
      ...deps,
      statusOf: () => mkStatus({}),
      sweepConfirmed: () => { sweepConfirmedCalls++; return true; },
      acquireLock: () => ({ ok: true, release: () => {} }),
      latestRoundId: () => "r20260101000000-abcdef",
    },
  });
  assert.equal(outcome.status, "ready");
  assert.ok(sweepConfirmedCalls > 0, "legacy/compiler call sites still read deps.sweepConfirmed — byte-unchanged behavior");
});


// ── Reviewer fixes (verifier findings 2026-07-02): no-op regen, global cap, regex ──

test("authorWriteOneChapter: a regen that leaves the chapter byte-identical fails IMMEDIATELY (no retry burned)", async () => {
  const { deps, spawns } = mkDeps(() => ({}));
  const r = await authorWriteOneChapter("zz", 1, deps, { complaints: ["quiz Q2: key contradicted"], io: mkIo() });
  assert.ok(!r.ok, "byte-identical regen must fail");
  if (!r.ok) assert.match(r.reason, /byte-identical/);
  assert.equal(spawns.length, 1, "no retry for a lazy session — the gate-retry budget is for gate blockers");
});

test("authorWriteOneChapter: a regen that CHANGES the chapter succeeds normally", async () => {
  let bumped = 0;
  const chaptersNow = () => FIXTURE_CHAPTERS.map((c) => (bumped > 0 && c.number === 1 ? { ...c, hook: `${c.hook} (v2)` } : c));
  const { deps, spawns } = mkDeps((o) => {
    if (o.sessionId.startsWith("author-ch01")) {
      bumped++;
      return { candidate: chaptersNow()[0] }; // changed bytes land as the workspace candidate
    }
    return {};
  });
  const r = await authorWriteOneChapter("zz", 1, deps, { complaints: ["quiz Q2: key contradicted"], io: mkIo({ loadChapters: () => chaptersNow() }) });
  assert.ok(r.ok, "changed bytes = a real regeneration");
  assert.equal(spawns.length, 1);
});

test("mapBookComplaintsToChapters: 'launch 3' does not route to chapter 3 (word-boundary regex)", () => {
  const mk = (verdict: string) => ({ keyCheck: { matches: 0, of: 0, disagreements: [] }, oneParagraphVerdict: verdict, gateVerdict: "FAIL" as const, churn: "HIGH" as const });
  const routed = mapBookComplaintsToChapters([mk("the launch 3 metaphor is fine but chapter 5 repeats itself")], [3, 5]);
  assert.ok(!routed.has(3), "'launch 3' must not be read as ch3");
  assert.ok(routed.has(5), "'chapter 5' routes normally");
});

test("doAuthorReview: AUTHOR_REGEN_CAP is GLOBAL — a chapter regened in the review round is skipped by the book round, halting when nothing is actionable", async () => {
  let regenBumps = 0;
  const chaptersNow = () => FIXTURE_CHAPTERS.map((c) => (regenBumps > 0 && c.number === 1 ? { ...c, hook: `${c.hook} (regen ${regenBumps})` } : c));
  let ch1Reviews = 0;
  const { deps, spawns } = mkDeps((o) => {
    if (o.sessionId.startsWith("author-ch01")) {
      regenBumps++;
      return { candidate: chaptersNow()[0] }; // the regen writer CHANGES bytes (IMP-01: candidate in workspace)
    }
    if (o.sessionId.includes("author-book-reader")) {
      return { finalMessage: bookReply(chaptersNow(), { gate: "FAIL", verdictText: "chapter 1 quiz key is contradicted by its own prose" }) };
    }
    const m = o.sessionId.match(/author-review-ch0*(\d+)/);
    if (m) {
      if (Number(m[1]) === 1) {
        ch1Reviews++;
        // first review FAILS (drives the review-round regen), the re-review PASSES
        return { finalMessage: reviewReply(chaptersNow()[0], ch1Reviews === 1 ? { ship84: false, score: 60 } : {}) };
      }
      return { finalMessage: reviewReply(CH2) };
    }
    return {};
  });
  const result = await doAuthorReview("zz", deps, { maxParallel: 2, io: mkIo({ loadChapters: () => chaptersNow() }) });
  assert.ok(result && result.status === "halt" && result.category === "content", "nothing actionable => content halt");
  if (result && result.status === "halt") assert.match(result.reason, /already consumed its regen budget/);
  const regens = spawns.filter((sp) => sp.sessionId.startsWith("author-ch01"));
  assert.equal(regens.length, 1, "exactly ONE regen ever for ch01 — the book round must not grant a third attempt");
});

test("authorWriteOneChapter: a rubric-preflight FAIL feeds the retry card like a gate blocker (Phase-3 live finding)", async () => {
  let rubricCalls = 0;
  const { deps, spawns } = mkDeps(() => ({}));
  const io = mkIo({
    rubricWithCandidate: async () => {
      rubricCalls++;
      return {
        code: 1,
        stdout: rubricCalls === 1
          ? "  ch01: FAIL ease=66.4✗ fk=6.9~ tell=0.778✗ transfer=0.556✗ memClean=3 — FAIL: fleschEase, tellRate, transferRatio"
          : "  ch01: WARN ease=75.1 fk=5.7~ tell=0.111 transfer=0.778 memClean=3",
        stderr: "",
      };
    },
  });
  const r = await authorWriteOneChapter("zz", 1, deps, { io });
  assert.ok(r.ok, "retry converged after the rubric complaint");
  assert.equal(spawns.length, 2, "rubric FAIL consumed the single retry");
  assert.ok(spawns[1].task.includes("RUBRIC PREFLIGHT FAILURES"), "retry card carries the rubric framing");
  assert.ok(spawns[1].task.includes("tell=0.778"), "the verbatim metrics line reaches the writer");
  // B12 rebase (STIER-2, documented): the guidance now states the gate's REAL
  // constraint — at most one uniquely-longest key — instead of the vague
  // "balance distractor lengths" that let card-compliant drafts fail the gate.
  assert.ok(spawns[1].task.includes("at most ONE of the 9 keys may be the uniquely longest"), "the how-to-read guidance is attached");
});

test("authorWriteOneChapter: a W2 card-quality FAIL carries its `chNN fix:` repair line VERBATIM into the retry card", async () => {
  // Verifier fix (2026-07-03): the retry grep must capture the follow-on
  // `chNN fix:` lines formatRubricMetrics emits beneath the verdict line, or the
  // W2 length-tell / practice-floor repair instruction never reaches the writer.
  let rubricCalls = 0;
  const { deps, spawns } = mkDeps(() => ({}));
  const io = mkIo({
    rubricWithCandidate: async () => {
      rubricCalls++;
      return rubricCalls === 1
        ? {
            code: 1,
            // The real formatRubricMetrics block: a verdict line + an indented
            // `chNN fix:` reason line (length-tell shortest-side).
            stdout:
              "  ch01: FAIL ease=80 fk=5~ tell=0 transfer=1 memClean=3 echo=0 lenTell=5✗ practice=2 — FAIL: lengthTell\n" +
              "    ch01 fix: length-tell: key is the uniquely-SHORTEST choice in 5/9 questions (max 4) — lengthen keys / balance distractors",
            stderr: "",
          }
        : { code: 0, stdout: "  ch01: PASS ease=80 fk=5~ tell=0 transfer=1 memClean=3 echo=0 lenTell=2 practice=2", stderr: "" };
    },
  });
  const r = await authorWriteOneChapter("zz", 1, deps, { io });
  assert.ok(r.ok, "retry converged after the card-quality complaint");
  assert.equal(spawns.length, 2, "the length-tell FAIL consumed the single retry");
  assert.ok(spawns[1].task.includes("FAIL: lengthTell"), "the verdict line reaches the writer");
  assert.ok(
    spawns[1].task.includes("ch01 fix: length-tell: key is the uniquely-SHORTEST choice in 5/9"),
    "the concrete `chNN fix:` repair line is carried VERBATIM into the retry card",
  );
  // FINAL-HARDENING-PLAN 2026-07-04 D1 rebase: the retry guidance states the real
  // caps (4-shortest/1-longest) instead of the old zero-extremes overreach.
  assert.ok(spawns[1].task.includes("uniquely SHORTEST choice in at most 4 of 9"), "the how-to-read guidance decodes lenTell with the REAL caps");
  assert.ok(spawns[1].task.includes("do NOT purge every length extreme"), "the retry guidance carries the anti-pendulum instruction");
});

// ── Book-acceptance bar calibration (owner decision 2026-07-03) ───────────────

test("book acceptance: floor 74 + beat-shipped margin 5 decide; gate stays hard (publish calibration 2026-07-04)", async () => {
  const run = async (score: number, shipped?: string) => {
    if (shipped === undefined) delete process.env.CHAPTERFLOW_BEAT_SHIPPED_COMPOSITE;
    else process.env.CHAPTERFLOW_BEAT_SHIPPED_COMPOSITE = shipped;
    try {
      const { deps } = mkDeps((o) => {
        if (o.sessionId.includes("author-book-reader")) return { finalMessage: bookReply(FIXTURE_CHAPTERS, { score }) };
        const m = o.sessionId.match(/author-review-ch0*(\d+)/);
        if (m) return { finalMessage: reviewReply(Number(m[1]) === 1 ? CH1 : CH2) };
        return {};
      });
      return await doAuthorReview("zz", deps, { maxParallel: 2, io: mkIo() });
    } finally {
      delete process.env.CHAPTERFLOW_BEAT_SHIPPED_COMPOSITE;
    }
  };
  // Publish calibration rebase (2026-07-04, documented): ACCEPT = gate PASS +
  // composite >= FLOOR(74) + composite >= shipped + MARGIN(5). Bar-80 is the
  // premium telemetry target, not the ship gate.
  assert.equal(await run(81), null, "81 clears the floor → accepted");
  assert.equal(await run(75), null, "75 clears the floor 74 → accepted (the old bar-80 world rejected a 9x85+ book at 75)");
  const rejected = await run(73);
  assert.ok(rejected && rejected.status === "halt", "73 < floor 74 → rejected → regen round → halt in this stub");
  const belowShipped = await run(81, "82.5");
  assert.ok(belowShipped && belowShipped.status === "halt", "81 < shipped 82.5 + margin 5 → rejected despite clearing the floor");
  assert.equal(await run(88, "82.5"), null, "88 beats the shipped control by the real margin");
});

// ── Q7: complaint-targeting guard (invalid reader's complaints ignored) ───────

test("Q7 mapBookComplaintsToChapters harvests ONLY still-VALID readers' complaints", () => {
  const mk = (o: { verdict?: string; valid?: boolean }) => ({
    keyCheck: { matches: 0, of: 0, disagreements: [] as string[] },
    oneParagraphVerdict: o.verdict ?? "",
    gateVerdict: "FAIL" as const,
    churn: "HIGH" as const,
    valid: o.valid ?? true,
  });
  // An INVALID reader (disproven structural claim) names ch05; a VALID reader names ch07.
  const routed = mapBookComplaintsToChapters(
    [mk({ verdict: "the answer key omits chapter 5 Q9", valid: false }), mk({ verdict: "chapter 7 reads as generic template", valid: true })],
    [3, 5, 7, 9],
  );
  assert.deepEqual([...routed.keys()], [7], "the disproven reader's ch05 target is dropped; only the valid reader's ch07 survives");

  // ALL readers invalid → no targets at all (caller halts on nothing-actionable).
  const none = mapBookComplaintsToChapters([mk({ verdict: "the key omits chapter 5 Q9", valid: false })], [3, 5, 7, 9]);
  assert.equal(none.size, 0, "an all-invalid panel steers no regen");

  // Backward-compatible: readers WITHOUT a `valid` field are treated as valid.
  const legacy = mapBookComplaintsToChapters([{ keyCheck: { matches: 0, of: 0, disagreements: [] }, oneParagraphVerdict: "chapter 3 is stamped", gateVerdict: "FAIL" as const, churn: "HIGH" as const }], [3, 5]);
  assert.deepEqual([...legacy.keys()], [3]);
});

// ── Q4: valid-count quorum blocks a sub-quorum accept ─────────────────────────

test("Q4 a book is NEVER accepted below the valid-reader quorum (2 of 3 readers unparseable)", async () => {
  // Two of the three book readers never parse (even on the -r2 respawn) → only
  // ONE valid reader. Even with a clean PASS from that reader, quorum blocks it.
  const { deps, spawns } = mkDeps((o) => {
    if (o.sessionId.includes("author-book-reader")) {
      // reader 1 parses a PASS; readers 2 & 3 never parse (both attempts).
      if (o.sessionId.includes("author-book-reader-1")) return { finalMessage: bookReply(FIXTURE_CHAPTERS) };
      return { finalMessage: "no json here" };
    }
    const m = o.sessionId.match(/author-review-ch0*(\d+)/);
    if (m) return { finalMessage: reviewReply(Number(m[1]) === 1 ? CH1 : CH2) };
    return {};
  });
  const io = mkIo();
  const result = await doAuthorReview("zz", deps, { maxParallel: 3, io });
  assert.ok(result && result.status === "halt", "below quorum → not accepted (halts, never READY)");
  // The durable record proves validCount was below quorum for round1.
  const round1 = io.acceptanceRecords.find((r) => r.roundLabel === "");
  assert.ok(round1, "a round-1 acceptance record was written");
  assert.equal(round1!.verdict.validCount, 1, "only one reader was valid");
  assert.equal(round1!.accepted, false, "sub-quorum round is not accepted even though the lone reader PASSed");
  assert.ok(spawns.some((s) => s.sessionId.includes("author-book-reader-2")), "the panel still spawned all three readers");
});

// ── Q6: durable acceptance record with all required fields ────────────────────

test("Q6 acceptance writes a durable record: verdict, readers, bar, sampled, docSha256, timestamp", async () => {
  const { deps } = mkDeps(happyScript);
  const io = mkIo();
  const result = await doAuthorReview("zz", deps, { maxParallel: 3, io });
  assert.equal(result, null, "accepted (happy path)");
  assert.equal(io.acceptanceRecords.length, 1, "exactly one acceptance round recorded on the happy path");
  const rec = io.acceptanceRecords[0];
  assert.equal(rec.schemaVersion, "author-acceptance-v1");
  assert.equal(rec.bookId, "zz");
  assert.equal(rec.roundLabel, "", "round 1 has the empty label");
  assert.equal(rec.accepted, true);
  assert.equal(rec.bar, 80, "the calibrated acceptance bar is recorded");
  assert.equal(rec.beatShipped, null, "no beat-shipped floor set in this run");
  assert.deepEqual(rec.sampledChapters, FIXTURE_CHAPTERS.map((c) => c.number));
  assert.match(rec.docSha256, /^[0-9a-f]{64}$/, "sha256 of the exact docText readers scored");
  assert.match(rec.at, /^\d{4}-\d\d-\d\dT/, "ISO timestamp");
  assert.equal(rec.readers.length, 3, "all three adjudicated reader results captured");
  for (const r of rec.readers) {
    assert.ok("gateVerdict" in r && "churn" in r && "scores" in r && "keyCheck" in r && "quotesVerified" in r, "reader fields present");
    assert.ok(r.structuralScreen, "each reader carries its Q3 structural-screen record");
  }
  assert.ok(rec.verdict.medianComposite !== null, "composed verdict captured");
});

// ── Multi-read acceptance median (FINAL-HARDENING-PLAN 2026-07-04) ────────────

const bookReaderSpawns = (spawns: SpawnRec[]) => spawns.filter((s) => s.sessionId.includes("author-book-reader")).length;

test("multi-read: a CLEAR pass spends exactly one panel; a CLEAR fail spends exactly one panel", async () => {
  // 90 is far above the floor-74 boundary → no extra reads.
  const pass = mkDeps(happyScript);
  const passIo = mkIo();
  assert.equal(await doAuthorReview("zz", pass.deps, { maxParallel: 3, io: passIo }), null, "clear pass accepted");
  assert.equal(bookReaderSpawns(pass.spawns), 3, "ONE 3-reader panel — no multi-read on an obvious accept");
  assert.equal(passIo.acceptanceRecords.length, 1, "one durable read record");
  assert.equal(passIo.acceptanceRecords[0].pooled?.reads, 1);

  // 60 is far below → one panel, reject.
  const fail = mkDeps((o) => {
    if (o.sessionId.includes("author-book-reader")) return { finalMessage: bookReply(FIXTURE_CHAPTERS, { score: 60 }) };
    const m = o.sessionId.match(/author-review-ch0*(\d+)/);
    if (m) return { finalMessage: reviewReply(Number(m[1]) === 1 ? CH1 : CH2) };
    return {};
  });
  const failIo = mkIo();
  const rejected = await doAuthorReview("zz", fail.deps, { maxParallel: 3, io: failIo });
  assert.ok(rejected && rejected.status === "halt", "clear fail rejected");
  assert.equal(bookReaderSpawns(fail.spawns), 3, "ONE 3-reader panel — no multi-read on an obvious reject");
});

test("multi-read: a borderline composite triggers extra panels; the TRUE median of 3 decides at the cap", async () => {
  // Panel scores 76 → 71 → 74: the old upper-median-of-2 pooling would have
  // decided max(76,71)=76; the true median of all three is 74 (accept at floor).
  const panelScores = [76, 71, 74];
  let bookSpawnCount = 0;
  const { deps, spawns } = mkDeps((o) => {
    if (o.sessionId.includes("author-book-reader")) {
      const panelIdx = Math.min(Math.floor(bookSpawnCount / 3), panelScores.length - 1);
      bookSpawnCount++;
      return { finalMessage: bookReply(FIXTURE_CHAPTERS, { score: panelScores[panelIdx] }) };
    }
    const m = o.sessionId.match(/author-review-ch0*(\d+)/);
    if (m) return { finalMessage: reviewReply(Number(m[1]) === 1 ? CH1 : CH2) };
    return {};
  });
  const io = mkIo();
  assert.equal(await doAuthorReview("zz", deps, { maxParallel: 3, io }), null, "median 74 >= floor 74 → accepted");
  assert.equal(bookReaderSpawns(spawns), 9, "three panels spawned (borderline stayed inside the ±3.7 band)");
  assert.equal(io.acceptanceRecords.length, 3, "every panel read persisted append-only");
  const last = io.acceptanceRecords[2];
  assert.equal(last.pooled?.reads, 3);
  assert.equal(last.pooled?.composite, 74, "TRUE median of [71, 74, 76]");
  assert.equal(last.pooled?.capped, true, "per-doc panel cap reached");
  assert.equal(last.accepted, true, "the pooled decision rides the record deriveDurableAcceptance corroborates");
});

test("multi-read: trueMedian is the standard median (even count averages the middle pair — never max)", () => {
  assert.equal(trueMedian([72, 75]), 73.5, "the BREAK-2 exploit case: two reads pool to their mean, not their max");
  assert.equal(trueMedian([71, 74, 76]), 74);
  assert.equal(trueMedian([80]), 80);
  assert.equal(trueMedian([1, 2, 3, 100]), 2.5, "outlier-resistant on even counts");
});

test("multi-read: a gate FAIL sticks for the docSha — no further reads, and a re-entry on identical bytes spawns NOTHING", async () => {
  const script = (o: { sessionId: string }) => {
    if (o.sessionId.includes("author-book-reader")) return { finalMessage: bookReply(FIXTURE_CHAPTERS, { score: 76, gate: "FAIL" }) };
    const m = o.sessionId.match(/author-review-ch0*(\d+)/);
    if (m) return { finalMessage: reviewReply(Number(m[1]) === 1 ? CH1 : CH2) };
    return {};
  };
  const io = mkIo();
  const entry1 = mkDeps(script);
  const r1 = await doAuthorReview("zz", entry1.deps, { maxParallel: 3, io });
  assert.ok(r1 && r1.status === "halt", "gate FAIL rejects despite composite 76 >= floor");
  assert.equal(bookReaderSpawns(entry1.spawns), 3, "76 is within the band of 74, but a stuck gate FAIL makes more reads pointless — one panel only");
  // Re-entry on the SAME bytes: the durable FAIL read is reused; zero panels spawn.
  const entry2 = mkDeps(script);
  const r2 = await doAuthorReview("zz", entry2.deps, { maxParallel: 3, io });
  assert.ok(r2 && r2.status === "halt", "still rejected");
  assert.equal(bookReaderSpawns(entry2.spawns), 0, "gate-FAIL stickiness survives re-entry (the old per-label overwrite decayed after one)");
});

test("multi-read: at the per-doc cap the decision FREEZES — a later entry on identical bytes reuses it without spawning", async () => {
  const script = (o: { sessionId: string }) => {
    if (o.sessionId.includes("author-book-reader")) return { finalMessage: bookReply(FIXTURE_CHAPTERS, { score: 75 }) };
    const m = o.sessionId.match(/author-review-ch0*(\d+)/);
    if (m) return { finalMessage: reviewReply(Number(m[1]) === 1 ? CH1 : CH2) };
    return {};
  };
  const io = mkIo();
  const entry1 = mkDeps(script);
  assert.equal(await doAuthorReview("zz", entry1.deps, { maxParallel: 3, io }), null, "borderline 75 accepted on the pooled median");
  assert.equal(bookReaderSpawns(entry1.spawns), 9, "cap of 3 panels consumed inside entry 1");
  const entry2 = mkDeps(script);
  assert.equal(await doAuthorReview("zz", entry2.deps, { maxParallel: 3, io }), null, "frozen pooled ACCEPT reused");
  assert.equal(bookReaderSpawns(entry2.spawns), 0, "no panel re-roll after the cap — the ±3.7 casino is closed");
  assert.equal(io.acceptanceRecords.length, 3, "no new records after the cap either");
});

test("multi-read: CHAPTERFLOW_PANEL_NOISE_BAND is fail-closed on garbage and honored at 0", async () => {
  process.env.CHAPTERFLOW_PANEL_NOISE_BAND = "abc";
  try {
    const { deps } = mkDeps(happyScript);
    const r = await doAuthorReview("zz", deps, { maxParallel: 3, io: mkIo() });
    assert.ok(r && r.status === "halt" && r.category === "infra", "set-but-invalid band halts infra (BREAK-1 lesson)");
    assert.match(r.reason, /CHAPTERFLOW_PANEL_NOISE_BAND/);
  } finally {
    delete process.env.CHAPTERFLOW_PANEL_NOISE_BAND;
  }
  // Band 0: even a knife-edge 75 is "clear" — exactly one panel.
  process.env.CHAPTERFLOW_PANEL_NOISE_BAND = "0";
  try {
    const { deps, spawns } = mkDeps((o) => {
      if (o.sessionId.includes("author-book-reader")) return { finalMessage: bookReply(FIXTURE_CHAPTERS, { score: 75 }) };
      const m = o.sessionId.match(/author-review-ch0*(\d+)/);
      if (m) return { finalMessage: reviewReply(Number(m[1]) === 1 ? CH1 : CH2) };
      return {};
    });
    assert.equal(await doAuthorReview("zz", deps, { maxParallel: 3, io: mkIo() }), null);
    assert.equal(bookReaderSpawns(spawns), 3, "band 0 disables the multi-read trigger");
  } finally {
    delete process.env.CHAPTERFLOW_PANEL_NOISE_BAND;
  }
});

test("multi-read: a quorum-met read whose durable record cannot be persisted FAILS CLOSED (cap can't be laundered)", async () => {
  // red-team #1: the per-doc cap survives re-entry ONLY through durable records;
  // without them the next entry re-seeds totalReads=0 and re-rolls the panel.
  const io = mkIo({ persistAcceptance: () => { throw new Error("disk full"); } });
  const { deps } = mkDeps(happyScript);
  const r = await doAuthorReview("zz", deps, { maxParallel: 3, io });
  assert.ok(r && r.status === "halt" && r.category === "infra", "unpersistable quorum-met read → infra halt");
  assert.match(r.reason, /per-doc read cap cannot be enforced/);
});

test("F5: a dead-ended chapter (exact bytes already FAILed, regen+repair spent) halts BEFORE any reader spawns", async () => {
  const hash = chapterContentHash(CH1);
  const p = reviewHistoryPath("zz", 1, hash);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify({ chapterNumber: 1, contentHash: hash, valid: true, pass: false, composite: 81 }), "utf8");
  try {
    const { deps, spawns } = mkDeps(happyScript);
    const io = mkIo({
      regenConsumedFor: () => 1, // >= AUTHOR_REGEN_CAP - 1
      repairConsumedFor: () => 1,
      recordRepairConsumed: () => {},
    });
    const r = await doAuthorReview("zz", deps, { maxParallel: 3, io });
    assert.ok(r && r.status === "halt" && r.category === "content", "dead end halts as content");
    assert.match(r.reason, /DEAD-ENDED/);
    assert.equal(spawns.filter((s) => s.sessionId.includes("author-review-ch")).length, 0, "no chapter readers spawned");
    assert.equal(bookReaderSpawns(spawns), 0, "no acceptance panel spawned");
  } finally {
    rmSync(p, { force: true });
  }
});

test("Q6 acceptanceRoundSegment + path: '' → round1, '-round2' → round2, fs-safe", () => {
  assert.equal(acceptanceRoundSegment(""), "round1");
  assert.equal(acceptanceRoundSegment("-round2"), "round2");
  assert.equal(acceptanceRoundSegment("-weird/label"), "weird_label");
  const p = acceptanceRecordPath("zz", "-round2", "/tmp/state-root");
  assert.match(p, /reviews\/zz\/acceptance\.round2\.json$/);
});

// ── Q3 respawn in the live acceptance path ────────────────────────────────────

test("Q3 (IMP-08 retarget): a key-omission claim over the key-free phase-1 doc is a NO-OP — no infra halt, no invalidation, the FAIL vote stands", async () => {
  // Pre-IMP-08 this pinned the Q3 respawn: a byte-false "key omits ch1 Q1"
  // claim was disproven against the doc's key rows and invalidated the reader.
  // The phase-1 acceptance doc contains NO key section AT ALL (certified by
  // assertBookSamplePhase1Integrity pre-spawn), so the claim CLASS is obsolete.
  // The protections this now pins: such a claim must neither CONFIRM against
  // the empty key-row map (a DocIntegrityError infra-halt on reader confusion)
  // nor invalidate the vote — the reader stays VALID and its gate FAIL counts
  // as a real verdict. Quote fabrication remains the validity guard.
  let r3attempts = 0;
  const { deps } = mkDeps((o) => {
    if (o.sessionId.includes("author-book-reader-3")) {
      r3attempts++;
      // A FAIL whose rationale is a key-omission claim over a key-free doc.
      return { finalMessage: bookReply(FIXTURE_CHAPTERS, { gate: "FAIL", verdictText: "The combined answer key omits chapter 1 Q1." }) };
    }
    if (o.sessionId.includes("author-book-reader")) return { finalMessage: bookReply(FIXTURE_CHAPTERS) };
    const m = o.sessionId.match(/author-review-ch0*(\d+)/);
    if (m) return { finalMessage: reviewReply(Number(m[1]) === 1 ? CH1 : CH2) };
    return {};
  });
  const io = mkIo();
  // Must NOT throw (the unguarded screen would have "confirmed" the claim
  // against the empty key-row map and halted infra on a provably-correct doc).
  await doAuthorReview("zz", deps, { maxParallel: 3, io });
  const round1 = io.acceptanceRecords.find((r) => r.roundLabel === "");
  assert.ok(round1 && round1.verdict.validCount === 3, "all three readers stay VALID (no structural invalidation on a key-free doc)");
  assert.ok(round1 && round1.readers.some((r) => r.gateVerdict === "FAIL"), "the confused reader's gate FAIL still counts as a real vote");
  assert.equal(r3attempts, 1, "reader 3 is NOT respawned — the claim is a no-op, not an invalidation");
});

// ── F-05: the book-acceptance PREDICATE, pinned ──────────────────────────────
// Verified semantics (authorReview.ts): accepted = quorumMet ∧ sticky-gate PASS
// ∧ median>=AUTHOR_BOOK_ACCEPT_FLOOR(74) ∧ (shipped===null ∨ median>=shipped+
// BEAT_SHIPPED_MARGIN(5)). These tests drive runBookAcceptance directly with an
// injected 3-read pool at the per-doc cap (PANEL_READS_PER_DOC_CAP): the decision
// is FROZEN for those bytes, so NO reader spawns and the predicate is computed
// purely from the pooled median + the injected shipped control. No live readers.

/** A single durable same-doc read at full valid-reader quorum. Three of these at
 *  the cap freeze the decision; trueMedian([c,c,c]) === c pins any composite. */
function poolRead(composite: number, gate: "PASS" | "FAIL", churn = "LOW"): AuthorAcceptanceRecord {
  return {
    schemaVersion: "author-acceptance-v1",
    bookId: "zz", roundLabel: "", at: "2026-07-08T00:00:00Z",
    bar: 80, beatShipped: null, accepted: true,
    sampledChapters: [1, 2], docSha256: "pool-sha",
    verdict: { id: "zz", medianComposite: composite, factors: null, gate, gateVotes: gate === "PASS" ? "3P/0F" : "0P/3F", churn, validCount: 3, readerCount: 3, chapters: [1, 2], readers: [] } as unknown as AuthorAcceptanceRecord["verdict"],
    readers: [],
  };
}

/** Drive runBookAcceptance over a frozen (cap-filled) pool; capture the accept
 *  decision + logs without spawning a single reader. */
async function drivePredicate(pool: AuthorAcceptanceRecord[], shipped: number | null): Promise<{ accepted: boolean; logs: string[] }> {
  const { deps } = mkDeps(() => { throw new Error("a cap-frozen pool must NOT spawn any reader"); });
  const logs: string[] = [];
  (deps as unknown as { log: (m: string) => void }).log = (m: string) => { logs.push(m); };
  const io = mkIo({
    listAcceptanceReads: () => pool,
    resolveBeatShipped: async () => ({ ok: true as const, composite: shipped, source: shipped === null ? "none" as const : "env" as const }),
  });
  const res = await runBookAcceptance("zz", FIXTURE_CHAPTERS, deps, io as unknown as AuthorReviewIo, 80, "");
  return { accepted: res.accepted, logs };
}

test("F-05 predicate: FLOOR boundary with no shipped control — 73.9 rejects, 74.0 accepts", async () => {
  const below = await drivePredicate([poolRead(73.9, "PASS"), poolRead(73.9, "PASS"), poolRead(73.9, "PASS")], null);
  assert.equal(below.accepted, false, "median 73.9 < floor 74 → REJECT");
  const at = await drivePredicate([poolRead(74.0, "PASS"), poolRead(74.0, "PASS"), poolRead(74.0, "PASS")], null);
  assert.equal(at.accepted, true, "median 74.0 == floor 74 → ACCEPT (no shipped control, floor-only)");
});

test("F-05 predicate: MARGIN boundary against a shipped control 72.7 — 77.6 rejects, 77.7 accepts", async () => {
  const below = await drivePredicate([poolRead(77.6, "PASS"), poolRead(77.6, "PASS"), poolRead(77.6, "PASS")], 72.7);
  assert.equal(below.accepted, false, "77.6 < shipped(72.7)+5 → REJECT (clears the 74 floor but not the +5 margin)");
  const at = await drivePredicate([poolRead(77.7, "PASS"), poolRead(77.7, "PASS"), poolRead(77.7, "PASS")], 72.7);
  assert.equal(at.accepted, true, "77.7 == shipped(72.7)+5 → ACCEPT");
});

test("F-05 predicate: a sticky gate FAIL forces REJECT regardless of a passing median", async () => {
  // One FAIL read among three makes gateFailStuck; composite 90 is irrelevant.
  const r = await drivePredicate([poolRead(90, "PASS"), poolRead(90, "FAIL"), poolRead(90, "PASS")], null);
  assert.equal(r.accepted, false, "a FAIL on any pooled read sticks → REJECT even at median 90");
});

test("F-05 predicate: quorum unmet → REJECT with the valid-reader-quorum message", async () => {
  // Empty pool + a panel that never parses → 0 valid readers → sub-quorum.
  const { deps } = mkDeps((o) => (o.sessionId.includes("author-book-reader") ? { finalMessage: "not valid json at all" } : {}));
  const logs: string[] = [];
  (deps as unknown as { log: (m: string) => void }).log = (m: string) => { logs.push(m); };
  const io = mkIo({
    listAcceptanceReads: () => [],
    resolveBeatShipped: async () => ({ ok: true as const, composite: null, source: "none" as const }),
  });
  const res = await runBookAcceptance("zz", FIXTURE_CHAPTERS, deps, io as unknown as AuthorReviewIo, 80, "");
  assert.equal(res.accepted, false, "a sub-quorum panel is never accepted");
  assert.ok(res.verdict.validCount < AUTHOR_BOOK_READERS, "fewer than the 3-reader quorum were valid");
  assert.ok(logs.some((l) => /below valid-reader quorum/.test(l)), `the reject log names the quorum: ${JSON.stringify(logs.filter((l) => /REJECT/.test(l)))}`);
});

test("F-05 predicate: churn HIGH with passing numbers is ACCEPTED — churn is telemetry, NOT an accept-time veto", async () => {
  // STANDING 2026-07-04 calibration (owner decision): the correctness gate, the
  // 74 floor, and the +5 beat-shipped margin are the ONLY accept blockers; the
  // holistic churn label routes repair AFTER a rejection but never vetoes. Do not
  // read this test as endorsing churn HIGH — it pins the semantics loudly so a
  // future campaign is not, again, run against a wrong model of the gate. Whether
  // churn should ever veto is an explicit OPEN owner question:
  // docs/v24/ACCEPTANCE-GATE-POLICY.md (open question a).
  const r = await drivePredicate(
    [poolRead(80, "PASS", "HIGH"), poolRead(80, "PASS", "HIGH"), poolRead(80, "PASS", "HIGH")],
    null,
  );
  assert.equal(r.accepted, true, "unanimous churn HIGH + gate PASS + median 80 >= floor 74 → ACCEPT");
});

// ── F-09: the sub-band second-opinion guard (bounded, one extra read) ─────────

test("F-09 guard: a sub-band taste FAIL rescued by a shipping second opinion spends NO regen (one extra read, ledger untouched)", async () => {
  // ch01: a valid, clean-keyed, sub-band (composite 60 < 80−3.7) FAIL whose only
  // complaint is aesthetic (downgraded by the classifier). The guard fires ONE
  // independent read; that read ships → the better read stands → no regen spent.
  const { deps, spawns } = mkDeps((o) => {
    const m = o.sessionId.match(/author-review-ch0*(\d+)/);
    if (m) {
      const n = Number(m[1]);
      if (o.sessionId.includes("-2nd")) return { finalMessage: reviewReply(n === 1 ? CH1 : CH2, { ship84: true, score: 90 }) };
      if (n === 1) return { finalMessage: reviewReply(CH1, { ship84: false, score: 60, complaints: [{ unit: "example 2", problem: "the phrasing is a bit generic and could be richer", mustFix: false }] }) };
      return { finalMessage: reviewReply(CH2) };
    }
    if (o.sessionId.includes("author-book-reader")) return { finalMessage: bookReply(FIXTURE_CHAPTERS) };
    return {};
  });
  const io = mkIo();
  const result = await doAuthorReview("zz", deps, { maxParallel: 2, io });
  assert.equal(spawns.filter((s) => s.sessionId.includes("author-review-ch01-2nd")).length, 1, "exactly ONE second-opinion read for the sub-band chapter");
  assert.equal(spawns.filter((s) => s.sessionId.includes("author-review-ch02-2nd")).length, 0, "the passing chapter earns no second opinion");
  assert.equal(io.regenConsumedFor!("zz", 1), 0, "the shipping second opinion PREVENTED the regen — lifetime write budget untouched");
  assert.equal(spawns.filter((s) => s.sessionId.startsWith("author-ch")).length, 0, "no regen writer spawned");
  assert.equal(result, null, "the better read stands → the run completes to acceptance");
});

test("F-09 guard: a sub-band taste FAIL whose second opinion ALSO fails proceeds to regen (one extra read, then the cap is spent)", async () => {
  const { deps, spawns } = mkDeps((o) => {
    const m = o.sessionId.match(/author-review-ch0*(\d+)/);
    if (m) {
      const n = Number(m[1]);
      if (o.sessionId.includes("-2nd")) return { finalMessage: reviewReply(CH1, { ship84: false, score: 60, complaints: [{ unit: "example 2", problem: "still reads a little thin", mustFix: false }] }) };
      if (n === 1) return { finalMessage: reviewReply(CH1, { ship84: false, score: 60, complaints: [{ unit: "example 2", problem: "the phrasing is a bit generic", mustFix: false }] }) };
      return { finalMessage: reviewReply(CH2) };
    }
    if (o.sessionId.includes("author-book-reader")) return { finalMessage: bookReply(FIXTURE_CHAPTERS) };
    return {};
  });
  const io = mkIo();
  const result = await doAuthorReview("zz", deps, { maxParallel: 2, io });
  assert.equal(spawns.filter((s) => s.sessionId.includes("author-review-ch01-2nd")).length, 1, "exactly one second-opinion read (hard cap)");
  assert.equal(io.regenConsumedFor!("zz", 1), 1, "a corroborated sub-band FAIL still spends its regen — the guard never hides a durable fail");
  assert.ok(result && result.status === "halt" && result.category === "content", "no-op (byte-identical) regen halts content after the guard");
});

test("F-09 guard: a reserved-harm FAIL spawns NO second opinion — it goes straight to regen", async () => {
  const { deps, spawns } = mkDeps((o) => {
    const m = o.sessionId.match(/author-review-ch0*(\d+)/);
    if (m) {
      const n = Number(m[1]);
      if (n === 1) return { finalMessage: reviewReply(CH1, { ship84: false, score: 60, complaints: [{ unit: "quiz Q2", problem: "the answer key is wrong — two choices are correct", mustFix: true }] }) };
      return { finalMessage: reviewReply(CH2) };
    }
    if (o.sessionId.includes("author-book-reader")) return { finalMessage: bookReply(FIXTURE_CHAPTERS) };
    return {};
  });
  const io = mkIo();
  const result = await doAuthorReview("zz", deps, { maxParallel: 2, io });
  assert.equal(spawns.filter((s) => s.sessionId.includes("-2nd")).length, 0, "a reserved-harm complaint blocks the second-opinion guard entirely");
  assert.equal(io.regenConsumedFor!("zz", 1), 1, "the reserved-harm FAIL spent its regen directly (no cheap read wasted)");
  assert.ok(result && result.status === "halt" && result.category === "content", "byte-identical regen halts content");
});

test("author-arch fixtures restore production telemetry bytes and mtimes", () => {
  for (const snapshot of MODULE_TELEMETRY_SNAPSHOTS) restoreTestFile(snapshot);
  for (const snapshot of MODULE_DIR_SNAPSHOTS) restoreTestDir(snapshot);
});
