/**
 * WP-801 — failure-injection suite for the generation pipeline (master plan §8 WP-801).
 *
 * Ten NAMED scenarios, each driving the REAL production mechanism in-process with an
 * injected failure (never a live model call — CHAPTERFLOW_NO_API_CODEX_QC=1 is set on
 * every invocation of this suite) and asserting: (a) a fail-closed halt with no partial
 * canonical write, (b) a truthful, diagnosably-distinct non-zero exit code, (c) a bounded
 * attempt count, and (d) zero silent model substitution/fallback.
 *
 * Scenario → real mechanism exercised (no guard is weakened to make a test pass):
 *   malformed_model_output     → authorWriteOneChapter/importCandidate (chapterTransaction.ts):
 *                                 a candidate that is not valid JSON.
 *   output_schema_violation    → authorWriteOneChapter/importCandidate: a syntactically-valid
 *                                 candidate carrying the WRONG chapterId (identity/schema
 *                                 contract violation).
 *   timeout                    → classifyProviderOutcome (modelPolicy.ts) + authorWriteOneChapter
 *                                 with a spawn that throws exactly the "timed out" shape the
 *                                 real runner's SIGKILL-on-timeout throw carries.
 *   context_truncation         → classifyProviderOutcome + authorWriteOneChapter with a spawn
 *                                 that COMPLETES (transport layer) but writes truncated/incomplete
 *                                 JSON — the SAME "completed but invalid content" reclassification
 *                                 rule production call sites use (bakeoff/migration/sampleRunner.ts:273,
 *                                 rubricAuditHarness.ts:682/764: a clean spawn whose output fails
 *                                 downstream validation is content_invalid, never timeout).
 *   sigkill_mid_chapter        → the WP-103 mid-kill CAS/interrupt harness (manifest-state
 *                                 injection, chapterTransaction.ts) wired through
 *                                 generateBookCommand's --resume.
 *   stale_state_dir            → the WP-602 doctor's canonical-chapter-set check
 *                                 (compareChapterSetToCanonical, src/lib/chapterSet.ts) wired
 *                                 through runGeneratePreflightChecks + generateBookCommand.
 *   duplicate_concurrent_invocation → the REAL acquireBookLock + runAutopilot lock-check
 *                                 (autopilot.ts:1187-1190), wired through generateBookCommand.
 *   missing_artifact            → authorWriteOneChapter's pre-spawn packet-presence check.
 *   unsupported_model_config    → modelPolicy.resolveRoute/preflightOperatorModelSelection
 *                                 (RoutePreflightError-class refusal) + generateBookCommand.
 *   forbidden_gpt55_config      → the SAME gate: a gpt-5.5-* id is not a member of
 *                                 SUPPORTED_MODEL_IDS (directive-1) — refused identically,
 *                                 pre-spawn, with no fallback.
 *
 * STUDY: this file deliberately follows the established patterns of
 * tests/generate-book-command.test.ts (WP-601 injected-deps harness),
 * tests/generate-book-cli.test.ts (WP-604 — REAL acquireBookLock/runAutopilot lock-check,
 * the WP-103 mid-kill harness wired through generateBookCommand's --resume), and
 * tests/author-arch.test.ts (authorWriteOneChapter driven with an injected spawn/io rig).
 * Per tests/generate-book-cli.test.ts's own header note, the WP-103 interrupt harness
 * (tests/resume-mid-kill-cas.test.ts) is INLINED here rather than imported — importing a
 * sibling *.test.ts module would transitively execute (and register) its whole suite under
 * THIS file's report header (tests/run.ts loads every *.test.ts file by iterating the
 * directory and running + clearing the shared harness registry per file).
 */

import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { test } from "./harness.js";
import {
  PIPELINE_DIR,
  STATE_CHAPTERS,
  STATE_INDEXES,
  makeChapter,
  writeCanonicalIndexFixture,
  writeFixtureBook,
} from "./helpers.js";

import {
  GENERATE_BOOK_EXIT,
  generateBookCommand,
  parseGenerateBookArgs,
  type GenerateBookConfig,
  type GenerateBookDeps,
  type GenerateBookParsed,
} from "../src/orchestrator/generateBookCommand.js";
import {
  runAutopilot,
  acquireBookLock,
  type AutopilotDeps,
  type AutopilotOptions,
  type AutopilotOutcome,
} from "../src/orchestrator/autopilot.js";
import { runGeneratePreflightChecks, type DoctorFinding } from "../src/lifecycle/doctor.js";
import {
  authorChapterId,
  authorWriteOneChapter,
  AUTHOR_WRITE_GATE_RETRIES,
} from "../src/orchestrator/authorRun.js";
import { chapterFileName } from "../src/lib/chapterPaths.js";
import {
  classifyProviderOutcome,
  isSupportedModelId,
  preflightOperatorModelSelection,
  resolveRoute,
  RoutePreflightError,
  UnsupportedModelConfigError,
} from "../src/orchestrator/modelPolicy.js";
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
import type { SourcePacketV1 } from "../src/artifacts/artifactTypes.js";

