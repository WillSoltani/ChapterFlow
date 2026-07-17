/**
 * WP-E71 red-team — ATTACK 9 (cloned judgment) + ATTACK 10 (blind-identity leak).
 *
 * ATTACK 10. A candidate's model identity is the one secret in the bake-off /
 * chapter-diagnostic pipeline. This asserts a model token (sol/terra/luna/gpt-5.6)
 * or a blind-component effort token (xhigh) trips the leak guard in every place a
 * rater could see it: the blind package (metadata + structural fields), the blind
 * id components, a produced rating record, and any worker/task/session identity
 * string — and that the reviewer-facing leak guard trips on candidate tokens too.
 *
 * ATTACK 9. Two mutually-blind rater judgments must be genuinely independent. A
 * pair seal whose two results are administrative CLONES (identical judgment modulo
 * run/job/role/receipt-hash) is refused by the skill's real `seal_blind_pair_receipt`
 * ("administrative clone of one worker judgment"). Driven end-to-end against the
 * REAL offline python seal script (xenv-gated on python3 + the skill checkout).
 *
 * Hermetic: pure guards + source-driven python whose every write target is a tmp
 * dir (the seal path, receipts, and --temp-root are all under os tmp).
 */

import assert from "node:assert/strict";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { test, xenv } from "./harness.js";
import {
  assertNoModelIdentityLeak,
  ChapterDiagnosticRunError,
} from "../src/evaluation/chapterDiagnosticRun.js";
import {
  buildChapterDiagnosticBookId,
  buildChapterDiagnosticPackage,
  scanChapterDiagnosticForbiddenTokens,
  ChapterDiagnosticPackageError,
} from "../src/evaluation/chapterDiagnosticPackage.js";
import {
  assertNoIdentityLeak,
  forbiddenReviewTokens,
  BlindingLeakError,
} from "../src/bakeoff/review.js";
import {
  assertPython3Available,
  inspectPackage,
  issueWorkerReceipts,
  sealBlindPairReceipt,
} from "../src/evaluation/evaluatorSkillHarness.js";
import { V21_SCHEMA_VERSION, type ChapterV21 } from "../src/types.js";
import type { CandidateSpec } from "../src/bakeoff/types.js";

const PIPELINE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = resolve(PIPELINE_ROOT, "..", "..", "..", "..");
const SEAL_SCRIPT = join(REPO_ROOT, ".agents/skills/chapterflow-book-evaluator/scripts/seal_blind_pair_receipt.py");

function cleanChapter(): ChapterV21 {
  return {
    schemaVersion: V21_SCHEMA_VERSION,
    chapterId: "nudge-ch03", number: 3, title: "Following the Herd", readingTimeMinutes: 8,
    hook: "A short arresting hook line about a group-decision moment worth reading.",
    counterintuition: "The obvious reading of the crowd is usually the wrong one.",
    tryThisNow: "List every reason behind your next group decision and mark the independent ones.",
    keyTakeaway: "Count independent reasons before you trust a unanimous show of hands.",
    breakdown: {
      fastRead: "Fast read paragraph with enough words to look like real prose content for testing here.",
      deepRead: "Deep read paragraph explaining the two-channel mechanism in a bit more depth for the reader.",
      fullRead: "Full read paragraph going into the mechanism, its limits, and a second worked case for depth.",
    },
    examples: [
      { exampleId: "ex01", title: "Example One", tags: ["case"], scenario: "Scenario text describing a concrete situation for testing with enough detail here.", whatToDo: "What-to-do guidance sentence for the reader to act on in this scenario right now.", whyItMatters: "Why-it-matters sentence explaining the stakes of the scenario for the reader clearly." },
    ],
    quiz: {
      passingScorePercent: 70,
      questions: [
        { questionId: "q01", prompt: "Which answer is correct for this test question about the concept here?", choices: ["Wrong one", "Correct answer", "Wrong two"], correctIndex: 1, explanation: "Explanation describing why the correct choice is correct for this test question here.", bloomsLevel: "understand" },
      ],
    },
    reviewCards: [{ cardId: "c01", front: "Card front question text about the concept?", back: "Card back answer text explaining the concept for retrieval.", difficulty: "medium" }],
    implementationPlan: {
      coreSkill: "Core skill description spanning a couple of sentences for test realism here.",
      ifThenPlans: [{ context: "A triggering situation arises for the reader.", plan: "If the context happens, then take the specified action next." }],
      twentyFourHourChallenge: "Within 24 hours, perform the challenge action once and note the result.",
      weeklyPractice: "For one week, repeat the practice daily and record what changes over time.",
    },
    memorableLines: [{ text: "Count reasons, not hands, before you trust the crowd." }],
  } as unknown as ChapterV21;
}

// ══════════════════════════════════════════════════════════════════════════════
// ATTACK 10 — blind-identity leak guards
// ══════════════════════════════════════════════════════════════════════════════

