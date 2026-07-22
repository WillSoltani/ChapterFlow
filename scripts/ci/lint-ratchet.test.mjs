import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  evaluateRatchet,
  readBaseline,
  runLintRatchetCli,
  sumErrorCount,
} from "./lint-ratchet.mjs";

const REPO_ROOT = path.resolve(import.meta.dirname, "../..");
const COMMITTED_BASELINE_PATH = path.join(
  REPO_ROOT,
  "scripts/ci/eslint-error-baseline",
);

function makeTmpDir() {
  const dir = mkdtempSync(path.join(tmpdir(), "lint-ratchet-test-"));
  return dir;
}

function writeFixture(dir, name, content) {
  const p = path.join(dir, name);
  writeFileSync(p, content, "utf8");
  return p;
}

function nullExplodingCall(label) {
  return () => {
    throw new Error(`fixture mode must not shell out to ${label}`);
  };
}

function collectingWriter() {
  const chunks = [];
  return {
    write(chunk) {
      chunks.push(chunk);
      return true;
    },
    text() {
      return chunks.join("");
    },
  };
}

// ── Pure helpers ────────────────────────────────────────────────────────

test("sumErrorCount sums errorCount across every file in an eslint --format json report", () => {
  const report = [
    { filePath: "a.ts", errorCount: 2 },
    { filePath: "b.ts", errorCount: 0 },
    { filePath: "c.ts", errorCount: 5 },
  ];
  assert.equal(sumErrorCount(report), 7);
});

test("sumErrorCount treats a missing errorCount as zero and rejects a non-array report", () => {
  assert.equal(sumErrorCount([{ filePath: "a.ts" }]), 0);
  assert.throws(() => sumErrorCount({ not: "an array" }), /must be a JSON array/);
});

test("evaluateRatchet passes at exactly the baseline", () => {
  const result = evaluateRatchet({ errors: 7, baseline: 7 });
  assert.equal(result.exitCode, 0);
  assert.equal(result.level, "ok");
});

test("evaluateRatchet warns (but still passes) below the baseline", () => {
  const result = evaluateRatchet({ errors: 3, baseline: 7 });
  assert.equal(result.exitCode, 0);
  assert.equal(result.level, "warn");
  assert.match(result.message, /BELOW baseline/);
});

test("evaluateRatchet fails above the baseline", () => {
  const result = evaluateRatchet({ errors: 8, baseline: 7 });
  assert.equal(result.exitCode, 1);
  assert.equal(result.level, "error");
  assert.match(result.message, /exceeds baseline/);
});

// ── Baseline is read from the committed file, not a hardcoded/env number ──

test("readBaseline reads the committed scripts/ci/eslint-error-baseline file as a single integer", () => {
  const fromHelper = readBaseline(COMMITTED_BASELINE_PATH);
  const fromDisk = Number(readFileSync(COMMITTED_BASELINE_PATH, "utf8").trim());
  assert.equal(fromHelper, fromDisk);
  assert.ok(Number.isInteger(fromHelper) && fromHelper >= 0);
});

test("readBaseline defaults to the committed baseline file when called with no path", () => {
  assert.equal(readBaseline(), readBaseline(COMMITTED_BASELINE_PATH));
});

