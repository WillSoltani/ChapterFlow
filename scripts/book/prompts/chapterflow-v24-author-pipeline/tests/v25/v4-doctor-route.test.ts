import assert from "node:assert/strict";
import { resolve } from "node:path";

import { checkV4Route } from "../../src/lifecycle/doctor.js";
import { PIPELINE_ROOT } from "./baseline.js";
import { finishV25Tests, requiredTest } from "./harness.js";

requiredTest("checkV4Route reports the 3 checks; model-cli SKIPs under the hermetic no-API guard", async ({ roots }) => {
  assert.equal(process.env.CHAPTERFLOW_NO_API_CODEX_QC, "1", "this suite runs hermetic — the CLI preflight must never spawn a real CLI");

  const v25Root = resolve(roots.tempRoot, "v4-route-check");
  const attemptRoot = resolve(roots.attemptsRoot, "v4-route-check");
  const findings = await checkV4Route({ pipelineRoot: PIPELINE_ROOT, v25Root, attemptRoot });

  assert.equal(findings.length, 3, `expected exactly 3 v4-route checks, got ${JSON.stringify(findings)}`);
  for (const finding of findings) assert.match(finding.check, /^v4-route:/, `every finding must be scoped under the v4-route section: ${JSON.stringify(finding)}`);

  const byCheck = new Map(findings.map((f) => [f.check, f]));
  const modelCli = byCheck.get("v4-route:model-cli");
  const v25RootWritable = byCheck.get("v4-route:v25-root-writable");
  const compositionConstructs = byCheck.get("v4-route:composition-constructs");
  assert.ok(modelCli, "model-cli check must be present");
  assert.ok(v25RootWritable, "v25-root-writable check must be present");
  assert.ok(compositionConstructs, "composition-constructs check must be present");

  assert.equal(modelCli!.level, "skip", `hermetic mode must SKIP the model CLI preflight: ${JSON.stringify(modelCli)}`);
  assert.match(modelCli!.message, /CHAPTERFLOW_NO_API_CODEX_QC/);

  assert.equal(v25RootWritable!.level, "ok", `v25 root must be writable: ${JSON.stringify(v25RootWritable)}`);
  assert.equal(compositionConstructs!.level, "ok", `production composition must construct without throwing: ${JSON.stringify(compositionConstructs)}`);
});

requiredTest("checkV4Route: composition-constructs is fatal when the v25/attempt roots collide with the pipeline root", async ({ roots }) => {
  // createProductionBookRunComposition rejects a v25Root/attemptRoot that is
  // not isolated from pipelineRoot — checkV4Route must surface that as a
  // fatal finding, not throw out of the doctor check itself.
  const findings = await checkV4Route({
    pipelineRoot: PIPELINE_ROOT,
    v25Root: resolve(PIPELINE_ROOT, "v4-route-check-inside-pipeline-root"),
    attemptRoot: resolve(roots.attemptsRoot, "v4-route-check-collision"),
  });
  const compositionConstructs = findings.find((f) => f.check === "v4-route:composition-constructs");
  assert.ok(compositionConstructs);
  assert.equal(compositionConstructs!.level, "fatal");
  assert.match(compositionConstructs!.message, /production composition failed to construct/);
});

requiredTest("checkV4Route: default probe root (no explicit v25Root/attemptRoot) still constructs cleanly", async () => {
  const findings = await checkV4Route();
  const byCheck = new Map(findings.map((f) => [f.check, f]));
  assert.equal(byCheck.get("v4-route:v25-root-writable")!.level, "ok");
  assert.equal(byCheck.get("v4-route:composition-constructs")!.level, "ok");
});

finishV25Tests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