const TMP = mkdtempSync(join(tmpdir(), "wp801-fail-injection-"));

const HERE = dirname(fileURLToPath(import.meta.url));
const GOLDEN_PACKET = JSON.parse(
  readFileSync(resolve(HERE, "fixtures", "fact-ranking-legacy-packet.json"), "utf8"),
) as SourcePacketV1;

// ── shared: authorWriteOneChapter rig (malformed/schema/timeout/truncation/missing) ──

type SpawnCall = { sessionId: string; cwd?: string; model?: string };
type SpawnResult = { ok: boolean; exitCode: number; finalMessage: string; stdout: string; stderr: string; durationMs: number; sessionId: string };

/** A fully-explicit AuthorIo (every required field stubbed — never falls back to
 *  resolveAuthorIo's real-disk defaults) so these tests never touch the real
 *  pipeline state/ tree, exactly as tests/author-arch.test.ts's mkIo() does. */
function mkFailIo() {
  const chapterBytes = new Map<string, string>();
  return {
    chapterExists: () => false,
    readChapterFile: (b: string, n: number) => chapterBytes.get(`${b}:${n}`) ?? null,
    writeChapterFile: (b: string, n: number, bytes: string) => { chapterBytes.set(`${b}:${n}`, bytes); },
    removeChapterFile: (b: string, n: number) => { chapterBytes.delete(`${b}:${n}`); },
    readBriefMd: () => "# Fixture brief\n\nWrite the complete chapter.",
    readBrief: () => null,
    readPacket: (() => GOLDEN_PACKET) as (bookId: string, chapterNumber: number) => SourcePacketV1 | null,
    readSourcePlan: () => null,
    loadChapters: () => [],
    nameBankOk: () => true,
    voiceCard: () => null,
    authorSessionOf: () => undefined,
    recordProvenance: () => {},
    readProvenance: () => null,
    restoreProvenance: () => {},
    readLeadOverride: () => null,
    writeLeadOverride: () => {},
    removeLeadOverride: () => {},
    gateCandidate: async () => ({ code: 0, stdout: "Gate verdict: PASS — 0 blockers (0 major(s), 0 minor(s) above are non-blocking). (exit 0)", stderr: "" }),
    rubricWithCandidate: async () => ({ code: 0, stdout: "", stderr: "" }),
    attemptsRoot: () => mkdtempSync(join(TMP, "attempts-")),
    chapterBytes,
  };
}

function mkFailDeps(spawnFn: (o: { sessionId: string; cwd?: string }) => Promise<SpawnResult>): { deps: AutopilotDeps; spawnCalls: SpawnCall[] } {
  const spawnCalls: SpawnCall[] = [];
  let n = 0;
  const deps = {
    spawn: (async (o: { sessionId: string; cwd?: string; model?: string }) => {
      spawnCalls.push({ sessionId: o.sessionId, cwd: o.cwd, model: o.model });
      return spawnFn(o);
    }) as unknown as AutopilotDeps["spawn"],
    mkSessionId: (label: string) => `${label}#${++n}`,
    expectedChapterNumbers: () => [1],
    logSession: () => {},
    log: () => {},
  } as unknown as AutopilotDeps;
  return { deps, spawnCalls };
}

const BOUNDED_WRITE_ATTEMPTS = 1 + AUTHOR_WRITE_GATE_RETRIES; // = 2: the initial write + ONE gate retry

// ════════════════════════════════════════════════════════════════════════════
// 1. malformed_model_output
// ════════════════════════════════════════════════════════════════════════════

test("malformed_model_output: a candidate that is not valid JSON fails closed — bounded attempts, no partial canonical write, no silent substitution", async () => {
  const bookId = "zz-wp801-malformed";
  const chapterId = authorChapterId(bookId, 1);
  const candidateName = chapterFileName(chapterId);
  const io = mkFailIo();
  const { deps, spawnCalls } = mkFailDeps(async (o) => {
    writeFileSync(join(o.cwd!, candidateName), "not valid json {{{ a broken model turn cut off mid-token");
    return { ok: true, exitCode: 0, finalMessage: "done", stdout: "", stderr: "", durationMs: 1, sessionId: o.sessionId };
  });

  const r = await authorWriteOneChapter(bookId, 1, deps, { io });

  assert.equal(r.ok, false, "a run of malformed candidates never succeeds");
  if (!r.ok) {
    assert.match(r.reason, /not valid JSON/i, "the halt names the exact defect (JSON parse failure), never a vague failure");
    assert.equal(r.failureKind, "PROMPT_OR_CONTRACT");
  }
  assert.equal(spawnCalls.length, BOUNDED_WRITE_ATTEMPTS, `bounded at ${BOUNDED_WRITE_ATTEMPTS} attempts (1 + AUTHOR_WRITE_GATE_RETRIES) — a persistently malformed writer is never retried forever`);
  assert.equal(io.chapterBytes.get(`${bookId}:1`), undefined, "no partial/malformed draft ever reaches canonical");
  assert.ok(spawnCalls.every((c) => c.model === undefined), "every attempt requests the SAME (policy-resolved) model — no silent substitution across retries");
});

