/**
 * IMP-11 — the migration firewall (no-promotion / no-canonical-write /
 * no-verb / one-attempt), including the STATIC proof over the migration
 * sources themselves.
 */

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { test } from "./harness.js";
import { PIPELINE_DIR } from "../src/bakeoff/paths.js";
import {
  assertNotCanonical,
  assertOneAttemptOpts,
  FORBIDDEN_MIGRATION_IMPORT_PATTERNS,
  MigrationGuardError,
  migrationForbiddenTokens,
  migrationRoots,
  rootedPath,
  rootedWrite,
  withMigrationGuards,
} from "../src/bakeoff/migration/guards.js";
import type { ExperimentSpecV1 } from "../src/bakeoff/migration/experimentTypes.js";
import { tmpRoot, fakeAutopilotDeps } from "./model-bakeoff-helpers.js";
import type { AutopilotDeps } from "../src/orchestrator/autopilot.js";

const MIGRATION_SRC = resolve(PIPELINE_DIR, "src", "bakeoff", "migration");

function specFixture(): ExperimentSpecV1 {
  return {
    schema: "migration-experiment-spec-v1",
    experimentId: "exp-guards",
    stage: "confirmatory",
    title: "t",
    cells: [
      { cellId: "55-H", model: "gpt-5.5", effort: "high", stackId: "sol-native-v25" },
      { cellId: "56S-H", model: "gpt-5.6-sol", effort: "high", stackId: "sol-native-v25" },
    ],
    stacks: [{ id: "sol-native-v25", source: "current-builders" }],
    books: [],
    samplesPerCell: 2,
    screening: { samplesPerCell: 2, expandWhen: [], maxSamplesPerCell: 2 },
    randomizationSeed: "s",
    judgePanel: [{ model: "gpt-5.5", effort: "high" }],
    thresholdsRelPath: "x",
    priceSnapshot: { "gpt-5.5": null, "gpt-5.6-sol": null },
    precision: { primaryEndpoints: [] },
    stopping: { rules: ["never-expand"] },
    infraReplay: { maxPerSample: 1, replayableOutcomes: ["infrastructure_failure"] },
  };
}

test("rooted writes stay inside the experiment root and refuse every canonical tree", () => {
  const roots = migrationRoots("exp-guards", tmpRoot("cf-mig-guards-"));
  rootedWrite(roots, resolve(roots.runRoot, "ok.json"), "{}");
  assert.throws(() => rootedWrite(roots, resolve(roots.runRoot, "..", "escape.json"), "{}"), MigrationGuardError);
  assert.throws(() => rootedPath(roots, "..", "..", "escape"), MigrationGuardError);
  for (const canonical of ["state/chapters/x.chapter.json", "state/provenance/p.json", "state/books/b.json", "book-packages/x.json"]) {
    assert.throws(() => assertNotCanonical(resolve(PIPELINE_DIR, canonical)), MigrationGuardError, canonical);
  }
  // Defense in depth: even a root misconfigured INTO a canonical tree refuses.
  const evilRoots = migrationRoots("evil", resolve(PIPELINE_DIR, "state", "chapters"));
  assert.throws(() => rootedWrite(evilRoots, resolve(evilRoots.runRoot, "x.json"), "{}"), MigrationGuardError);
});

test("withMigrationGuards strips the CLI-verb capability entirely", async () => {
  const deps = withMigrationGuards(fakeAutopilotDeps() as AutopilotDeps);
  await assert.rejects(() => deps.runVerb(["qc-converge", "some-book"]), MigrationGuardError);
  await assert.rejects(() => deps.runVerb(["promote-book", "some-book"]), MigrationGuardError);
});

test("assertOneAttemptOpts enforces first-write-only, no complaint feedback", () => {
  assert.throws(() => assertOneAttemptOpts({}), MigrationGuardError);
  assert.throws(() => assertOneAttemptOpts({ firstWriteOnly: false }), MigrationGuardError);
  assert.throws(() => assertOneAttemptOpts({ firstWriteOnly: true, complaints: ["fix X"] }), MigrationGuardError);
  assertOneAttemptOpts({ firstWriteOnly: true });
  assertOneAttemptOpts({ firstWriteOnly: true, complaints: [] });
});

test("migrationForbiddenTokens covers models, family suffixes, stacks, cells, and stage vocabulary", () => {
  const tokens = migrationForbiddenTokens(specFixture());
  for (const expected of ["gpt-5.6-sol", "gpt-5-6-sol", "sol", "56s-h", "sol-native-v25", "legacy-v24", "exp-guards", "migration-experiment"]) {
    assert.ok(tokens.includes(expected), `forbidden tokens include ${expected}`);
  }
});

// ── STATIC proof (verification #4): the migration sources cannot reach
// promotion/publish/provenance/delegation surfaces, have no verb call sites,
// no ambient env reads, and no book-specific literals. guards.ts is the
// pattern-definition site and is scanned separately. ─────────────────────────

test("static: migration sources contain no promotion/publish/delegation identifiers", () => {
  const files = readdirSync(MIGRATION_SRC).filter((f) => f.endsWith(".ts"));
  assert.ok(files.length >= 10, `migration module family present (${files.length} files)`);
  for (const f of files) {
    if (f === "guards.ts") continue; // the definition site of the forbidden list
    const text = readFileSync(resolve(MIGRATION_SRC, f), "utf8");
    for (const pattern of FORBIDDEN_MIGRATION_IMPORT_PATTERNS) {
      assert.ok(!text.includes(pattern), `${f} must not contain "${pattern}"`);
    }
    assert.ok(!text.includes(".runVerb("), `${f} must not call runVerb (the harness has no verb capability)`);
    for (const line of text.split("\n").filter((l) => /^import .* from "/.test(l.trim()))) {
      assert.ok(!/promotion|publish|deploy/i.test(line), `${f} import line is promotion/publish-free: ${line.trim()}`);
    }
  }
});

test("static: migration sources read no ambient environment and hardcode no book identity", () => {
  const files = readdirSync(MIGRATION_SRC).filter((f) => f.endsWith(".ts"));
  for (const f of files) {
    const text = readFileSync(resolve(MIGRATION_SRC, f), "utf8");
    assert.ok(!text.includes("process.env"), `${f} must not read process.env (spec-driven, never ambient)`);
    if (f !== "guards.ts") {
      assert.ok(!text.includes("state/books"), `${f} must not reference the canonical books tree`);
      assert.ok(!text.includes("state/chapters"), `${f} must not reference the canonical chapters tree`);
    }
  }
  // Pure analysis modules additionally perform no filesystem IO at all.
  for (const pure of ["prng.ts", "stats.ts", "thresholds.ts", "metrics.ts", "schedule.ts", "experimentTypes.ts"]) {
    const text = readFileSync(resolve(MIGRATION_SRC, pure), "utf8");
    for (const io of ["readFileSync", "writeFileSync", "mkdirSync", "existsSync", "readdirSync"]) {
      assert.ok(!text.includes(io), `${pure} is pure — no ${io}`);
    }
  }
});
