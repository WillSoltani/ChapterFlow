/** §16 LIVE conductor driver — runs the REAL ladder on the SEALED diagnostic
 *  (no injected stages, no synthetic qualification). Usage (PIPE):
 *    npx tsx state/migration-experiments/_owner-inputs/live-conductor-driver.mts <through-phase>
 *  e.g. `qualify` (Stage-Q Layer N), later `analyze` (blind generate/review/
 *  metrics/analyze — STOPS before unblind for the mandatory C3 pause).
 *
 *  Frozen policy enforced here (s16-execution-policy v2):
 *  - driver env carries no metered-API material; CHAPTERFLOW_NO_API_CODEX_QC=1;
 *  - maxParallel = 1 (serial, sealed executionOrder);
 *  - corpus = the owner-approved Layer-N corpus (human-status labels);
 *  - allowSyntheticQualification is NEVER passed (live review refuses dry-run
 *    qualifications structurally).
 */
import { runMigrationExperiment } from "../../../src/bakeoff/migration/runExperiment.js";

for (const k of ["OPENAI_API_KEY", "CODEX_API_KEY", "OPENAI_BASE_URL", "OPENAI_API_BASE", "ANTHROPIC_API_KEY"]) {
  if (process.env[k] !== undefined) { console.error(`REFUSING TO START: forbidden env var ${k} present`); process.exit(1); }
}
if (process.env.CHAPTERFLOW_NO_API_CODEX_QC !== "1") { console.error("REFUSING TO START: CHAPTERFLOW_NO_API_CODEX_QC=1 required"); process.exit(1); }

const through = process.argv[2];
const ALLOWED = ["qualify", "generate", "review", "metrics", "analyze"];
if (!ALLOWED.includes(through)) {
  console.error(`usage: live-conductor-driver.mts <${ALLOWED.join("|")}> — unblind/decide/report run ONLY after the owner's completed C3 adjudication is installed and hashed`);
  process.exit(2);
}

const INDEX: Record<string, number[]> = { "start-with-why": Array.from({ length: 14 }, (_, i) => i + 1) };

const out = await runMigrationExperiment({
  experimentId: "diagnostic-stack-2026-07",
  corpusPath: "state/migration-experiments/_owner-inputs/stage-q/layer-n-corpus.owner-approved.v1.json",
  through: through as never,
  maxParallel: 1,
  sealDeps: { expectedChapterNumbers: (b: string) => { const i = INDEX[b]; if (!i) throw new Error(`no chapter index injected for ${b}`); return i; } },
  log: (m: string) => console.log(m),
});
console.log(JSON.stringify(out, null, 2));
if (out.status === "halt") process.exit(1);
