import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const RAW_INPUT_NAME = "APPLE_IAP_TESTFLIGHT_QA_USER_IDS";
const HASH_INPUT_NAME = "APPLE_IAP_TESTFLIGHT_QA_USER_HASHES";

function readWorkspaceFile(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

test("raw TestFlight subjects stop before CDK and Lambda configuration", () => {
  const workflow = readWorkspaceFile(".github/workflows/_deploy-app.yml");
  const deployStepStart = workflow.indexOf(
    "- name: CDK deploy frontend stack",
  );
  assert.notEqual(deployStepStart, -1);
  const deployStepAndAfter = workflow.slice(deployStepStart);
  assert.equal(deployStepAndAfter.includes(RAW_INPUT_NAME), false);
  assert.equal(
    workflow.includes(`echo "${HASH_INPUT_NAME}=\$HASHES"`),
    true,
  );

  const appSource = readWorkspaceFile("infra/bin/app.ts");
  assert.equal(appSource.includes(RAW_INPUT_NAME), false, "infra/bin/app.ts");
  assert.match(appSource, /buildFrontendRuntimeConfig/);

  for (const path of [
    "infra/lib/apple-iap-config.ts",
    "infra/lib/frontend-runtime-config.ts",
  ]) {
    const source = readWorkspaceFile(path);
    assert.equal(source.includes(RAW_INPUT_NAME), false, path);
    assert.equal(source.includes(HASH_INPUT_NAME), true, path);
  }
});

test("workflow derives hashes only after the protected raw secret boundary", () => {
  const workflow = readWorkspaceFile(".github/workflows/_deploy-app.yml");
  assert.match(
    workflow,
    /APPLE_IAP_TESTFLIGHT_QA_USER_IDS: .*secrets\.APPLE_IAP_TESTFLIGHT_QA_USER_IDS/,
  );
  assert.match(
    workflow,
    /node --import tsx scripts\/ci\/hash-apple-testflight-qa-users\.ts/,
  );
});
