import { test } from "node:test";
import assert from "node:assert/strict";
import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import { Annotations, Match, Template } from "aws-cdk-lib/assertions";
import { SENSITIVE_ACTIONS, SensitiveWildcardGuard } from "./iam-guards";
import { ChapterFlowBackendStack } from "./chapterflow-backend-stack";

// Regression coverage for WS6-003 (see FR-13/AC-3 in
// upgrade/infra-cicd/FINDINGS.md): three IAM grants used to fall back to a
// "*" resource when the env's identity wasn't known at synth. All three envs
// share ONE AWS account, and Cognito/SES are account-global, so that fallback
// let a dev/staging role reach the PROD user pool / PROD SES identity. The
// grant sites were fixed to omit the statement entirely when the identity is
// unknown (fail closed); this suite covers the SensitiveWildcardGuard Aspect
// that backstops that fix for ANY stack, present or future.

function newGuardedStack(id = "TestStack"): { app: cdk.App; stack: cdk.Stack } {
  const app = new cdk.App();
  cdk.Aspects.of(app).add(new SensitiveWildcardGuard());
  const stack = new cdk.Stack(app, id, {
    env: { account: "123456789012", region: "us-east-1" },
  });
  return { app, stack };
}

const GUARD_MESSAGE = Match.stringLikeRegexp("SensitiveWildcardGuard");

test("wildcard cognito-idp:AdminDeleteUser grant is flagged as a synth error", () => {
  const { stack } = newGuardedStack();
  const role = new iam.Role(stack, "AdminRole", {
    assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
  });
  role.addToPolicy(
    new iam.PolicyStatement({
      actions: ["cognito-idp:AdminDeleteUser"],
      resources: ["*"],
    }),
  );

  // hasError THROWS (failing this test) if no matching error annotation was
  // recorded — this is the actual proof the guard fires: the assertion below
  // only passes because `Annotations.fromStack` triggered a real app.synth()
  // that ran the Aspect and it added the error.
  Annotations.fromStack(stack).hasError(
    "*",
    Match.stringLikeRegexp("SensitiveWildcardGuard.*cognito-idp:AdminDeleteUser"),
  );
});

test("sesv2:SendEmail on Resource '*' is flagged", () => {
  const { stack } = newGuardedStack();
  const role = new iam.Role(stack, "SesRole", {
    assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
  });
  role.addToPolicy(
    new iam.PolicyStatement({
      actions: ["sesv2:SendEmail"],
      resources: ["*"],
    }),
  );

  Annotations.fromStack(stack).hasError(
    "*",
    Match.stringLikeRegexp("SensitiveWildcardGuard.*sesv2:SendEmail"),
  );
});

test("service wildcard 'ses:*' on Resource '*' is flagged (covers ses:SendEmail)", () => {
  const { stack } = newGuardedStack();
  const role = new iam.Role(stack, "SesWildcardRole", {
    assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
  });
  role.addToPolicy(
    new iam.PolicyStatement({
      actions: ["ses:*"],
      resources: ["*"],
    }),
  );

  Annotations.fromStack(stack).hasError(
    "*",
    Match.stringLikeRegexp("SensitiveWildcardGuard.*ses:SendEmail"),
  );
});

test("global '*' action on Resource '*' is flagged (covers every sensitive action)", () => {
  const { stack } = newGuardedStack();
  const role = new iam.Role(stack, "GlobalWildcardRole", {
    assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
  });
  role.addToPolicy(
    new iam.PolicyStatement({
      actions: ["*"],
      resources: ["*"],
    }),
  );

  const annotations = Annotations.fromStack(stack);
  for (const action of SENSITIVE_ACTIONS) {
    annotations.hasError("*", Match.stringLikeRegexp(`SensitiveWildcardGuard.*${escapeRegExp(action)}`));
  }
});

