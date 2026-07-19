#!/usr/bin/env node

/**
 * Fail closed unless c8 reports every production TypeScript file in the two
 * WS7 critical roots. c8's `all` option supplies zero-coverage records for
 * unimported files; this independent inventory prevents a future glob change
 * from silently shrinking the denominator.
 *
 * `test:coverage:critical` discovers the 103 tests colocated with these roots
 * and fails if that set shrinks. CI retains the separate full `npm test` gate,
 * so the focused coverage run cannot silently replace broader regression tests.
 * Test files, declarations, and explicitly named test fixtures are excluded.
 * On Node 20.20.2, the 2026-07-19 baseline was 40.58% lines/statements,
 * 82.84% branches, and 68.25% functions. The committed floors are 40.5%
 * lines/statements, 82.8% branches, and 68.2% functions. They may only move
 * upward as coverage improves.
 */

import { appendFile, readFile, readdir, writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = process.cwd();
const coverageDirectory = resolve(root, "coverage");
const summaryPath = resolve(coverageDirectory, "coverage-summary.json");
const inventoryPath = resolve(coverageDirectory, "inventory.json");
const criticalRoots = ["lib", "app/app/api/book/_lib"];
const sourceExtension = /\.(?:ts|tsx|mts|cts)$/;
const excludedSource =
  /\.(?:test|spec|itest)\.(?:ts|tsx|mts|cts)$|-test-fixtures\.(?:ts|tsx|mts|cts)$|\.d\.(?:ts|mts|cts)$/;

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = resolve(directory, entry.name);
      return entry.isDirectory() ? walk(path) : [path];
    }),
  );
  return files.flat();
}

function repositoryPath(path) {
  const absolute = path.startsWith("file:")
    ? fileURLToPath(path)
    : isAbsolute(path)
      ? path
      : resolve(root, path);
  return relative(root, absolute).split(sep).join("/");
}

const expectedFiles = (
  await Promise.all(criticalRoots.map((directory) => walk(resolve(root, directory))))
)
  .flat()
  .filter((path) => sourceExtension.test(path) && !excludedSource.test(path))
  .map(repositoryPath)
  .sort();

let summary;
try {
  summary = JSON.parse(await readFile(summaryPath, "utf8"));
} catch (error) {
  console.error(`Coverage inventory could not read ${summaryPath}:`, error);
  process.exit(1);
}

const reportedFiles = Object.keys(summary)
  .filter((path) => path !== "total")
  .map(repositoryPath)
  .sort();
const expected = new Set(expectedFiles);
const reported = new Set(reportedFiles);
const missing = expectedFiles.filter((path) => !reported.has(path));
const unexpected = reportedFiles.filter((path) => !expected.has(path));

const inventory = {
  schemaVersion: 1,
  criticalRoots,
  expectedFileCount: expectedFiles.length,
  reportedFileCount: reportedFiles.length,
  missing,
  unexpected,
  totals: summary.total,
};
await writeFile(inventoryPath, `${JSON.stringify(inventory, null, 2)}\n`);

const metrics = ["lines", "branches", "functions", "statements"];
const metricSummary = metrics
  .map((metric) => `${metric} ${summary.total?.[metric]?.pct ?? "missing"}%`)
  .join(", ");
console.log(
  `Critical coverage inventory: ${reportedFiles.length}/${expectedFiles.length} files; ${metricSummary}`,
);

if (process.env.GITHUB_STEP_SUMMARY) {
  const rows = metrics
    .map(
      (metric) =>
        `| ${metric} | ${summary.total?.[metric]?.covered ?? "missing"} | ${summary.total?.[metric]?.total ?? "missing"} | ${summary.total?.[metric]?.pct ?? "missing"}% |`,
    )
    .join("\n");
  await appendFile(
    process.env.GITHUB_STEP_SUMMARY,
    [
      "## Unit code coverage",
      "",
      `Critical inventory: **${reportedFiles.length}/${expectedFiles.length} files** across ${criticalRoots.join(" and ")}.`,
      "",
      "| Metric | Covered | Total | Percent |",
      "| --- | ---: | ---: | ---: |",
      rows,
      "",
    ].join("\n"),
  );
}

if (expectedFiles.length === 0 || missing.length > 0 || unexpected.length > 0) {
  if (missing.length > 0) console.error("Missing coverage files:", missing);
  if (unexpected.length > 0) console.error("Unexpected coverage files:", unexpected);
  process.exit(1);
}
