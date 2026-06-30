/**
 * Test runner. Usage (from the pipeline dir):
 *
 *   npx tsx tests/run.ts            # run everything
 *   npx tsx tests/run.ts hash gold  # run files whose names contain a term
 *
 * Exit codes: 0 = all pass (xfails count as pass), 1 = any FAIL or XPASS.
 */

import { readdirSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { runRegistered, TestResult } from "./harness.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const filters = process.argv.slice(2).map((s) => s.toLowerCase());

const files = readdirSync(__dirname)
  .filter((f) => f.endsWith(".test.ts"))
  .filter((f) => filters.length === 0 || filters.some((t) => f.toLowerCase().includes(t)))
  .sort();

const ICONS: Record<TestResult["status"], string> = {
  pass: "✓",
  fail: "✗",
  xfail: "▣",
  xpass: "✗",
  skip: "−",
};

let pass = 0, fail = 0, xfailCount = 0, xpass = 0, skipped = 0;

async function main(): Promise<void> {
for (const file of files) {
  console.log(`\n── ${file}`);
  await import(resolve(__dirname, file));
  const results = await runRegistered();
  for (const r of results) {
    const icon = ICONS[r.status];
    const tag = r.status === "xfail" ? " [known defect]" : r.status === "xpass" ? " [XPASS]" : r.status === "skip" ? " [skip]" : "";
    console.log(`  ${icon} ${r.name}${tag}`);
    if (r.status === "xfail" && r.reason) console.log(`      ↳ ${r.reason}`);
    if (r.status === "skip" && r.reason) console.log(`      ↳ ${r.reason}`);
    if (r.error) console.log(`      ↳ ${r.error.replace(/\n/g, "\n        ")}`);
    if (r.status === "pass") pass++;
    else if (r.status === "fail") fail++;
    else if (r.status === "xfail") xfailCount++;
    else if (r.status === "xpass") xpass++;
    else skipped++;
  }
}

console.log(
  `\n${"─".repeat(60)}\n` +
  `pass ${pass}  fail ${fail}  xfail(known defects) ${xfailCount}  xpass ${xpass}  skip ${skipped}`,
);
if (xpass > 0) {
  console.log("XPASS means a documented defect got fixed — promote its xfail() to test().");
}
process.exit(fail > 0 || xpass > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
