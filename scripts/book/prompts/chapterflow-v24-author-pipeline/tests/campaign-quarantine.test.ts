/**
 * WP-202 — campaign-verb quarantine.
 *
 * The pilot-readiness / role-qualification / forward-attestation stack is retired
 * from the ship path by the S-tier program (ledger L-16/L-15). This suite proves:
 *   1. every gated readiness/qualification/attestation/forward-campaign subverb
 *      fails closed (exit 2 + the exact CLOSED notice) without `--campaign`, minting
 *      nothing and writing nothing;
 *   2. the explicit `--campaign` flag restores the exact prior behaviour (spot-checked
 *      on MODEL-FREE materializers — never a live run, per ledger L-22 corrective
 *      rules). Flag-only by design: the migration module reads no ambient env (a hard,
 *      statically-enforced invariant — see tests/migration-guards.test.ts);
 *   3. the core migration-experiment verbs, `status`, `close-legacy-campaign`,
 *      `retrospective`, and the rubric-audit (WP-401) verbs stay ungated;
 *   4. STATIC proof: no module runtime-reachable from the author-first ship path
 *      (autopilot / liveRun / promoteBook) imports the forward/readiness/
 *      qualification family — the item-4 proof-of-non-use guard.
 */

import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { tmpdir } from "node:os";

import { test } from "./harness.js";
import { PIPELINE_DIR } from "../src/bakeoff/paths.js";
import {
  CAMPAIGN_GATED_SUBVERBS,
  CAMPAIGN_QUARANTINE_NOTICE,
  runMigrationBakeoffCli,
} from "../src/bakeoff/migration/cli.js";

// ── console capture ──────────────────────────────────────────────────────────
async function capture(fn: () => Promise<number>): Promise<{ code: number; out: string; err: string }> {
  const out: string[] = [];
  const err: string[] = [];
  const oLog = console.log;
  const oErr = console.error;
  console.log = (...a: unknown[]) => { out.push(a.map(String).join(" ")); };
  console.error = (...a: unknown[]) => { err.push(a.map(String).join(" ")); };
  let code: number;
  try {
    code = await fn();
  } finally {
    console.log = oLog;
    console.error = oErr;
  }
  return { code, out: out.join("\n"), err: err.join("\n") };
}

function tmpDir(prefix: string): string {
  return mkdtempSync(resolve(tmpdir(), prefix));
}

