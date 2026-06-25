import { test } from "node:test";
import assert from "node:assert/strict";
import * as cdk from "aws-cdk-lib";
import { Template, Match } from "aws-cdk-lib/assertions";
import { ChapterFlowBackendStack } from "./chapterflow-backend-stack";

// Regression for the confused-deputy defect (cluster "sns-topic-source-guard",
// finding F9): the ChapterFlowEmailEvents SNS topic granted sns:Publish to the
// ses.amazonaws.com service principal with NO conditions, so SES acting on
// behalf of ANY AWS account could publish forged bounce/complaint events into
// the suppression handler. AWS's documented guard is to constrain a
// service-principal publish grant with aws:SourceAccount (and, where feasible,
// aws:SourceArn of the originating resource — here the SES configuration set).

// Synth against the dev env: the topic policy (account-id Ref +
// configuration-set ARN) is identical across envs save for the resource
// suffix, and dev does not assert the prod-only launch-critical secrets
// (CHAPTERFLOW_APP_BASE_URL etc.) that would otherwise throw at construct time.
function synthBackend() {
  const app = new cdk.App();
  const stack = new ChapterFlowBackendStack(app, "TestBackend", {
    env: { account: "123456789012", region: "us-east-1" },
    envName: "dev",
    resourceSuffix: "-dev",
    tableName: "ChapterFlowApp-dev",
    analyticsTableName: "ChapterFlowAppAnalytics-dev",
    ssmPrefix: "/chapterflow/dev",
    removalPolicy: cdk.RemovalPolicy.DESTROY,
    deletionProtection: false,
    pointInTimeRecovery: false,
  });
  return Template.fromStack(stack);
}

// Locate the SNS::TopicPolicy statement whose Principal is the SES service
// principal and whose Action is sns:Publish.
function findSesPublishStatement(
  template: Template
): Record<string, unknown> {
  const policies = template.findResources("AWS::SNS::TopicPolicy");
  for (const policy of Object.values(policies)) {
    const statements: Array<Record<string, unknown>> =
      // @ts-expect-error - CDK assertions returns untyped JSON.
      policy.Properties?.PolicyDocument?.Statement ?? [];
    for (const stmt of statements) {
      const principal = stmt.Principal as { Service?: unknown } | undefined;
      const action = stmt.Action;
      const isSes =
        principal?.Service === "ses.amazonaws.com" ||
        (Array.isArray(principal?.Service) &&
          principal!.Service.includes("ses.amazonaws.com"));
      const isPublish =
        action === "sns:Publish" ||
        (Array.isArray(action) && action.includes("sns:Publish"));
      if (isSes && isPublish) return stmt;
    }
  }
  throw new Error(
    "no SNS TopicPolicy statement granting sns:Publish to ses.amazonaws.com was synthesized"
  );
}

test("SES publish grant on the email-events topic is constrained by aws:SourceAccount", () => {
  const template = synthBackend();
  const stmt = findSesPublishStatement(template);
  const condition = stmt.Condition as
    | { StringEquals?: Record<string, unknown> }
    | undefined;
  assert.ok(
    condition,
    "the SES sns:Publish statement MUST carry a Condition block (confused-deputy guard)"
  );
  assert.ok(
    condition.StringEquals,
    "the Condition MUST use StringEquals"
  );
  assert.equal(
    JSON.stringify(condition.StringEquals!["aws:SourceAccount"]),
    JSON.stringify({ Ref: "AWS::AccountId" }),
    "aws:SourceAccount MUST equal this account so SES from another account cannot publish"
  );
});

test("SES publish grant is also scoped to this account's email configuration-set ARN", () => {
  const template = synthBackend();
  const stmt = findSesPublishStatement(template);
  const condition = stmt.Condition as {
    StringEquals?: Record<string, unknown>;
  };
  const sourceArn = condition.StringEquals!["aws:SourceArn"];
  assert.ok(
    sourceArn,
    "aws:SourceArn MUST be present to scope the publish to our SES configuration set"
  );
  // The ARN is a CloudFormation Fn::Join over the SES configuration-set path.
  const rendered = JSON.stringify(sourceArn);
  assert.ok(
    rendered.includes("configuration-set/ChapterFlowEmail"),
    `aws:SourceArn must reference the ChapterFlowEmail configuration set, got ${rendered}`
  );
  assert.ok(
    rendered.includes(":ses:"),
    `aws:SourceArn must be an SES ARN, got ${rendered}`
  );
});

test("the email-events topic policy as a whole matches the guarded shape", () => {
  // Belt-and-suspenders: assert via Template.hasResourceProperties that SOME
  // TopicPolicy statement has the full guarded shape. If the conditions are
  // ever dropped this fails just like the two targeted checks above.
  const template = synthBackend();
  template.hasResourceProperties(
    "AWS::SNS::TopicPolicy",
    Match.objectLike({
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: "sns:Publish",
            Principal: { Service: "ses.amazonaws.com" },
            Condition: {
              StringEquals: {
                "aws:SourceAccount": { Ref: "AWS::AccountId" },
              },
            },
          }),
        ]),
      },
    })
  );
});
