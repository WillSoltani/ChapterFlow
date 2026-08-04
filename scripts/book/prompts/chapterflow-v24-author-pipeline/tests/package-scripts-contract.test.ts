/**
 * package.json npm-script contract: the V4 entrypoint (`book-run` /
 * `book-autopilot`) must be reachable via `npm run`, and no npm script may
 * invoke a LEGACY_DISABLED cli command (see cli.ts LEGACY_DISABLED_COMMANDS).
 */

import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { test } from "./harness.js";

const pkg = JSON.parse(
  readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "..", "package.json"), "utf8"),
);

// Mirror of cli.ts LEGACY_DISABLED_COMMANDS.
const DISABLED = new Set(["ping", "pipeline", "flow", "generate-book", "generate"]);

test("book-run and book-autopilot have npm wrappers", () => {
  assert.match(pkg.scripts["book-run"], /src\/cli\.ts book-run/);
  assert.match(pkg.scripts["book-autopilot"], /src\/cli\.ts book-autopilot/);
});

test("no npm script invokes a LEGACY_DISABLED command", () => {
  for (const [name, cmd] of Object.entries(pkg.scripts as Record<string, string>)) {
    const m = cmd.match(/src\/cli\.ts (\S+)/);
    if (m) assert.ok(!DISABLED.has(m[1]), `script "${name}" invokes disabled command "${m[1]}"`);
  }
});
