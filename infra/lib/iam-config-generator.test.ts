import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildIamArtifacts,
  parseIamArtifactConfig,
  renderIamArtifacts,
} from "./iam-config-generator";

const SYNTHETIC_ACCOUNT = "123456789012";
const REPOSITORY = "WillSoltani/ChapterFlow";

test("generator emits parseable, directly applicable IAM JSON from validated config", () => {
  const config = parseIamArtifactConfig({
    CDK_DEFAULT_ACCOUNT: SYNTHETIC_ACCOUNT,
    CHAPTERFLOW_ENV: "dev",
    AWS_REGION: "us-east-1",
    GITHUB_REPOSITORY: REPOSITORY,
  });
  const rendered = renderIamArtifacts(config);

  assert.deepEqual(JSON.parse(rendered.trustJson), rendered.trustPolicy);
  assert.deepEqual(JSON.parse(rendered.deploymentPolicyJson), rendered.deploymentPolicy);
  assert.equal(rendered.deploymentPolicyFile, "github-actions-dev-policy.json");
  assert.doesNotMatch(rendered.trustJson, /placeholder|CDK_DEFAULT_ACCOUNT/);
  assert.doesNotMatch(
    rendered.deploymentPolicyJson,
    /placeholder|CDK_DEFAULT_ACCOUNT/,
  );
});

test("trust and permission ARNs derive from the account while subjects stay exact", () => {
  const artifacts = buildIamArtifacts({
    accountId: SYNTHETIC_ACCOUNT,
    environment: "dev",
    region: "us-east-1",
    repository: REPOSITORY,
    bootstrapQualifier: "hnb659fds",
  });
  const trustStatement = artifacts.trustPolicy.Statement[0];
  assert.equal(
    trustStatement.Principal.Federated,
    `arn:aws:iam::${SYNTHETIC_ACCOUNT}:oidc-provider/token.actions.githubusercontent.com`,
  );
  assert.deepEqual(
    trustStatement.Condition.StringEquals[
      "token.actions.githubusercontent.com:sub"
    ],
    [
      `repo:${REPOSITORY}:environment:dev`,
      `repo:${REPOSITORY}:environment:staging`,
      `repo:${REPOSITORY}:environment:prod`,
    ],
  );
  assert.equal(
    JSON.stringify(artifacts.deploymentPolicy).includes(SYNTHETIC_ACCOUNT),
    true,
  );
});

test("environment-specific policy names only the matching seed table", () => {
  const expected = {
    dev: "ChapterFlowApp-dev",
    staging: "ChapterFlowApp-staging",
    prod: "ChapterFlowApp",
  } as const;

  for (const [environment, tableName] of Object.entries(expected)) {
    const artifacts = buildIamArtifacts({
      accountId: SYNTHETIC_ACCOUNT,
      environment: environment as keyof typeof expected,
      region: "us-east-1",
      repository: REPOSITORY,
      bootstrapQualifier: "hnb659fds",
    });
    const seed = artifacts.deploymentPolicy.Statement.find(
      ({ Sid }) => Sid === "DynamoDBSeedAndPublish",
    );
    assert.deepEqual(seed?.Resource, [
      `arn:aws:dynamodb:us-east-1:${SYNTHETIC_ACCOUNT}:table/${tableName}`,
    ]);
  }
});

test("invalid or incomplete generator inputs fail before any JSON is emitted", () => {
  for (const env of [
    {},
    { CDK_DEFAULT_ACCOUNT: "1234" },
    { CDK_DEFAULT_ACCOUNT: SYNTHETIC_ACCOUNT, CHAPTERFLOW_ENV: "preview" },
    {
      CDK_DEFAULT_ACCOUNT: SYNTHETIC_ACCOUNT,
      CHAPTERFLOW_ENV: "dev",
      GITHUB_REPOSITORY: "not-a-repository",
    },
  ]) {
    assert.throws(() => parseIamArtifactConfig(env));
  }
});
