import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  CLAUDE_ROUTE_NOT_AVAILABLE_CODE,
  ClaudeRouteNotAvailableError,
  createCodexRoute,
  createRouteForRoleRoute,
  DEFAULT_MODEL_ROUTING_CONFIG_PATH,
  loadModelRoutingConfig,
  MODEL_ROUTING_OWNER_OVERRIDE_SENTINEL,
  checkModelRoutingTripwire,
  resolveRoleRoute,
  validateModelRoutingConfig,
  type ModelRoutingConfig,
  type RoleRoute,
} from "../../src/runtime/codexRoute.js";
import { validateAllConfigFiles } from "../../src/runtimeSchemas.js";
import { PIPELINE_ROOT } from "./baseline.js";
import { finishV25Tests, requiredTest } from "./harness.js";

function roleRoute(overrides: Partial<RoleRoute> = {}): RoleRoute {
  return { route: "codex", model: "gpt-5.5", effort: "high", ...overrides };
}

function baseConfig(overrides: Partial<ModelRoutingConfig> = {}): ModelRoutingConfig {
  return {
    defaultRoute: roleRoute(),
    ownerOverride: MODEL_ROUTING_OWNER_OVERRIDE_SENTINEL,
    ...overrides,
  };
}

// ── (a) role present → that role's route/model/effort resolved ─────────────

requiredTest("resolveRoleRoute: a present role resolves its own entry, not the default", () => {
  const review: RoleRoute = { route: "codex", model: "gpt-5.5", effort: "xhigh" };
  const config = baseConfig({
    defaultRoute: roleRoute({ effort: "high" }),
    roles: { review, author: roleRoute({ effort: "high" }) },
  });
  assert.deepEqual(resolveRoleRoute(config, "review"), review);
  assert.notDeepEqual(resolveRoleRoute(config, "review"), config.defaultRoute);
});

// ── (b) role absent → defaultRoute ──────────────────────────────────────────

requiredTest("resolveRoleRoute: role absent, undefined, or unknown falls through to defaultRoute", () => {
  const config = baseConfig({
    defaultRoute: roleRoute({ model: "gpt-5.5", effort: "medium" }),
    roles: { author: roleRoute({ effort: "high" }) },
  });
  assert.deepEqual(resolveRoleRoute(config, undefined), config.defaultRoute);
  assert.deepEqual(resolveRoleRoute(config), config.defaultRoute);
  assert.deepEqual(resolveRoleRoute(config, "not-a-configured-role"), config.defaultRoute);
});

// ── (c) config validates against schema ─────────────────────────────────────

requiredTest("shipped config/model-routing.json validates structurally and passes the tripwire", () => {
  const config = loadModelRoutingConfig();
  assert.equal(config.defaultRoute.route, "codex");
  assert.equal(typeof config.defaultRoute.model, "string");
  assert.equal(checkModelRoutingTripwire(config).length, 0);
});

requiredTest("shipped config/model-routing.json produces zero findings from the runtime config-contract sweep", () => {
  const configDir = resolve(PIPELINE_ROOT, "config");
  const findings = validateAllConfigFiles(configDir).filter((f) => f.path.startsWith("/model-routing.json"));
  assert.deepEqual(findings, [], findings.map((f) => f.message).join("\n"));
});

requiredTest("DEFAULT_MODEL_ROUTING_CONFIG_PATH points at the checked-in config file", () => {
  assert.equal(DEFAULT_MODEL_ROUTING_CONFIG_PATH, resolve(PIPELINE_ROOT, "config", "model-routing.json"));
});

