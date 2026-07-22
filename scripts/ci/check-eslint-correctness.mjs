import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// WS6-015: zero-tolerance correctness-rule subset for the lint ratchet. These
// rules ship at severity "warn" in eslint-config-next's default config, so
// eslint.config.mjs elevates them to "error" for this repo — this checker
// then fails on any hit regardless of the ratchet's overall error-count
// baseline (which tolerates some slack for stylistic rules).
//
// WS6-021: exported (not just a top-level script) so scripts/ci/lint-ratchet.mjs
// can run this exact same check inline in its real-mode run — the CI job's
// "ESLint correctness subset" step and a local `npm run lint:ratchet` /
// `npm run verify` now share one implementation instead of CI running a
// second script local verify never touches.
export const CORRECTNESS_RULES = new Set([
  "react-hooks/exhaustive-deps",
  "@typescript-eslint/no-unused-vars",
  "no-unused-vars",
  "@typescript-eslint/no-floating-promises",
]);

/** Pure: given a parsed `eslint --format json` report, return the zero-tolerance hits. */
export function findCorrectnessHits(report) {
  const hits = [];
  for (const f of report ?? []) {
    for (const m of f.messages ?? []) {
      if (m.severity === 2 && CORRECTNESS_RULES.has(m.ruleId)) {
        hits.push(`${f.filePath}:${m.line} ${m.ruleId}`);
      }
    }
  }
  return hits;
}

/**
 * CLI entry point, kept byte-compatible with the prior standalone-script
 * behavior (same argv[2] report path default, same stdout/stderr marker
 * text, same exit codes) so CI's `node scripts/ci/check-eslint-correctness.mjs
 * eslint-report.json` step is unaffected by this refactor.
 */
export function runCheckEslintCorrectnessCli({
  reportPath = process.argv[2] ?? "eslint-report.json",
  stdout = process.stdout,
  stderr = process.stderr,
} = {}) {
  const report = JSON.parse(readFileSync(reportPath, "utf8"));
  const hits = findCorrectnessHits(report);
  if (hits.length) {
    for (const h of hits) stderr.write(`${h}\n`);
    return 1;
  }
  stdout.write("correctness subset clean\n");
  return 0;
}

const SCRIPT_PATH = fileURLToPath(import.meta.url);

function main() {
  process.exitCode = runCheckEslintCorrectnessCli();
}

if (
  process.argv[1] !== undefined &&
  pathToFileURL(path.resolve(process.argv[1])).href ===
    pathToFileURL(SCRIPT_PATH).href
) {
  main();
}
