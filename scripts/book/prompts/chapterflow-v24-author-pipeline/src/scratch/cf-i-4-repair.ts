/* CF-I-4 canonical surgical-repair driver (owner-approved mechanism, 2026-07-09).
 *
 * The canonical review-repair lane (doRepairOneChapter) is only reachable through an
 * UPHELD review FAIL with scope-convergent complaints — multipliers is 9/9 PASS, so the
 * normal trigger never fires and there is no CLI verb. This driver invokes the SAME
 * sanctioned function directly with explicit example/quiz scopes + CF-I-derived
 * complaints. Its guardrails are unchanged: it splices ONLY the allowed scopes, re-gates
 * (gate-chapter + rubric preflight + write-contract), and RESTORES the original bytes on
 * any failure. Prose (C34 ledes, stray beat phrases, hook clone) is hand-edited separately
 * (the lane vetoes prose by design).
 *
 *   npx tsx src/scratch/cf-i-4-repair.ts <chapterNumber>[,<n>...]
 */
import { existsSync } from "fs";
import { resolveDeps } from "../orchestrator/autopilot.js";
import { resolveAuthorIo } from "../orchestrator/authorRun.js";
import { doRepairOneChapter, type RepairScope } from "../orchestrator/authorRepair.js";
import { STRICT_PIPELINE_ENV } from "../lib/strictEnv.js";

Object.assign(process.env, STRICT_PIPELINE_ENV);
if (!process.env.CHAPTERFLOW_CODEX_BIN) {
  const appBin = "/Applications/Codex.app/Contents/Resources/codex";
  if (existsSync(appBin)) process.env.CHAPTERFLOW_CODEX_BIN = appBin;
}

const BOOK = "multipliers";

type RepairSpec = { ch: number; scopes: RepairScope[]; complaints: string[] };

const REPAIRS: RepairSpec[] = [
  {
    ch: 2,
    scopes: ["examples[0]", "examples[1]", "examples[2]", "examples[3]", "examples[4]"],
    complaints: [
      "Every example's whatToDo and whyItMatters opens on an evaluator QUESTION — \"Why does the handoff work?\", \"What cost proves the change?\", \"What did the bare year save?\", \"Who should answer now?\", \"What is the first signal?\", \"What does skipping cost first?\" — so the reader meets a quiz-master instead of a guide. Rewrite each whatToDo and whyItMatters to OPEN on a declarative sentence that does the teaching; a question may appear later inside a field but never as its first sentence (C31 evaluator-opener register). Keep every fact, name, date, and sourceAnchorId; keep the dealt arc.",
    ],
  },
  {
    ch: 5,
    scopes: ["examples[0]", "examples[1]", "examples[3]"],
    complaints: [
      "Three example fields render the brief's INTERNAL beat labels verbatim instead of the moment: \"Janelle makes the early signal count\" (ex0.whyItMatters), \"The late catch saves the call\" (ex1.scenario), \"The return moment turns dissent from noise\" (ex3.whyItMatters). These are dealing vocabulary, not reader language. Make each beat HAPPEN in the scene — someone spots the miss before others do; a fix that barely lands in time; the moment the check comes back — WITHOUT naming \"early signal\", \"late catch\", or \"return moment\" (C33 beat-vocabulary echo). Keep every fact and the dealt arc.",
    ],
  },
  {
    ch: 6,
    scopes: ["examples[0]", "examples[1]", "examples[3]"],
    complaints: [
      "Example fields speak the brief's beat labels verbatim: \"reach the return moment\" and \"The late catch is the paired frame\" (ex0.scenario), \"The return point is now set\" / \"mark the return point\" (ex1.scenario/whatToDo), \"the early signal appears before anyone flags it\" (ex3.scenario). Render each beat in the action — the check they return to, the catch that barely lands, the tell no one has flagged — WITHOUT naming \"return point\", \"return moment\", \"early signal\", or \"late catch\" (C33). Keep every fact, name, date, and sourceAnchorId; keep the dealt arc.",
    ],
  },
  {
    ch: 7,
    scopes: ["examples[0]", "examples[2]", "examples[3]", "examples[5]"],
    complaints: [
      "Example fields repeat the brief's beat labels: \"sets a return point\" and \"Without the return point\" and \"catches the early signal\" / \"Miss the early signal\" (ex0), \"One late catch beats a kind dodge\" (ex2.whyItMatters), \"At the return point, Blake brings his read first\" (ex3.scenario), \"The miss is caught late\" (ex5.scenario). Make each beat occur in the action WITHOUT naming \"return point\", \"early signal\", \"late catch\", or \"caught late\" (C33). Keep every fact and the dealt arc.",
    ],
  },
  {
    ch: 8,
    scopes: ["examples[0]", "examples[1]", "examples[2]", "examples[3]", "examples[4]", "quiz"],
    complaints: [
      "Every example's whatToDo and whyItMatters opens on an evaluator QUESTION — \"What got skipped?\", \"Who pays?\", \"What caused the miss?\", \"Why does the late catch matter?\", \"What would you ask here?\". Rewrite each to OPEN on a declarative teaching sentence; a question may appear later but never first (C31 evaluator-opener register).",
      "Example scenarios render dealt beat labels verbatim: \"At the return point\" (ex0), \"The return point is set but not met\" (ex2), \"the early signal is a demand that leaves no owner\" (ex3), \"The late catch was smaller\" (ex1). Render each beat in the scene WITHOUT naming \"return point\", \"early signal\", or \"late catch\" (C33). Keep every fact and the dealt arc.",
      "Quiz q01's correct choice rewards CITING the source lineage — \"Tie the move to Getting to Yes and its named authors, Roger Fisher and William Ury, so the frame is traceable\" (explanation: \"The source lineage matters here\") — and q04's correct choice is \"Name Chris Voss and his FBI negotiation experience as the lineage behind the tactic.\" The quiz must test whether the reader can USE the move in a NEW situation, not whether they can cite where it came from. Rewrite BOTH correct choices so the graded skill is APPLICATION (what the reader does/decides in a scenario); the source name may stay in the EXPLANATION as support, never as the answer. Keep every correctIndex unchanged; derive each distractor from the key (half-measure / wrong-trigger / over-correction / borrowed-authority); do not change the number of questions or choices (C35 lineage-key quiz). keyEvidence/sourceGrounding anchors stay intact.",
    ],
  },
];

const wanted = (process.argv[2] ?? "").split(",").map((s) => parseInt(s.trim(), 10)).filter(Number.isInteger);
const specs = wanted.length ? REPAIRS.filter((r) => wanted.includes(r.ch)) : REPAIRS;

async function main() {
  const deps = resolveDeps({ log: (m) => console.log(m) });
  const io = resolveAuthorIo();
  for (const spec of specs) {
    console.log(`\n════════ CF-I-4 repair ch${String(spec.ch).padStart(2, "0")} — scopes: ${spec.scopes.join(", ")}`);
    const started = Date.now();
    const rep = await doRepairOneChapter(BOOK, spec.ch, deps, { io, scopes: spec.scopes, complaints: spec.complaints });
    const mins = ((Date.now() - started) / 60000).toFixed(1);
    if (rep.ok) console.log(`✅ ch${spec.ch}: repair OK (session ${rep.sessionId}, ${mins}min)`);
    else console.log(`❌ ch${spec.ch}: repair FAILED — ${rep.reason} (restoreFailed=${rep.restoreFailed ?? false}, ${mins}min)`);
  }
  console.log("\n(done)");
}
main().catch((e) => { console.error("DRIVER ERROR:", e); process.exit(1); });
