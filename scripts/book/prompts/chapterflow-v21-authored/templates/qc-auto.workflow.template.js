// ChapterFlow qc-auto workflow template.
// Filled by `npx tsx src/cli.ts qc-auto "<book>" --pass`.
//
// A Codex workflow runtime may provide phase(), agent(), parallel(), and
// pipeline(). If it is absent, qc-auto leaves this file plus task cards on disk
// and reports manual subagent mode instead of faking reviewer outputs.

const bookId = __BOOK_ID__;
const roundId = __ROUND_ID__;
const roundRecordPath = __ROUND_RECORD_PATH__;
const maxAgents = __MAX_AGENTS__;

const root = "scripts/book/prompts/chapterflow-v21-authored";
const run = (cmd) => `${cmd}`;

const task = (path) => `${root}/state/qc-orchestrator/${bookId}/${roundId}/task-cards/${path}`;

pipeline(`ChapterFlow no-api QC autopilot: ${bookId}`, [
  phase("PHASE 0 — Preflight", [
    run(`cd ${root}`),
    run("export CHAPTERFLOW_NO_API_CODEX_QC=1"),
    run(`cat ${roundRecordPath}`),
  ]),
  phase("PHASE 1 — Sweep", [
    agent("sweep", {
      promptFile: task("00-sweep.md"),
      mustSubmit: `npx tsx src/cli.ts qc-submit ${bookId} --round ${roundId} --role sweep --token <sweep-token> --file <submission.json>`,
    }),
  ]),
  phase("PHASE 2 — Key A / Key B", [
    parallel([
      agent("keyA", { promptFile: task("01-keyA.md") }),
      agent("keyB", { promptFile: task("02-keyB.md") }),
    ]),
  ]),
  phase("PHASE 3 — Bar Reads", [
    agent("bar-readers", {
      promptGlob: task("bar/ch*.md"),
      schemaVersion: "qc-bar-read-v2",
      maxAgents,
    }),
  ]),
  phase("PHASE 4 — First Collect", [
    run(`CHAPTERFLOW_NO_API_CODEX_QC=1 npx tsx src/cli.ts qc-orchestrate ${bookId} --collect --round ${roundId}`),
  ]),
  phase("PHASE 5 — Confirm Candidates", [
    run(`CHAPTERFLOW_NO_API_CODEX_QC=1 npx tsx src/cli.ts qc-orchestrate ${bookId} --confirm-candidates --round ${roundId}`),
  ]),
  phase("PHASE 6 — Confirm Reads", [
    agent("confirm-readers", {
      promptGlob: task("confirm/ch*.md"),
      schemaVersion: "qc-confirm-read-v1",
      onlyForPublishableCandidates: true,
      maxAgents,
    }),
  ]),
  phase("PHASE 7 — Finalize", [
    run(`CHAPTERFLOW_NO_API_CODEX_QC=1 npx tsx src/cli.ts qc-orchestrate ${bookId} --finalize --round ${roundId}`),
  ]),
]);
