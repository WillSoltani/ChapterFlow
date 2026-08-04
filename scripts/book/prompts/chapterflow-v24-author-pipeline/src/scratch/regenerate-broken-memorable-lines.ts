#!/usr/bin/env tsx

import { MODEL_TASK_RUNNER_REQUIRED } from "../app/modelTaskRunner.js";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Disabled until WP-V4-018 supplies app-owned runner/context per chapter. */
export async function main(): Promise<never> {
  throw new Error(`SCRATCH_DISABLED:${MODEL_TASK_RUNNER_REQUIRED}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
