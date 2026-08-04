import assert from "node:assert/strict";
import { readFileSync } from "fs";
import { resolve } from "path";

import { test } from "./harness.js";
import { PIPELINE_DIR } from "./helpers.js";

test("qc-auto PASS output points to publish-after-qc dry-run, not raw promote-book", () => {
  const cli = readFileSync(resolve(PIPELINE_DIR, "src/cli.ts"), "utf8");
  const start = cli.indexOf('const passLabel = isSubset ? "QC AUTO PASS (SUBSET)" : "QC AUTO PASS";');
  assert.notEqual(start, -1, "could not find canonical full/subset QC AUTO PASS output block");
  const end = cli.indexOf('if (result.outcome === "QC_STATUS_FAIL")', start);
  assert.notEqual(end, -1, "could not find end of QC AUTO PASS output block");
  const block = cli.slice(start, end);
  assert.match(block, /publish-after-qc/, "qc-auto success path must route through publish-after-qc");
  assert.match(block, /--dry-run/, "qc-auto success path must tell operators to dry-run publish-after-qc first");
  assert.doesNotMatch(block, /promote-book/, "qc-auto success path must not teach raw promote-book as the next publish step");
});
