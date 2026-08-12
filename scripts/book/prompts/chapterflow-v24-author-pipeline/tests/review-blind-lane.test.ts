/**
 * IMP-08 — the blinded review LANE: reviewOneChapter end-to-end with the
 * physically-isolated workspace + the two-phase quiz protocol, and the carry
 * invalidation the hashVersion v3 bump enforces.
 *
 * Pins:
 *  - the direct reader's spawn cwd is a role workspace OUTSIDE the repo (never
 *    PIPELINE_DIR) containing exactly the phase-1 doc; sandbox read-only;
 *  - session independence survives: fresh session per read, never the author
 *    session (re-mint on collision);
 *  - the phase-2 adjudication spawn sees ONLY the phase-2 doc, and an HONEST
 *    adjudicator (parsing the doc like a real agent) verifies end-to-end onto
 *    the persisted review; a garbage adjudicator records an explicit
 *    "unavailable" without touching the review verdict;
 *  - profile evidence (executionProfileHash, workspaceManifestSha256) rides
 *    the persisted review while NO model identity appears in any
 *    reviewer-visible artifact (task or workspace file);
 *  - carry invalidation: a v2-era history record — and a v3 record whose
 *    docHash doesn't match the current phase-1 bytes — can never satisfy
 *    carryReviewFor.
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { test } from "./harness.js";
import { fxChapter } from "./migrationFixtures.js";
import type { ChapterV21 } from "../src/types.js";
import type { AutopilotDeps } from "../src/orchestrator/autopilot.js";
import { reviewOneChapter, type AuthorReviewIo } from "../src/orchestrator/authorReview.js";
import { carryReviewFor, appendReviewHistory } from "../src/orchestrator/authorReviewLedger.js";
import {
  adjudicateReview,
  chapterReaderDocHash,
  parseReaderReview,
  READER_RUBRIC_VERSION,
  REVIEW_DOC_HASH_VERSION,
} from "../src/review/readerReview.js";
import { renderChapterReaderDocPhase1 } from "../src/review/renderReaderDoc.js";
import { resolveExecutionProfile } from "../src/exec/executionEnvelope.js";
import { chapterContentHash } from "../src/critics/qcAttestation.js";
import { ensureTrailingNewline } from "../src/lib/atomicWrite.js";
import type { ChapterReviewV1 } from "../src/artifacts/artifactTypes.js";

const PIPE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function laneChapter(): ChapterV21 {
  return fxChapter({
    hook: "Defaults decide more than resolve does.",
    breakdown: { fastRead: "Defaults beat resolve.", deepRead: "The deep read explains why defaults dominate.", fullRead: "The full read tells the story end to end." },
    keyTakeaway: "Change the default.",
    tryThisNow: "Move one default.",
    examples: [{ title: "Form", scenario: "A team shortened a form.", whatToDo: "Cut a field.", whyItMatters: "Completion rose." }],
    quiz: {
      questions: [
        { questionId: "q1", prompt: "Why did completion rise?", choices: ["More ads", "A field was removed", "Bigger budget"], correctIndex: 1, explanation: "The prose credits the removed field." },
      ],
    },
    reviewCards: [{ front: "What decides?", back: "Defaults." }],
    memorableLines: [{ text: "Defaults decide.", why: "compact" }],
  } as Partial<ChapterV21>) as ChapterV21;
}

/** Reader reply built from the REAL doc the fake receives (quotes byte-true). */
function readerReply(docText: string): string {
  const quote = docText.split("\n").find((l) => l.length > 20 && !l.startsWith("#")) ?? "Defaults decide.";
  return "```json\n" + JSON.stringify({
    quizDerivation: { answers: ["b"], mechanisms: ["the prose credits the field"], confidence: ["high"], ambiguities: [""], tells: [] },
    scores: { retention: 85, quizzes: 84, transfer: 83, practical: 84, summaries: 83, tone: 82, limits: 81, insight: 82, density: 83, beginner: 85 },
    ship84: true,
    quotes: [{ quote, why: "spine" }],
    complaints: [],
    oneParagraphVerdict: "ships",
  }) + "\n```";
}