test("attack10: assertNoModelIdentityLeak trips on a model token in a rater-visible record (word-boundary safe)", () => {
  for (const token of ["Sol", "gpt-5.6", "Terra", "Luna"]) {
    assert.throws(() => assertNoModelIdentityLeak({ verdict: `chosen by ${token}` }, "record"), ChapterDiagnosticRunError, `model token ${token} must trip`);
  }
  // A hyphen/slash/space-joined model token in an identity string IS caught.
  assert.throws(() => assertNoModelIdentityLeak({ worker_task_id: "/root/sol-primary" }, "record"), ChapterDiagnosticRunError);
  assert.throws(() => assertNoModelIdentityLeak({ worker_task_id: "/root/sol/primary" }, "record"), ChapterDiagnosticRunError);
  // Word-boundary: benign prose that merely CONTAINS the letters never trips.
  assert.doesNotThrow(() => assertNoModelIdentityLeak({ verdict: "a solution on the console is soluble" }, "record"));
});

// FINDING F-1 (WP-E71) — FIXED. `assertNoModelIdentityLeak` (chapterDiagnosticRun.ts)
// previously used a `\b<token>\b` match. `_` is a WORD character in JS regex, so
// `\bsol\b` did NOT match `sol_primary` — the EXACT `/root/sol_primary`
// reference-record leak form the code's own comment (mintRoleIdentity) calls out.
// The boundary is now aligned with the sibling reviewer guard
// `bakeoff/review.assertNoIdentityLeak` — `(^|[^a-z0-9])TOKEN($|[^a-z0-9])`, which
// treats `_` as a separator — so an underscore-joined model token is caught while
// benign prose ("solution", "console") still never trips. Promoted from xfail.
test(
  'attack10 F-1 (fixed): an underscore-joined model token ("sol_primary") IS caught by assertNoModelIdentityLeak',
  () => {
    assert.throws(() => assertNoModelIdentityLeak({ verdict: "graded by sol_primary" }, "record"), ChapterDiagnosticRunError);
    assert.throws(() => assertNoModelIdentityLeak({ worker_session_id: "luna_verification" }, "record"), ChapterDiagnosticRunError);
    // …and a benign identifier that merely CONTAINS the letters still never trips.
    assert.doesNotThrow(() => assertNoModelIdentityLeak({ verdict: "resolved on the console" }, "record"));
  },
);

test("attack10: a model token in blind package metadata is refused (build fails closed) and scannable", () => {
  const leaky = cleanChapter();
  leaky.title = "How Sol Decides"; // "sol" whole-word in a metadata field
  assert.throws(
    () => buildChapterDiagnosticPackage({ runHash: "rt10", blockCode: "nudge-ch03", slot: "w1", chapter: leaky, book: { title: "Nudge" } }),
    (err: unknown) => err instanceof ChapterDiagnosticPackageError && /forbidden-token|model-identity/i.test((err as Error).message),
  );

  // A clean package scans clean; injecting a model token into a metadata field is detected.
  const built = buildChapterDiagnosticPackage({ runHash: "rt10", blockCode: "nudge-ch03", slot: "w1", chapter: cleanChapter(), book: { title: "Nudge", categories: ["Behavioral Economics"], tags: ["choice"] } });
  assert.deepEqual(scanChapterDiagnosticForbiddenTokens(built.package), [], "a clean blind package has no forbidden-token hits");
  const poisoned = { ...built.package, book: { ...built.package.book, title: "The Sol Method" } };
  const hits = scanChapterDiagnosticForbiddenTokens(poisoned);
  assert.ok(hits.some((h) => h.category === "model-identity"), "the model token is flagged as a model-identity hit");
});

test("attack10: a blind id component that IS a model or effort token is refused", () => {
  assert.throws(() => buildChapterDiagnosticBookId("sol", "nudge-ch03", "w1"), ChapterDiagnosticPackageError);   // model token
  assert.throws(() => buildChapterDiagnosticBookId("terra", "nudge-ch03", "w1"), ChapterDiagnosticPackageError); // model token
  assert.throws(() => buildChapterDiagnosticBookId("xhigh", "nudge-ch03", "w1"), ChapterDiagnosticPackageError); // effort token
  // The blind slot convention w1/w2/w3 is allowed (it is NOT a model/effort token).
  assert.ok(buildChapterDiagnosticBookId("rh", "nudge-ch03", "w1").startsWith("chapterdiag--"));
});

test("attack10: the reviewer-facing leak guard trips on candidate model tokens (word-boundary safe)", () => {
  const candidates = [{ model: "gpt-5.6-sol", slug: "sol-cand", slot: "w1" }] as unknown as CandidateSpec[];
  const forbidden = forbiddenReviewTokens(candidates);
  assert.ok(forbidden.includes("gpt-5.6-sol") && forbidden.includes("sol"), "the family suffix is a forbidden token");
  assert.throws(() => assertNoIdentityLeak("the sol candidate wrote a strong chapter", forbidden, "reviewer doc"), BlindingLeakError);
  assert.throws(() => assertNoIdentityLeak("compare gpt-5.6-sol against B", forbidden, "reviewer doc"), BlindingLeakError);
  // "solution"/"console" must never false-positive on "sol".
  assert.doesNotThrow(() => assertNoIdentityLeak("a solution appeared on the console", forbidden, "reviewer doc"));
});

