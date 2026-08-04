/**
 * Sweep-driven scoped repairs (owner-authorized publish pass): break the two
 * book-wide stamps the sweep blocked on — the "After X, [role] lead [Name]
 * traces backward" example-opener skeleton (9/9) and the "Each Friday" weekly-
 * practice stamp (7/9). Repair-lane mechanics: scoped splice, full stack,
 * restore-on-failure. persona_drift was fixed deterministically beforehand.
 */
import { spawnSync } from "child_process";
import { readFileSync } from "fs";
import { doRepairOneChapter } from "../src/orchestrator/authorRepair.js";
import { resolveAuthorIo } from "../src/orchestrator/authorRun.js";
import { spawnCodexAgent } from "../src/orchestrator/codexAgent.js";
import type { RepairScope } from "../src/orchestrator/authorRepair.js";

const BOOK = "execution";
const FRIDAY_CHAPTERS = new Set([1, 2, 3, 6, 7, 8, 9]);

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
  const results: string[] = [];
  for (let n = 1; n <= 9; n++) {
    const ch = JSON.parse(readFileSync(`state/chapters/execution-ch0${n}.v21-native.chapter.json`, "utf8"));
    const exCount = (ch.examples ?? []).length;
    const scopes: RepairScope[] = Array.from({ length: exCount }, (_, i) => `examples[${i}]` as RepairScope);
    const complaints = [
      `book-wide stamp (sweep blocker scene_skeleton, 9/9 chapters): example scenarios across the WHOLE BOOK open with the same retrospective skeleton — "After X ends/holds, [role] lead [Name] traces/works backward…". Rewrite THIS chapter's example OPENING SENTENCES so none uses the after-the-fact trace-backward framing unless its dealt arc entry is 'aftermath-looking-back' (at most ONE may). Enter the others live: mid-action, at the demand, at the early signal — per each example's existing content. Change opening sentences only; keep each example's substance, people, facts, and lesson intact.`,
    ];
    if (FRIDAY_CHAPTERS.has(n)) {
      scopes.push("practice");
      complaints.push(`book-wide stamp (sweep blocker repeated_unit, 7/9 chapters): every weeklyPractice anchors on "Each Friday". Re-anchor THIS chapter's weeklyPractice to a different natural recurrence that fits its content (before a weekly meeting you already attend, when you close your task list, the first work morning of the week, after a recurring handoff) — keep the same practice substance and any dealt structure; do not touch tryThisNow unless it also says Friday.`);
    }
    console.log(`\n=== sweep repair ch0${n} (scopes: ${scopes.join(",")}) ===`);
    const r = await doRepairOneChapter(BOOK, n, deps, { io, scopes, complaints });
    results.push(`ch0${n}: ${r.ok ? "REPAIRED" : `KEPT-ORIGINAL (${(r.reason ?? "").slice(0, 120)})`}`);
    console.log(results[results.length - 1]);
  }
  console.log(`\nSUMMARY:\n${results.join("\n")}`);
})();
