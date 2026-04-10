#!/usr/bin/env node

import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

console.error(
  "validate-master.mjs is deprecated. Forwarding to scripts/book/validate-book.mjs (v12-sealed-only)."
);

const validatorPath = fileURLToPath(new URL("./validate-book.mjs", import.meta.url));
const result = spawnSync(process.execPath, [validatorPath, ...process.argv.slice(2)], {
  stdio: "inherit",
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