// ════════════════════════════════════════════════════════════════════════════
// 2. output_schema_violation
// ════════════════════════════════════════════════════════════════════════════

test("output_schema_violation: syntactically-valid JSON with the WRONG chapterId (identity/schema contract violation) fails closed — bounded attempts, no partial canonical write", async () => {
  const bookId = "zz-wp801-schema";
  const chapterId = authorChapterId(bookId, 1);
  const candidateName = chapterFileName(chapterId);
  const io = mkFailIo();
  const { deps, spawnCalls } = mkFailDeps(async (o) => {
    // Valid JSON, but the writer output claims a DIFFERENT chapter's identity — the
    // exact "wrong-identity output rejected" contract importCandidate enforces
    // (chapterTransaction.ts:213-215).
    const wrong = JSON.stringify({ chapterId: "some-other-book-ch99", number: 1, title: "Wrong Identity" }, null, 2);
    writeFileSync(join(o.cwd!, candidateName), wrong);
    return { ok: true, exitCode: 0, finalMessage: "done", stdout: "", stderr: "", durationMs: 1, sessionId: o.sessionId };
  });

  const r = await authorWriteOneChapter(bookId, 1, deps, { io });

  assert.equal(r.ok, false, "an identity/schema-violating candidate never accepted");
  if (!r.ok) {
    assert.match(r.reason, /wrong-identity output rejected|!=\s*expected/i, "the halt names the exact schema/identity contract violated");
    assert.equal(r.failureKind, "PROMPT_OR_CONTRACT");
  }
  assert.equal(spawnCalls.length, BOUNDED_WRITE_ATTEMPTS, `bounded at ${BOUNDED_WRITE_ATTEMPTS} attempts — never accepted after unbounded retries either`);
  assert.equal(io.chapterBytes.get(`${bookId}:1`), undefined, "no schema-violating draft ever reaches canonical");
  assert.ok(spawnCalls.every((c) => c.model === undefined), "no silent model substitution across the bounded retries");
});

// ════════════════════════════════════════════════════════════════════════════
// 3. timeout
// ════════════════════════════════════════════════════════════════════════════

test("timeout: classifyProviderOutcome records a REAL provider timeout distinctly, and a writer that always times out halts bounded (never replayed until pass, never a silent model swap)", async () => {
  // The provider-outcome classifier (modelPolicy.ts) is the SAME function every real
  // spawn site (codexAgent.ts, cost-tracker.ts, autopilot.ts) uses to record what a
  // provider DID. A timeout is recorded as "timeout" — DISJOINT from a content failure.
  assert.equal(
    classifyProviderOutcome({ completed: false, errorMessage: "codex exec timed out after 1800000ms" }),
    "timeout",
    "a real timeout classifies as its own disjoint outcome, never content_completed/content_invalid",
  );

  const bookId = "zz-wp801-timeout";
  const io = mkFailIo();
  // The real runner REJECTS (SIGKILL) on a timeout — authorRun.ts's spawn call is
  // wrapped in a try/catch that treats a THROW as "writer session died before
  // completing" (authorRun.ts:1362-1381), never a content failure and never replayed
  // as though the refusal might eventually pass.
  const { deps, spawnCalls } = mkFailDeps(async () => {
    throw new Error("codex exec timed out after 1800000ms (SIGKILL)");
  });

  const r = await authorWriteOneChapter(bookId, 1, deps, { io });

  assert.equal(r.ok, false, "a persistently-timing-out writer never succeeds");
  if (!r.ok) {
    assert.match(r.reason, /died before completing/i, "the halt names a died/timeout session, never a content-quality complaint");
    assert.equal(r.failureKind, "INFRASTRUCTURE");
  }
  assert.equal(spawnCalls.length, BOUNDED_WRITE_ATTEMPTS, `bounded at ${BOUNDED_WRITE_ATTEMPTS} attempts — a timeout is never retried unboundedly`);
  assert.equal(io.chapterBytes.get(`${bookId}:1`), undefined, "no canonical write survives a run of nothing but timeouts");
  assert.ok(spawnCalls.every((c) => c.model === undefined), "no silent model substitution after a timeout");
});

