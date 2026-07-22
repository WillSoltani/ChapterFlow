import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { test } from "./harness.js";

const cliSource = readFileSync(resolve(process.cwd(), "src/cli.ts"), "utf8");

function cli(args: string[]) {
  return spawnSync(process.execPath, ["--import", "tsx", "src/cli.ts", ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      CHAPTERFLOW_NO_API_CODEX_QC: "1",
      CHAPTERFLOW_ALLOW_MODEL_GEN: "0",
    },
  });
}

function sourceBetween(start: string, end: string): string {
  const startAt = cliSource.indexOf(start);
  const endAt = cliSource.indexOf(end, startAt + start.length);
  assert.ok(startAt >= 0, `missing source marker: ${start}`);
  assert.ok(endAt > startAt, `missing source marker after ${start}: ${end}`);
  return cliSource.slice(startAt, endAt);
}

function bookArgs(command: "book-run" | "book-autopilot"): string[] {
  return [
    command,
    "cli-v4-book",
    "--title", "CLI V4 Book",
    "--author", "Test Author",
    "--v25-root", "/tmp/cli-v4-state",
    "--attempt-root", "/tmp/cli-v4-attempts",
    "--source-git-sha", "deadbeef",
  ];
}

test("help exposes only canonical V4 production routes and flags", () => {
  const result = cli(["help"]);
  const output = `${result.stdout}${result.stderr}`;
  assert.equal(result.status, 0);
  assert.match(output, /research "<title>" "<author>".*--v25-root <absolute>.*--attempt-root <absolute>.*--source-git-sha <sha>/);
  assert.match(output, /generate \| pipeline \| flow\s+LEGACY_ROUTE_DISABLED/);
  assert.match(output, /book-autopilot <bookId> --title <title> --author <author>.*--no-publish/);
  assert.match(output, /book-run <bookId> --title <title> --author <author>.*--log <absolute>/);
  assert.match(output, /Route is always local-only: no package\/registry\/Git\/remote\/deploy/);
  assert.doesNotMatch(output, /SUBPROCESS MODE|AUTO-PUBLISHES|macOS notification/);
});

test("book routes reject retired flags and require absolute book-run log", () => {
  const relativeLog = cli([...bookArgs("book-run"), "--no-publish", "--promote-local", "--log", "events.jsonl"]);
  assert.equal(relativeLog.status, 2);
  assert.match(`${relativeLog.stdout}${relativeLog.stderr}`, /Usage: book-run .*--log <absolute>/);

  const autopilotLog = cli([...bookArgs("book-autopilot"), "--log", "/tmp/events.jsonl"]);
  assert.equal(autopilotLog.status, 2);
  assert.match(`${autopilotLog.stdout}${autopilotLog.stderr}`, /UNSUPPORTED_OPTION:book-autopilot:--log/);

  const retired = cli([...bookArgs("book-run"), "--plan"]);
  assert.equal(retired.status, 2);
  assert.match(`${retired.stdout}${retired.stderr}`, /UNSUPPORTED_OPTION:book-run:--plan/);

  const external = cli([...bookArgs("book-run"), "--push"]);
  assert.equal(external.status, 2);
  assert.match(`${external.stdout}${external.stderr}`, /BOOK_RUN_LOCAL_ONLY:--push/);
});

test("book-run and book-autopilot share one service binding and local promotion remains compatible", () => {
  const production = sourceBetween("async function runV4BookProduction", "async function runV4SelectedCandidateQc");
  const routes = sourceBetween("async function runExistingCommand", "async function main");
  assert.equal((production.match(/createProductionBookRunComposition\(/g) ?? []).length, 1);
  assert.equal((production.match(/\.app\.bookRun\.run\(/g) ?? []).length, 1);
  assert.match(production, /"promote-local", "no-publish"/);
  assert.match(production, /promoteLocal: flags\["promote-local"\] === true/);
  assert.match(production, /signal,/);
  assert.doesNotMatch(production, /new AbortController/);
  assert.match(routes, /runV4BookProduction\(args, flags, "book-autopilot", signal\)/);
  assert.match(routes, /runV4BookProduction\(args, flags, "book-run", signal\)/);
});

test("research uses V4 composition while legacy generation routes stay disabled", () => {
  const research = sourceBetween("async function runV4Research", "async function runV4BookProduction");
  assert.equal((research.match(/createProductionBookRunComposition\(/g) ?? []).length, 1);
  assert.equal((research.match(/\.app\.research\.run\(/g) ?? []).length, 1);
  assert.match(research, /signal,/);
  assert.doesNotMatch(research, /runResearch\(|new AbortController|claude -p/);

  for (const command of ["pipeline", "flow", "generate"] as const) {
    const result = cli([command]);
    assert.equal(result.status, 2);
    assert.match(`${result.stdout}${result.stderr}`, new RegExp(`LEGACY_ROUTE_DISABLED:V4_APPLICATION_ROUTE_REQUIRED:cli\\.${command}`));
  }
});

test("V4 qc-auto and qc-diagnose choose explicit candidate selector branches", () => {
  const qcAuto = cli(["qc-auto", "cli-v4-book", "--pass", "--v25-root", "/tmp/cli-v4-state"]);
  assert.equal(qcAuto.status, 2);
  assert.match(`${qcAuto.stdout}${qcAuto.stderr}`, /V25_COMPOSITION_REQUIRED/);

  const diagnose = cli(["qc-diagnose", "cli-v4-book", "--round", "round-1", "--v25-root", "/tmp/cli-v4-state"]);
  assert.equal(diagnose.status, 2);
  assert.match(`${diagnose.stdout}${diagnose.stderr}`, /V25_COMPOSITION_REQUIRED/);

  const routes = sourceBetween("async function runExistingCommand", "async function main");
  assert.match(routes, /hasCliV25Selection\(flags\) \? runV4SelectedCandidateQc\(args, flags, signal\) : runQcAuto/);
  const selectedQc = sourceBetween("async function runV4SelectedCandidateQc", "async function reviewCliV25Candidate");
  assert.match(selectedQc, /createCliV25Composition\(bookId, flags\)/);
  assert.match(selectedQc, /CandidateQcEvaluator/);
  assert.match(selectedQc, /qcService\.runFresh/);
});

test("SIGINT abort signal reaches V4 application calls", () => {
  const main = cliSource.slice(cliSource.indexOf("const cliAbortController"));
  assert.match(main, /process\.once\("SIGINT"/);
  assert.match(main, /cliAbortController\.abort\(new Error\("SIGINT"\)\)/);
  assert.match(main, /main\(cliAbortController\.signal\)/);
  assert.match(main, /signal\.aborted \? 130/);
  assert.match(cliSource, /abortSignal: signal/);
});
