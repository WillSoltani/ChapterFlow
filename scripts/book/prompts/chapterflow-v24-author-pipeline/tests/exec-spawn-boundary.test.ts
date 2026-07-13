/**
 * IMP-00: static spawn-boundary scan.
 *
 * Three invariants, enforced against the SOURCE so a new call site cannot
 * regress them silently:
 *
 *  1. Every production spawn-options literal declares an agent `role:` (or is a
 *     pure `...opts` forwarder whose origin already declared one). A role is
 *     what activates the hermetic envelope — a role-less real spawn throws at
 *     runtime, and this scan catches it at review time.
 *  2. Only the known proxy files may call `spawnCodexAgent` directly; everything
 *     else routes through `AutopilotDeps.spawn` so tests can inject runners and
 *     IMP-02 can interpose routing policy at one seam.
 *  3. `codexAgent.ts` spreads the parent environment exactly once — in the
 *     legacy injected-runner branch. The hermetic path builds its env from the
 *     allowlist; a second `...process.env` anywhere is an envelope breach.
 */

import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { test } from "./harness.js";
import { PIPELINE_DIR } from "./helpers.js";

const SRC = join(PIPELINE_DIR, "src");

function walkTs(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walkTs(full));
    else if (name.endsWith(".ts")) out.push(full);
  }
  return out;
}

/** Spawn-literal openers that ORIGINATE agent work (object literal follows). */
const SPAWN_OPENERS = [/\bdeps\.spawn\(\{/g, /\bjdeps\.spawn\(\{/g, /\bspawnCodexAgent\(\{/g, /\bd\.spawn\(\{/g];

/** Files allowed to call spawnCodexAgent directly (everything else uses deps). */
const DIRECT_SPAWN_ALLOWLIST = new Set([
  "src/orchestrator/codexAgent.ts",
  "src/orchestrator/autopilot.ts",   // resolveDeps default binding only
  // IMP-22 live qualification is a sealed broker boundary: it proves the
  // ChatGPT route before execution, uses forwardReviewerExecutor for the exact
  // model/effort profile, and persists REQUESTED + receipt evidence around the
  // direct call. Routing it through legacy AutopilotDeps would bypass that
  // phase-local crash-safe ledger.
  "src/orchestrator/forwardRoleQualificationLive.ts",
  // The forward pilot/gold boundary likewise records REQUESTED before the
  // exact sealed evaluator spawn, validates the typed result, and retains the
  // receipt before any downstream call. It cannot use the legacy autopilot
  // broker without losing that experiment-local ledger and resume contract.
  "src/orchestrator/forwardLiveValidationDriver.ts",
  "src/review/evalReaderProxy.ts",
  "src/review/evalBookProxy.ts",
  "src/cli.ts",
]);

test("every production spawn literal declares role: (or forwards an opts object that did)", () => {
  const offenders: string[] = [];
  for (const file of walkTs(SRC)) {
    const text = readFileSync(file, "utf8");
    for (const opener of SPAWN_OPENERS) {
      opener.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = opener.exec(text)) !== null) {
        const litStart = m.index + m[0].length;
        const window = text.slice(litStart, litStart + 2000);
        const isForwarder = window.trimStart().startsWith("...");
        const declaresRole = /\brole:\s*["']/.test(window.slice(0, window.indexOf("})") === -1 ? 2000 : window.indexOf("})") + 2));
        if (!isForwarder && !declaresRole) {
          const line = text.slice(0, m.index).split("\n").length;
          offenders.push(`${relative(PIPELINE_DIR, file)}:${line}`);
        }
      }
    }
  }
  assert.deepEqual(offenders, [], `spawn literals missing role:\n${offenders.join("\n")}`);
});

test("spawnCodexAgent is imported for calls only inside the allowlisted proxy files", () => {
  const offenders: string[] = [];
  for (const file of walkTs(SRC)) {
    const rel = relative(PIPELINE_DIR, file).replace(/\\/g, "/");
    const text = readFileSync(file, "utf8");
    if (/\bspawnCodexAgent\(/.test(text) && !DIRECT_SPAWN_ALLOWLIST.has(rel)) {
      offenders.push(rel);
    }
  }
  assert.deepEqual(offenders, [], `unexpected direct spawnCodexAgent callers:\n${offenders.join("\n")}`);
});

test("codexAgent.ts spreads process.env exactly once (the legacy test-double branch)", () => {
  const text = readFileSync(join(SRC, "orchestrator", "codexAgent.ts"), "utf8");
  const spreads = text.match(/\.\.\.process\.env/g) ?? [];
  assert.equal(spreads.length, 1, "the hermetic path must build env from the allowlist, never the full parent env");
});

test("no production source hardcodes the SOL model as a default route (IMP-02 owns any future change)", () => {
  const offenders: string[] = [];
  for (const file of walkTs(SRC)) {
    const rel = relative(PIPELINE_DIR, file).replace(/\\/g, "/");
    const text = readFileSync(file, "utf8");
    // Flag DEFAULT bindings to SOL (?? "gpt-5.6..." / = "gpt-5.6..." on env fallbacks),
    // not mere mentions (bakeoff candidate LISTS may name it explicitly as experiment input).
    if (/\?\?\s*["']gpt-5\.6/.test(text) || /defaultModel:\s*["']gpt-5\.6/.test(text)) {
      offenders.push(rel);
    }
  }
  assert.deepEqual(offenders, [], `SOL must not be a silent default before qualification:\n${offenders.join("\n")}`);
});