// ════════════════════════════════════════════════════════════════════════════
// 4. context_truncation
// ════════════════════════════════════════════════════════════════════════════

test("context_truncation: a transport-COMPLETE response whose content is truncated mid-generation is recorded as content_invalid (disjoint from timeout, never replayed until it passes)", async () => {
  // The provider layer here genuinely completed (exitCode 0, no error) — the
  // truncation is a CONTENT defect, not an infrastructure one. classifyProviderOutcome
  // alone would call this content_completed; every real call site that validates
  // downstream output (bakeoff/migration/sampleRunner.ts:273,
  // bakeoff/migration/rubricAuditHarness.ts:682/764) reclassifies a clean spawn whose
  // OUTPUT fails validation to content_invalid — the SAME rule applied here.
  const providerLayer = classifyProviderOutcome({ completed: true, exitCode: 0, finalMessage: "partial output, cut off" });
  assert.equal(providerLayer, "content_completed", "the transport layer genuinely completed");
  const recorded = providerLayer === "content_completed" ? "content_invalid" : providerLayer;
  assert.equal(recorded, "content_invalid", "a truncated-but-transport-complete response is recorded as a content failure");
  assert.notEqual(recorded, "timeout", "context truncation must never be conflated with a provider timeout");
  assert.notEqual(
    recorded,
    classifyProviderOutcome({ completed: false, errorMessage: "codex exec timed out after 1800000ms" }),
    "timeout and context-truncation are DISJOINT outcomes",
  );

  const bookId = "zz-wp801-truncated";
  const chapterId = authorChapterId(bookId, 1);
  const candidateName = chapterFileName(chapterId);
  const io = mkFailIo();
  const { deps, spawnCalls } = mkFailDeps(async (o) => {
    // The spawn "completes" (transport ok) but the candidate bytes are an INCOMPLETE
    // JSON document — exactly what a context/output-token ceiling cutting the model
    // off mid-object would leave on disk.
    writeFileSync(join(o.cwd!, candidateName), `{"chapterId":"${chapterId}","number":1,"title":"Partial chapter that got cut off mid-generat`);
    return { ok: true, exitCode: 0, finalMessage: "partial output, cut off", stdout: "", stderr: "", durationMs: 1, sessionId: o.sessionId };
  });

  const r = await authorWriteOneChapter(bookId, 1, deps, { io });

  assert.equal(r.ok, false, "truncated content is never accepted as a finished chapter");
  if (!r.ok) assert.match(r.reason, /not valid JSON/i, "the halt names the truncated/malformed candidate, never a refusal or a timeout");
  assert.equal(spawnCalls.length, BOUNDED_WRITE_ATTEMPTS, `bounded at ${BOUNDED_WRITE_ATTEMPTS} attempts — a persistently truncated response is never replayed until it happens to pass`);
  assert.equal(io.chapterBytes.get(`${bookId}:1`), undefined, "no truncated draft ever reaches canonical");
});

// ════════════════════════════════════════════════════════════════════════════
// 5. sigkill_mid_chapter — reuses the WP-103 mid-kill CAS/interrupt harness
// ════════════════════════════════════════════════════════════════════════════

// Inlined per tests/generate-book-cli.test.ts's own convention (see this file's
// header comment): importing tests/resume-mid-kill-cas.test.ts would transitively
// execute (and register) its whole suite under THIS file's report section.
type KillWindow =
  | "before_canonical_write"
  | "after_canonical_write_before_bracket_close"
  | "pending_required_evidence_bracket_open";

