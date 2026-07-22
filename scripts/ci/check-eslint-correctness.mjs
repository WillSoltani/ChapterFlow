import { readFileSync } from "node:fs";

// WS6-015: zero-tolerance correctness-rule subset for the lint ratchet. These
// rules ship at severity "warn" in eslint-config-next's default config, so
// eslint.config.mjs elevates them to "error" for this repo — this checker
// then fails CI on any hit regardless of the ratchet's overall error-count
// baseline (which tolerates some slack for stylistic rules).
const CORRECTNESS_RULES = new Set([
  "react-hooks/exhaustive-deps",
  "@typescript-eslint/no-unused-vars",
  "no-unused-vars",
  "@typescript-eslint/no-floating-promises",
]);

const report = JSON.parse(readFileSync(process.argv[2] ?? "eslint-report.json", "utf8"));
const hits = [];
for (const f of report) for (const m of f.messages ?? [])
  if (m.severity === 2 && CORRECTNESS_RULES.has(m.ruleId)) hits.push(`${f.filePath}:${m.line} ${m.ruleId}`);
if (hits.length) { for (const h of hits) console.error(h); process.exit(1); }
console.log("correctness subset clean");
