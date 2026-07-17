/**
 * WP-E26 — Claude-rating neutralization sweep (policy P1: no Claude-family
 * model rates books or chapters).
 *
 *   1. qcAttestation.ts: "claude-qc" is gone from DEFAULT_QC_REVIEWERS, and a
 *      claude-* reviewer identity is REFUSED (typed error), even one supplied
 *      via CHAPTERFLOW_QC_REVIEWERS.
 *   2. providers/cli.ts: the legacy anthropic-cli transport refuses to serve a
 *      RATING/JUDGING role (qc-reviewer, chapter-reviewer, eval-reader,
 *      eval-book, book-acceptance-reader, bakeoff-judge); non-rating roles
 *      (author-writer, research, …) are unaffected.
 */

import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { test } from "./harness.js";
import { makeChapter, TMP_DIR } from "./helpers.js";
import {
  approvedReviewerRoles,
  attestationPath,
  chapterContentHash,
  checkQcAttestation,
  ClaudeRatingRoleRefusalError,
  isApprovedReviewer,
  writeAttestation,
} from "../src/critics/qcAttestation.js";
import { AnthropicRatingRoleRefusalError, ClaudeCliProvider } from "../src/providers/cli.js";

const BOOK = "zz-fixture-e26-claude-refusal";

function cleanup(n: number): void {
  rmSync(attestationPath(BOOK, n), { force: true });
}

