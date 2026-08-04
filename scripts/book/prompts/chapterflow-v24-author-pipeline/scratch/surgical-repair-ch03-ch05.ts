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
  3: [
    "practice: tryThisNow asks the reader to count how many of the seven behaviors are visible before the return pass — a meta-exercise nobody performs unprompted. The reusable action a reader would actually do: pick one live promise from today and write three things beside it — who owns it, what proof returns, and when it comes back.",
    "review cards: several cards quiz source-case recall (Welch/GE specifics) rather than the reusable tool. At most 2 cards may hinge on a named source case; every other card must be answerable by a reader applying the move to their own promises (e.g. 'What makes a promise inspectable?' → 'A named owner, a visible fact, and a return point.').",
  ],
  5: [
    "practice: the read-aloud script is stiff for a solo reader. The natural version is written, not spoken: complete the two blanks — 'This role gets hard when ___. I have seen this person handle that when ___.' — and if the second blank is empty, the choice is not ready.",
    "review cards: several cards quiz source-case recall (GE Session C / IBM / Home Depot specifics) rather than the reusable tool. At most 2 cards may hinge on a named source case; the rest must drill role-fit as the reader would use it (e.g. 'What should you ask before putting a name beside a hard role?' → 'What will the role strain first, and what behavior have we already seen under that strain?').",
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
  for (const n of [3, 5]) {
    console.log(`\n=== surgical repair ch0${n} (scopes: practice, reviewCards) ===`);
    try { { const lin = computeRegenLineage(BOOK, n); if (lin) recordRepairConsumed(BOOK, n, lin); }; } catch (e) { console.log(`ledger: ${(e as Error).message}`); }
    const r = await doRepairOneChapter(BOOK, n, deps, { io, scopes: ["practice", "reviewCards"], complaints: COMPLAINTS[n] });
    console.log(`ch0${n}: ${r.ok ? "REPAIRED (spliced + gate + preflight + contract clean)" : `REJECTED-RESTORED: ${r.reason}`}`);
    if (!r.ok) process.exitCode = 1;
  }
})();
