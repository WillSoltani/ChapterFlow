import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { test } from "./harness.js";
import { AnthropicApiProvider, anthropicModelOmitsSamplingFields } from "../src/providers/anthropic-api.js";
import { ClaudeCliProvider } from "../src/providers/cli.js";
import { OpenAiApiProvider } from "../src/providers/openai-api.js";
import { callModel, defaultModelForProviderName, pingProvider, selectProvider } from "../src/providers/router.js";
import type { CallOptions } from "../src/providers/types.js";

const CALL = { tier: "writer", system: "system", user: "user" } as const satisfies CallOptions;
const DISABLED = /LEGACY_ROUTE_DISABLED:V4_APPLICATION_ROUTE_REQUIRED/;

test("legacy provider selection and direct call are stable disabled", async () => {
  await assert.rejects(selectProvider(CALL), DISABLED);
  await assert.rejects(callModel(CALL), DISABLED);
  assert.deepEqual(await pingProvider(), {
    ok: false,
    provider: "anthropic-cli",
    model: "disabled",
    message: "LEGACY_ROUTE_DISABLED:V4_APPLICATION_ROUTE_REQUIRED:providers.pingProvider",
  });
});

test("all provider adapters report unavailable and reject before execution", async () => {
  for (const provider of [ClaudeCliProvider, AnthropicApiProvider, OpenAiApiProvider]) {
    assert.equal(provider.isConfigured(), false);
    await assert.rejects(provider.call({ ...CALL, model: provider.defaultModelForTier("writer") }), DISABLED);
  }
});

test("retained provider helpers are pure data only", () => {
  assert.equal(defaultModelForProviderName("anthropic-cli", "writer"), "claude-opus-4-7");
  assert.equal(defaultModelForProviderName("anthropic-api", "critic"), "claude-haiku-4-5-20251001");
  assert.equal(defaultModelForProviderName("openai-api", "researcher"), "gpt-4o-mini");
  assert.equal(anthropicModelOmitsSamplingFields("claude-opus-4-7"), true);
});

test("disabled adapters contain no SDK dynamic import or subprocess route", () => {
  for (const path of ["src/providers/router.ts", "src/providers/cli.ts", "src/providers/anthropic-api.ts", "src/providers/openai-api.ts"]) {
    const source = readFileSync(resolve(process.cwd(), path), "utf8");
    assert.doesNotMatch(source, /import\(["'](?:openai|@anthropic-ai\/sdk)["']\)|node:child_process|\bspawn\s*\(/);
  }
});
