/**
 * IMP-01: conductor-owned chapter transactions — attempt identity, candidate
 * import, workspace containment, compare-and-swap commit, two-attempt races,
 * crash recovery, evidence lifecycle, and the no-direct-canonical-writer scan.
 * (Master plan §8.8; F-001/F-020; frozen `candidate-transaction` v1 contract.)
 */

import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { test } from "./harness.js";
import { TMP_DIR } from "./helpers.js";
import {
  commitChapterCandidate,
  finalizeAttempt,
  importCandidate,
  mintChapterAttempt,
  recoverIncompleteCommits,
  sweepStaleAttempts,
  unexpectedAttemptWrites,
  CANDIDATE_MAX_BYTES,
  type ChapterCanonicalIo,
} from "../src/orchestrator/chapterTransaction.js";
import { validateAttemptIdentity } from "../src/contracts/candidateTransaction.js";
import { sha256Hex } from "../src/contracts/contractUtil.js";

let seq = 0;
function rig(prior?: string): { io: ChapterCanonicalIo & { bytes: Map<string, string> }; root: string } {
  const bytes = new Map<string, string>();
  if (prior !== undefined) bytes.set("zz-tx:1", prior);
  const root = join(TMP_DIR, `chapter-tx-${process.pid}-${seq++}`);
  mkdirSync(root, { recursive: true });
  return {
    root,
    io: {
      bytes,
      readChapterFile: (b, n) => bytes.get(`${b}:${n}`) ?? null,
      writeChapterFile: (b, n, v) => { bytes.set(`${b}:${n}`, v); },
    },
  };
}

function mint(io: ChapterCanonicalIo, root: string, seed?: string) {
  return mintChapterAttempt({
    bookId: "zz-tx",
    chapterNumber: 1,
    chapterId: "zz-tx-ch01",
    attemptKind: "author-initial",
    attemptSequence: 1,
    promptSha256: "p".repeat(64),
    io,
    attemptsRoot: root,
    ...(seed !== undefined ? { seedBytes: seed } : {}),
  });
}

const CAND = JSON.stringify({ chapterId: "zz-tx-ch01", number: 1, title: "candidate" }) + "\n";
const PRIOR = JSON.stringify({ chapterId: "zz-tx-ch01", number: 1, title: "prior" }) + "\n";

test("mint: schema-valid attempt identity; expectedBase null for a missing chapter, hash for an existing one", () => {
  const a = rig();
  const at1 = mint(a.io, a.root);
  assert.deepEqual(validateAttemptIdentity(at1.identity), []);
  assert.equal(at1.identity.expectedBaseSha256, null);
  assert.ok(existsSync(at1.workspaceDir), "workspace created");

  const b = rig(PRIOR);
  const at2 = mint(b.io, b.root);
  assert.equal(at2.identity.expectedBaseSha256, sha256Hex(PRIOR));
});

test("mint: seedBytes lands as the candidate (the repair copy-edit protocol)", () => {
  const { io, root } = rig(PRIOR);
  const at = mint(io, root, PRIOR);
  assert.equal(readFileSync(at.candidatePath, "utf8"), PRIOR);
});

test("importCandidate: missing, malformed, oversized, and wrong-identity candidates are rejected with distinct outcomes", () => {
  const { io, root } = rig();
  const missing = importCandidate(mint(io, root));
  assert.ok(!missing.ok && missing.outcome === "validation_failed" && /no candidate file/.test(missing.reason));

  const at2 = mint(io, root);
  writeFileSync(at2.candidatePath, "{ not json");
  const malformed = importCandidate(at2);
  assert.ok(!malformed.ok && malformed.outcome === "malformed_output");

  const at3 = mint(io, root);
  writeFileSync(at3.candidatePath, `{"chapterId":"zz-tx-ch01","pad":"${"x".repeat(CANDIDATE_MAX_BYTES)}"}`);
  const oversized = importCandidate(at3);
  assert.ok(!oversized.ok && oversized.outcome === "malformed_output" && /cap/.test(oversized.reason));

  const at4 = mint(io, root);
  writeFileSync(at4.candidatePath, JSON.stringify({ chapterId: "OTHER-ch07", number: 1 }));
  const wrongId = importCandidate(at4);
  assert.ok(!wrongId.ok && wrongId.outcome === "validation_failed" && /wrong-identity/.test(wrongId.reason));

  const at5 = mint(io, root);
  writeFileSync(at5.candidatePath, CAND);
  const ok = importCandidate(at5);
  assert.ok(ok.ok && ok.sha256 === sha256Hex(CAND) && ok.chapter.chapterId === "zz-tx-ch01");
});

