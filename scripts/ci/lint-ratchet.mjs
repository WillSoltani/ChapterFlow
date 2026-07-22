#!/usr/bin/env node
// WS6-021: single source of truth for "did this PR add new ESLint error-level
// debt". Both `npm run lint:ratchet` (local/verify) and the CI "Lint Ratchet"
// job call this exact script, so a green local run predicts a green CI run —
// no separately-hand-maintained bash/env-var copy of the same logic.
//
// Baseline lives in the committed file scripts/ci/eslint-error-baseline (a
// single integer) rather than a workflow env var, so ci.yml and this script
// can never drift from each other.
import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "../..");
const DEFAULT_BASELINE_PATH = path.join(
  REPO_ROOT,
  "scripts/ci/eslint-error-baseline",
);
const DEFAULT_REPORT_PATH = path.join(REPO_ROOT, "eslint-report.json");

/**
 * Read the committed baseline file: a single non-negative integer, optional
 * trailing newline. Fails closed (throws) on anything else, same posture as
 * verify-tsconfig-boundary.mjs.
 */
export function readBaseline(baselinePath = DEFAULT_BASELINE_PATH) {
  const raw = readFileSync(baselinePath, "utf8").trim();
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0 || raw === "") {
    throw new Error(
      `${path.relative(REPO_ROOT, baselinePath)} must contain a single non-negative integer, got: ${JSON.stringify(raw)}`,
    );
  }
  return value;
}

/**
 * Sum `errorCount` across an ESLint `--format json` report (an array of
 * per-file results). Mirrors the inline `node -e` one-liner this replaces
 * (ci.yml's former lint-ratchet step).
 */
export function sumErrorCount(report) {
  if (!Array.isArray(report)) {
    throw new Error("ESLint report must be a JSON array (--format json output)");
  }
  let total = 0;
  for (const file of report) total += file?.errorCount ?? 0;
  return total;
}

/**
 * Pure comparison: given the observed error count and the committed
 * baseline, decide pass/fail/warn-below. Never raises above the baseline —
 * only equal or below is a passing exit code.
 */
export function evaluateRatchet({ errors, baseline }) {
  if (errors > baseline) {
    return {
      exitCode: 1,
      level: "error",
      message: `ESLint error count ${errors} exceeds baseline ${baseline} — new correctness-lint debt is not allowed. Fix the new error(s) or, if intentional, justify and lower/raise scripts/ci/eslint-error-baseline in the same PR.`,
    };
  }
  if (errors < baseline) {
    return {
      exitCode: 0,
      level: "warn",
      message: `ESLint error count ${errors} is BELOW baseline ${baseline} — lower scripts/ci/eslint-error-baseline to lock in the win.`,
    };
  }
  return {
    exitCode: 0,
    level: "ok",
    message: `No new ESLint errors (${errors} == baseline ${baseline}).`,
  };
}

function writeGithubStepSummary({ errors, baseline, result }) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) return;
  const lines = [
    "## ESLint ratchet",
    "",
    `- Current errors: \`${errors}\``,
    `- Baseline: \`${baseline}\``,
    "",
  ];
  if (result.level === "error") {
    lines.push(`❌ **${errors} > ${baseline}** — new ESLint errors introduced.`);
  } else if (result.level === "warn") {
    lines.push(
      `⬇️ **${errors} < ${baseline}** — ratchet the baseline down to lock in the cleanup.`,
    );
  } else {
    lines.push("✅ No new ESLint errors.");
  }
  lines.push("");
  try {
    appendFileSync(summaryPath, `${lines.join("\n")}\n`);
  } catch {
    // Never fail the ratchet over a missing/unwritable summary file.
  }
}

/**
 * Run the ratchet.
 *
 * Fixture mode (reportPath supplied via arg/env): skip shelling out to
 * `lint:infra-ci`/eslint entirely and just evaluate the given report file
 * against the baseline — this is what lint-ratchet.test.mjs exercises, so
 * the test suite never shells out to real ESLint.
 *
 * Real mode (no reportPath supplied — the CI job and bare `npm run
 * lint:ratchet`): runs `npm run lint:infra-ci` first (mirrors the CI job's
 * separate "Infra and CI-source ESLint" step so a bare local run catches the
 * same thing), then regenerates the ESLint report itself.
 */
export function runLintRatchetCli({
  reportPath = process.argv[2] || process.env.ESLINT_RATCHET_REPORT_PATH || "",
  // Where the report lands in real (non-fixture) mode, i.e. what path
  // runEslintReport is asked to write. Kept separate from `reportPath` so
  // tests can exercise the real-mode code path (mocked lint:infra-ci/eslint
  // calls) without writing into the repo root.
  outputPath = DEFAULT_REPORT_PATH,
  baselinePath = DEFAULT_BASELINE_PATH,
  runLintInfraCi = () =>
    execFileSync("npm", ["run", "lint:infra-ci"], {
      cwd: REPO_ROOT,
      stdio: "inherit",
    }),
  runEslintReport = (outPath) => {
    try {
      execFileSync(
        "npx",
        ["eslint", ".", "--format", "json", "--output-file", outPath],
        { cwd: REPO_ROOT, stdio: ["ignore", "ignore", "inherit"] },
      );
    } catch {
      // ESLint exits non-zero whenever it finds any error — expected; the
      // report file on disk is what this ratchet reads, not the exit code.
    }
  },
  stdout = process.stdout,
  stderr = process.stderr,
} = {}) {
  const fixtureMode = Boolean(reportPath);
  const resolvedReportPath = fixtureMode
    ? path.resolve(reportPath)
    : outputPath;

  if (!fixtureMode) {
    runLintInfraCi();
    runEslintReport(resolvedReportPath);
  }

  if (!existsSync(resolvedReportPath)) {
    stderr.write(
      `lint-ratchet: no ESLint report found at ${resolvedReportPath}\n`,
    );
    return 1;
  }

  let report;
  let baseline;
  try {
    report = JSON.parse(readFileSync(resolvedReportPath, "utf8"));
    baseline = readBaseline(baselinePath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    stderr.write(`lint-ratchet failed closed: ${message}\n`);
    return 1;
  }

  const errors = sumErrorCount(report);
  const result = evaluateRatchet({ errors, baseline });

  stdout.write(`ESLint errors: ${errors} (baseline: ${baseline})\n`);
  if (result.level === "error") {
    stderr.write(`::error::${result.message}\n`);
  } else if (result.level === "warn") {
    stderr.write(`::warning::${result.message}\n`);
  } else {
    stdout.write(`${result.message}\n`);
  }
  writeGithubStepSummary({ errors, baseline, result });

  return result.exitCode;
}

function main() {
  process.exitCode = runLintRatchetCli();
}

if (
  process.argv[1] !== undefined &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  main();
}
