import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { buildIamArtifacts } from "./iam-config-generator";

const REPOSITORY = "WillSoltani/ChapterFlow";
const EXPECTED_SUBJECTS = [
  `repo:${REPOSITORY}:environment:dev`,
  `repo:${REPOSITORY}:environment:staging`,
  `repo:${REPOSITORY}:environment:prod`,
] as const;

type TrustStatement = {
  Effect?: string;
  Principal?: { Federated?: string };
  Action?: string;
  Condition?: Record<string, Record<string, string | string[]>>;
};

function readTrustStatement(): TrustStatement {
  const trust = buildIamArtifacts({
    accountId: "123456789012",
    environment: "dev",
    region: "us-east-1",
    repository: REPOSITORY,
    bootstrapQualifier: "hnb659fds",
  }).trustPolicy as { Statement?: TrustStatement[] };
  assert.equal(trust.Statement?.length, 1);
  return trust.Statement[0];
}

function subjectIsTrusted(statement: TrustStatement, subject: string): boolean {
  const configured =
    statement.Condition?.StringEquals?.[
      "token.actions.githubusercontent.com:sub"
    ];
  const allowed = Array.isArray(configured) ? configured : [configured];
  return allowed.includes(subject);
}

test("generated GitHub OIDC trust admits only the three real Environment subjects", () => {
  const statement = readTrustStatement();
  assert.equal(statement.Effect, "Allow");
  assert.equal(statement.Action, "sts:AssumeRoleWithWebIdentity");
  assert.match(
    statement.Principal?.Federated ?? "",
    /:oidc-provider\/token\.actions\.githubusercontent\.com$/,
  );
  assert.deepEqual(statement.Condition, {
    StringEquals: {
      "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
      "token.actions.githubusercontent.com:sub": [...EXPECTED_SUBJECTS],
    },
  });

  for (const subject of EXPECTED_SUBJECTS) {
    assert.equal(subjectIsTrusted(statement, subject), true, subject);
  }
  for (const subject of [
    `repo:${REPOSITORY}:ref:refs/heads/main`,
    `repo:${REPOSITORY}:pull_request`,
    `repo:${REPOSITORY}:environment:preview`,
    "repo:someone-else/ChapterFlow:environment:prod",
  ]) {
    assert.equal(subjectIsTrusted(statement, subject), false, subject);
  }
});

for (const workflowName of ["_deploy-infra.yml", "_deploy-app.yml"]) {
  test(`${workflowName} rejects unknown environment input before its deployment job`, () => {
    const workflowPath = path.resolve(
      __dirname,
      `../../.github/workflows/${workflowName}`,
    );
    const workflow = fs.readFileSync(workflowPath, "utf8");

    assert.match(workflow, /\n  validate-environment:\n/);
    assert.match(
      workflow,
      /DEPLOY_ENVIRONMENT: \$\{\{ inputs\.environment \}\}[\s\S]*case "\$DEPLOY_ENVIRONMENT" in[\s\S]*dev\|staging\|prod\)[\s\S]*\*\) echo "::error::invalid environment/,
    );
    assert.match(
      workflow,
      /\n  deploy-(?:infra|app):[\s\S]*?\n    needs: validate-environment\n[\s\S]*?\n    environment: \$\{\{ inputs\.environment \}\}/,
    );
  });
}
