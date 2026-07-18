/**
 * Stage-1 SCREENING DRIVER (protocol docs/v25/implementation/V25_CHAPTER_EXPERIMENT_PROTOCOL.md §5;
 * plan docs/v25/V25_EVALUATOR_AND_MODEL_SELECTION_EXECUTION_PLAN.md §5, hierarchy §3).
 *
 * The orchestrator runs ONE INVOCATION per process — one (block, replicate) cell
 * of the registered 3-block × 2-replicate Stage-1 grid:
 *
 *     env -u OPENAI_API_KEY npx tsx scripts/screening/run-stage1-screening.mts \
 *         --invocation=<block>:<r1|r2> --execute-live [--run-hash=<kebab>]
 *
 * where <block> ∈ { nudge-ch03, made-to-stick-ch04, the-happiness-hypothesis-ch06 }
 * (SCREENING_PLAN units; the sol@high arm is DROPPED — protocol §5 Stage 1b).
 * Keep --run-hash IDENTICAL across all six invocations — it is the campaign key
 * every run id, sealed blind-label map, and the scoreboard aggregate under.
 *
 * Modes:
 *   (default, no --execute-live)  DRY PLAN — the full 6-invocation plan with
 *       per-invocation session estimates, the live remaining budget (WP-503
 *       ledger recount), the registered floors/band/caps with sources, and a
 *       fail-closed corpus-intake verification per block. Spawns NOTHING.
 *   --invocation=<block>:<rep>    scope the dry plan (or, with --execute-live,
 *       the live run) to exactly one invocation.
 *   --execute-live                actually run the invocation (fail-closed:
 *       requires --invocation; refuses when OPENAI_API_KEY is present so no
 *       codex child can inherit it).
 *   --scoreboard                  (re)build the BLIND stage scoreboard from
 *       disk — no spawn, ever; prints "no cells" and exits 0 on empty state.
 *
 * What one live invocation does (see stage1Core.mts for the full design notes):
 * authoring via the corpus compare-only runBakeoff (measure-only readability;
 * review/D7/select machinery neutralized through the stages seam; the conductor
 * stops itself at the provisional-selection halt) → dual-blind E-audits per
 * candidate slot (PRIMARY; written to the exact eval-diagnostic.json location
 * the terminal-gated selection reads) → single-rater D7-lite + per-block drift
 * unit (SECONDARY; replicate r1 only) → terminal d7.json records → FINAL
 * selection minting once BOTH replicates of the block carry terminal audits.
 * Budget: every spawn is preceded by a ledger recount against the 170 TRUE-
 * session ceiling and Stage-1's registered 119 cap — a would-be overshoot HALTS
 * BEFORE the offending spawn.
 *
 * Exit codes: 0 ok/plan; 1 unexpected; 2 probe-gate failure or usage; 3 budget
 * halt; 4 rater-uniformity halt; 5 cell failure (recorded, fail-closed); 6 dry
 * -plan blockers; 7 authoring failure.
 *
 * MODEL-FREE at import/typecheck time; a live session happens only under
 * --execute-live (orchestrator-owned).
 */

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { PIPELINE_DIR } from "../../src/bakeoff/paths.js";
import { intakeCorpus } from "../../src/bakeoff/corpusIntake.js";
import {
  NOT_A_BOOK_SCORE_NOTE,
  STAGE1_ADVANCE_FLOOR,
  STAGE1_BAND_W,
  STAGE1_BLOCK_FLOOR,
  STAGE1_D7LITE_TOLERANCE,
  STAGE1_FLOORS_SOURCE,
  STAGE1_SESSION_CEILING,
  STAGE1_STAGE_CAP,
  Stage1SpawnGate,
  executeStage1Invocation,
  invocationSessionEstimate,
  stage1Blocks,
  stage1RunId,
  writeStage1Scoreboard,
  type Stage1Replicate,
} from "./stage1Core.mjs";
import { STAGE1_AT_CAP_WITHOUT_CONFIRMATION_RULE } from "../../src/bakeoff/screeningPlan.js";

