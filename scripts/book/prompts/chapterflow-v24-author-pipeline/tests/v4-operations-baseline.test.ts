import assert from "node:assert/strict";

import { test } from "./harness.js";
import { BASELINE_UNAVAILABLE, operationsBaseline } from "../src/app/operationsBaseline.js";

test("operations baseline copies descriptive versions environment counts durations and routes", () => {
  const input = {
    versions: { node: "20.20.0", npm: "10.8.2" },
    environment: { platform: process.platform, ci: BASELINE_UNAVAILABLE },
    fileCounts: { ordinary: 311, v25: 27 },
    caseCounts: { lifecycle: 9 },
    durationsMs: { ordinary: 1_234, v25: 567 },
    routeCounts: { live: 0, legacyBypass: 0 },
  } as const;
  const baseline = operationsBaseline(input);
  assert.deepEqual(baseline, { schemaVersion: "1", ...input });
  assert.notEqual(baseline.versions, input.versions);
  assert.notEqual(baseline.routeCounts, input.routeCounts);
});

test("unavailable baseline values remain descriptive and expose no readiness outcome", () => {
  const baseline = operationsBaseline({
    versions: { node: BASELINE_UNAVAILABLE },
    environment: { host: BASELINE_UNAVAILABLE },
    fileCounts: { ordinary: BASELINE_UNAVAILABLE },
    caseCounts: { lifecycle: BASELINE_UNAVAILABLE },
    durationsMs: { ordinary: BASELINE_UNAVAILABLE },
    routeCounts: { live: BASELINE_UNAVAILABLE },
  });
  assert.equal(baseline.durationsMs.ordinary, "UNAVAILABLE");
  assert.equal(baseline.routeCounts.live, "UNAVAILABLE");
  assert.equal("outcome" in baseline, false);
  assert.equal("ready" in baseline, false);
});