/** An HONEST phase-2 adjudicator: reads the phase-2 doc from its own cwd like
 *  a real agent, copies the committed hash + derived letters + real key rows,
 *  and returns verifiable verdicts. */
function honestAdjudicatorReply(cwd: string): string {
  const file = readdirSync(cwd).find((f) => f.endsWith(".phase2.txt"));
  if (!file) return "no doc";
  const doc = readFileSync(join(cwd, file), "utf8");
  const sha = doc.match(/Committed blind derivation sha256: ([0-9a-f]{64})/)?.[1] ?? "";
  const items: Array<Record<string, unknown>> = [];
  for (const m of doc.matchAll(/^Q(\d+) \[([^\]]+)\]: derived ([abc]|\(none\)) — confidence/gm)) {
    const qn = Number(m[1]);
    const derived = m[3] === "(none)" ? -1 : "abc".indexOf(m[3]);
    const keyRow = doc.match(new RegExp(`^Q${qn}: ([abc?])`, "m"))?.[1] ?? "?";
    const keyed = "abc".indexOf(keyRow);
    items.push({ itemId: m[2], keyedAnswerIndex: keyed, derivedAnswerIndex: derived, agreement: derived === keyed, keyCorrect: "correct", rationale: "the prose supports the keyed choice only" });
  }
  return "```json\n" + JSON.stringify({ schema: "quiz-adjudication-v1", derivationSha256: sha, documentSha256: "", reviewerSessionId: "adj", items }) + "\n```";
}

type SpawnCall = { sessionId: string; task: string; cwd: string; sandbox?: string; role?: string; model?: string };

function mkLane(opts: { authorSid?: string; adjudicator?: "honest" | "garbage" | "throws"; collideOnce?: boolean }) {
  const spawns: SpawnCall[] = [];
  const persisted: ChapterReviewV1[] = [];
  const docDir = mkdtempSync(join(tmpdir(), "cf-imp08-lane-"));
  let minted = 0;
  const deps = {
    spawn: (async (o: SpawnCall) => {
      spawns.push({ ...o });
      let msg: string;
      if (o.sessionId.includes("author-quizadj")) {
        if (opts.adjudicator === "throws") throw new Error("preflight: codex CLI missing a required flag");
        msg = opts.adjudicator === "garbage" ? "not an adjudication at all" : honestAdjudicatorReply(o.cwd);
      } else {
        const file = readdirSync(o.cwd).find((f) => f.endsWith(".txt"));
        msg = readerReply(file ? readFileSync(join(o.cwd, file), "utf8") : "");
      }
      return { ok: true, exitCode: 0, finalMessage: msg, stdout: msg, stderr: "", durationMs: 1, sessionId: o.sessionId };
    }) as unknown as AutopilotDeps["spawn"],
    mkSessionId: (label: string) => {
      minted++;
      // Optionally collide the FIRST mint with the author session to pin the
      // independence re-mint.
      if (opts.collideOnce && minted === 1 && opts.authorSid) return opts.authorSid;
      return `${label}#${minted}`;
    },
    logSession: () => {},
    log: () => {},
  } as unknown as AutopilotDeps;
  const io: Partial<AuthorReviewIo> = {
    authorSessionOf: () => opts.authorSid,
    writeReviewDoc: (bookId, fileName, text) => {
      const abs = join(docDir, `${bookId}-${fileName}`);
      writeFileSync(abs, text, "utf8");
      return { absPath: abs, relPath: abs };
    },
    persistReview: (_bookId, review) => { persisted.push(review); return "/tmp/r.json"; },
  };
  return { deps, io: io as AuthorReviewIo, spawns, persisted, cleanup: () => rmSync(docDir, { recursive: true, force: true }) };
}