// ── 1. every gated subverb fails closed without --campaign ───────────────────
test("WP-202: every gated campaign subverb fails closed without --campaign (exit 2 + notice, zero writes)", async () => {
  // Guard-only: the gate returns BEFORE any handler, so no subverb reaches a
  // writer or a (would-be) model call. We still pass write-triggering flags and a
  // temp state-root, then assert the temp dir stays EMPTY — proving nothing minted.
  assert.ok(CAMPAIGN_GATED_SUBVERBS.size >= 30, `expected the full family gated, got ${CAMPAIGN_GATED_SUBVERBS.size}`);
  for (const subverb of CAMPAIGN_GATED_SUBVERBS) {
    const root = tmpDir("cf-wp202-gate-");
    try {
      const { code, err } = await capture(() =>
        runMigrationBakeoffCli([subverb], {
          write: true,
          json: true,
          output: resolve(root, "out.json"),
          "state-root": root,
          "phase-dir": root,
        }),
      );
      assert.equal(code, 2, `${subverb} must exit 2 without --campaign`);
      assert.ok(err.includes(CAMPAIGN_QUARANTINE_NOTICE), `${subverb} must print the exact CLOSED notice`);
      assert.ok(err.includes(subverb), `${subverb} notice must name the subverb`);
      assert.deepEqual(readdirSync(root), [], `${subverb} must write nothing when gated`);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

// ── 2a. --campaign flag restores exact prior behaviour (MODEL-FREE materializer) ──
test("WP-202: --campaign flag restores prior behaviour on a model-free materializer (no write → exit 0)", async () => {
  const { code, out, err } = await capture(() =>
    runMigrationBakeoffCli(["forward-materialize-production-instrument-seal"], { campaign: true, json: true }),
  );
  assert.equal(code, 0, err);
  assert.ok(!err.includes(CAMPAIGN_QUARANTINE_NOTICE), "un-gated invocation must not print the CLOSED notice");
  // The dry (no --write) path emits the seal JSON with written=false; nothing persisted.
  const parsed = JSON.parse(out) as { written?: boolean; sealSha256?: string };
  assert.equal(parsed.written, false);
  assert.equal(typeof parsed.sealSha256, "string");
});

// ── 2b. flag un-gate on a second model-free materializer + no-flag still refuses ──
test("WP-202: --campaign un-gates a second model-free materializer (thresholds, no write → 0); absent flag refuses", async () => {
  const gated = await capture(() => runMigrationBakeoffCli(["imp24-materialize-thresholds"], { json: true }));
  assert.equal(gated.code, 2, "without --campaign the thresholds materializer is gated");
  assert.ok(gated.err.includes(CAMPAIGN_QUARANTINE_NOTICE));

  const ungated = await capture(() => runMigrationBakeoffCli(["imp24-materialize-thresholds"], { campaign: true, json: true }));
  assert.equal(ungated.code, 0, ungated.err);
  assert.ok(!ungated.err.includes(CAMPAIGN_QUARANTINE_NOTICE), "un-gated invocation must not print the CLOSED notice");
});

// The opt-in is flag-only: the migration module must never read ambient env for it
// (tests/migration-guards.test.ts enforces the broader no-process.env invariant; this
// pins the WP-202 helper specifically to the flag).
test("WP-202: the campaign opt-in is flag-only — the migration cli reads no env for it", () => {
  const src = readFileSync(resolve(SRC_ROOT, "bakeoff/migration/cli.ts"), "utf8");
  assert.ok(!src.includes("process.env"), "migration/cli.ts must not read process.env (spec/argv-driven)");
  assert.ok(!src.includes("CHAPTERFLOW_CAMPAIGN_VERBS"), "the opt-in must not be an ambient env var");
});

// ── 3. exempt verbs stay ungated ─────────────────────────────────────────────
test("WP-202: read-only status stays callable without --campaign", async () => {
  const { code, err } = await capture(() =>
    runMigrationBakeoffCli(["status"], { experiment: "zz-wp202-nonexistent-probe", json: true }),
  );
  assert.equal(code, 0, err);
  assert.ok(!err.includes(CAMPAIGN_QUARANTINE_NOTICE));
});

test("WP-202: close-legacy-campaign / retrospective are not gated (reach their own handler)", async () => {
  for (const subverb of ["close-legacy-campaign", "retrospective"]) {
    const { err } = await capture(() => runMigrationBakeoffCli([subverb], { json: true }));
    // Whatever the handler decides (0/1/2 depending on committed §16 artifacts), it
    // must NOT be short-circuited by the quarantine gate.
    assert.ok(!err.includes(CAMPAIGN_QUARANTINE_NOTICE), `${subverb} must not be gated`);
  }
});

test("WP-202: the core experiment verbs, exempt split-lane verbs, and rubric-audit (WP-401) verbs are NOT gated", () => {
  const ungated = [
    "plan", "seal", "qualify", "run", "analyze", "decide", "status",
    "close-legacy-campaign", "retrospective",
    // rubric-audit family — WP-401 owns these; WP-202 must not touch them.
    "reader-gold-dev-pool", "reader-gold-dev-docs", "rubric-audit-batch", "rubric-audit-report",
    "rubric-verify-owner-run", "rubric-audit-render-task", "rubric-audit-ingest",
    "rubric-audit-status", "assemble-audit-package",
  ];
  for (const verb of ungated) {
    assert.equal(CAMPAIGN_GATED_SUBVERBS.has(verb), false, `${verb} must NOT be gated by WP-202`);
  }
  // Sanity: representative campaign verbs ARE gated.
  for (const verb of [
    "pilot-role-readiness-v6", "role-qualification-freeze", "forward-pilot", "imp24-role-qualification-v3",
    "imp24e-schema-probes", "role-qualification-attest-calibration", "build-reader-corpus", "recovery-preflight",
  ]) {
    assert.equal(CAMPAIGN_GATED_SUBVERBS.has(verb), true, `${verb} MUST be gated by WP-202`);
  }
});

// ── 4. static import-closure guard (proof-of-non-use) ────────────────────────
/** Precise forward/readiness/qualification family. Matches the retired stack ONLY:
 *  the exec `cliQualification` and reviewer `judgeCapabilityQualification` modules
 *  (legitimate ship-path infra) do NOT match. */
const FORBIDDEN_FAMILY: RegExp[] = [
  /(^|\/)imp24/i,
  /roleQualification/i,
  /pilotRoleReadiness/i,
  /forwardPilotRoleReadiness/i,
  /forward.*RoleQualification/i,
  /forwardRoleAssignmentFreeze/i,
  /forwardValidationCampaign/i,
  /forwardActivation/i,
  /forwardInputFreeze/i,
  /forwardInputMaterialization/i,
  /forwardTransportSmoke/i,
  /forwardRetained/i,
];

const SRC_ROOT = resolve(PIPELINE_DIR, "src");

/** Runtime import edges only: whole-statement `import type … from` is elided by
 *  tsc and produces no runtime dependency, so it is not an edge. Value imports and
 *  dynamic `import()` are real runtime edges. */
function runtimeImportsOf(file: string): string[] {
  const specs: string[] = [];
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (/^\s*import\s+type\b/.test(line)) continue;
    const m = /from\s+["']([^"']+)["']/.exec(line);
    if (m && m[1].startsWith(".")) specs.push(m[1]);
    const dyn = /import\(\s*["']([^"']+)["']\s*\)/g;
    let d: RegExpExecArray | null;
    while ((d = dyn.exec(line))) if (d[1].startsWith(".")) specs.push(d[1]);
  }
  return specs;
}

function resolveSpec(fromFile: string, spec: string): string | null {
  const base = resolve(dirname(fromFile), spec.replace(/\.js$/, ""));
  for (const cand of [base + ".ts", base + ".tsx", resolve(base, "index.ts")]) {
    if (existsSync(cand)) return cand;
  }
  return null;
}

test("WP-202: the author-first ship path has ZERO runtime reach into the forward/readiness/qualification family", () => {
  const entries = ["orchestrator/autopilot.ts", "orchestrator/liveRun.ts", "promoteBook.ts"].map((f) => resolve(SRC_ROOT, f));
  for (const e of entries) assert.ok(existsSync(e), `ship-path entry missing: ${e}`);

  const seen = new Set<string>(entries);
  const parent = new Map<string, string>();
  const queue = [...entries];
  const hits: string[] = [];

  while (queue.length) {
    const file = queue.shift()!;
    const rel = file.slice(SRC_ROOT.length + 1);
    if (FORBIDDEN_FAMILY.some((p) => p.test(rel))) {
      const chain = [rel];
      let cur = file;
      while (parent.has(cur)) { cur = parent.get(cur)!; chain.unshift(cur.slice(SRC_ROOT.length + 1)); }
      hits.push(chain.join(" -> "));
      continue; // do not traverse into forbidden modules
    }
    for (const spec of runtimeImportsOf(file)) {
      const r = resolveSpec(file, spec);
      if (r && !seen.has(r)) { seen.add(r); parent.set(r, file); queue.push(r); }
    }
  }

  assert.deepEqual(hits, [], `ship path reaches the retired family:\n${hits.join("\n")}`);
  // Sanity: the closure is non-trivial (the analyzer actually walked the graph).
  assert.ok(seen.size > 100, `import closure implausibly small (${seen.size}) — analyzer likely broke`);
});
