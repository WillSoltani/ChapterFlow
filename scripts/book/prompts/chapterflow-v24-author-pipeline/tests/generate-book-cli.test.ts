/**
 * WP-604 — the `generate-book` CLI test suite: the DEFINITIVE regression net for the
 * terminal command's operator contract (master plan §8 WP-604; docs/v25/WP-601-GENERATE-BOOK-COMMAND.md).
 *
 * This file EXTENDS the existing coverage rather than duplicating it:
 *   - tests/generate-book-command.test.ts already drives `generateBookCommand` at the
 *     injected-deps level (parse/config-precedence/model-fail-closed/validate-only/dry-run/
 *     overwrite-refusal/exit-mapping/production-wiring). This file does NOT re-assert those.
 *   - tests/cli-contract.test.ts already spawns the REAL CLI (`runCli`) for generate-book's
 *     bad-args and unsupported/non-baseline-model pre-work exits (both exit 2). This file does
 *     NOT re-assert those; it closes the GAPS the master plan names: a full real-subprocess
 *     exit-code walk, the duplicate-invocation lock, resume-after-kill at each stage boundary,
 *     and validate-only on known-bad fixtures.
 *
 * ZERO LIVE MODEL CALLS anywhere in this file. Every subprocess invocation below passes
 * CHAPTERFLOW_NO_API_CODEX_QC=1 and uses ONLY --dry-run / --validate-only / bad-flags /
 * a refuse-clobber fixture — never a bare live-capable `generate-book` invocation (per the
 * governing hard rule: live-capable CLI verbs are forbidden even for guard testing; module-level
 * + --plan/--validate-only/--dry-run are the only sanctioned real-process surfaces). Where the
 * true contract (a second concurrent live run, a live D7/QC halt) can only manifest inside the
 * real author-first run (which would need to spawn codex), it is proven at the MODULE level
 * against the REAL underlying mechanism (acquireBookLock, runAutopilot's lock-check, decidePhase,
 * repairTargetChapterNumbers, the D7 halt-sidecar freshness guard, chapterTransaction's CAS
 * primitives) — never a scripted string a regression could fool. Each such test says so inline.
 *
 * ── Exit-code table roadmap (0/1/2/3) — where each scenario is proven ───────────────────────
 *   0  OK       — §A1 below: real subprocess, `--dry-run` on a fresh book (env-independent).
 *   1  HALT     — §A2 below: real subprocess, `--validate-only` with a deterministic warn-only
 *                 fixture (too-short --expected-base-sha); the OTHER exit-1 class (a genuine
 *                 runtime halt) needs a live conductor run and is covered at the injected-deps
 *                 level by generate-book-command.test.ts ("generic content halt → exit 1").
 *   2  USAGE    — bad-args + unsupported/non-baseline-model: tests/cli-contract.test.ts
 *                 (real subprocess, pre-existing). REFUSED_CLOBBER: §A3 below (real subprocess,
 *                 NEW). PREFLIGHT_FATAL from a genuinely bad fixture: §D below (module-level,
 *                 composing REAL doctor checks against REAL bad fixtures — corrupt name-bank /
 *                 dirty forbidden worktree / unsupported model via --validate-only).
 *   3  BLOCKED  — §B below (duplicate-invocation lock: module-level, REAL acquireBookLock +
 *                 REAL runAutopilot lock-check) and the pre-existing D7 quality-bar test in
 *                 generate-book-command.test.ts (BLOCKED_QUALITY_BAR, sealed halt sidecar).
 *                 A second concurrent LIVE process and a live D7 halt both require a real
 *                 author-first run (forbidden here) — proven at module level instead; documented.
 *
 * ── Resume-after-kill at each stage boundary (§C) ───────────────────────────────────────────
 * "Stage boundary" follows the master plan's own vocabulary (author / floor / repair / gate /
 * publish). Each test names the REAL, production mechanism that governs "what a resumed run
 * does at this boundary" — the SAME mechanism a fresh run and a `--resume` run both consult
 * (there is no separate "resume code path"; resume is simply re-entering the conductor over
 * durable on-disk state) — so proving the mechanism proves resume:
 *   author  → the chapterTransaction CAS primitives (mint/commit/finalize/recover), reused via
 *             WP-103's `injectMidKillManifest` harness, wired through generateBookCommand's
 *             `--resume` flag.
 *   floor   → `decidePhase` (BookStatus → phase), the single function EVERY re-entry (fresh or
 *             resumed) uses to decide "gate" vs "write" vs "qc".
 *   repair  → `repairTargetChapterNumbers` (round evidence-matrix → the edit-target set),
 *             untested elsewhere (tests/repair-flagged-chapters.test.ts only covers its sibling
 *             `flaggedChapterNumbers`).
 *   gate    → the D7 halt-sidecar freshness guard (`classifyOutcomeExit`/`readFreshD7Halt`),
 *             extended here with a torn-file defense-in-depth case not covered elsewhere.
 *   publish → `decidePhase`'s packaged/regen branch + the CLI's REFUSED_CLOBBER/--resume/
 *             --overwrite wiring (generate-book-command.test.ts), tied together here.
 */