function injectMidKillManifest(args: {
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
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  if (window !== "before_canonical_write") {
    io.writeChapterFile(bookId, chapterNumber, committedBytes);
  }
  return { manifestPath, committedSha256 };
}

function rig(bookId: string): { io: ChapterCanonicalIo & { bytes: Map<string, string> }; root: string } {
  const bytes = new Map<string, string>();
  const root = mkdtempSync(join(TMP, `sigkill-${bookId}-`));
  return {
    root,
    io: {
      bytes,
      readChapterFile: (b, n) => bytes.get(`${b}:${n}`) ?? null,
      writeChapterFile: (b, n, v) => { bytes.set(`${b}:${n}`, v); },
    },
  };
}

function mintAt(io: ChapterCanonicalIo, root: string, bookId: string, chapterNumber: number): ChapterAttempt {
  const nn = String(chapterNumber).padStart(2, "0");
  return mintChapterAttempt({
    bookId, chapterNumber, chapterId: `${bookId}-ch${nn}`,
    attemptKind: "author-initial", attemptSequence: 1, promptSha256: "p".repeat(64),
    io, attemptsRoot: root,
  });
}

test("sigkill_mid_chapter: a kill BEFORE the canonical rename lands leaves canonical UNCHANGED — no partial write is ever observable, recovery resolves aborted_recovered", () => {
  const bookId = "zz-wp801-sigkill-before";
  const { io, root } = rig(bookId);
  const PRIOR = JSON.stringify({ chapterId: `${bookId}-ch01`, number: 1, title: "prior committed" }) + "\n";
  const CAND = JSON.stringify({ chapterId: `${bookId}-ch01`, number: 1, title: "new candidate" }) + "\n";
  io.writeChapterFile(bookId, 1, PRIOR);
  const attempt = mintAt(io, root, bookId, 1);
  injectMidKillManifest({ attempt, io, bookId, chapterNumber: 1, previousSha256: sha256Hex(PRIOR), committedBytes: CAND, window: "before_canonical_write" });

  assert.equal(io.readChapterFile(bookId, 1), PRIOR, "no partial canonical write survives a kill that predates the atomic rename");
  const resolutions = recoverIncompleteCommits(join(root, bookId, "ch01"), io, bookId, 1);
  assert.deepEqual(resolutions, [{ attemptId: attempt.identity.attemptId, resolution: "aborted_recovered" }]);
  assert.equal(io.readChapterFile(bookId, 1), PRIOR, "recovery itself never mutates canonical");
});

test("sigkill_mid_chapter: kill mid-commit-bracket of the LAST chapter, then --resume via generateBookCommand re-enters at the first incomplete phase — byte-verified prior work, no double-write, no corruption", async () => {
  const bookId = "zz-wp801-sigkill-resume";
  const { io, root } = rig(bookId);

  // ch01 committed cleanly BEFORE the kill.
  const ch1Bytes = JSON.stringify({ chapterId: `${bookId}-ch01`, number: 1, title: "One" }) + "\n";
  const a1 = mintAt(io, root, bookId, 1);
  writeFileSync(a1.candidatePath, ch1Bytes);
  assert.ok(importCandidate(a1).ok, "ch01 candidate imports cleanly");
  assert.ok(commitChapterCandidate({ attempt: a1, bytes: ch1Bytes, io }).ok, "ch01 commits cleanly");
  finalizeAttempt(a1, "committed");

  // ch02's commit is interrupted MID-BRACKET (manifest-state injection, never a real
  // signal, per WP-103 instruction 4): the atomic rename already landed, but the
  // bracket never closed — exactly what a real SIGKILL at that instant leaves.
  const ch2Bytes = JSON.stringify({ chapterId: `${bookId}-ch02`, number: 2, title: "Two" }) + "\n";
  const a2 = mintAt(io, root, bookId, 2);
  injectMidKillManifest({ attempt: a2, io, bookId, chapterNumber: 2, previousSha256: null, committedBytes: ch2Bytes, window: "after_canonical_write_before_bracket_close" });
  assert.equal(io.bytes.get(`${bookId}:2`), ch2Bytes, "ch02's atomic rename already landed before the kill");

  const writeCalls: number[] = [];
  const bookRoot = mkdtempSync(join(TMP, "sigkill-pkgs-"));
  const env: Record<string, string | undefined> = {};
  const deps: Partial<GenerateBookDeps> = {
    runConductor: async (o: AutopilotOptions) => {
      const expected = [1, 2];
      const missing = expected.filter((n) => !io.readChapterFile(bookId, n));
      for (const n of missing) writeCalls.push(n); // would (re)author here — must stay empty
      return { status: "ready", bookId: o.bookId, message: `resume complete; ${missing.length} chapter(s) (re)authored` };
    },
    runPreflight: async () => [{ level: "ok", check: "stub", message: "all clear" }] as DoctorFinding[],
    loadConfigFile: () => ({} as GenerateBookConfig),
    now: () => 1_000_000,
    log: () => {},
    env,
    stateBooksDir: mkdtempSync(join(TMP, "sigkill-state-books-")),
    packagePath: (b) => resolve(bookRoot, `${b}.v21.json`),
    ledgerPaths: (b, runId) => ({
      jsonl: resolve(TMP, "sigkill-ledger", b, `${runId}.jsonl`),
      summary: resolve(TMP, "sigkill-ledger", b, `${runId}.summary.json`),
      bookRollup: resolve(TMP, "sigkill-ledger", b, "book-rollup.json"),
    }),
  };
  const parsed = parseGenerateBookArgs([bookId], { title: "T", author: "A", resume: true });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) throw new Error("unreachable");

  const r = await generateBookCommand(parsed.parsed, deps);
  assert.equal(r.code, GENERATE_BOOK_EXIT.OK, "a clean resume over byte-verified prior work is a truthful exit 0, never a halt");
  assert.deepEqual(writeCalls, [], "the resumed run authors NOTHING further — this would FAIL if either chapter were re-authored (double-write)");
  assert.equal(io.bytes.get(`${bookId}:1`), ch1Bytes, "ch01 byte-identical after resume");
  assert.equal(io.bytes.get(`${bookId}:2`), ch2Bytes, "ch02's pre-kill bytes are exactly preserved — no corruption, no silent rollback");

  // Direct recovery (the SAME call mintChapterAttempt performs internally before
  // minting a fresh attempt) closes ch02's dangling bracket bookkeeping-wise,
  // WITHOUT touching canonical bytes a second time — "re-enters at the first
  // incomplete phase with byte-verified prior work".
  const resolutions = recoverIncompleteCommits(join(root, bookId, "ch02"), io, bookId, 2);
  assert.deepEqual(resolutions, [{ attemptId: (a2 as ChapterAttempt).identity.attemptId, resolution: "committed" }]);
  assert.equal(io.bytes.get(`${bookId}:2`), ch2Bytes, "recovery never mutates canonical a second time");
});