test("containment: any workspace entry beyond the candidate is an unexpected write", () => {
  const { io, root } = rig();
  const at = mint(io, root);
  writeFileSync(at.candidatePath, CAND);
  assert.deepEqual(unexpectedAttemptWrites(at), []);
  mkdirSync(join(at.workspaceDir, "notes"), { recursive: true });
  writeFileSync(join(at.workspaceDir, "notes", "scratch.md"), "smuggled");
  writeFileSync(join(at.workspaceDir, "AGENTS.md"), "hostile");
  assert.deepEqual(unexpectedAttemptWrites(at), ["AGENTS.md", join("notes", "scratch.md")]);
});

test("commit: CAS success writes through the io seam and brackets a committed manifest; generation increments", () => {
  const { io, root } = rig();
  const at = mint(io, root);
  writeFileSync(at.candidatePath, CAND);
  const r = commitChapterCandidate({ attempt: at, bytes: CAND, io });
  assert.ok(r.ok);
  assert.equal(io.bytes.get("zz-tx:1"), CAND, "canonical mutated ONLY via the io seam");
  const manifest = JSON.parse(readFileSync(join(at.attemptDir, "commit-manifest.json"), "utf8"));
  assert.equal(manifest.phase, "committed");
  assert.equal(manifest.previousSha256, null);
  assert.equal(manifest.committedSha256, sha256Hex(CAND));
  assert.equal(manifest.committedGeneration, 1);
  // The next attempt sees the committed generation.
  const at2 = mint(io, root);
  assert.equal(at2.identity.expectedBaseGeneration, 1);
  assert.equal(at2.identity.expectedBaseSha256, sha256Hex(CAND));
});

test("commit: a no-op canonical write cannot close the commit bracket or claim success", () => {
  const { io, root } = rig(PRIOR);
  const at = mint(io, root);
  const noOpIo: ChapterCanonicalIo = {
    readChapterFile: io.readChapterFile,
    writeChapterFile: () => { /* deliberately lies by returning without persistence */ },
  };
  const result = commitChapterCandidate({ attempt: at, bytes: CAND, io: noOpIo });
  assert.ok(!result.ok && result.outcome === "infrastructure_failure");
  assert.equal(io.bytes.get("zz-tx:1"), PRIOR);
  const manifest = JSON.parse(readFileSync(join(at.attemptDir, "commit-manifest.json"), "utf8"));
  assert.equal(manifest.phase, "reconciliation_required");
  assert.match(manifest.reconciliation.detail, /read-back mismatch/);
});

test("commit: a canonical change after mint is stale_base — no overwrite, aborted manifest retained", () => {
  const { io, root } = rig(PRIOR);
  const at = mint(io, root);
  io.bytes.set("zz-tx:1", CAND); // someone else commits underneath this attempt
  const r = commitChapterCandidate({ attempt: at, bytes: PRIOR, io });
  assert.ok(!r.ok && r.outcome === "stale_base");
  assert.equal(io.bytes.get("zz-tx:1"), CAND, "the newer commit is never overwritten");
  const manifest = JSON.parse(readFileSync(join(at.attemptDir, "commit-manifest.json"), "utf8"));
  assert.equal(manifest.phase, "aborted_stale_base");
});

test("race: two attempts minted from the same base — exactly one commits, the loser is stale_base", () => {
  const { io, root } = rig(PRIOR);
  const a = mint(io, root);
  const b = mint(io, root);
  const winnerBytes = CAND;
  const loserBytes = JSON.stringify({ chapterId: "zz-tx-ch01", number: 1, title: "loser" }) + "\n";
  const first = commitChapterCandidate({ attempt: a, bytes: winnerBytes, io });
  const second = commitChapterCandidate({ attempt: b, bytes: loserBytes, io });
  assert.ok(first.ok, "the first CAS wins");
  assert.ok(!second.ok && second.outcome === "stale_base", "the second CAS loses");
  assert.equal(io.bytes.get("zz-tx:1"), winnerBytes, "canonical holds the winner's bytes");
});

test("recovery: a pending bracket resolves deterministically — committed when canonical matches, aborted otherwise", () => {
  const { io, root } = rig(PRIOR);
  const at = mint(io, root);
  // Simulate a crash BETWEEN the pending manifest and the canonical write:
  const pendingManifest = {
    schema: "commit-manifest-v1", attemptId: at.identity.attemptId, bookId: "zz-tx", chapterNumber: 1,
    previousSha256: sha256Hex(PRIOR), committedSha256: sha256Hex(CAND), committedGeneration: 1,
    invalidated: [], committedAtIso: new Date().toISOString(), phase: "pending",
  };
  writeFileSync(join(at.attemptDir, "commit-manifest.json"), JSON.stringify(pendingManifest, null, 2));
  const chapterRoot = join(root, "zz-tx", "ch01");
  const r1 = recoverIncompleteCommits(chapterRoot, io, "zz-tx", 1);
  assert.deepEqual(r1, [{ attemptId: at.identity.attemptId, resolution: "aborted_recovered" }], "canonical never changed → aborted");

  // Simulate a crash AFTER the canonical write but before the bracket close:
  const at2 = mint(io, root);
  writeFileSync(join(at2.attemptDir, "commit-manifest.json"), JSON.stringify({ ...pendingManifest, attemptId: at2.identity.attemptId }, null, 2));
  io.bytes.set("zz-tx:1", CAND);
  const r2 = recoverIncompleteCommits(chapterRoot, io, "zz-tx", 1);
  assert.deepEqual(r2, [{ attemptId: at2.identity.attemptId, resolution: "committed" }], "canonical matches → bracket finished");
  // Recovery is idempotent: nothing pending remains.
  assert.deepEqual(recoverIncompleteCommits(chapterRoot, io, "zz-tx", 1), []);
});