import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { dirname, join, resolve } from "path";

import { test } from "./harness.js";
import {
  PIPELINE_DIR,
  STATE_CHAPTERS,
  STATE_INDEXES,
  makeChapter,
  runCli,
  writeCanonicalIndexFixture,
  writeFixtureBook,
} from "./helpers.js";
import {
  GENERATE_BOOK_EXIT,
  classifyOutcomeExit,
  generateBookCommand,
  parseGenerateBookArgs,
  type GenerateBookConfig,
  type GenerateBookDeps,
  type GenerateBookParsed,
} from "../src/orchestrator/generateBookCommand.js";
import { runAutopilot, acquireBookLock, decidePhase, repairTargetChapterNumbers } from "../src/orchestrator/autopilot.js";
import type { AutopilotOptions, AutopilotOutcome } from "../src/orchestrator/autopilot.js";
import type { BookStatus } from "../src/lifecycle/bookStatus.js";
import {
  runGeneratePreflightChecks,
  checkNameBankConfig,
  checkWorktreeClean,
  type DoctorFinding,
} from "../src/lifecycle/doctor.js";
import { d7ShipGateHaltPath } from "../src/critics/d7ShipGate.js";
import {
  commitChapterCandidate,
  finalizeAttempt,
  importCandidate,
  mintChapterAttempt,
  recoverIncompleteCommits,
  type ChapterAttempt,
  type ChapterCanonicalIo,
} from "../src/orchestrator/chapterTransaction.js";
import { evidenceMatrixPath, orchestratorRoundDir } from "../src/qc/orchestrator/artifacts.js";
import { sha256Hex } from "../src/contracts/contractUtil.js";

const TMP = mkdtempSync(join(tmpdir(), "gen-book-cli-"));

/**
 * The WP-103 mid-kill interrupt harness (tests/resume-mid-kill-cas.test.ts), INLINED rather
 * than imported: `tests/run.ts` loads every `*.test.ts` file by iterating the directory and
 * imports+runs+CLEARS the shared harness registry per file; importing a sibling `*.test.ts`
 * module would transitively execute (and register) ITS tests too — at THIS file's position in
 * the alphabetical run order ("generate-book-cli" sorts before "resume-mid-kill-cas"), that
 * would silently fold resume-mid-kill-cas.test.ts's whole suite into this file's console
 * section and leave it reporting zero tests under its own header. Inlining keeps each file's
 * report honest. Behavior is identical to the original (WP-103's own header names this WP as
 * the intended reuse of the technique, not the module).
 */
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

// ── shared module-level harness (mirrors generate-book-command.test.ts's mkHarness,
//    kept local/lightweight — this file's scenarios need different real-vs-fake mixes
//    per test, e.g. a REAL runPreflight or a REAL runConductor) ─────────────────────────────

type Harness = { deps: Partial<GenerateBookDeps>; logs: string[]; env: Record<string, string | undefined>; out: string };

function mkHarness(overrides: Partial<GenerateBookDeps> = {}): Harness {
  const logs: string[] = [];
  const env: Record<string, string | undefined> = {};
  const bookRoot = mkdtempSync(join(TMP, "pkgs-"));
  const deps: Partial<GenerateBookDeps> = {
    runConductor: async (o) => ({ status: "published", bookId: o.bookId, roundId: "r1", message: "PUBLISHED (fake)" }) as AutopilotOutcome,
    runPreflight: async () => [{ level: "ok", check: "stub", message: "all clear" }] as DoctorFinding[],
    loadConfigFile: () => ({} as GenerateBookConfig),
    now: () => 1_000_000,
    log: (l) => logs.push(l),
    env,
    stateBooksDir: mkdtempSync(join(TMP, "state-books-")),
    packagePath: (b) => resolve(bookRoot, `${b}.v21.json`),
    ledgerPaths: (b, runId) => ({
      jsonl: resolve(TMP, "ledger", b, `${runId}.jsonl`),
      summary: resolve(TMP, "ledger", b, `${runId}.summary.json`),
      bookRollup: resolve(TMP, "ledger", b, "book-rollup.json"),
    }),
    ...overrides,
  };
  return { deps, logs, env, get out() { return logs.join("\n"); } };
}

