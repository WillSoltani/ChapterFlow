import assert from "node:assert/strict";

import { CommandRegistry } from "../src/commands/commandRegistry.js";
import type { CommandSpec } from "../src/commands/commandSpec.js";
import { test } from "./harness.js";

const run: CommandSpec["run"] = async () => ({ ok: true, value: 7 });

test("CommandRegistry registers and resolves frozen command spec shape", async () => {
  const registry = new CommandRegistry();
  const spec: CommandSpec = { id: "status", requiredConfig: [], mode: "READ", run };
  registry.register(spec);
  assert.strictEqual(registry.resolve("status"), spec);
  assert.deepEqual(await registry.resolve("status")!.run({
    argv: ["status"], sourceGitSha: "fixture-sha", abortSignal: new AbortController().signal,
  }), { ok: true, value: 7 });
  assert.equal(registry.resolve("missing"), undefined);
});

test("CommandRegistry rejects duplicate IDs at registration", () => {
  const registry = new CommandRegistry();
  registry.register({ id: "same", requiredConfig: ["runtime"], mode: "WRITE", run });
  assert.throws(
    () => registry.register({ id: "same", requiredConfig: [], mode: "READ", run }),
    /duplicate command spec: same/,
  );
});
