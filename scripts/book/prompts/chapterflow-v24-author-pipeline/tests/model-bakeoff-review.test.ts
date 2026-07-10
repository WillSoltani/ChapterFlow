/**
 * Model bake-off — the blinded review battery: fixed-judge pinning on every
 * reviewer spawn, blind packets (no identity in doc or task), independent book
 * reads with a disagreement-only tiebreak, and review persistence for resume.
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { test } from "./harness.js";
import type { AutopilotDeps } from "../src/orchestrator/autopilot.js";
import type { SpawnCodexAgentOptions, CodexAgentResult } from "../src/orchestrator/codexAgent.js";
import { bakeoffRoots, PIPELINE_DIR } from "../src/bakeoff/paths.js";
import { forbiddenReviewTokens, reviewCandidate } from "../src/bakeoff/review.js";
import type { CandidateSpec } from "../src/bakeoff/types.js";
import { fixtureChapter, tmpRoot, fakeAutopilotDeps } from "./model-bakeoff-helpers.js";

const SPECS: CandidateSpec[] = [
  { model: "gpt-5.6-sol", slug: "gpt-5-6-sol", slot: "w1", effort: "xhigh" },
  { model: "gpt-5.6-terra", slug: "gpt-5-6-terra", slot: "w2", effort: "xhigh" },
  { model: "gpt-5.6-luna", slug: "gpt-5-6-luna", slot: "w3", effort: "xhigh" },
];

const TEN_SCORES = { retention: 82, quizzes: 80, transfer: 81, practical: 83, summaries: 80, tone: 82, limits: 78, insight: 79, density: 80, beginner: 84 };

/** A judge spawn that behaves like a real blinded reader: reads the doc file
 *  named in the task, quotes real bytes from it, and returns the fenced JSON
 *  contract. Composites are controlled per test via `scoreOf`. */
function judgeSpawn(
  record: SpawnCodexAgentOptions[],
  scoreOf: (readNo: number) => number,
): (opts: SpawnCodexAgentOptions) => Promise<CodexAgentResult> {
  let bookReads = 0;
  return async (opts) => {
    record.push(opts);
    const docRel = opts.task.match(/at: (\S+)/)?.[1] ?? "";
    // IMP-08: reviewers run inside role workspaces (cwd = the workspace), so a
    // realistic judge resolves the doc against ITS OWN cwd, like real codex.
    const docText = readFileSync(resolve(opts.cwd ?? PIPELINE_DIR, docRel), "utf8");
    const quote = docText.split("\n").find((l) => l.length > 30 && !l.startsWith("#") && !l.startsWith("=")) ?? docText.slice(0, 40);
    const isBookReview = opts.task.includes("gate_verdict") || opts.task.startsWith("BLINDED BOOK REVIEW") || opts.task.includes("book3_churn");
    let payload: Record<string, unknown>;
    if (isBookReview) {
      bookReads += 1;
      const c = scoreOf(bookReads);
      const scores = Object.fromEntries(Object.keys(TEN_SCORES).map((k) => [k, c]));
      payload = {
        gate_verdict: "PASS",
        book3_churn: "LOW",
        quizDerivation: {},
        scores,
        quotes: [{ quote, why: "strong" }],
        oneParagraphVerdict: "solid",
      };
    } else {
      payload = {
        quizDerivation: { answers: [], keyDisagreements: [], tells: [] },
        scores: TEN_SCORES,
        ship84: true,
        quotes: [{ quote, why: "strong" }],
        complaints: [],
        oneParagraphVerdict: "ships",
      };
    }
    const finalMessage = "```json\n" + JSON.stringify(payload) + "\n```";
    return { ok: true, exitCode: 0, finalMessage, stdout: finalMessage, stderr: "", durationMs: 3, sessionId: opts.sessionId };
  };
}

test("reviewCandidate pins the FIXED judge on every spawn, blinds every packet, and persists reviews under the opaque label", async () => {
  const bookId = "zz-bakeoff-review";
  const roots = bakeoffRoots(bookId, "r1", tmpRoot("cf-bakeoff-review-"));
  const chapters = [fixtureChapter(bookId, 1), fixtureChapter(bookId, 2)];
  const spawns: SpawnCodexAgentOptions[] = [];
  const deps = fakeAutopilotDeps({
    spawn: judgeSpawn(spawns, () => 80) as unknown as AutopilotDeps["spawn"],
  }) as AutopilotDeps;

  const review = await reviewCandidate(bookId, "B", chapters, deps, roots, {
    runId: "r1",
    judge: { model: "gpt-5.5", effort: "high" },
    forbidden: forbiddenReviewTokens(SPECS),
    log: () => {},
    chapterParallel: 1,
  });

  // Fixed instrument: EVERY reviewer spawn carries the judge pin, read-only.
  assert.ok(spawns.length >= 4, "2 chapter reads + 2 book reads at minimum");
  for (const s of spawns) {
    assert.equal(s.model, "gpt-5.5", "judge model pinned on every reviewer spawn");
    assert.equal(s.reasoningEffort, "high", "judge effort pinned");
    assert.equal(s.sandbox, "read-only", "reviewers never write");
  }
  // Blind packets: no model id / family / slot / tier vocabulary in any task.
  const forbidden = forbiddenReviewTokens(SPECS);
  for (const s of spawns) {
    for (const tok of forbidden) {
      assert.ok(!new RegExp(`(^|[^a-z0-9])${tok.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^a-z0-9])`, "i").test(s.task), `task leaks "${tok}"`);
    }
  }
  // The two independent reads AGREED (same composite) → no tiebreak read.
  assert.equal(review.bookReads.length, 2, "no tiebreak when the two reads agree");
  assert.equal(review.bookGate, "PASS");
  assert.equal(review.label, "B");
  assert.equal(review.chapterReviews.length, 2);
  assert.ok(review.contentSha256.length === 64, "content hash recorded for resume");
  // Docs + review records live under the LABEL dir (never the model name).
  // IMP-08: the forensic chapter doc is the phase-1 (key-free) copy.
  assert.ok(existsSync(join(roots.reviewsDir, "B", "ch01.phase1.txt")));
  assert.ok(existsSync(join(roots.reviewsDir, "B", "book-sample.phase1.txt")), "book doc forensic copy is phase-1 too");
  assert.ok(existsSync(join(roots.reviewsDir, "B", "review.json")));
  const persisted = JSON.parse(readFileSync(join(roots.reviewsDir, "B", "review.json"), "utf8"));
  assert.equal(persisted.label, "B");
});

test("disagreeing book reads trigger exactly ONE independent tiebreak read", async () => {
  const bookId = "zz-bakeoff-tiebreak";
  const roots = bakeoffRoots(bookId, "r1", tmpRoot("cf-bakeoff-tb-"));
  const chapters = [fixtureChapter(bookId, 1)];
  const spawns: SpawnCodexAgentOptions[] = [];
  // Read 1 scores 88, read 2 scores 70 (gap > noise band) → tiebreak read 3.
  const deps = fakeAutopilotDeps({
    spawn: judgeSpawn(spawns, (readNo) => (readNo === 1 ? 88 : readNo === 2 ? 70 : 80)) as unknown as AutopilotDeps["spawn"],
  }) as AutopilotDeps;

  const review = await reviewCandidate(bookId, "A", chapters, deps, roots, {
    runId: "r1",
    judge: { model: "gpt-5.5", effort: "high" },
    forbidden: [],
    log: () => {},
    chapterParallel: 1,
  });
  assert.equal(review.bookReads.length, 3, "one tiebreak read on disagreement");
  assert.ok(review.bookComposite !== null);
});