test("readBaseline fails closed on a malformed baseline file", () => {
  const dir = makeTmpDir();
  try {
    const badPath = writeFixture(dir, "eslint-error-baseline", "not-a-number\n");
    assert.throws(() => readBaseline(badPath), /must contain a single non-negative integer/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── CLI: fixture report path means it never shells out to real ESLint ────

test("runLintRatchetCli in fixture mode never runs lint:infra-ci or eslint, and passes when at/below baseline", () => {
  const dir = makeTmpDir();
  try {
    const baselinePath = writeFixture(dir, "eslint-error-baseline", "7\n");
    const reportPath = writeFixture(
      dir,
      "eslint-report.json",
      JSON.stringify([{ filePath: "a.ts", errorCount: 4 }]),
    );
    const stdout = collectingWriter();
    const stderr = collectingWriter();
    const exitCode = runLintRatchetCli({
      reportPath,
      baselinePath,
      runLintInfraCi: nullExplodingCall("npm run lint:infra-ci"),
      runEslintReport: nullExplodingCall("npx eslint"),
      stdout,
      stderr,
    });
    assert.equal(exitCode, 0);
    assert.match(stdout.text(), /ESLint errors: 4 \(baseline: 7\)/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("runLintRatchetCli in fixture mode fails when the fixture report exceeds the baseline", () => {
  const dir = makeTmpDir();
  try {
    const baselinePath = writeFixture(dir, "eslint-error-baseline", "2\n");
    const reportPath = writeFixture(
      dir,
      "eslint-report.json",
      JSON.stringify([
        { filePath: "a.ts", errorCount: 2 },
        { filePath: "b.ts", errorCount: 1 },
      ]),
    );
    const stdout = collectingWriter();
    const stderr = collectingWriter();
    const exitCode = runLintRatchetCli({
      reportPath,
      baselinePath,
      runLintInfraCi: nullExplodingCall("npm run lint:infra-ci"),
      runEslintReport: nullExplodingCall("npx eslint"),
      stdout,
      stderr,
    });
    assert.equal(exitCode, 1);
    assert.match(stderr.text(), /::error::.*exceeds baseline/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("runLintRatchetCli fails closed (exit 1) when the report file does not exist", () => {
  const dir = makeTmpDir();
  try {
    const baselinePath = writeFixture(dir, "eslint-error-baseline", "7\n");
    const reportPath = path.join(dir, "does-not-exist.json");
    const stderr = collectingWriter();
    const exitCode = runLintRatchetCli({
      reportPath,
      baselinePath,
      runLintInfraCi: nullExplodingCall("npm run lint:infra-ci"),
      runEslintReport: nullExplodingCall("npx eslint"),
      stdout: collectingWriter(),
      stderr,
    });
    assert.equal(exitCode, 1);
    assert.match(stderr.text(), /no ESLint report found/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── Non-fixture ("real") mode runs lint:infra-ci first, then eslint ──────

// ── WS6-021: the zero-tolerance correctness subset runs inline too ───────

test("runLintRatchetCli fails and reports a hit when the report contains a zero-tolerance correctness-rule error", () => {
  const dir = makeTmpDir();
  try {
    const baselinePath = writeFixture(dir, "eslint-error-baseline", "9\n");
    const reportPath = writeFixture(
      dir,
      "eslint-report.json",
      JSON.stringify([
        {
          filePath: "app/foo.tsx",
          errorCount: 1,
          messages: [
            { severity: 2, ruleId: "react-hooks/exhaustive-deps", line: 12 },
          ],
        },
      ]),
    );
    const stdout = collectingWriter();
    const stderr = collectingWriter();
    const exitCode = runLintRatchetCli({
      reportPath,
      baselinePath,
      runLintInfraCi: nullExplodingCall("npm run lint:infra-ci"),
      runEslintReport: nullExplodingCall("npx eslint"),
      stdout,
      stderr,
    });
    // Below baseline (1 < 9) but still fails: correctness hits are
    // independent of the baseline comparison, same as CI's separate step.
    assert.equal(exitCode, 1);
    assert.match(stderr.text(), /app\/foo\.tsx:12 react-hooks\/exhaustive-deps/);
    assert.match(stderr.text(), /::error::ESLint correctness subset found 1 zero-tolerance hit/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("runLintRatchetCli prints the correctness-subset-clean marker and passes when there are no zero-tolerance hits", () => {
  const dir = makeTmpDir();
  try {
    const baselinePath = writeFixture(dir, "eslint-error-baseline", "7\n");
    const reportPath = writeFixture(
      dir,
      "eslint-report.json",
      JSON.stringify([{ filePath: "a.ts", errorCount: 4, messages: [] }]),
    );
    const stdout = collectingWriter();
    const stderr = collectingWriter();
    const exitCode = runLintRatchetCli({
      reportPath,
      baselinePath,
      runLintInfraCi: nullExplodingCall("npm run lint:infra-ci"),
      runEslintReport: nullExplodingCall("npx eslint"),
      stdout,
      stderr,
    });
    assert.equal(exitCode, 0);
    assert.match(stdout.text(), /correctness subset clean/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("runLintRatchetCli in real mode (no reportPath) runs lint:infra-ci before generating the eslint report, and writes it to outputPath", () => {
  const dir = makeTmpDir();
  try {
    const baselinePath = writeFixture(dir, "eslint-error-baseline", "1\n");
    const outputPath = path.join(dir, "eslint-report.json");
    const calls = [];
    const exitCode = runLintRatchetCli({
      reportPath: "",
      outputPath,
      baselinePath,
      runLintInfraCi: () => calls.push("lint:infra-ci"),
      runEslintReport: (outPath) => {
        calls.push("eslint");
        assert.equal(outPath, outputPath);
        writeFileSync(outPath, JSON.stringify([{ filePath: "a.ts", errorCount: 1 }]));
      },
      stdout: collectingWriter(),
      stderr: collectingWriter(),
    });
    assert.deepEqual(calls, ["lint:infra-ci", "eslint"]);
    assert.equal(exitCode, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