requiredTest("validateModelRoutingConfig accepts a well-formed config and rejects malformed shapes", () => {
  const ok = validateModelRoutingConfig(baseConfig());
  assert.equal(ok.ok, true);

  const missingDefault = validateModelRoutingConfig({});
  assert.equal(missingDefault.ok, false);

  const badRouteValue = validateModelRoutingConfig(baseConfig({ defaultRoute: roleRoute({ route: "not-a-route" as never }) }));
  assert.equal(badRouteValue.ok, false);

  const badEffort = validateModelRoutingConfig(baseConfig({ defaultRoute: roleRoute({ effort: "ultra" as never }) }));
  assert.equal(badEffort.ok, false);

  const emptyModel = validateModelRoutingConfig(baseConfig({ defaultRoute: roleRoute({ model: "" }) }));
  assert.equal(emptyModel.ok, false);
});

// ── (d) frozen-policy tripwire: NO-GPT-5.5 without codex+ownerOverride ─────

requiredTest("tripwire: gpt-5.5* model on the codex route WITH the approved ownerOverride passes", () => {
  const config = baseConfig({
    defaultRoute: { route: "codex", model: "gpt-5.5", effort: "high" },
    ownerOverride: MODEL_ROUTING_OWNER_OVERRIDE_SENTINEL,
  });
  assert.deepEqual(checkModelRoutingTripwire(config), []);
  assert.equal(validateModelRoutingConfig(config).ok, true);
});

requiredTest("tripwire: gpt-5.5* model on the codex route WITHOUT ownerOverride fails", () => {
  const config = baseConfig({
    defaultRoute: { route: "codex", model: "gpt-5.5", effort: "high" },
    ownerOverride: undefined,
  });
  const violations = checkModelRoutingTripwire(config);
  assert.equal(violations.length, 1);
  assert.match(violations[0]!, /defaultRoute/);
  assert.equal(validateModelRoutingConfig(config).ok, false);
});

requiredTest("tripwire: gpt-5.5* model on the codex route with the WRONG ownerOverride string fails", () => {
  const config = baseConfig({
    defaultRoute: { route: "codex", model: "gpt-5.5", effort: "high" },
    ownerOverride: "some-other-approval",
  });
  assert.equal(checkModelRoutingTripwire(config).length, 1);
});

requiredTest("tripwire: gpt-5.5* model routed through claude-cli fails even with the approved ownerOverride", () => {
  const config = baseConfig({
    defaultRoute: { route: "claude-cli", model: "gpt-5.5", effort: "high" },
    ownerOverride: MODEL_ROUTING_OWNER_OVERRIDE_SENTINEL,
  });
  const violations = checkModelRoutingTripwire(config);
  assert.equal(violations.length, 1);
  assert.match(violations[0]!, /route:"codex"/);
});

requiredTest("tripwire: a non-gpt-5.5 model never trips, regardless of route or ownerOverride", () => {
  const config = baseConfig({
    defaultRoute: { route: "claude-cli", model: "claude-sonnet-5", effort: "high" },
    ownerOverride: undefined,
  });
  assert.deepEqual(checkModelRoutingTripwire(config), []);
});

requiredTest("tripwire: scans every per-role entry, not just defaultRoute", () => {
  const config = baseConfig({
    defaultRoute: { route: "claude-cli", model: "claude-sonnet-5", effort: "high" },
    roles: {
      research: { route: "claude-cli", model: "claude-sonnet-5", effort: "medium" },
      author: { route: "codex", model: "gpt-5.5", effort: "high" },
    },
    ownerOverride: undefined,
  });
  const violations = checkModelRoutingTripwire(config);
  assert.equal(violations.length, 1);
  assert.match(violations[0]!, /^author:/);
});

// ── Step 2: createCodexRoute parameterized; no fixed model/effort consts ───

