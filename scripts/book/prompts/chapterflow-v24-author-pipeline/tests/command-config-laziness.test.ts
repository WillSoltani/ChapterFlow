import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { test } from "./harness.js";

const cli = readFileSync(resolve(process.cwd(), "src/cli.ts"), "utf8");

test("every accepted CLI switch token has explicit registered command ID", () => {
  const idsBlock = cli.slice(cli.indexOf("const COMMAND_IDS"), cli.indexOf("] as const;", cli.indexOf("const COMMAND_IDS")));
  const ids = new Set([...idsBlock.matchAll(/"([a-z0-9-]+)"/g)].map((match) => match[1]));
  const switchBlock = cli.slice(cli.indexOf("async function runExistingCommand"), cli.indexOf("async function main()"));
  const cases = [...switchBlock.matchAll(/case "([a-z0-9-]+)"/g)].map((match) => match[1]);
  assert.ok(cases.length > 100, `expected complete legacy switch, got ${cases.length}`);
  assert.deepEqual(cases.filter((id) => !ids.has(id)), []);
  assert.match(cli, /cmd === undefined \|\| cmd === "--help" \|\| cmd === "-h" \? "help"/);
});

test("READ routes skip config while WRITE and MODEL routes declare runtime bundle", () => {
  assert.match(cli, /mode === "READ" \? \[\] : \["runtime"\]/);
  assert.match(cli, /const spec = commandRegistry\.resolve\(id\)/);
  assert.match(cli, /if \(!spec\) \{\s*console\.error\(`Unknown command:/);
  assert.doesNotMatch(cli, /if \(!spec\) return runExistingCommand/);
  assert.match(cli, /if \(spec\.requiredConfig\.includes\("runtime"\)\) \{\s*const configFindings = validateAllConfigFiles\(\s*typeof flags\["config-dir"\] === "string" \? flags\["config-dir"\] : undefined,\s*\)/);
  const reads = cli.slice(cli.indexOf("const READ_COMMANDS"), cli.indexOf("const MODEL_COMMANDS"));
  for (const id of ["help", "doctor", "book-status", "qc-status", "state-status"]) assert.match(reads, new RegExp(`"${id}"`));
});