test("properly scoped AdminDeleteUser (pool ARN) is NOT flagged", () => {
  const { stack } = newGuardedStack();
  const role = new iam.Role(stack, "ScopedAdminRole", {
    assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
  });
  role.addToPolicy(
    new iam.PolicyStatement({
      actions: ["cognito-idp:AdminDeleteUser"],
      resources: [
        "arn:aws:cognito-idp:us-east-1:123456789012:userpool/us-east-1_ABC123",
      ],
    }),
  );

  Annotations.fromStack(stack).hasNoError("*", GUARD_MESSAGE);
});

test("ses:SendEmail on Resource '*' with Effect Deny is NOT flagged", () => {
  const { stack } = newGuardedStack();
  const role = new iam.Role(stack, "DenyRole", {
    assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
  });
  role.addToPolicy(
    new iam.PolicyStatement({
      effect: iam.Effect.DENY,
      actions: ["ses:SendEmail"],
      resources: ["*"],
    }),
  );

  Annotations.fromStack(stack).hasNoError("*", GUARD_MESSAGE);
});

test("unrelated action (s3:GetObject) on Resource '*' is NOT flagged", () => {
  const { stack } = newGuardedStack();
  const role = new iam.Role(stack, "S3Role", {
    assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
  });
  role.addToPolicy(
    new iam.PolicyStatement({
      actions: ["s3:GetObject"],
      resources: ["*"],
    }),
  );

  Annotations.fromStack(stack).hasNoError("*", GUARD_MESSAGE);
});

test("CfnRole INLINE policies path (iam.Role inlinePolicies prop) is covered", () => {
  const { stack } = newGuardedStack();
  new iam.Role(stack, "InlinePolicyRole", {
    assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
    inlinePolicies: {
      SensitiveInline: new iam.PolicyDocument({
        statements: [
          new iam.PolicyStatement({
            actions: ["sesv2:SendEmail"],
            resources: ["*"],
          }),
        ],
      }),
    },
  });

  // The role above must synth as a Role with a `policies` (inline) entry, NOT
  // a separate AWS::IAM::Policy — that's the whole point of this fixture.
  const template = Template.fromStack(stack);
  template.hasResourceProperties("AWS::IAM::Role", {
    Policies: Match.arrayWith([
      Match.objectLike({ PolicyName: "SensitiveInline" }),
    ]),
  });

  Annotations.fromStack(stack).hasError(
    "*",
    Match.stringLikeRegexp("SensitiveWildcardGuard.*inline policy.*sesv2:SendEmail"),
  );
});

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// --- Integration: the real backend stack, dev env, no Cognito pool id / no
// verified domain (the exact scenario FR-11/FR-12 fail closed on) — assert
// via Template that NO statement anywhere in the stack grants a
// SENSITIVE_ACTIONS entry on Resource "*".

const ENV_KEYS_TO_SCRUB = [
  "COGNITO_USER_POOL_ID",
  "CHAPTERFLOW_DOMAIN_NAME",
  "SES_SENDER_EMAIL",
  "CHAPTERFLOW_APP_BASE_URL",
];