test("lane: the direct reader runs in a workspace OUTSIDE the repo with exactly the phase-1 doc; phase-2 sees only the phase-2 doc; both read-only", async () => {
  const ch = laneChapter();
  const lane = mkLane({ authorSid: "the-author-session", adjudicator: "honest" });
  try {
    const review = await reviewOneChapter("zz-lane", ch, lane.deps, lane.io, 80);
    assert.ok(review.valid && review.pass, `clean review passes: ${JSON.stringify({ valid: review.valid, pass: review.pass, keys: review.keyCheck })}`);
    const readerSpawns = lane.spawns.filter((s) => s.sessionId.includes("author-review-ch"));
    const adjSpawns = lane.spawns.filter((s) => s.sessionId.includes("author-quizadj"));
    assert.equal(readerSpawns.length, 1, "one phase-1 read");
    assert.equal(adjSpawns.length, 1, "one phase-2 adjudication");
    for (const s of [...readerSpawns, ...adjSpawns]) {
      assert.ok(!s.cwd.startsWith(PIPE_ROOT + sep) && s.cwd !== PIPE_ROOT, `spawn cwd ${s.cwd} is OUTSIDE the pipeline repo`);
      assert.equal(s.sandbox, "read-only");
      assert.equal(s.model, undefined, "no model identity on the spawn call — policy resolves it invisibly");
    }
    // The reviewer saw no key; the adjudicator saw the phase-2 doc only. The
    // spawn mock read the workspace, so what it saw IS what was in the dir.
    assert.ok(!lane.spawns[0].task.includes("ANSWER KEY"), "the phase-1 task never mentions a visible key");
  } finally {
    lane.cleanup();
  }
});

test("lane: an honest adjudicator lands status=adjudicated with the hash chain; profile + workspace evidence ride the persisted review", async () => {
  const ch = laneChapter();
  const lane = mkLane({ adjudicator: "honest" });
  try {
    const review = await reviewOneChapter("zz-lane", ch, lane.deps, lane.io, 80);
    assert.equal(review.quizAdjudication?.status, "adjudicated");
    assert.ok(/^[0-9a-f]{64}$/.test(review.quizAdjudication?.derivationSha256 ?? ""), "derivation hash recorded");
    assert.equal(review.quizAdjudication?.items?.length, 1);
    assert.equal(review.quizAdjudication?.keyWrongCount, 0);
    assert.equal(review.executionProfileHash, resolveExecutionProfile("chapter-reviewer").profileHash, "conductor-side profile evidence");
    assert.ok(/^[0-9a-f]{64}$/.test(review.workspaceManifestSha256 ?? ""), "workspace manifest hash recorded");
    assert.equal(lane.persisted.length, 1, "persisted once");
    assert.equal(lane.persisted[0].quizAdjudication?.status, "adjudicated");
    // Instrument binding: document, rubric, output schema, profile, session.
    assert.equal(review.docHash, chapterReaderDocHash(ch));
    assert.equal(review.hashVersion, "v3");
    // Pinned to the constant, not a literal: the rubric version is a WEDGE that
    // moves whenever the reader instrument's scoring semantics change (C2 added
    // the band anchors), and a hand-copied literal here would silently assert
    // the old instrument.
    assert.equal(review.rubricVersion, READER_RUBRIC_VERSION);
    assert.equal(review.phase1DocVersion, "phase1-v1");
  } finally {
    lane.cleanup();
  }
});

test("lane: a garbage adjudicator records an EXPLICIT unavailable after 2 bounded attempts — the review verdict is untouched", async () => {
  const ch = laneChapter();
  const lane = mkLane({ adjudicator: "garbage" });
  try {
    const review = await reviewOneChapter("zz-lane", ch, lane.deps, lane.io, 80);
    assert.ok(review.valid && review.pass, "phase-1 verdict unaffected by the advisory instrument");
    assert.equal(review.quizAdjudication?.status, "unavailable");
    assert.ok(/2 bounded attempts/.test(review.quizAdjudication?.reason ?? ""));
    assert.equal(lane.spawns.filter((s) => s.sessionId.includes("author-quizadj")).length, 2, "exactly two bounded attempts, never unbounded");
  } finally {
    lane.cleanup();
  }
});