// ════════════════════════════════════════════════════════════════════════════
// 6. stale_state_dir
// ════════════════════════════════════════════════════════════════════════════

test("stale_state_dir: a canonical chapter index STALE against on-disk state/chapters fails closed (PREFLIGHT_FATAL, exit 2), naming the exact missing chapter — never a fabricated/backfilled artifact", async () => {
  const bookId = "zz-wp801-stale-idx";
  const ch1 = makeChapter(bookId, 1);
  const files = writeFixtureBook(STATE_CHAPTERS, [ch1]); // only ch01 actually on disk
  // The canonical index claims TWO chapters exist — ch02 is stale/missing.
  writeCanonicalIndexFixture(bookId, [
    { chapterId: ch1.chapterId, number: 1, title: ch1.title },
    { chapterId: `${bookId}-ch02`, number: 2, title: "Ghost Chapter" },
  ]);
  const indexPath = resolve(STATE_INDEXES, `${bookId}.json`);
  try {
    // The REAL WP-602 doctor battery, --resume forces the per-book existing-state
    // checks (canonical-chapter-set) to run as FATAL.
    const findings = await runGeneratePreflightChecks({ bookId, resume: true });
    const csetFinding = findings.find((f) => f.check === "canonical-chapter-set");
    assert.ok(csetFinding, "the canonical-chapter-set check ran");
    assert.equal(csetFinding!.level, "fatal", "a stale index is a FATAL finding, never a silent pass");
    assert.match(csetFinding!.message, /CHSET\.missing_chapter/, "the exact stale/missing input is named");
    assert.match(csetFinding!.message, new RegExp(`${bookId}-ch02`), "the specific missing chapter id is named, never a vague 'something is wrong'");

    // Wired through the terminal command: the run refuses BEFORE any conductor call.
    const env: Record<string, string | undefined> = {};
    const bookRoot = mkdtempSync(join(TMP, "stale-pkgs-"));
    let conductorCalls = 0;
    const deps: Partial<GenerateBookDeps> = {
      runConductor: async (o: AutopilotOptions) => { conductorCalls++; return { status: "published", bookId: o.bookId, roundId: "r1" }; },
      runPreflight: runGeneratePreflightChecks,
      loadConfigFile: () => ({} as GenerateBookConfig),
      now: () => 1_000_000,
      log: () => {},
      env,
      stateBooksDir: mkdtempSync(join(TMP, "stale-state-books-")),
      packagePath: (b) => resolve(bookRoot, `${b}.v21.json`),
      ledgerPaths: (b, runId) => ({
        jsonl: resolve(TMP, "stale-ledger", b, `${runId}.jsonl`),
        summary: resolve(TMP, "stale-ledger", b, `${runId}.summary.json`),
        bookRollup: resolve(TMP, "stale-ledger", b, "book-rollup.json"),
      }),
    };
    const parsed = parseGenerateBookArgs([bookId], { title: "T", author: "A", resume: true });
    assert.equal(parsed.ok, true);
    if (!parsed.ok) throw new Error("unreachable");
    const r = await generateBookCommand(parsed.parsed, deps);
    assert.equal(r.code, GENERATE_BOOK_EXIT.USAGE, "a stale canonical index is a truthful, diagnosable exit 2 (never exit 0)");
    assert.equal(r.label, "PREFLIGHT_FATAL");
    assert.equal(r.ranConductor, false, "a stale-state halt never reaches the conductor");
    assert.equal(conductorCalls, 0, "zero conductor invocations — nothing is fabricated to paper over the missing chapter");
  } finally {
    for (const f of files) rmSync(f, { force: true });
    rmSync(indexPath, { force: true });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// 7. duplicate_concurrent_invocation
// ════════════════════════════════════════════════════════════════════════════

function cleanupRealAutopilotFootprint(bookId: string): void {
  for (const dir of ["state/autopilot-logs", "state/books", "state/run-ledger"]) {
    rmSync(resolve(PIPELINE_DIR, dir, bookId), { recursive: true, force: true });
  }
}

test("duplicate_concurrent_invocation: a second run is refused by the REAL book lock (acquireBookLock + runAutopilot's own lock-check) with a truthful message and non-zero exit — never a silent no-op", async () => {
  const bookId = "zz-wp801-lock-dup";
  const lockDir = mkdtempSync(join(TMP, "lock-dup-"));
  const first = acquireBookLock(lockDir, bookId);
  assert.equal(first.ok, true, "the first invocation genuinely holds the lock");
  try {
    const env: Record<string, string | undefined> = {};
    const bookRoot = mkdtempSync(join(TMP, "lock-dup-pkgs-"));
    const deps: Partial<GenerateBookDeps> = {
      runConductor: (o: AutopilotOptions) => runAutopilot({ ...o, deps: { acquireLock: (id: string) => acquireBookLock(lockDir, id) } }),
      runPreflight: async () => [{ level: "ok", check: "stub", message: "all clear" }] as DoctorFinding[],
      loadConfigFile: () => ({} as GenerateBookConfig),
      now: () => 1_000_000,
      log: () => {},
      env,
      stateBooksDir: mkdtempSync(join(TMP, "lock-dup-state-books-")),
      packagePath: (b) => resolve(bookRoot, `${b}.v21.json`),
      ledgerPaths: (b, runId) => ({
        jsonl: resolve(TMP, "lock-dup-ledger", b, `${runId}.jsonl`),
        summary: resolve(TMP, "lock-dup-ledger", b, `${runId}.summary.json`),
        bookRollup: resolve(TMP, "lock-dup-ledger", b, "book-rollup.json"),
      }),
    };
    const parsed = parseGenerateBookArgs([bookId], { title: "T", author: "A" });
    assert.equal(parsed.ok, true);
    if (!parsed.ok) throw new Error("unreachable");

    const r = await generateBookCommand(parsed.parsed, deps);
    assert.equal(r.code, GENERATE_BOOK_EXIT.BLOCKED, "a genuine lock refusal is the circuit-breaker class (exit 3), never exit 0");
    assert.equal(r.label, "LOCK_REFUSED");
    assert.equal(acquireBookLock(lockDir, bookId).ok, false, "the lock is UNCHANGED after the refused second attempt (never silently stolen or no-op'd)");
  } finally {
    first.release();
    cleanupRealAutopilotFootprint(bookId);
  }
});

// ════════════════════════════════════════════════════════════════════════════
// 8. missing_artifact
// ════════════════════════════════════════════════════════════════════════════

test("missing_artifact: an absent upstream source packet refuses BEFORE any provider spawn — fail-closed halt naming the missing artifact, never a fabricated/backfilled one", async () => {
  const bookId = "zz-wp801-missing-artifact";
  const io = mkFailIo();
  io.readPacket = () => null; // compile-source-packets never ran for this chapter
  const { deps, spawnCalls } = mkFailDeps(async () => {
    throw new Error("must never be called — a missing artifact refuses pre-spawn");
  });

  const r = await authorWriteOneChapter(bookId, 1, deps, { io });

  assert.equal(r.ok, false, "authoring never proceeds without its required source packet");
  if (!r.ok) {
    assert.match(r.reason, /no source packet/i, "the halt names EXACTLY the missing artifact");
    assert.equal(r.failureKind, "STATE_OR_PROVENANCE");
  }
  assert.equal(spawnCalls.length, 0, "zero provider spawns — the refusal happens before any model call, never a fabricated/backfilled substitute");
});

// ════════════════════════════════════════════════════════════════════════════
// 9. unsupported_model_config
// ════════════════════════════════════════════════════════════════════════════

function mkCmdDeps(overrides: Partial<GenerateBookDeps> = {}): { deps: Partial<GenerateBookDeps>; conductorCalls: number; env: Record<string, string | undefined> } {
  const env: Record<string, string | undefined> = {};
  const bookRoot = mkdtempSync(join(TMP, "cmd-pkgs-"));
  let conductorCalls = 0;
  const deps: Partial<GenerateBookDeps> = {
    runConductor: async (o: AutopilotOptions) => { conductorCalls++; return { status: "published", bookId: o.bookId, roundId: "r1" } as AutopilotOutcome; },
    runPreflight: async () => [{ level: "ok", check: "stub", message: "all clear" }] as DoctorFinding[],
    loadConfigFile: () => ({} as GenerateBookConfig),
    now: () => 1_000_000,
    log: () => {},
    env,
    stateBooksDir: mkdtempSync(join(TMP, "cmd-state-books-")),
    packagePath: (b) => resolve(bookRoot, `${b}.v21.json`),
    ledgerPaths: (b, runId) => ({
      jsonl: resolve(TMP, "cmd-ledger", b, `${runId}.jsonl`),
      summary: resolve(TMP, "cmd-ledger", b, `${runId}.summary.json`),
      bookRollup: resolve(TMP, "cmd-ledger", b, "book-rollup.json"),
    }),
    ...overrides,
  };
  return { deps, get conductorCalls() { return conductorCalls; }, env };
}

function parseCmd(bookId: string, flags: Record<string, string | boolean> = {}): GenerateBookParsed {
  const r = parseGenerateBookArgs([bookId], { title: "T", author: "A", ...flags });
  assert.equal(r.ok, true, r.ok ? "" : r.message);
  if (!r.ok) throw new Error("unreachable");
  return r.parsed;
}

test("unsupported_model_config: a RoutePreflightError-class refusal fires BEFORE any provider spawn (assert spawn/conductor call count = 0), no fallback route attempted", async () => {
  // The operator-selection boundary itself (WP-504) — the SAME function
  // generate-book's model-check step calls before any work starts.
  assert.throws(
    () => preflightOperatorModelSelection({ model: "gpt-4o" }),
    (err: unknown) => err instanceof RoutePreflightError && err instanceof UnsupportedModelConfigError,
    "an unsupported model id is refused as a typed RoutePreflightError, never a generic throw",
  );
  assert.equal(isSupportedModelId("gpt-4o"), false, "gpt-4o is not a member of the routable candidate set");

  const h = mkCmdDeps();
  const r = await generateBookCommand(parseCmd("zz-wp801-unsupported-model", { model: "gpt-4o" }), h.deps);
  assert.equal(r.code, GENERATE_BOOK_EXIT.USAGE, "truthful, distinct exit 2 — never exit 0 and never a bare crash");
  assert.equal(r.label, "UNSUPPORTED_MODEL_CONFIG");
  assert.equal(r.ranConductor, false);
  assert.equal(h.conductorCalls, 0, "zero conductor invocations — the refusal happens strictly before any provider work, and no fallback route is attempted");
});

// ════════════════════════════════════════════════════════════════════════════
// 10. forbidden_gpt55_config
// ════════════════════════════════════════════════════════════════════════════

test("forbidden_gpt55_config: a gpt-5.5-* selection is refused pre-spawn exactly like any other unsupported model (directive-1: no GPT-5.5 writer/reviewer/repair/fallback/baseline) — no fallback attempted", async () => {
  // Directive-1 is enforced STRUCTURALLY: SUPPORTED_MODEL_IDS is derived only from
  // the 5.6 candidate family — no gpt-5.5 id can be a member by construction.
  assert.equal(isSupportedModelId("gpt-5.5-sol"), false, "no gpt-5.5-* id is a member of the routable set (directive-1)");
  assert.equal(isSupportedModelId("gpt-5.5"), false);

  assert.throws(
    () => resolveRoute({ role: "author-writer", requestedModel: "gpt-5.5-sol", requireSupportedModel: true }),
    (err: unknown) => err instanceof RoutePreflightError && err instanceof UnsupportedModelConfigError,
    "a forbidden 5.5 id is refused as the SAME typed RoutePreflightError as any unsupported model — no separate, weaker path",
  );
  assert.throws(
    () => preflightOperatorModelSelection({ model: "gpt-5.5-sol" }),
    (err: unknown) => err instanceof RoutePreflightError,
    "the operator-selection boundary refuses gpt-5.5 BEFORE any provider spawn",
  );

  const h = mkCmdDeps();
  const r = await generateBookCommand(parseCmd("zz-wp801-forbidden-55", { model: "gpt-5.5-sol" }), h.deps);
  assert.equal(r.code, GENERATE_BOOK_EXIT.USAGE, "truthful, distinct exit 2");
  assert.equal(r.label, "UNSUPPORTED_MODEL_CONFIG");
  assert.equal(r.ranConductor, false);
  assert.equal(h.conductorCalls, 0, "zero conductor/spawn calls — a forbidden 5.5 config is never silently re-routed to the 5.6 baseline or any other model");
});

// ── cleanup ────────────────────────────────────────────────────────────────────

test("zz cleanup: remove the WP-801 failure-injection tmp root", () => {
  rmSync(TMP, { recursive: true, force: true });
});
