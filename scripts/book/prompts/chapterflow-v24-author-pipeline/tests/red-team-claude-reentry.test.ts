/**
 * WP-E71 red-team — ATTACK 3: Claude re-entry into the rating path.
 *
 * Owner policy P1 / V25-NEW-01: NO Claude-family model may rate a book or
 * chapter. This suite tries to construct a rating identity/route that resolves to
 * a Claude binary or model string through every seam it can find, and asserts each
 * is refused:
 *
 *   • CHAPTERFLOW_QC_REVIEWERS=claude-*  → stripped from the reviewer allowlist and
 *     refused outright (ClaudeRatingRoleRefusalError) at the QC attestation gate
 *     AND at the write boundary.
 *   • A `qc-attest --reviewer claude-*`   → refused before it can reach disk.
 *   • provider/role routing               → `resolveD7RaterRoute()` is the ONE
 *     authority and returns the 5.6 baseline @ ultra regardless of ambient env;
 *     `SUPPORTED_MODEL_IDS` (what a proven D7 route must be a member of) contains
 *     no Claude/Anthropic id, so a claimed Claude route can never verify.
 *   • CHAPTERFLOW_CLAUDE_BIN               → never consulted by the ultra rating
 *     spawn; the argv still carries the 5.6 baseline model.
 *
 * Plus a STATIC proof: no rating-dispatch source file embeds a concrete
 * Claude/Anthropic model-id literal in a dispatch/model position.
 *
 * Hermetic: the one live-ish path uses an injected runner double + tmp dirs; the
 * rest are pure/env checks and source reads. Env mutations are restored in finally.
 */

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { test } from "./harness.js";
import {
  approvedReviewerRoles,
  ClaudeRatingRoleRefusalError,
  isApprovedReviewer,
  writeAttestation,
  type QcAttestation,
} from "../src/critics/qcAttestation.js";
import { BASELINE_MODEL, SUPPORTED_MODEL_IDS, resolveD7RaterRoute } from "../src/orchestrator/modelPolicy.js";
import {
  ULTRA_EFFORT,
  runUltraSession,
  type UltraSessionDepsV1,
  type UltraSessionRequestV1,
} from "../src/exec/ultraSession.js";
import { syntheticQualification } from "../src/exec/cliQualification.js";
import type { CodexRunner } from "../src/orchestrator/codexAgent.js";