function parse(bookId: string, flags: Record<string, string | boolean> = {}): GenerateBookParsed {
  const r = parseGenerateBookArgs([bookId], { title: "T", author: "A", ...flags });
  assert.equal(r.ok, true, r.ok ? "" : r.message);
  if (!r.ok) throw new Error("unreachable");
  return r.parsed;
}

/**
 * The v24 author-pipeline's `state/chapters`/`state/indexes` carry ZERO gold books yet (the
 * pipeline is still pre-launch — CLAUDE.md: this is background tooling, no v24 book has shipped).
 * `checkCanonicalChapterSet` is FATAL for any bookId with no canonical index at all — by design,
 * a book without one has never been indexed — so a real subprocess run against a bookId that
 * doesn't already have a minimal on-disk fixture NEVER reaches exit 0/1 (it hits PREFLIGHT_FATAL
 * first, regardless of the scenario under test). This registers the minimal REAL fixture (one
 * structurally-valid chapter + a matching canonical index — same pattern tests/cli-contract.test.ts's
 * "book-gate exits 0" test already uses) so the REST of the preflight resolves ok/warn, isolating
 * whatever this file's own test is actually trying to prove. Always cleaned up by explicit path
 * (never a wildcard/`git add -A`-style removal).
 */
function withMinimalCanonicalFixture(bookId: string): { cleanup: () => void } {
  const ch1 = makeChapter(bookId, 1);
  const files = writeFixtureBook(STATE_CHAPTERS, [ch1]);
  writeCanonicalIndexFixture(bookId, [{ chapterId: ch1.chapterId, number: 1, title: ch1.title }]);
  const indexPath = resolve(STATE_INDEXES, `${bookId}.json`);
  return {
    cleanup: () => {
      for (const f of files) rmSync(f, { force: true });
      rmSync(indexPath, { force: true });
    },
  };
}

/** runAutopilot writes cost-report/run-manifest/call-ledger rollups for EVERY terminal (even
 *  an immediate lock-refusal halt) under the REAL PIPELINE_DIR, keyed by bookId — the SAME
 *  footgun tests/cli-contract.test.ts's WP-201 test documents and cleans up (state/run-ledger/
 *  is NON-gitignored). Any test in this file that invokes the REAL runAutopilot must call this. */