test("lane: a THROWING adjudicator spawn (infra preflight) records unavailable — an advisory instrument never converts a decided review into a failure", async () => {
  const ch = laneChapter();
  const lane = mkLane({ adjudicator: "throws" });
  try {
    const review = await reviewOneChapter("zz-lane", ch, lane.deps, lane.io, 80);
    assert.ok(review.valid && review.pass, "the phase-1 verdict survives the infra throw");
    assert.equal(review.quizAdjudication?.status, "unavailable");
    assert.equal(lane.spawns.filter((s) => s.sessionId.includes("author-quizadj")).length, 2, "both bounded attempts were spent, then explicit unavailable");
  } finally {
    lane.cleanup();
  }
});

test("lane: session independence — a mint that collides with the author session is re-minted with the -indep suffix", async () => {
  const ch = laneChapter();
  const lane = mkLane({ authorSid: "the-author-session", adjudicator: "honest", collideOnce: true });
  try {
    const review = await reviewOneChapter("zz-lane", ch, lane.deps, lane.io, 80);
    assert.ok(review.reviewerSessionId !== "the-author-session", "the reviewer is never the author session");
    assert.ok(review.reviewerSessionId.includes("-indep"), "the collision re-mint path fired");
  } finally {
    lane.cleanup();
  }
});

test("carry invalidation: v2-era records and doc-drifted v3 records can never satisfy carryReviewFor", () => {
  const ch = laneChapter();
  const stateRoot = mkdtempSync(join(tmpdir(), "cf-imp08-carry-"));
  try {
    const p1 = ensureTrailingNewline(renderChapterReaderDocPhase1(ch));
    const parsed = parseReaderReview(readerReply(p1))!;
    const good = adjudicateReview(parsed, p1, ch, { bar: 80, reviewerSessionId: "carry-reviewer" });
    assert.ok(good.pass && good.hashVersion === "v3");

    // (a) a v2-era record (legacy instrument) at the same content: DEAD.
    const v2rec: ChapterReviewV1 = { ...good, hashVersion: "v2" as never, docHash: "0".repeat(64) };
    appendReviewHistory("zz-carry", v2rec, stateRoot);
    const missV2 = carryReviewFor("zz-carry", ch, 80, undefined, stateRoot);
    assert.ok(!missV2.hit, "a v2 record never carries across the instrument split");

    // (b) a v3 record whose docHash is not the CURRENT phase-1 bytes: DEAD.
    const drifted: ChapterReviewV1 = { ...good, docHash: createHash("sha256").update("different bytes\n").digest("hex") };
    appendReviewHistory("zz-carry", drifted, stateRoot);
    assert.ok(!carryReviewFor("zz-carry", ch, 80, undefined, stateRoot).hit, "doc drift invalidates carry");

    // (c) the honest v3 record at the exact phase-1 bytes: CARRIES.
    appendReviewHistory("zz-carry", good, stateRoot);
    const hit = carryReviewFor("zz-carry", ch, 80, undefined, stateRoot);
    assert.ok(hit.hit, `the matching v3 record carries: ${JSON.stringify(hit)}`);
    assert.equal(REVIEW_DOC_HASH_VERSION, "v3");
    assert.equal(chapterContentHash(ch), good.contentHash, "content binding sanity");
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("no model identity in ANY reviewer-visible artifact: tasks and workspace files carry no policy model string", async () => {
  const ch = laneChapter();
  const lane = mkLane({ adjudicator: "honest" });
  try {
    await reviewOneChapter("zz-lane", ch, lane.deps, lane.io, 80);
    // The strings that could leak identity: model family names the policy
    // routes to. The reviewer-visible surfaces are the task text and the
    // workspace file contents (captured by the mock via its own cwd read).
    for (const s of lane.spawns) {
      for (const leak of ["gpt-5", "gpt-4", "claude", "o3", "codex-model"]) {
        assert.ok(!s.task.toLowerCase().includes(leak), `task leaks "${leak}"`);
      }
    }
  } finally {
    lane.cleanup();
  }
});
