/**
 * Reviewer-identity gate (Phase: Codex-as-both-roles hardening, 2026-06).
 *
 * The semantic gate assumes reviewer ≠ author. With one agent both writing AND
 * QCing a book, `qc-attest` becomes self-certification — so the promote gate
 * must refuse a PUBLISHABLE attestation whose reviewer is the writer, not an
 * approved QC role. On-disk reviewers are claude-qc:/codex-qc:/harness:/human:;
 * the writer identity is codex:writer.
 *
 * This is a default-safe guardrail (a single agent can still relabel itself);
 * the honesty-independent catch for wrong keys lives in quiz-key-gate.test.ts.
 */

import assert from "node:assert/strict";
import { readFileSync, rmSync } from "fs";

import { test } from "./harness.js";
import { makeChapter } from "./helpers.js";
import type { ChapterV21 } from "../src/types.js";
import {
  checkQcAttestation,
  loadAttestation,
  writeAttestation,
  chapterContentHash,
  attestationPath,
  type QcAttestation,
} from "../src/critics/qcAttestation.js";

const BOOK = "zz-fixture-reviewer";

function writeAtt(ch: ChapterV21, reviewer: string, verdict: "PUBLISHABLE" | "REVISE" | "CORRUPTION" = "PUBLISHABLE"): QcAttestation {
  writeAttestation({
    schemaVersion: "qc-attest-v1",
    bookId: BOOK,
    chapterNumber: ch.number,
    chapterId: ch.chapterId!,
    verdict,
    contentHash: chapterContentHash(ch),
    hashVersion: "v2",
    reviewer,
    reviewedAt: "2026-06-12T00:00:00.000Z",
  });
  const path = attestationPath(BOOK, ch.number);
  const attestation = loadAttestation(BOOK, ch.number, readFileSync(path));
  assert.ok(attestation, `invalid attestation fixture at ${path}`);
  return attestation;
}

function checkWrittenAttestation(ch: ChapterV21, attestation: QcAttestation, enforce: boolean) {
  return checkQcAttestation(ch, enforce, {
    attestation,
    authorSessionId: undefined,
    legacyRoundPresent: false,
  });
}

function cleanup(n: number): void {
  rmSync(attestationPath(BOOK, n), { force: true });
}

function withoutNoApi<T>(fn: () => T): T {
  const prev = process.env.CHAPTERFLOW_NO_API_CODEX_QC;
  try {
    delete process.env.CHAPTERFLOW_NO_API_CODEX_QC;
    return fn();
  } finally {
    if (prev === undefined) delete process.env.CHAPTERFLOW_NO_API_CODEX_QC;
    else process.env.CHAPTERFLOW_NO_API_CODEX_QC = prev;
  }
}

test("checkQcAttestation blocks a PUBLISHABLE attestation self-certified by the writer", () => {
  const ch = makeChapter(BOOK, 1);
  try {
    const attestation = writeAtt(ch, "codex:writer");
    const findings = checkWrittenAttestation(ch, attestation, true);
    assert.equal(findings.length, 1, "a writer-attested PUBLISHABLE must not pass the gate");
    assert.equal(findings[0].checkId, "QC0.unverified_reviewer");
    assert.equal(findings[0].severity, "blocker");
  } finally {
    cleanup(1);
  }
});

test("checkQcAttestation accepts the approved QC reviewer roles", () => {
  const ch = makeChapter(BOOK, 2);
  try {
    for (const reviewer of ["claude-qc:s1", "codex-qc:s2", "harness:qc-run-x", "human:alice"]) {
      const attestation = writeAtt(ch, reviewer);
      assert.deepEqual(withoutNoApi(() => checkWrittenAttestation(ch, attestation, true)), [], `${reviewer} should be an approved QC role`);
    }
  } finally {
    cleanup(2);
  }
});

test("the reviewer-identity finding is advisory in gate-chapter mode (enforce=false)", () => {
  const ch = makeChapter(BOOK, 3);
  try {
    const attestation = writeAtt(ch, "codex:writer");
    const findings = checkWrittenAttestation(ch, attestation, false);
    assert.equal(findings[0].checkId, "QC0.unverified_reviewer");
    assert.equal(findings[0].severity, "advisory");
  } finally {
    cleanup(3);
  }
});

test("CHAPTERFLOW_QC_REVIEWERS overrides the allowed roles", () => {
  const ch = makeChapter(BOOK, 4);
  const prev = process.env.CHAPTERFLOW_QC_REVIEWERS;
  try {
    const attestation = writeAtt(ch, "auditor:bob");
    assert.equal(
      withoutNoApi(() => checkWrittenAttestation(ch, attestation, true))[0].checkId,
      "QC0.unverified_reviewer",
      "auditor is not an approved role by default",
    );
    process.env.CHAPTERFLOW_QC_REVIEWERS = "auditor, claude-qc";
    assert.deepEqual(withoutNoApi(() => checkWrittenAttestation(ch, attestation, true)), [], "auditor passes once added to the env allowlist");
  } finally {
    if (prev === undefined) delete process.env.CHAPTERFLOW_QC_REVIEWERS;
    else process.env.CHAPTERFLOW_QC_REVIEWERS = prev;
    cleanup(4);
  }
});