function withScrubbedEnv<T>(fn: () => T): T {
  const saved = new Map<string, string | undefined>();
  for (const key of ENV_KEYS_TO_SCRUB) {
    saved.set(key, process.env[key]);
    delete process.env[key];
  }
  try {
    return fn();
  } finally {
    for (const [key, value] of saved) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function isAllowStatementOnWildcardResource(stmt: unknown): stmt is {
  Effect?: unknown;
  Action?: unknown;
  Resource?: unknown;
} {
  if (!stmt || typeof stmt !== "object") return false;
  const { Effect, Resource } = stmt as { Effect?: unknown; Resource?: unknown };
  if (Effect !== undefined && Effect !== "Allow") return false;
  const resources = Array.isArray(Resource) ? Resource : [Resource];
  return resources.includes("*");
}

function statementActionsCoverSensitive(actionField: unknown): string[] {
  const actions = (Array.isArray(actionField) ? actionField : [actionField]).filter(
    (a): a is string => typeof a === "string",
  );
  const hits = new Set<string>();
  for (const action of actions) {
    for (const sensitive of SENSITIVE_ACTIONS) {
      if (action === "*" || action === sensitive) {
        hits.add(sensitive);
        continue;
      }
      const separator = action.indexOf(":");
      if (separator === -1) continue;
      const service = action.slice(0, separator);
      const rest = action.slice(separator + 1);
      if (rest === "*" && service === sensitive.slice(0, sensitive.indexOf(":"))) {
        hits.add(sensitive);
      }
    }
  }
  return [...hits];
}

function collectPolicyDocuments(template: Template): unknown[] {
  const docs: unknown[] = [];
  for (const resourceType of ["AWS::IAM::Policy", "AWS::IAM::ManagedPolicy"]) {
    const resources = template.findResources(resourceType);
    for (const resource of Object.values(resources)) {
      const props = (resource as { Properties?: Record<string, unknown> }).Properties;
      if (props?.PolicyDocument) docs.push(props.PolicyDocument);
    }
  }
  const roles = template.findResources("AWS::IAM::Role");
  for (const role of Object.values(roles)) {
    const props = (role as { Properties?: Record<string, unknown> }).Properties;
    const policies = (props?.Policies as Array<Record<string, unknown>>) ?? [];
    for (const policy of policies) {
      if (policy?.PolicyDocument) docs.push(policy.PolicyDocument);
    }
  }
  return docs;
}

function findSensitiveWildcardStatements(
  template: Template,
): Array<{ Action: unknown; Resource: unknown }> {
  const offenders: Array<{ Action: unknown; Resource: unknown }> = [];
  for (const doc of collectPolicyDocuments(template)) {
    const statements = (doc as { Statement?: unknown })?.Statement;
    const list = Array.isArray(statements) ? statements : [statements];
    for (const stmt of list) {
      if (!isAllowStatementOnWildcardResource(stmt)) continue;
      const stmtObj = stmt as { Action?: unknown; Resource?: unknown };
      if (statementActionsCoverSensitive(stmtObj.Action).length > 0) {
        offenders.push({ Action: stmtObj.Action, Resource: stmtObj.Resource });
      }
    }
  }
  return offenders;
}

test(
  "integration: ChapterFlowBackendStack (dev, no Cognito pool id / no verified " +
    "domain) grants no SENSITIVE_ACTIONS entry on Resource '*'",
  () => {
    withScrubbedEnv(() => {
      const app = new cdk.App({ context: { env: "dev" } });
      cdk.Aspects.of(app).add(new SensitiveWildcardGuard());

      // Same prop shape bin/app.ts passes for the backend stack (dev values;
      // dummy account/region — see lib/env-config.ts resolveEnvConfig() for
      // the dev-tier removalPolicy/deletionProtection/pointInTimeRecovery
      // values this mirrors). domainName and cognitoUserPoolId are both
      // deliberately omitted — the exact "identity unknown at synth" case
      // FR-11/FR-12 must fail closed on.
      const stack = new ChapterFlowBackendStack(app, "TestChapterFlowBackendDev", {
        env: { account: "123456789012", region: "us-east-1" },
        envName: "dev",
        resourceSuffix: "-dev",
        tableName: "ChapterFlowApp-dev",
        analyticsTableName: "ChapterFlowInsights-dev",
        ssmPrefix: "/chapterflow/dev",
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        deletionProtection: false,
        pointInTimeRecovery: false,
        lambdaConcurrency: { reminder: 2, suppression: 2, preSignUp: 2 },
      });

      const template = Template.fromStack(stack);
      const offenders = findSensitiveWildcardStatements(template);
      assert.deepEqual(
        offenders,
        [],
        `expected no IAM statement granting ${SENSITIVE_ACTIONS.join(", ")} on ` +
          `Resource "*", found: ${JSON.stringify(offenders)}`,
      );

      // Belt-and-suspenders: the guard itself must stay silent on this stack.
      Annotations.fromStack(stack).hasNoError("*", GUARD_MESSAGE);
    });
  },
);