const RUN_HASH_RE = /^[a-z0-9][a-z0-9-]*$/;

function log(msg: string): void {
  process.stdout.write(`${msg}\n`);
}

function usage(): void {
  const blockList = stage1Blocks().map((b) => b.unit).join(" | ");
  log(
    [
      "usage: npx tsx scripts/screening/run-stage1-screening.mts [options]",
      "",
      "  (no options)                      dry plan for all six invocations (no spawn)",
      `  --invocation=<block>:<r1|r2>      block ∈ { ${blockList} }`,
      "  --execute-live                    run the named invocation live (requires --invocation;",
      "                                    launch with `env -u OPENAI_API_KEY …`)",
      "  --scoreboard                      (re)build the blind scoreboard from disk (no spawn)",
      "  --run-hash=<kebab>                campaign key (default s1); keep IDENTICAL across all six",
    ].join("\n"),
  );
}

function parseInvocation(value: string): { unit: string; replicate: Stage1Replicate } {
  const idx = value.lastIndexOf(":");
  const unit = idx === -1 ? value : value.slice(0, idx);
  const rep = idx === -1 ? "" : value.slice(idx + 1);
  const block = stage1Blocks().find((b) => b.unit === unit);
  if (!block || (rep !== "r1" && rep !== "r2")) {
    throw new Error(
      `bad --invocation ${JSON.stringify(value)} — want <block>:<r1|r2> with block one of: ${stage1Blocks().map((b) => b.unit).join(", ")}`,
    );
  }
  return { unit, replicate: rep };
}

function printDryPlan(runHash: string, only: { unit: string; replicate: Stage1Replicate } | null): number {
  const blocks = stage1Blocks();
  const gate = new Stage1SpawnGate(PIPELINE_DIR);
  const budget = gate.snapshot();
  log(`Stage-1 screening — DRY PLAN (no --execute-live: nothing spawns, nothing is written)`);
  log(`  ${NOT_A_BOOK_SCORE_NOTE}`);
  log(`  run-hash ${runHash} (keep identical across all six invocations — run ids, sealed labels, and the scoreboard key on it)`);
  log(`  registered: advance floor ${STAGE1_ADVANCE_FLOOR} / block floor ${STAGE1_BLOCK_FLOOR} (${STAGE1_FLOORS_SOURCE})`);
  log(`  registered: W = ${STAGE1_BAND_W} (frozen); D7-lite tolerance ±${STAGE1_D7LITE_TOLERANCE}; E-audit PRIMARY, D7-lite SECONDARY signs-only (plan §3)`);
  log(`  budget: campaign ${budget.campaignTrueSessions}/${STAGE1_SESSION_CEILING} TRUE sessions spent (WP-503 ledger recount; remaining ${budget.remainingCeiling}); stage-1 ${budget.stage1TrueSessions}/${STAGE1_STAGE_CAP} (remaining ${budget.remainingStageCap})`);
  log(`  rule: ${STAGE1_AT_CAP_WITHOUT_CONFIRMATION_RULE}`);
  log(`  pre-Stage-2 gate: checkBudgetBeforeStage2() (src/bakeoff/screeningPlan.ts) — cited, enforced at Stage-2 entry`);
  log("");

  let blockers = 0;
  let plannedTotal = 0;
  for (const block of blocks) {
    let intakeLine: string;
    try {
      const intake = intakeCorpus({ bookId: block.bookId, chapters: [block.chapter] });
      intakeLine = `corpus intake OK (${intake.corpusId}; ${intake.sharedInputCount} shared inputs on disk)`;
    } catch (err) {
      blockers += 1;
      intakeLine = `BLOCKER: ${(err as Error).message.split("\n")[0]}`;
    }
    for (const replicate of ["r1", "r2"] as const) {
      if (only && (only.unit !== block.unit || only.replicate !== replicate)) continue;
      const est = invocationSessionEstimate(replicate);
      plannedTotal += est.planned;
      log(`  ${block.unit}:${replicate}  runId ${stage1RunId(runHash, block.unit, replicate)}`);
      log(`    book ${block.bookId} ch${block.chapter}; 3 blinded candidates @ ${block.effort} (sealed label map); calibration/drift unit ${block.calibrationUnit}`);
      log(`    sessions: planned ${est.planned} (${replicate === "r1" ? "3 author + 9 E-audit + 3 D7-lite + 1 drift" : "3 author + 9 E-audit; D7-lite skipped on r2"}); worst case ${est.worstCase} (+1 once per campaign if the ultra probe re-runs)`);
      log(`    ${intakeLine}`);
      log(`    live: env -u OPENAI_API_KEY npx tsx scripts/screening/run-stage1-screening.mts --invocation=${block.unit}:${replicate} --execute-live --run-hash=${runHash}`);
    }
  }
  log("");
  log(`  planned total (all six, protocol §5 Stage-1 row): 84 sessions${only ? "" : ` — this plan enumerates ${plannedTotal}`}; hard cap ${STAGE1_STAGE_CAP}`);
  log(`  scoreboard: npx tsx scripts/screening/run-stage1-screening.mts --scoreboard --run-hash=${runHash}`);
  return blockers === 0 ? 0 : 6;
}

