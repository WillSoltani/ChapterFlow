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
  // F5: the research-run pin is exposed on BOTH book production commands.
  assert.match(output, /book-run <bookId> .*--research-run-id <id>/);
  assert.match(output, /book-autopilot <bookId> .*--research-run-id <id>/);
});

// The 2026-09-04 live Franklin resume defect was, for the operator, a
// documentation failure as much as a code one: nothing said whether the retry
// command should repeat --regen, and the two spellings behaved differently (one
// discarded 16 durable chapter sidecars, the other was refused outright with
// RESEARCH_RESUME_CONFLICT). The contract is now stated where the operator
// looks — INCLUDING its two exceptions. A help text that promises more than the
// code does is worse than no help text, so the exceptions are pinned here beside
// the promise.
test("help states the resume contract: which research run a resume continues, and both ways that can fail", () => {
  const result = cli(["help"]);
  const output = `${result.stdout}${result.stderr}`;
  assert.equal(result.status, 0);
  assert.match(output, /--resume-run-id continues an existing run\.\s+The research run a round creates is\s+recorded durably against its control run before the first chapter is researched/);
  assert.match(output, /a resume continues THAT research run — not whichever compatible bundle for the book\s+is newest/);
  assert.match(output, /loaded from disk with zero model\s+calls, and only the chapters without one are re-run/);
  // Exception 1: a run that predates the binding falls back, and says so.
  assert.match(output, /falls back to the newest compatible\s+bundle and prints action=NO_RECORDED_RESEARCH_RUN/);
  // Exception 2: an unusable own bundle stops the run, naming the field.
  assert.match(output, /no longer matches the current fingerprint \(codeVersion,\s+promptHash, configHash, provider, model/);
  assert.match(output, /FAILS CLOSED with RESEARCH_RESUME_CONFLICT naming the field, rather than\s+silently re-researching or adopting another run's bundle/);
  assert.match(output, /on a resumed round --regen means ONLY "bypass the already-promoted\s+pointer"/);
  assert.match(output, /--regen --resume-run-id X do the same work and\s+neither is a definition conflict/);
  assert.match(output, /Research refresh is a FIRST-round axis/);
  assert.match(output, /A resume still fails closed\s+when the intent that matters changed/);
});

test("piped stdout is never truncated by exit — the whole document reaches the reader", () => {
  // Regression lock. `process.exit()` discards data still queued on an async
  // stream, and stdout is async whenever it is a pipe. Before exitAfterFlush,
  // `help` delivered exactly 8192 bytes to a pipe (one pipe buffer) out of the
  // 37410 it writes to a file, and any consumer of piped output — captured CI
  // logs, `--json` readers — silently read a prefix. This asserts on the tail
  // and on the byte count, because a prefix check cannot see truncation.
  const result = cli(["help"]);
  const output = `${result.stdout}${result.stderr}`;
  assert.equal(result.status, 0);
  assert.ok(
    output.length > 8192,
    `piped help truncated to ${output.length} bytes — process.exit() is discarding buffered stdout again`,
  );
  // The final documented route must survive, not just the first pipe-buffer's worth.
  assert.match(output, /npx tsx src\/cli\.ts book-run atomic-habits/);
});

test("the research-run pin is shared by both book production commands and fails closed on a malformed value", () => {
  // Paired with a deliberately invalid --max-repair so the command stops at the
  // usage gate (no composition, no side effects) while still proving the flag
  // cleared book-autopilot's allowlist.
  const autopilot = cli([...bookArgs("book-autopilot"), "--research-run-id", "20260728T101112131Z-abc", "--max-repair", "2"]);
  assert.equal(autopilot.status, 2);
  assert.doesNotMatch(
    `${autopilot.stdout}${autopilot.stderr}`,
    /UNSUPPORTED_OPTION:book-autopilot:--research-run-id/,
    "--research-run-id is shared, not book-run-only",
  );
  assert.match(`${autopilot.stdout}${autopilot.stderr}`, /Usage: book-autopilot /);

  const valueless = cli([...bookArgs("book-run"), "--research-run-id"]);
  assert.equal(valueless.status, 2);
  assert.match(`${valueless.stdout}${valueless.stderr}`, /Usage: book-run .*--research-run-id <id>/);

  const empty = cli([...bookArgs("book-run"), "--research-run-id", ""]);
  assert.equal(empty.status, 2);
  assert.match(`${empty.stdout}${empty.stderr}`, /Usage: book-run .*--research-run-id <id>/);
});

test("the research-run pin is mutually exclusive with resume and is not offered by the research command", () => {
  const conflict = cli([...bookArgs("book-run"), "--research-run-id", "X", "--resume-run-id", "Y"]);
  assert.equal(conflict.status, 2);
  assert.match(
    `${conflict.stdout}${conflict.stderr}`,
    /BOOK_RUN_FLAG_CONFLICT:--research-run-id cannot be combined with --resume-run-id/,
  );

  // An unsupported flag is still reported FIRST — the conflict check never
  // masks the allowlist rejection.
  const withUnsupported = cli([...bookArgs("book-run"), "--research-run-id", "X", "--resume-run-id", "Y", "--plan"]);
  assert.equal(withUnsupported.status, 2);
  assert.match(`${withUnsupported.stdout}${withUnsupported.stderr}`, /UNSUPPORTED_OPTION:book-run:--plan/);

  // Scope lock: the pin buys nothing on the research command (which already has
  // --force-refresh), so its absence there is a decision, not an oversight.
  const research = cli([
    "research", "Some Title", "Some Author",
    "--v25-root", "/tmp/cli-v4-state",
    "--attempt-root", "/tmp/cli-v4-attempts",
    "--source-git-sha", "deadbeef",
    "--research-run-id", "X",
  ]);
  assert.equal(research.status, 2);
  assert.match(`${research.stdout}${research.stderr}`, /UNSUPPORTED_OPTION:research:--research-run-id/);
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
  assert.match(production, /"resume-run-id", "research-run-id"/);
  assert.match(
    production,
    /\.\.\.\(typeof flags\["research-run-id"\] === "string" \? \{ researchRunId: flags\["research-run-id"\] \} : \{\}\)/,
  );
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