// ══════════════════════════════════════════════════════════════════════════════
// ATTACK 9 — cloned judgment rejected by the REAL blind-pair seal (python)
// ══════════════════════════════════════════════════════════════════════════════

function canRunClone(): boolean {
  if (!existsSync(SEAL_SCRIPT)) return false;
  try { assertPython3Available(); return true; } catch { return false; }
}

xenv(
  "attack9: the real seal script rejects an administrative clone of one worker judgment, and seals a genuinely distinct pair",
  "python3 and/or the chapterflow-book-evaluator skill scripts are not available on this machine",
  canRunClone,
  () => {
    const workDir = mkdtempSync(join(tmpdir(), "cf-rt9-"));
    const tempRoot = join(workDir, "tmp");
    const opts = { repoRoot: REPO_ROOT, tempRoot } as const;

    // 1. A real blind package + a real inspect for the source hash.
    const built = buildChapterDiagnosticPackage({ runHash: "rt9", blockCode: "nudge-ch03", slot: "w1", chapter: cleanChapter(), book: { title: "Nudge", categories: ["Behavioral Economics"], tags: ["choice"] } });
    const packagePath = join(workDir, "package.json");
    writeFileSync(packagePath, built.bytes);
    const bookId = built.blindBookId;
    const runId = "rt9run";

    const inspected = inspectPackage(packagePath, { ...opts, tempRoot });
    assert.equal(inspected.process.exitCode, 0, inspected.process.stderr);
    const sourceHash = inspected.artifact!.source_hash;

    // 2. Two distinct-identity dispatch receipts (the blind pair).
    const receiptsDir = join(workDir, "receipts");
    const receipts = issueWorkerReceipts({
      package: packagePath, tempRoot, runId, bookId, pairId: `${bookId}-pair`,
      primaryJobId: "jp", primaryTaskId: "/root/primary", primarySessionId: "sp",
      verificationJobId: "jv", verificationTaskId: "/root/verification", verificationSessionId: "sv",
      outputDir: receiptsDir,
    }, opts);
    assert.equal(receipts.process.exitCode, 0, receipts.process.stderr);

    // 3. The ATTACK: a verification result that is an administrative clone of the
    //    primary — identical judgment payload, only the admin fields (job/role/
    //    receipt-hash) re-stamped to bind to the verification dispatch receipt.
    const judgment = { domains: { epistemic_integrity: { note: "same" } }, chapter_diagnostic_score: 80, verdict: "identical judgment" };
    const primaryResult = { ...judgment, run_id: runId, book: { book_id: bookId }, source_hash: sourceHash, job_id: "jp", rater_role: "primary", worker_dispatch_receipt_sha256: receipts.hashes!.primary_sha256 };
    const clonedVerification = { ...primaryResult, job_id: "jv", rater_role: "verification", worker_dispatch_receipt_sha256: receipts.hashes!.verification_sha256 };

    const primaryPath = join(workDir, "primary.result.json");
    const clonePath = join(workDir, "verification.clone.json");
    writeFileSync(primaryPath, JSON.stringify(primaryResult));
    writeFileSync(clonePath, JSON.stringify(clonedVerification));

    const cloneSeal = sealBlindPairReceipt({
      package: packagePath, tempRoot, primary: primaryPath, verification: clonePath,
      primaryDispatch: receipts.primaryDispatchPath, verificationDispatch: receipts.verificationDispatchPath,
      output: join(workDir, "clone.seal.json"),
    }, opts);
    assert.notEqual(cloneSeal.process.exitCode, 0, "the clone must NOT seal");
    assert.equal(cloneSeal.seal, null);
    assert.match(cloneSeal.process.stderr, /administrative clone/i, "the seal names the clone refusal");

    // 4. Positive control: a genuinely DISTINCT verification judgment seals cleanly.
    const distinctVerification = { ...clonedVerification, verdict: "an independent, different judgment", chapter_diagnostic_score: 74 };
    const distinctPath = join(workDir, "verification.distinct.json");
    writeFileSync(distinctPath, JSON.stringify(distinctVerification));
    const okSeal = sealBlindPairReceipt({
      package: packagePath, tempRoot, primary: primaryPath, verification: distinctPath,
      primaryDispatch: receipts.primaryDispatchPath, verificationDispatch: receipts.verificationDispatchPath,
      output: join(workDir, "ok.seal.json"),
    }, opts);
    assert.equal(okSeal.process.exitCode, 0, `a distinct pair must seal: ${okSeal.process.stderr}`);
    assert.ok(okSeal.seal, "the distinct pair produced a seal");
    assert.notEqual(okSeal.seal!.workers.primary.judgment_sha256, okSeal.seal!.workers.verification.judgment_sha256);
  },
);
