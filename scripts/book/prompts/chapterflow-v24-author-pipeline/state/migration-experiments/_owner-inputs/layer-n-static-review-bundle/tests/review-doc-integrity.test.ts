/**
 * WS3 — trust-layer plumbing tests that span modules:
 *   - ensureTrailingNewline (the Q1 central choke-point helper);
 *   - the REAL writeReviewDoc IO appends a trailing newline to EVERY reader-doc
 *     write site (book-sample, per-chapter reader doc, key-judge doc, sweep JSON);
 *   - sessionFinalHead (Q6/T3): the sessions.jsonl head is the reader's actual
 *     final json block, not the closing "```" fence that the old slice captured.
 */

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { test } from "./harness.js";
import { ensureTrailingNewline } from "../src/lib/atomicWrite.js";
import { resolveAuthorReviewIo } from "../src/orchestrator/authorReview.js";
import { sessionFinalHead } from "../src/orchestrator/autopilot.js";
import type { CodexAgentResult } from "../src/orchestrator/codexAgent.js";

// ── ensureTrailingNewline ─────────────────────────────────────────────────────

test("ensureTrailingNewline: adds one \\n when absent, is idempotent, handles empty", () => {
  assert.equal(ensureTrailingNewline("abc"), "abc\n");
  assert.equal(ensureTrailingNewline("abc\n"), "abc\n", "idempotent — never doubles the newline");
  assert.equal(ensureTrailingNewline(""), "\n");
  assert.equal(ensureTrailingNewline("a\nb"), "a\nb\n", "only the terminal newline is enforced");
});

// ── The real writeReviewDoc choke point ───────────────────────────────────────

test("Q1 writeReviewDoc appends a trailing newline to EVERY reader-facing doc it writes", () => {
  const tmp = mkdtempSync(join(tmpdir(), "review-doc-"));
  let fixtureDir: string | null = null;
  try {
    // Point the write choke point at a tmp dir via an override that still runs
    // the REAL default implementation's newline enforcement — we exercise the
    // default (over?.writeReviewDoc undefined) but redirect PIPELINE_DIR-relative
    // writes by reading them back from the returned absPath.
    const io = resolveAuthorReviewIo();
    // Each of these mirrors a real write site (authorEvidence + authorReview):
    const cases: Array<{ name: string; text: string }> = [
      { name: "book-sample.txt", text: "==== CHAPTER 1: X ====\nbody\nCHAPTER 1 Q1: a" },   // no trailing \n
      { name: "ch01.txt", text: "# Chapter\n## ANSWER KEY\nQ1: a" },                          // no trailing \n
      { name: "key-judge-r1.txt", text: "BLIND KEY PACKS\nQ0. prompt" },                      // no trailing \n
      { name: "keyA.answers-r1.json", text: JSON.stringify({ chapters: [] }) },               // JSON, no \n
      { name: "sweep-submission-r1-a1.json", text: JSON.stringify({ verdict: "PASS" }) },      // JSON, no \n
    ];
    for (const c of cases) {
      const { absPath } = io.writeReviewDoc("zz-doc-fixture", c.name, c.text);
      fixtureDir = dirname(absPath);
      const onDisk = readFileSync(absPath, "utf8");
      assert.ok(onDisk.endsWith("\n"), `${c.name} must end with a newline on disk`);
      assert.equal(onDisk, ensureTrailingNewline(c.text), `${c.name} bytes = input + single trailing newline`);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
    if (fixtureDir) rmSync(fixtureDir, { recursive: true, force: true });
  }
});

// ── sessionFinalHead (Q6/T3) ──────────────────────────────────────────────────

function mkResult(over: Partial<CodexAgentResult>): CodexAgentResult {
  return { ok: true, exitCode: 0, finalMessage: "", stdout: "", stderr: "", durationMs: 1, sessionId: "s", ...over };
}

test("Q6/T3 sessionFinalHead returns the reader's final json block, not the closing fence", () => {
  // The exact failure mode: finalMessage = lastNonEmptyLine(stdout) = "```".
  const verdict = { gate_verdict: "PASS", scores: { retention: 88 } };
  const stdout = `thinking out loud...\n\`\`\`json\n${JSON.stringify(verdict, null, 2)}\n\`\`\`\n`;
  const r = mkResult({ finalMessage: "```", stdout });
  const head = sessionFinalHead(r);
  assert.notEqual(head, "```", "the old bug captured only the closing fence");
  assert.ok(head.includes('"gate_verdict"'), "the meaningful verdict head is captured");
  assert.ok(head.startsWith("```"), "the head is the full fenced block");
});

test("Q6/T3 sessionFinalHead falls back to finalMessage when there is no fenced block, and caps length", () => {
  const noBlock = mkResult({ finalMessage: "plain final message", stdout: "plain final message" });
  assert.equal(sessionFinalHead(noBlock), "plain final message");
  const long = "x".repeat(5000);
  const capped = sessionFinalHead(mkResult({ finalMessage: long, stdout: long }), 2000);
  assert.equal(capped.length, 2000, "capped to the requested head size");
});