function cleanupRealAutopilotFootprint(bookId: string): void {
  for (const dir of ["state/autopilot-logs", "state/books", "state/run-ledger"]) {
    rmSync(resolve(PIPELINE_DIR, dir, bookId), { recursive: true, force: true });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// §A — exit-code table via REAL SUBPROCESS (tsx src/cli.ts), where the real exit code matters
// ═══════════════════════════════════════════════════════════════════════════════════════════

const NO_API = { CHAPTERFLOW_NO_API_CODEX_QC: "1" };

test("cli exit-0: --dry-run on a book with a minimal clean fixture is the OK real-CLI path (dry-run only blocks on a FATAL finding, never a warn — so this stays exit 0 regardless of THIS dev worktree's own dirty/off-main state)", () => {
  const bookId = "zz-wp604-dryrun-clean";
  const fixture = withMinimalCanonicalFixture(bookId);
  try {
    const { status, out } = runCli(["generate-book", bookId, "--title", "T", "--author", "A", "--dry-run"], NO_API);
    assert.equal(status, 0, `expected exit 0 for a clean --dry-run; tail:\n${out.slice(-1500)}`);
    assert.match(out, /DRY_RUN|plan complete/i);
  } finally {
    fixture.cleanup();
    cleanupRealAutopilotFootprint(bookId);
  }
});

test("cli exit-1: --validate-only with a deterministic WARN-only fixture (too-short --expected-base-sha) exits 1 via the real CLI", () => {
  const bookId = "zz-wp604-validate-warn";
  const fixture = withMinimalCanonicalFixture(bookId);
  try {
    // checkBaseShaMatch warns (never fatal) on a too-short expected SHA — a genuine,
    // environment-INDEPENDENT warn (unlike worktree-clean/branch-sanity, which depend on this
    // live dev worktree's constantly-changing git state — see doctor-preflight.test.ts's own
    // header comment on why those are hermeticized away from real git state in unit tests).
    const { status, out } = runCli(
      ["generate-book", bookId, "--title", "T", "--author", "A", "--validate-only", "--expected-base-sha", "ab"],
      NO_API,
    );
    assert.equal(status, 1, `a too-short --expected-base-sha must warn (never fatal) → exit 1; tail:\n${out.slice(-1500)}`);
    assert.match(out, /base-sha-match/);
    assert.match(out, /too short/);
  } finally {
    fixture.cleanup();
  }
});

test("cli exit-2 REFUSED_CLOBBER: generate-book on a bookId with an existing shipped package refuses (real CLI, real package-exists check, zero conductor invocation)", () => {
  const bookId = "zz-wp604-clobber";
  const fixture = withMinimalCanonicalFixture(bookId);
  const pkgPath = resolve(PIPELINE_DIR, "book-packages", `${bookId}.v21.json`);
  try {
    mkdirSync(dirname(pkgPath), { recursive: true });
    writeFileSync(pkgPath, "{}\n", "utf8");
    // --dry-run is included per the governing hard rule (never invoke a live-capable verb
    // bare) even though REFUSED_CLOBBER fires BEFORE the dry-run/full-run branch either way.
    const { status, out } = runCli(["generate-book", bookId, "--title", "T", "--author", "A", "--dry-run"], NO_API);
    assert.equal(status, 2, `an existing shipped package must refuse with exit 2; tail:\n${out.slice(-1200)}`);
    assert.match(out, /REFUSED_CLOBBER|Refusing to clobber/i);
    assert.doesNotMatch(out, /starting the author-first run|plan complete/i, "a refusal must never reach the conductor");
  } finally {
    rmSync(pkgPath, { force: true });
    fixture.cleanup();
  }
});

test("cli exit-2: an unsupported --model fails closed even combined with --validate-only (the pre-work model gate runs before, and supersedes, validate-only's own preflight)", () => {
  const bookId = "zz-wp604-badmodel-vo";
  const { status, out } = runCli(
    ["generate-book", bookId, "--title", "T", "--author", "A", "--model", "gpt-4o", "--validate-only"],
    NO_API,
  );
  assert.equal(status, 2, `tail:\n${out.slice(-1000)}`);
  assert.match(out, /UNSUPPORTED_MODEL_CONFIG/);
  assert.doesNotMatch(out, /DOCTOR —/, "the early fail-closed model gate must return before the preflight battery ever runs");
});

test("cli (WP-602b): --validate-only on a genuinely FRESH bookId (NO fixture, NO --resume) no longer hits PREFLIGHT_FATAL — a brand-new book's preflight can pass because the per-book canonical-chapter-set check is skipped (the L-33 defect the WP-604 fixture used to route around)", () => {
  // Deliberately NO withMinimalCanonicalFixture — this IS the primary use case the
  // L-33 defect blocked: a brand-new book with zero on-disk state. Before WP-602b the
  // real CLI hit PREFLIGHT_FATAL on checkCanonicalChapterSet (index_missing) and could
  // never start; after it, the per-book existing-state checks are skipped for a fresh book.
  const bookId = "zz-wp602b-cli-fresh";
  assert.equal(existsSync(resolve(STATE_INDEXES, `${bookId}.json`)), false, "precondition: the fresh book has no canonical index");
  const { status, out } = runCli(
    ["generate-book", bookId, "--title", "T", "--author", "A", "--validate-only"],
    NO_API,
  );
  assert.notEqual(status, 2, `a fresh book's --validate-only must NOT be a FATAL preflight (exit 2); tail:\n${out.slice(-1800)}`);
  assert.doesNotMatch(out, /\[canonical-chapter-set\]/, "the fresh path must not even run — let alone fatal on — the canonical-chapter-set check");
  assert.doesNotMatch(out, /PREFLIGHT_FATAL|BLOCKED — a fatal preflight/, "no fatal-preflight block on a genuinely new book");
  assert.match(out, /READY/i, "validate-only reaches its READY verdict for a fresh book (the run can now start)");
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// §B — DUPLICATE-INVOCATION LOCK (exit 3). A real concurrent SECOND `generate-book` process
// can't be driven model-free (the lock only matters once the real author-first run starts,
// which requires spawning codex — forbidden). Tested instead at the MODULE level against the
// REAL lock mechanism: acquireBookLock (the exact production lock primitive) + runAutopilot's
// OWN lock-check (autopilot.ts:1187-1190), wired through generateBookCommand exactly as the
// CLI wires it — never a scripted "could not acquire the run lock" string.
// ═══════════════════════════════════════════════════════════════════════════════════════════

test("duplicate invocation: a second run is LOCK-REFUSED (exit 3) — REAL acquireBookLock + REAL runAutopilot lock-check (module-level; a live concurrent process is forbidden by L-22)", async () => {
  const bookId = "zz-wp604-lock-dup";
  const lockDir = mkdtempSync(join(TMP, "lock-dup-"));
  // "First invocation" holds a LIVE lock (this test process's own pid — genuinely alive).
  const first = acquireBookLock(lockDir, bookId);
  assert.equal(first.ok, true, "the first invocation acquires the lock");
  try {
    // "Second invocation" — the REAL production conductor, pointed at the SAME lock dir via
    // the SAME injectable acquireLock seam runAutopilot already exposes (opts.deps.acquireLock).
    const h = mkHarness({
      runConductor: (o: AutopilotOptions) =>
        runAutopilot({ ...o, deps: { acquireLock: (id: string) => acquireBookLock(lockDir, id) } }),
    });
    const r = await generateBookCommand(parse(bookId), h.deps);
    assert.equal(r.code, GENERATE_BOOK_EXIT.BLOCKED, "a genuine lock refusal is the circuit-breaker class (exit 3)");
    assert.equal(r.label, "LOCK_REFUSED");
    assert.match(h.out, /could not acquire the run lock/i);
    // The lock file itself is UNCHANGED by the refused second attempt (still owned by "first").
    assert.equal(acquireBookLock(lockDir, bookId).ok, false, "the lock is still held after the refused second attempt");
  } finally {
    first.release();
    cleanupRealAutopilotFootprint(bookId);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// §C — resume-after-kill at each stage boundary (author / floor / repair / gate / publish)
// ═══════════════════════════════════════════════════════════════════════════════════════════

// ── author ───────────────────────────────────────────────────────────────────────────────────

test("resume boundary — AUTHOR: kill mid-commit-bracket of the LAST chapter, then --resume via generateBookCommand authors NOTHING (both chapters' canonical bytes already exist; no corruption, no re-author)", async () => {
  const bookId = "zz-wp604-author-boundary";
  const bytes = new Map<string, string>();
  const io: ChapterCanonicalIo & { bytes: Map<string, string> } = {
    bytes,
    readChapterFile: (b, n) => bytes.get(`${b}:${n}`) ?? null,
    writeChapterFile: (b, n, v) => { bytes.set(`${b}:${n}`, v); },
  };
  const root = join(TMP, `author-boundary-${process.pid}`);

  // Pre-kill run: chapter 1 committed cleanly (a normal, uninterrupted commit).
  const ch1Bytes = JSON.stringify({ chapterId: `${bookId}-ch01`, number: 1, title: "One" }) + "\n";
  const a1 = mintChapterAttempt({
    bookId, chapterNumber: 1, chapterId: `${bookId}-ch01`, attemptKind: "author-initial",
    attemptSequence: 1, promptSha256: "a".repeat(64), io, attemptsRoot: root,
  });
  writeFileSync(a1.candidatePath, ch1Bytes);
  assert.ok(importCandidate(a1).ok, "ch01 candidate imports cleanly");
  assert.ok(commitChapterCandidate({ attempt: a1, bytes: ch1Bytes, io }).ok, "ch01 commits cleanly");
  finalizeAttempt(a1, "committed");

  // Chapter 2's commit is interrupted MID-BRACKET: the atomic rename already landed
  // (canonical bytes are ch2's new content) but the bracket never closed — exactly what a
  // real SIGKILL at that instant leaves (simulated via manifest injection, never a real
  // signal — WP-103 instruction 4).
  const ch2Bytes = JSON.stringify({ chapterId: `${bookId}-ch02`, number: 2, title: "Two" }) + "\n";
  const a2 = mintChapterAttempt({
    bookId, chapterNumber: 2, chapterId: `${bookId}-ch02`, attemptKind: "author-initial",
    attemptSequence: 1, promptSha256: "b".repeat(64), io, attemptsRoot: root,
  });
  injectMidKillManifest({
    attempt: a2, io, bookId, chapterNumber: 2, previousSha256: null, committedBytes: ch2Bytes,
    window: "after_canonical_write_before_bracket_close",
  });
  assert.equal(bytes.get(`${bookId}:2`), ch2Bytes, "ch02's atomic rename already landed before the kill");

  const writeCalls: number[] = [];
  const h = mkHarness({
    runConductor: async (o: AutopilotOptions) => {
      const expected = [1, 2];
      const missing = expected.filter((n) => !io.readChapterFile(bookId, n));
      for (const n of missing) writeCalls.push(n); // would author here — never reached below
      return { status: "ready", bookId: o.bookId, message: `resume complete; ${missing.length} chapter(s) (re)authored` };
    },
  });

  const r = await generateBookCommand(parse(bookId, { resume: true }), h.deps);
  assert.equal(r.code, GENERATE_BOOK_EXIT.OK);
  assert.deepEqual(writeCalls, [], "the resumed run authors NOTHING — ch01 was committed pre-kill and ch02's rename had already landed before the kill; this test would FAIL if the command re-authored either chapter");
  assert.equal(bytes.get(`${bookId}:1`), ch1Bytes, "ch01 untouched");
  assert.equal(bytes.get(`${bookId}:2`), ch2Bytes, "ch02's pre-kill bytes are exactly preserved — no corruption, no silent rollback");

  // Direct recovery (the SAME call `mintChapterAttempt` performs internally before minting a
  // fresh attempt, per WP-103) closes ch02's dangling bracket to "committed" bookkeeping-wise,
  // WITHOUT touching canonical bytes a second time.
  const resolutions = recoverIncompleteCommits(join(root, bookId, "ch02"), io, bookId, 2);
  assert.deepEqual(resolutions, [{ attemptId: (a2 as ChapterAttempt).identity.attemptId, resolution: "committed" }]);
  assert.equal(bytes.get(`${bookId}:2`), ch2Bytes, "recovery itself never mutates canonical");
});

// ── floor (the deterministic gate phase) ───────────────────────────────────────────────────

function baseStatus(overrides: Partial<BookStatus>): BookStatus {
  return {
    bookId: "zz-wp604-floor",
    stage: "gate",
    phase: "gate",
    expectedChapters: 2,
    writtenChapters: 2,
    gatedChapters: 0,
    qcdChapters: 0,
    bookGatePass: null,
    bookGateBlockers: 0,
    deterministicClean: true,
    packaged: false,
    publishable: false,
    guardrails: true,
    variety: null,
    nextCommand: "",
    nextLabel: "",
    chapters: [],
    ...overrides,
  };
}

test("resume boundary — FLOOR: a kill after chapter 1/2 is gated re-enters the SAME gate phase (never regresses to write, never skips to qc until every chapter is gated)", () => {
  // Immediately post-author, pre-floor (as a fresh kill leaves it): nothing gated yet.
  const freshlyWritten = baseStatus({ gatedChapters: 0, bookGatePass: null });
  assert.equal(decidePhase(freshlyWritten), "gate", "all chapters written but none gated → the floor phase, not write (would FAIL if it re-authored)");

  // Kill mid-floor: chapter 1 of 2 gated.
  const midFloor = baseStatus({ gatedChapters: 1, bookGatePass: null });
  assert.equal(decidePhase(midFloor), "gate", "a resumed run re-enters the SAME gate phase to finish the remaining chapter — it must NOT jump to qc with an ungated chapter still outstanding");

  // Floor fully converged (both chapters gated, book-gate clean) → qc, never back to write.
  const floorDone = baseStatus({ gatedChapters: 2, bookGatePass: true, qcdChapters: 0 });
  assert.equal(decidePhase(floorDone), "qc", "once every chapter is gated the resumed run advances to qc — never re-authors already-written chapters");

  // A book-gate FAIL (deterministicClean false) is never silently treated as converged.
  const dirtyFloor = baseStatus({ gatedChapters: 2, bookGatePass: true, deterministicClean: false });
  assert.equal(decidePhase(dirtyFloor), "gate", "a deterministic-battery-dirty book stays in the gate phase even with bookGatePass true — the floor is the FULL battery, not just ship/book-gate");
});

// ── repair (bounded typed repair rounds) ───────────────────────────────────────────────────

test("resume boundary — REPAIR: a killed mid-round's evidence matrix drives a resumed repair to re-dispatch ONLY the REVISE/CORRUPTION chapters — PUBLISHABLE chapters are never re-edited, NEEDS_MORE_QC never wastes an edit session", () => {
  const bookId = "zz-wp604-repair-boundary";
  const roundId = "r-wp604-repair";
  try {
    mkdirSync(orchestratorRoundDir(bookId, roundId), { recursive: true });
    writeFileSync(evidenceMatrixPath(bookId, roundId), JSON.stringify({
      schemaVersion: "qc-evidence-matrix-v1",
      chapters: [
        { chapterNumber: 1, finalVerdict: "PUBLISHABLE" },   // already passed pre-kill — must NOT be re-edited
        { chapterNumber: 2, finalVerdict: "REVISE" },        // content defect — the resumed repair must target this
        { chapterNumber: 3, finalVerdict: "CORRUPTION" },    // content defect — and this
        { chapterNumber: 4, finalVerdict: "NEEDS_MORE_QC" }, // evidence-only, zero actionable findings — no edit session
        { chapterNumber: 5, finalVerdict: "PUBLISHABLE" },   // already passed pre-kill — must NOT be re-edited
      ],
    }), "utf8");

    const targets = repairTargetChapterNumbers(bookId, roundId);
    assert.deepEqual([...targets].sort((a, b) => a - b), [2, 3], "the resumed repair round re-dispatches ONLY the REVISE/CORRUPTION chapters — this test would FAIL if a resumed run re-edited chapter 1/5 (already-passed work) or wasted a session on chapter 4 (evidence-only)");
    assert.ok(!targets.has(1) && !targets.has(5), "already-PUBLISHABLE chapters are protected from re-edit across the resume");
    assert.ok(!targets.has(4), "a NEEDS_MORE_QC chapter gets re-QC'd, never a wasted edit session, on resume");
  } finally {
    rmSync(orchestratorRoundDir(bookId, roundId), { recursive: true, force: true });
  }
});

// ── gate (the D7 ship-gate halt sidecar) ───────────────────────────────────────────────────

test("resume boundary — GATE (D7): no halt sidecar at all (killed before the D7 audit ever wrote anything) never falsely blocks the resumed run", () => {
  const stateBooksDir = mkdtempSync(join(TMP, "d7-absent-"));
  const bookId = "zz-wp604-d7-absent";
  const halt: AutopilotOutcome = { status: "halt", bookId, phase: "ready", category: "infra", reason: "some other infra failure" };
  const cls = classifyOutcomeExit(halt, { bookId, stateBooksDir, runStartMs: Date.now() });
  assert.equal(cls.code, GENERATE_BOOK_EXIT.HALT, "absent sidecar → generic halt, never a false quality-bar block");
  assert.notEqual(cls.label, "BLOCKED_QUALITY_BAR");
});

test("resume boundary — GATE (D7): a TORN halt-sidecar file (defense-in-depth — the atomic-write primitive should make this unreachable, exactly as chapter canonical writes are) never crashes classification and never falsely reports a block", () => {
  const stateBooksDir = mkdtempSync(join(TMP, "d7-torn-"));
  const bookId = "zz-wp604-d7-torn";
  // Captured BEFORE the file is written, so the record is guaranteed FRESH (mtime >=
  // runStartMs) — this isolates the PARSE-failure branch: the test must degrade to a
  // generic halt because the file is unreadable, never because a staleness check masked it.
  const runStartMs = Date.now();
  const path = d7ShipGateHaltPath(bookId, stateBooksDir);
  writeFileSync(path, "{ this is not valid json — a torn write", "utf8");
  const halt: AutopilotOutcome = { status: "halt", bookId, phase: "ready", category: "infra", reason: "publish-final failed" };
  assert.doesNotThrow(() => classifyOutcomeExit(halt, { bookId, stateBooksDir, runStartMs }));
  const cls = classifyOutcomeExit(halt, { bookId, stateBooksDir, runStartMs });
  assert.equal(cls.code, GENERATE_BOOK_EXIT.HALT, "an unparseable halt sidecar must degrade to the generic halt, never a false BLOCKED_QUALITY_BAR");
});

// ── publish (packaged/regen — REFUSED_CLOBBER vs --resume vs --overwrite) ──────────────────

test("resume boundary — PUBLISH: decidePhase treats an already-packaged book as 'shipped' under a resume (regen=false) — the resumed run does ZERO further work; --overwrite (regen=true) deliberately does NOT take the packaged shortcut", () => {
  const shipped = baseStatus({ packaged: true, gatedChapters: 2, qcdChapters: 2, bookGatePass: true });
  assert.equal(decidePhase(shipped, true, false), "shipped", "a resume (regen=false) over an already-packaged book is a no-op — a kill AFTER the publish rename landed must never re-trigger authoring/gating/QC");
  // --overwrite (regen=true) DELIBERATELY bypasses the `packaged && !regen` shortcut — it
  // re-evaluates from the SAME durable per-chapter state a resume would read. Here that state
  // is STILL fully converged (unchanged gate/QC marks), so it correctly lands on "ready"
  // (re-publish only) rather than blindly redoing already-valid gate/QC work — the two flags
  // differ ONLY in whether the packaged shortcut applies, never in redoing valid work for its
  // own sake. This is what would FAIL if --overwrite were wired to silently no-op like --resume.
  const overwritten = decidePhase(shipped, true, true);
  assert.notEqual(overwritten, "shipped", "--overwrite must NOT take the packaged no-op shortcut — --resume and --overwrite are not interchangeable");
  assert.equal(overwritten, "ready", "with gate/QC marks still valid, --overwrite's re-evaluation still lands on ready (re-publish), not a wasted re-gate/re-qc");
});

test("resume boundary — PUBLISH: the CLI wiring matches decidePhase's contract — a bare re-invocation refuses (REFUSED_CLOBBER), --resume proceeds with regen=false, --overwrite proceeds with regen=true", async () => {
  // This ties the pure decidePhase contract above to the ACTUAL generateBookCommand wiring
  // (already unit-proven individually in generate-book-command.test.ts — restated here in one
  // place as the publish-boundary's complete picture, not a duplicate of those assertions).
  const bookId = "zz-wp604-publish-boundary";
  const bookRoot = mkdtempSync(join(TMP, "publish-boundary-pkgs-"));
  mkdirSync(bookRoot, { recursive: true });
  writeFileSync(resolve(bookRoot, `${bookId}.v21.json`), "{}", "utf8");
  const conductorCalls: Array<{ regen?: boolean }> = [];
  const h = mkHarness({
    packagePath: (b) => resolve(bookRoot, `${b}.v21.json`),
    runConductor: async (o) => { conductorCalls.push({ regen: o.regen }); return { status: "published", bookId: o.bookId, roundId: "r1" }; },
  });

  const bare = await generateBookCommand(parse(bookId), h.deps);
  assert.equal(bare.code, GENERATE_BOOK_EXIT.USAGE);
  assert.equal(bare.label, "REFUSED_CLOBBER");
  assert.equal(conductorCalls.length, 0, "a kill AFTER publish landed must never silently re-run over the shipped package");

  const resumed = await generateBookCommand(parse(bookId, { resume: true }), h.deps);
  assert.equal(resumed.code, GENERATE_BOOK_EXIT.OK);
  assert.equal(conductorCalls.at(-1)?.regen, false, "--resume proceeds WITHOUT regen — decidePhase's packaged skip still applies inside the conductor, so an already-done book does zero extra work");

  const overwritten = await generateBookCommand(parse(bookId, { overwrite: true }), h.deps);
  assert.equal(overwritten.code, GENERATE_BOOK_EXIT.OK);
  assert.equal(conductorCalls.at(-1)?.regen, true, "--overwrite proceeds WITH regen — the deliberate reprocess path");
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// §D — VALIDATE-ONLY on a known-bad fixture → the right fatal + exit 2
// ═══════════════════════════════════════════════════════════════════════════════════════════
// Each composes the REAL production doctor battery (runGeneratePreflightChecks) with ONE
// deliberately-bad, REAL check result (not a scripted DoctorFinding literal) substituted in via
// the SAME injection seams doctor-preflight.test.ts already uses in isolation — this file closes
// the loop from "the individual check is correct" to "generate-book --validate-only's exit code
// and printed output correctly reflect it".

test("--validate-only on a known-bad fixture: a CORRUPT name-bank.json → the right fatal (name-bank-config) + exit 2", async () => {
  const dir = mkdtempSync(join(TMP, "vo-namebank-"));
  const badBank = resolve(dir, "name-bank.json");
  writeFileSync(badBank, "{ this is not valid json", "utf8");
  const h = mkHarness({
    runPreflight: async (opts) => {
      const real = await runGeneratePreflightChecks(opts);
      return real.filter((f) => f.check !== "name-bank-config").concat([checkNameBankConfig({ nameBankPath: badBank })]);
    },
  });
  const r = await generateBookCommand(parse("zz-wp604-vo-namebank", { "validate-only": true }), h.deps);
  assert.equal(r.code, GENERATE_BOOK_EXIT.USAGE, `tail:\n${h.out.slice(-1200)}`);
  assert.match(h.out, /name-bank-config/);
  assert.match(h.out, /BLOCKED — a fatal preflight finding/);
});

test("--validate-only on a known-bad fixture: a DIRTY worktree under --require-clean-worktree → the right fatal (worktree-clean) + exit 2", async () => {
  const h = mkHarness({
    runPreflight: async (opts) => {
      const real = await runGeneratePreflightChecks(opts);
      // Thread the ACTUAL resolved `--require-clean-worktree` flag through to the real check
      // (proving the CLI-flag → config → preflight-opts → check wiring end to end), only
      // substituting a REAL dirty-tree fixture for the git runner (never this live dev
      // worktree's own, constantly-changing git state).
      return real.filter((f) => f.check !== "worktree-clean").concat([
        checkWorktreeClean({ require: opts.requireCleanWorktree, runner: () => " M src/some-file.ts\n?? scratch.txt\n" }),
      ]);
    },
  });
  const r = await generateBookCommand(parse("zz-wp604-vo-dirty", { "validate-only": true, "require-clean-worktree": true }), h.deps);
  assert.equal(r.code, GENERATE_BOOK_EXIT.USAGE, `tail:\n${h.out.slice(-1200)}`);
  assert.match(h.out, /worktree-clean/);
  assert.match(h.out, /demands a clean worktree/);
});

test("--validate-only on a known-bad fixture: an UNSUPPORTED model → the right fatal + exit 2 (the pre-work model gate, not the preflight battery, is what fires — documented so this never masquerades as passing)", async () => {
  const h = mkHarness();
  const r = await generateBookCommand(parse("zz-wp604-vo-model", { "validate-only": true, model: "gpt-4o" }), h.deps);
  assert.equal(r.code, GENERATE_BOOK_EXIT.USAGE);
  assert.equal(r.label, "UNSUPPORTED_MODEL_CONFIG");
  assert.doesNotMatch(h.out, /DOCTOR —/, "validate-only's own preflight battery must never even run once the pre-work model gate has already refused");
});

// ── cleanup ────────────────────────────────────────────────────────────────────────────────

test("zz cleanup: remove the generate-book-cli tmp root", () => {
  rmSync(TMP, { recursive: true, force: true });
});
