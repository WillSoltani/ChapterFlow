/**
 * Owner-authorized surgical polish (plan docs/v24/PUBLISH-CALIBRATION-PLAN §D):
 * drive the repair lane's own machinery (doRepairOneChapter — patch-apply splice,
 * full deterministic stack, restore-on-failure) over ch03+ch05 with the external
 * review's field-scoped defects. Scopes: practice + reviewCards. Prose untouched.
 * Changed hashes get fresh blinded reviews at the next conductor entry.
 */
import { spawnSync } from "child_process";
import { doRepairOneChapter } from "../src/orchestrator/authorRepair.js";
import { resolveAuthorIo } from "../src/orchestrator/authorRun.js";
import { spawnCodexAgent } from "../src/orchestrator/codexAgent.js";
import { computeRegenLineage, recordRepairConsumed } from "../src/orchestrator/authorRegenLedger.js";

const BOOK = "execution";

const COMPLAINTS: Record<number, string[]> = {
  1: [
    "quiz Q1: the PROMPT and the KEY are misaligned — the prompt asks 'Which earlier choice caused the failure?' but the keyed answer describes the missing REMEDY (build a repeatable pass), which is not an 'earlier choice' at all; meanwhile the reward-the-hero distractor genuinely IS an earlier choice that causes recurrence, so two blind key-derivators hesitated between them. Fix by REPHRASING THE PROMPT so the stored key is the single direct answer (e.g. ask what would have prevented the miss from returning), keeping the same choices, the same correctIndex, and the reward-the-hero option as a tempting-but-wrong answer. Do not change any other question.",
  ],
};

const deps = {
  log: (m: string) => console.log(m),
  logSession: (_b: string, label: string, r: unknown) => { console.log(`[session] ${label}: exit=${(r as { exitCode?: number })?.exitCode}`); },
  spawn: (opts: Parameters<typeof spawnCodexAgent>[0]) => spawnCodexAgent(opts),
  runVerb: async (args: string[]) => {
    const r = spawnSync("npx", ["tsx", "src/cli.ts", ...args], { cwd: process.cwd(), encoding: "utf8", timeout: 600_000 });
    return { ok: r.status === 0, exitCode: r.status ?? 1, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
  },
} as never;

(async () => {
  const io = resolveAuthorIo();
  for (const n of [1]) {
    console.log(`\n=== key-alignment repair ch0${n} (scope: quiz) ===`);
    try { { const lin = computeRegenLineage(BOOK, n); if (lin) recordRepairConsumed(BOOK, n, lin); }; } catch (e) { console.log(`ledger: ${(e as Error).message}`); }
    const r = await doRepairOneChapter(BOOK, n, deps, { io, scopes: ["quiz"], complaints: COMPLAINTS[n] });
    console.log(`ch0${n}: ${r.ok ? "REPAIRED (spliced + gate + preflight + contract clean)" : `REJECTED-RESTORED: ${r.reason}`}`);
    if (!r.ok) process.exitCode = 1;
  }
})();