const PIPELINE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function withEnv<T>(vars: Record<string, string | undefined>, fn: () => T): T {
  const prev: Record<string, string | undefined> = {};
  for (const k of Object.keys(vars)) prev[k] = process.env[k];
  for (const [k, v] of Object.entries(vars)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    return fn();
  } finally {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

// ── Seam A: the QC reviewer allowlist / attestation gate ────────────────────────

test("attack3: CHAPTERFLOW_QC_REVIEWERS=claude-* is stripped from the allowlist and never accepted", () => {
  withEnv({ CHAPTERFLOW_QC_REVIEWERS: "claude-sonnet, codex-qc" }, () => {
    assert.deepEqual(approvedReviewerRoles(), ["codex-qc"], "the claude-* role is dropped from the env list");
  });
  withEnv({ CHAPTERFLOW_QC_REVIEWERS: "claude-opus" }, () => {
    assert.deepEqual(approvedReviewerRoles(), [], "a claude-only env list leaves NO approved roles");
    // …and even added to the list, a claude reviewer is refused outright, not just "not approved".
    assert.throws(() => isApprovedReviewer("claude-opus:wf1"), ClaudeRatingRoleRefusalError);
  });
});

test("attack3: isApprovedReviewer refuses any claude-* identity (throws), accepts codex-qc", () => {
  assert.throws(() => isApprovedReviewer("claude:foo"), ClaudeRatingRoleRefusalError);
  assert.throws(() => isApprovedReviewer("claude-3-5-sonnet:foo"), ClaudeRatingRoleRefusalError);
  assert.equal(isApprovedReviewer("codex-qc:wf_abcd"), true);
  assert.equal(isApprovedReviewer("harness:x"), true);
});

test("attack3: qc-attest with a claude-* reviewer is refused at the write boundary (never reaches disk)", () => {
  const att: QcAttestation = {
    schemaVersion: "qc-attest-v1",
    bookId: "zz-rt3-book",
    chapterNumber: 1,
    chapterId: "zz-rt3-book-ch01",
    verdict: "PUBLISHABLE",
    contentHash: "deadbeefdeadbeef",
    reviewer: "claude-qc:wf_evil",
    reviewedAt: "2026-07-17T00:00:00.000Z",
  };
  // Throws BEFORE mkdir/write, so nothing lands under state/qc.
  assert.throws(() => writeAttestation(att), ClaudeRatingRoleRefusalError);
});

// ── Seam B: the single-authority rating route (provider/role routing) ───────────

test("attack3: resolveD7RaterRoute is the sole authority — 5.6 baseline @ ultra, independent of ambient env", () => {
  const route = withEnv(
    { CHAPTERFLOW_CLAUDE_BIN: "/usr/bin/claude", CHAPTERFLOW_QC_REVIEWERS: "claude-opus", ANTHROPIC_API_KEY: "sk-ant-xxx" },
    () => resolveD7RaterRoute(),
  );
  assert.equal(route.model, BASELINE_MODEL, "the route model is the 5.6 baseline, not a Claude id");
  assert.equal(route.effort, ULTRA_EFFORT);
  assert.ok(!/claude|anthropic/i.test(route.model), "the route model is not a Claude/Anthropic id");
});

test("attack3: a Claude route can never be a PROVEN D7 route — SUPPORTED_MODEL_IDS excludes every Claude/Anthropic id", () => {
  for (const id of SUPPORTED_MODEL_IDS) {
    assert.ok(!/claude|anthropic/i.test(id), `supported model id "${id}" must not be a Claude/Anthropic family`);
  }
  assert.ok(SUPPORTED_MODEL_IDS.has(resolveD7RaterRoute().model), "the authority route IS a supported (codex-exec) model");
  assert.ok(!SUPPORTED_MODEL_IDS.has("claude-3-5-sonnet"));
  assert.ok(!SUPPORTED_MODEL_IDS.has("claude-opus-4-1"));
});

// ── Seam C: CHAPTERFLOW_CLAUDE_BIN cannot redirect the ultra rating spawn ────────

test("attack3: the ultra rating spawn ignores CHAPTERFLOW_CLAUDE_BIN — argv still carries the 5.6 baseline model", async () => {
  let captured: string[] = [];
  const runner: CodexRunner = async (args) => {
    captured = args.argv.slice();
    return { stdout: "{}", stderr: "", code: 0 };
  };
  const cwd = mkdtempSync(join(tmpdir(), "cf-rt3-cwd-"));
  const promptPath = join(cwd, "task.md");
  writeFileSync(promptPath, "Rate this chapter.");
  const deps: UltraSessionDepsV1 = {
    runner,
    execBaseDir: mkdtempSync(join(tmpdir(), "cf-rt3-exec-")),
    manifestSink: mkdtempSync(join(tmpdir(), "cf-rt3-sink-")),
    authSourceDir: mkdtempSync(join(tmpdir(), "cf-rt3-auth-")),
    qualification: syntheticQualification(),
    bin: "codex",
    clock: () => new Date("2026-07-17T00:00:00.000Z"),
  };
  const req: UltraSessionRequestV1 = {
    role: "d7-rater", promptPath, outputSchemaPath: null, cwd, timeoutMs: 60_000,
    sessionTag: "rt3", bookId: "zz-rt3-book", runId: "20260717T000000Z",
  };

  const res = await withEnv({ CHAPTERFLOW_CLAUDE_BIN: "/usr/bin/claude" }, () => runUltraSession(req, deps));
  assert.equal(res.model, BASELINE_MODEL);
  const modelArg = captured.find((a) => a.startsWith("model="));
  assert.equal(modelArg, `model=${BASELINE_MODEL}`, "the spawn argv routes the 5.6 baseline, not claude");
  assert.ok(!captured.some((a) => /claude|anthropic/i.test(a)), "no argv element names a Claude/Anthropic target");
});

// ── Static proof: no Claude model-id literal in any rating-dispatch source ───────

test("attack3: no rating-dispatch source file embeds a concrete Claude/Anthropic model-id literal", () => {
  const dispatchFiles = [
    "src/exec/ultraSession.ts",
    "src/bakeoff/d7WorkerDispatch.ts",
    "src/evaluation/chapterDiagnosticRun.ts",
    "src/orchestrator/modelPolicy.ts",
  ];
  // Match a MODEL-ID shape (claude-3 / claude-opus / claude-sonnet / us.anthropic.*),
  // never the bare word "Claude" that appears legitimately in doc comments and in
  // the retired `claude-side` ledger FAMILY label (which records model: null).
  const claudeModelLiteral = /claude-(?:\d|opus|sonnet|haiku|instant)|us\.anthropic|anthropic\.claude/i;
  for (const rel of dispatchFiles) {
    const src = readFileSync(join(PIPELINE_ROOT, rel), "utf8");
    const offending = src.split("\n").map((l, i) => [i + 1, l] as const).filter(([, l]) => claudeModelLiteral.test(l));
    assert.deepEqual(offending, [], `${rel} must contain no Claude model-id literal (found: ${offending.map(([n]) => n).join(", ")})`);
  }
});