requiredTest("createCodexRoute is parameterized: model and effort flow into the built args verbatim", () => {
  const route = createCodexRoute("gpt-5.5-test", "xhigh");
  const built = route.build({
    id: "read",
    workDirPolicy: "PIPELINE_ROOT",
    mode: "READ_ONLY",
    outputSchemaId: "text.v1",
    timeoutMs: 1,
    terminateGraceMs: 1,
    maxStdoutBytes: 1,
    maxStderrBytes: 1,
  });
  assert.equal(built.command, "codex");
  assert.equal(built.args.includes("model=gpt-5.5-test"), true);
  assert.equal(built.args.includes("model_reasoning_effort=xhigh"), true);

  const other = createCodexRoute("gpt-5.6-terra", "low");
  const builtOther = other.build({
    id: "read",
    workDirPolicy: "PIPELINE_ROOT",
    mode: "READ_ONLY",
    outputSchemaId: "text.v1",
    timeoutMs: 1,
    terminateGraceMs: 1,
    maxStdoutBytes: 1,
    maxStderrBytes: 1,
  });
  assert.equal(builtOther.args.includes("model=gpt-5.6-terra"), true);
  assert.equal(builtOther.args.includes("model_reasoning_effort=low"), true);
  assert.notDeepEqual(built.args, builtOther.args);
});

// ── Step 2: gateway construction selects route impl by the `route` field ──

requiredTest("createRouteForRoleRoute: route:\"codex\" builds a working ModelProcessRoute", () => {
  const route = createRouteForRoleRoute({ route: "codex", model: "gpt-5.5", effort: "high" });
  assert.equal(route.id, "codex-chatgpt-subscription-v1");
  const built = route.build({
    id: "read",
    workDirPolicy: "PIPELINE_ROOT",
    mode: "READ_ONLY",
    outputSchemaId: "text.v1",
    timeoutMs: 1,
    terminateGraceMs: 1,
    maxStdoutBytes: 1,
    maxStderrBytes: 1,
  });
  assert.equal(built.command, "codex");
});

requiredTest("createRouteForRoleRoute: route:\"claude-cli\" fails closed with ClaudeRouteNotAvailableError (Task 7 not landed)", () => {
  assert.throws(
    () => createRouteForRoleRoute({ route: "claude-cli", model: "claude-sonnet-5", effort: "high" }, "review"),
    (err: unknown) => {
      assert.ok(err instanceof ClaudeRouteNotAvailableError);
      assert.equal(err.code, CLAUDE_ROUTE_NOT_AVAILABLE_CODE);
      assert.match(err.message, /review/);
      assert.match(err.message, /Task 7/);
      return true;
    },
  );
});

requiredTest("createRouteForRoleRoute: claude-cli never silently falls back to codex", () => {
  let threw = false;
  try {
    createRouteForRoleRoute({ route: "claude-cli", model: "claude-sonnet-5", effort: "high" });
  } catch (err) {
    threw = true;
    assert.ok(err instanceof ClaudeRouteNotAvailableError);
  }
  assert.equal(threw, true, "claude-cli selection must throw, never construct a codex route as a silent fallback");
});

// ── loadModelRoutingConfig: fail-closed on disk-level problems ─────────────

requiredTest("loadModelRoutingConfig throws on missing file, malformed JSON, and schema/tripwire violations", () => {
  const dir = mkdtempSync(join(tmpdir(), "v4-model-routing-"));
  try {
    assert.throws(() => loadModelRoutingConfig(join(dir, "does-not-exist.json")), /unreadable/);

    const malformedPath = join(dir, "malformed.json");
    writeFileSync(malformedPath, "{ not json", "utf8");
    assert.throws(() => loadModelRoutingConfig(malformedPath), /unreadable/);

    const invalidPath = join(dir, "invalid.json");
    writeFileSync(invalidPath, JSON.stringify({ defaultRoute: { route: "codex", model: "gpt-5.5", effort: "high" } }), "utf8");
    assert.throws(() => loadModelRoutingConfig(invalidPath), /invalid/);

    const validPath = join(dir, "valid.json");
    writeFileSync(validPath, JSON.stringify(baseConfig()), "utf8");
    const loaded = loadModelRoutingConfig(validPath);
    assert.deepEqual(loaded, baseConfig());
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

finishV25Tests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