async function main(argv: string[]): Promise<number> {
  if (argv.includes("--help") || argv.includes("-h")) {
    usage();
    return 0;
  }
  const executeLive = argv.includes("--execute-live");
  const scoreboardOnly = argv.includes("--scoreboard");
  const runHash = (argv.find((a) => a.startsWith("--run-hash=")) ?? "").split("=")[1] || "s1";
  const invocationArg = (argv.find((a) => a.startsWith("--invocation=")) ?? "").split("=").slice(1).join("=");
  if (!RUN_HASH_RE.test(runHash)) {
    process.stderr.write(`--run-hash '${runHash}' must be kebab-case [a-z0-9-]\n`);
    return 2;
  }

  if (scoreboardOnly) {
    // No spawn, ever — a pure from-disk aggregation by BLIND label.
    const { cellsFound, outPath } = writeStage1Scoreboard({ runHash });
    if (cellsFound === 0) {
      log(`[stage1] scoreboard: no cells — no completed stage-1 E-audit cells on disk for run-hash '${runHash}'. Nothing written.`);
      return 0;
    }
    log(`[stage1] scoreboard: ${cellsFound} blind cell(s) aggregated → ${outPath}`);
    return 0;
  }

  let only: { unit: string; replicate: Stage1Replicate } | null = null;
  if (invocationArg) {
    try {
      only = parseInvocation(invocationArg);
    } catch (err) {
      process.stderr.write(`${(err as Error).message}\n`);
      return 2;
    }
  }

  if (!executeLive) return printDryPlan(runHash, only);

  // ── Live mode (fail-closed) ──
  if (only === null) {
    process.stderr.write(
      "--execute-live requires --invocation=<block>:<r1|r2> — the orchestrator runs exactly ONE invocation per process.\n",
    );
    return 2;
  }
  if (process.env.OPENAI_API_KEY !== undefined) {
    process.stderr.write(
      `REFUSED: OPENAI_API_KEY is set in the environment. Launch the driver with:\n  env -u OPENAI_API_KEY npx tsx scripts/screening/run-stage1-screening.mts --invocation=${only.unit}:${only.replicate} --execute-live --run-hash=${runHash}\n`,
    );
    return 2;
  }
  const { exitCode } = await executeStage1Invocation({ unit: only.unit, replicate: only.replicate, runHash });
  return exitCode;
}

// Execute ONLY when run as a script (never on import/typecheck).
const isMain = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((err) => {
      process.stderr.write(`[stage1] UNEXPECTED: ${(err as Error).stack ?? String(err)}\n`);
      process.exit(1);
    });
}

export { main };
