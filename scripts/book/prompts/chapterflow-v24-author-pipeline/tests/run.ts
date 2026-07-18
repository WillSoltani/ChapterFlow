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
import {
  formatLeakReports,
  snapshotProductionRoots,
  verifyProductionRoots,
  walkRootManifest,
  diffRootManifests,
  guardedProductionRoots,
  type LeakGuardSnapshot,
} from "./productionLeakGuard.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const filters = process.argv.slice(2).map((s) => s.toLowerCase());

// IMP-12 item 2: hermeticity is ENFORCED, not asserted.
//  - The repo-root FORBIDDEN SHADOW state dir (CLAUDE.md P0) is guarded on
//    EVERY run — it is always clean and any write to it is a hard failure.
//  - CHAPTERFLOW_LEAK_GUARD=1 additionally guards the pipeline state/logs/
//    .attempts roots (the F-018 legacy-leak surface being driven down; the
//    baseline of currently-leaking tests is tracked in TEST-ARCHITECTURE.md).
// ~/.codex is intentionally NOT diffed here: reading auth for envelope copies
// is legitimate and the user's live Codex session mutates it independently;
// the auth-copy safety invariant is pinned by tests/exec-envelope.test.ts.
const FULL_LEAK_GUARD = process.env.CHAPTERFLOW_LEAK_GUARD === "1";
const SHADOW_ROOT = guardedProductionRoots().find((r) => r.name.includes("forbidden shadow"))!.path;
const shadowBefore = walkRootManifest(SHADOW_ROOT);
const fullSnapshot: LeakGuardSnapshot | null = FULL_LEAK_GUARD ? snapshotProductionRoots() : null;

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
  xenv: "⊘",
};

let pass = 0, fail = 0, xfailCount = 0, xpass = 0, skipped = 0, xenvCount = 0;

async function main(): Promise<void> {
for (const file of files) {
  console.log(`\n── ${file}`);
  await import(resolve(__dirname, file));
  const results = await runRegistered();
  for (const r of results) {
    const icon = ICONS[r.status];
    const tag = r.status === "xfail" ? " [known defect]" : r.status === "xpass" ? " [XPASS]" : r.status === "skip" ? " [skip]" : r.status === "xenv" ? " [env-absent]" : "";
    console.log(`  ${icon} ${r.name}${tag}`);
    if (r.status === "xfail" && r.reason) console.log(`      ↳ ${r.reason}`);
    if (r.status === "skip" && r.reason) console.log(`      ↳ ${r.reason}`);
    if (r.status === "xenv" && r.reason) console.log(`      ↳ ${r.reason}`);
    if (r.error) console.log(`      ↳ ${r.error.replace(/\n/g, "\n        ")}`);
    if (r.status === "pass") pass++;
    else if (r.status === "fail") fail++;
    else if (r.status === "xfail") xfailCount++;
    else if (r.status === "xpass") xpass++;
    else if (r.status === "xenv") xenvCount++;
    else skipped++;
  }
}

console.log(
  `\n${"─".repeat(60)}\n` +
  `pass ${pass}  fail ${fail}  xfail(known defects) ${xfailCount}  xpass ${xpass}  xenv(env-absent) ${xenvCount}  skip ${skipped}`,
);
if (xpass > 0) {
  console.log("XPASS means a documented defect got fixed — promote its xfail() to test().");
}
if (xenvCount > 0) {
  console.log(
    `xenv means a test's required environment (e.g. the tracked gold corpus) is absent on this ` +
    `checkout, so it was skipped with a machine-checked reason. It RUNS automatically where that ` +
    `corpus is present. xenv never masks a real FAIL — only fail/xpass fail the suite.`,
  );
}
// IMP-12: hermeticity gate. The forbidden repo-root shadow state dir must be
// byte-identical before/after EVERY run; the full guard (opt-in) additionally
// covers the pipeline roots. A leak fails the run as loudly as a test FAIL.
let leaked = false;
const shadowDiff = diffRootManifests(shadowBefore, walkRootManifest(SHADOW_ROOT));
if (shadowDiff.added.length + shadowDiff.removed.length + shadowDiff.changed.length > 0) {
  leaked = true;
  console.log(`\n${"─".repeat(60)}\nHERMETICITY FAILURE: the forbidden repo-root shadow state dir was mutated by the suite:`);
  console.log(formatLeakReports([{ root: `repo-root-state (forbidden shadow) (${SHADOW_ROOT})`, ...shadowDiff }]));
}
if (fullSnapshot) {
  const reports = verifyProductionRoots(fullSnapshot);
  if (reports.length > 0) {
    leaked = true;
    console.log(`\n${"─".repeat(60)}\nLEAK GUARD (CHAPTERFLOW_LEAK_GUARD=1): production roots mutated by the suite:`);
    console.log(formatLeakReports(reports));
    console.log("\nThese are the F-018 legacy-leak surface. Move the offending tests onto injected testRoots (tests/testRoots.ts).");
  }
}

// `fail` is a REAL regression (a genuinely failing NAME, incl. a precondition-present
// env test that broke); `xenv` is expected-absent-corpus and never fails the suite.
process.exit(fail > 0 || xpass > 0 || leaked ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