test("mint recovers its chapter's pending brackets BEFORE capturing the expected base", () => {
  const { io, root } = rig(PRIOR);
  const at = mint(io, root);
  writeFileSync(join(at.attemptDir, "commit-manifest.json"), JSON.stringify({
    schema: "commit-manifest-v1", attemptId: at.identity.attemptId, bookId: "zz-tx", chapterNumber: 1,
    previousSha256: sha256Hex(PRIOR), committedSha256: sha256Hex(CAND), committedGeneration: 1,
    invalidated: [], committedAtIso: new Date().toISOString(), phase: "pending",
  }, null, 2));
  const at2 = mint(io, root); // must not throw and must resolve the pending bracket
  assert.equal(at2.identity.expectedBaseSha256, sha256Hex(PRIOR));
  const m = JSON.parse(readFileSync(join(at.attemptDir, "commit-manifest.json"), "utf8"));
  assert.equal(m.phase, "aborted_recovered");
});

test("finalize: success removes the workspace (candidate == canonical); failure keeps the candidate for forensics", () => {
  const { io, root } = rig();
  const ok = mint(io, root);
  writeFileSync(ok.candidatePath, CAND);
  finalizeAttempt(ok, "committed");
  assert.equal(existsSync(ok.workspaceDir), false, "committed workspace removed");
  assert.ok(existsSync(join(ok.attemptDir, "outcome.json")));

  const bad = mint(io, root);
  writeFileSync(bad.candidatePath, CAND);
  finalizeAttempt(bad, "validation_failed", "gate blocked");
  assert.ok(existsSync(bad.candidatePath), "failed candidate retained");
  const outcome = JSON.parse(readFileSync(join(bad.attemptDir, "outcome.json"), "utf8"));
  assert.equal(outcome.outcome, "validation_failed");
});

test("sweep: stale attempts are removed; pending commit brackets are NEVER swept (recovery owns them)", () => {
  const { io, root } = rig();
  const stale = mint(io, root);
  finalizeAttempt(stale, "validation_failed", "old");
  const pending = mint(io, root);
  writeFileSync(join(pending.attemptDir, "commit-manifest.json"), JSON.stringify({
    schema: "commit-manifest-v1", attemptId: pending.identity.attemptId, bookId: "zz-tx", chapterNumber: 1,
    previousSha256: null, committedSha256: sha256Hex(CAND), committedGeneration: 1,
    invalidated: [], committedAtIso: new Date().toISOString(), phase: "pending",
  }, null, 2));
  const old = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  utimesSync(stale.attemptDir, old, old);
  utimesSync(pending.attemptDir, old, old);
  const removed = sweepStaleAttempts({ attemptsRoot: root, olderThanMs: 7 * 24 * 60 * 60 * 1000 });
  assert.deepEqual(removed, [stale.attemptDir], "only the resolved stale attempt is swept");
  assert.ok(existsSync(pending.attemptDir), "a pending bracket survives the sweep");
});

test("static scan: author/repair modules perform no direct canonical chapter writes (the io seam is the only writer)", () => {
  const authorRun = readFileSync(join(TMP_DIR, "..", "..", "src", "orchestrator", "authorRun.ts"), "utf8");
  const authorRepair = readFileSync(join(TMP_DIR, "..", "..", "src", "orchestrator", "authorRepair.ts"), "utf8");
  // authorRepair must not write ANY file directly anymore (candidates + commits
  // both flow through the transaction/io seam).
  assert.equal(/\bwriteFileSync\s*\(/.test(authorRepair), false, "authorRepair has no direct fs writes");
  // authorRun's ONLY canonical-path write is the atomic io default.
  const canonicalWrites = authorRun.match(/write\w*\(\s*resolve\(CHAPTERS_DIR/g) ?? [];
  assert.equal(canonicalWrites.length, 1, "exactly one canonical write site (the atomic resolveAuthorIo default)");
  assert.ok(/writeFileAtomic\(resolve\(CHAPTERS_DIR/.test(authorRun), "and it is the ATOMIC primitive");
});
