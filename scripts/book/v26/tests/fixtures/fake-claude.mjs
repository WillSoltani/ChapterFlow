#!/usr/bin/env node
// Stand-in for the `claude` CLI. The first line of the prompt (stdin) picks the scenario.
//
// Scenarios named "pipe-<step>" are scripted by the pipeline tests. FAKE_PIPE_DIR holds script.json:
//   { "pipe-write": [ { result: <object | string>, cost?: <usd>, usage?: true, delay?: <ms> }, ... ], ... }
// The Nth call of a scenario answers with entry N (the last entry repeats). Each call is recorded in
// FAKE_PIPE_DIR/<scenario>.<N>.call.json as { scenario, index, effort, prompt }; the file doubles as the
// atomic claim on index N, so calls running in parallel never share one.
// A prompt whose first line is not "SCENARIO ..." is matched by what it says, so the real templates
// in scripts/book/v26/prompts can be run through the same script.
import fs from "node:fs";
import path from "node:path";

const argv = process.argv.slice(2);
const chunks = [];
for await (const c of process.stdin) chunks.push(c);
const prompt = Buffer.concat(chunks).toString("utf8");
const firstLine = prompt.split("\n")[0] ?? "";
const REAL_TEMPLATES = [
  [/writing one chapter/, "pipe-write"],
  [/fact checker/, "pipe-factcheck"],
  [/taking the quiz/, "pipe-keysolve"],
  [/ordinary reader/, "pipe-coldreader"],
  [/multiple-choice/, "pipe-nochapter"],
  [/^You wrote the/, "pipe-fix"],
  [/strict editor/, "pipe-review"],
];
const scenario =
  !/^SCENARIO\s/.test(firstLine) && process.env.FAKE_PIPE_DIR
    ? (REAL_TEMPLATES.find(([re]) => re.test(firstLine))?.[1] ?? firstLine.trim())
    : firstLine.replace(/^SCENARIO\s+/, "").trim();

if (process.env.FAKE_CLAUDE_LOG) {
  const entry = { argv, envKeys: Object.keys(process.env), cwd: process.cwd() };
  fs.appendFileSync(process.env.FAKE_CLAUDE_LOG, JSON.stringify(entry) + "\n");
}

const ok = () => ({
  type: "result",
  is_error: false,
  result: '```json\n{"hello":1}\n```',
  stop_reason: "end_turn",
  total_cost_usd: 0.25,
  usage: { output_tokens: 10 },
});
const truncated = () => ({ ...ok(), result: '{"hello":', stop_reason: "max_tokens" });
const effort = argv[argv.indexOf("--effort") + 1];

function usageLimit() {
  console.log(
    JSON.stringify({ type: "result", is_error: true, result: "Claude AI usage limit reached", api_error_status: 429, total_cost_usd: 0 }),
  );
  process.exit(1);
}

async function pipe(name) {
  const dir = process.env.FAKE_PIPE_DIR;
  const script = JSON.parse(fs.readFileSync(path.join(dir, "script.json"), "utf8"));
  const entries = script[name];
  if (!Array.isArray(entries) || entries.length === 0) {
    console.error(`fake-claude: no script for "${name}"`);
    process.exit(2);
  }
  let index = 0;
  for (;; index++) {
    try {
      fs.writeFileSync(path.join(dir, `${name}.${index}.call.json`), JSON.stringify({ scenario: name, index, effort, prompt }), { flag: "wx" });
      break;
    } catch (e) {
      if (e.code !== "EEXIST") throw e;
    }
  }
  const entry = entries[Math.min(index, entries.length - 1)];
  if (entry.delay) await new Promise((resolve) => setTimeout(resolve, entry.delay));
  if (entry.usage) usageLimit();
  const result = typeof entry.result === "string" ? entry.result : JSON.stringify(entry.result);
  console.log(JSON.stringify({ ...ok(), result, total_cost_usd: entry.cost ?? 0.25 }));
}

function garbage() {
  process.stdout.write("not json");
  process.exit(1);
}

switch (scenario) {
  case "ok":
    console.log(JSON.stringify(ok()));
    break;
  case "usage":
    console.log(
      JSON.stringify({
        type: "result",
        is_error: true,
        result: "Claude AI usage limit reached",
        api_error_status: 429,
        total_cost_usd: 0,
      }),
    );
    process.exit(1);
    break;
  case "maxtokens":
    console.log(JSON.stringify(effort === "high" ? truncated() : ok()));
    break;
  case "maxtokens-always":
    console.log(JSON.stringify(truncated()));
    break;
  case "garbage":
    garbage();
    break;
  case "garbage-once": {
    const state = process.env.FAKE_CLAUDE_STATE;
    if (state && !fs.existsSync(state)) {
      fs.writeFileSync(state, "1");
      garbage();
    }
    console.log(JSON.stringify(ok()));
    break;
  }
  case "hang":
    setInterval(() => {}, 1000); // keeps the process alive until the caller kills it
    break;
  default:
    if (scenario.startsWith("pipe-") && process.env.FAKE_PIPE_DIR) {
      await pipe(scenario);
      break;
    }
    console.error(`fake-claude: unknown scenario "${scenario}"`);
    process.exit(2);
}
