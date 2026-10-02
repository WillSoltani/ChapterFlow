#!/usr/bin/env node
// Stand-in for the `claude` CLI. The first line of the prompt (stdin) picks the scenario.
import fs from "node:fs";

const argv = process.argv.slice(2);
const chunks = [];
for await (const c of process.stdin) chunks.push(c);
const prompt = Buffer.concat(chunks).toString("utf8");
const scenario = (prompt.split("\n")[0] ?? "").replace(/^SCENARIO\s+/, "").trim();

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
    console.error(`fake-claude: unknown scenario "${scenario}"`);
    process.exit(2);
}