function withEnv<T>(vars: Record<string, string | undefined>, fn: () => T): T {
  const prev: Record<string, string | undefined> = {};
  for (const k of Object.keys(vars)) prev[k] = process.env[k];
  try {
    for (const [k, v] of Object.entries(vars)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    return fn();
  } finally {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

// ── 1. DEFAULT_QC_REVIEWERS ─────────────────────────────────────────────────

test("claude-qc is absent from the default approved reviewer roles", () => {
  withEnv({ CHAPTERFLOW_QC_REVIEWERS: undefined }, () => {
    const roles = approvedReviewerRoles();
    assert.ok(!roles.includes("claude-qc"), `default reviewer roles must not include claude-qc, got ${roles.join(", ")}`);
    // codex-qc/harness/human remain — the removal is Claude-specific, not a
    // blanket lockdown of the reviewer allowlist.
    assert.ok(roles.includes("codex-qc"));
    assert.ok(roles.includes("harness"));
    assert.ok(roles.includes("human"));
  });
});

// ── 2. reviewer-identity refusal (typed error, not a soft finding) ─────────

test("isApprovedReviewer throws ClaudeRatingRoleRefusalError for a claude-* reviewer identity", () => {
  assert.throws(() => isApprovedReviewer("claude-qc:s1"), ClaudeRatingRoleRefusalError);
  assert.throws(() => isApprovedReviewer("Claude-Something:x"), ClaudeRatingRoleRefusalError, "prefix match is case-insensitive");
  // A non-claude, non-approved role still returns false (ordinary miss, not a refusal).
  assert.equal(isApprovedReviewer("auditor:bob"), false);
});

test("CHAPTERFLOW_QC_REVIEWERS can add a reviewer role, but never a claude-* one", () => {
  withEnv({ CHAPTERFLOW_QC_REVIEWERS: "auditor, claude-x" }, () => {
    const roles = approvedReviewerRoles();
    assert.ok(roles.includes("auditor"), "a non-claude env-added role is honored");
    assert.ok(!roles.includes("claude-x"), "a claude-* env-added role is stripped, never honored");
    // And checking a claude-x reviewer identity still REFUSES even though the
    // operator tried to add it to the allowlist — the refusal is unconditional,
    // not merely "not currently in the list".
    assert.throws(() => isApprovedReviewer("claude-x:bob"), ClaudeRatingRoleRefusalError);
  });
});

test("checkQcAttestation propagates the refusal (throws) rather than returning a soft finding for a claude-* reviewer", () => {
  const ch = makeChapter(BOOK, 1);
  try {
    writeAttestation({
      schemaVersion: "qc-attest-v1",
      bookId: BOOK,
      chapterNumber: ch.number,
      chapterId: ch.chapterId!,
      verdict: "PUBLISHABLE",
      contentHash: chapterContentHash(ch),
      hashVersion: "v2",
      reviewer: "harness:seed", // written via harness so writeAttestation itself does not refuse it
      reviewedAt: "2026-07-17T00:00:00.000Z",
    });
    // Now hand-corrupt the on-disk reviewer to a claude-* identity to isolate
    // the READ-time (checkQcAttestation) refusal path from the write-time one
    // exercised below.
    const p = attestationPath(BOOK, ch.number);
    const att = JSON.parse(readFileSync(p, "utf8"));
    att.reviewer = "claude-qc:seed";
    writeFileSync(p, JSON.stringify(att, null, 2) + "\n");
    assert.throws(() => checkQcAttestation(ch, true), ClaudeRatingRoleRefusalError);
    assert.throws(() => checkQcAttestation(ch, false), ClaudeRatingRoleRefusalError, "the refusal applies in advisory (gate-chapter) mode too — it is a policy refusal, not a severity tier");
  } finally {
    cleanup(1);
  }
});

test("writeAttestation refuses a claude-* reviewer identity before it ever reaches disk", () => {
  const ch = makeChapter(BOOK, 2);
  const p = attestationPath(BOOK, ch.number);
  try {
    assert.throws(
      () =>
        writeAttestation({
          schemaVersion: "qc-attest-v1",
          bookId: BOOK,
          chapterNumber: ch.number,
          chapterId: ch.chapterId!,
          verdict: "PUBLISHABLE",
          contentHash: chapterContentHash(ch),
          hashVersion: "v2",
          reviewer: "claude-qc:direct-write",
          reviewedAt: "2026-07-17T00:00:00.000Z",
        }),
      ClaudeRatingRoleRefusalError,
    );
    assert.equal(existsSync(p), false, "the refused attestation must never be written to disk");
  } finally {
    cleanup(2);
  }
});

// ── 3. providers/cli.ts: anthropic-cli transport rating-role refusal ───────

function writeFakeClaude(): string {
  const dir = resolve(TMP_DIR, "e26-provider-cli");
  mkdirSync(dir, { recursive: true });
  const bin = resolve(dir, "fake-claude-ok.cjs");
  writeFileSync(
    bin,
    `#!/usr/bin/env node
process.stdin.resume();
process.stdin.on("end", () => {
  process.stdout.write(JSON.stringify({ result: "cli ok", usage: { input_tokens: 1, output_tokens: 1 } }));
});
`,
    "utf8",
  );
  chmodSync(bin, 0o755);
  return bin;
}

const RATING_ROLES = ["qc-reviewer", "chapter-reviewer", "eval-reader", "eval-book", "book-acceptance-reader", "bakeoff-judge"] as const;
const NON_RATING_ROLES = ["author-writer", "research", "author-repair", "autopilot-scout", "cli-adhoc"] as const;

for (const role of RATING_ROLES) {
  test(`ClaudeCliProvider.call refuses rating role "${role}" before spawning`, async () => {
    await assert.rejects(
      () => ClaudeCliProvider.call({ tier: "critic", role, system: "s", user: "u", model: "claude-test", timeoutMs: 1000 }),
      AnthropicRatingRoleRefusalError,
    );
  });
}

for (const role of NON_RATING_ROLES) {
  test(`ClaudeCliProvider.call still permits non-rating role "${role}" on the legacy transport`, async () => {
    const snapshot = process.env.CHAPTERFLOW_CLAUDE_BIN;
    const bin = writeFakeClaude();
    process.env.CHAPTERFLOW_CLAUDE_BIN = bin;
    try {
      const result = await ClaudeCliProvider.call({ tier: "writer", role, system: "s", user: "u", model: "claude-test", timeoutMs: 2000 });
      assert.equal(result.raw, "cli ok", `role "${role}" must reach the (fake) claude binary, not be refused`);
    } finally {
      if (snapshot === undefined) delete process.env.CHAPTERFLOW_CLAUDE_BIN;
      else process.env.CHAPTERFLOW_CLAUDE_BIN = snapshot;
    }
  });
}

test("ClaudeCliProvider.call with no role at all is unaffected (legacy unpinned calls never trip the rating refusal)", async () => {
  const snapshot = process.env.CHAPTERFLOW_CLAUDE_BIN;
  const bin = writeFakeClaude();
  process.env.CHAPTERFLOW_CLAUDE_BIN = bin;
  try {
    const result = await ClaudeCliProvider.call({ tier: "critic", system: "s", user: "u", model: "claude-test", timeoutMs: 2000 });
    assert.equal(result.raw, "cli ok");
  } finally {
    if (snapshot === undefined) delete process.env.CHAPTERFLOW_CLAUDE_BIN;
    else process.env.CHAPTERFLOW_CLAUDE_BIN = snapshot;
  }
});
