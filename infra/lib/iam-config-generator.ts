export type DeploymentEnvironment = "dev" | "staging" | "prod";

export type IamArtifactConfig = {
  accountId: string;
  environment: DeploymentEnvironment;
  region: string;
  repository: string;
  bootstrapQualifier: string;
};

type TrustPolicy = {
  Version: "2012-10-17";
  Statement: Array<{
    Effect: "Allow";
    Principal: { Federated: string };
    Action: "sts:AssumeRoleWithWebIdentity";
    Condition: {
      StringEquals: {
        "token.actions.githubusercontent.com:aud": "sts.amazonaws.com";
        "token.actions.githubusercontent.com:sub": string[];
      };
    };
  }>;
};

type DeploymentPolicyStatement = {
  Sid: string;
  Effect: "Allow";
  Action: string | string[];
  Resource: string | string[];
};

type DeploymentPolicy = {
  Version: "2012-10-17";
  Statement: DeploymentPolicyStatement[];
};

export type IamArtifacts = {
  trustPolicy: TrustPolicy;
  additivePolicy: DeploymentPolicy;
};

export type RenderedIamArtifacts = IamArtifacts & {
  trustJson: string;
  additivePolicyJson: string;
  additivePolicyFile: string;
};

const ENVIRONMENTS = ["dev", "staging", "prod"] as const;

function assertConfig(config: IamArtifactConfig): void {
  if (!/^\d{12}$/.test(config.accountId)) {
    throw new Error("CDK_DEFAULT_ACCOUNT must be exactly 12 digits");
  }
  if (!ENVIRONMENTS.includes(config.environment)) {
    throw new Error("CHAPTERFLOW_ENV must be dev, staging, or prod");
  }
  if (!/^[a-z]{2}(?:-gov)?-[a-z]+-\d$/.test(config.region)) {
    throw new Error("AWS_REGION must be a canonical AWS region");
  }
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(config.repository)) {
    throw new Error("GITHUB_REPOSITORY must be owner/name");
  }
  if (!/^[a-z0-9]{1,10}$/.test(config.bootstrapQualifier)) {
    throw new Error("CDK_BOOTSTRAP_QUALIFIER must be 1-10 lowercase letters or digits");
  }
}

export function parseIamArtifactConfig(
  env: Record<string, string | undefined>,
): IamArtifactConfig {
  const config = {
    accountId: env.CDK_DEFAULT_ACCOUNT?.trim() ?? "",
    environment: env.CHAPTERFLOW_ENV?.trim() as DeploymentEnvironment,
    region: env.AWS_REGION?.trim() || "us-east-1",
    repository: env.GITHUB_REPOSITORY?.trim() ?? "",
    bootstrapQualifier:
      env.CDK_BOOTSTRAP_QUALIFIER?.trim() || "hnb659fds",
  };
  assertConfig(config);
  return config;
}

export function buildIamArtifacts(config: IamArtifactConfig): IamArtifacts {
  assertConfig(config);
  const { accountId, environment, region, repository, bootstrapQualifier } =
    config;
  const suffix = environment === "prod" ? "" : `-${environment}`;
  const rolePrefix = `arn:aws:iam::${accountId}:role/cdk-${bootstrapQualifier}`;

  return {
    trustPolicy: {
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Principal: {
            Federated:
              `arn:aws:iam::${accountId}:oidc-provider/` +
              "token.actions.githubusercontent.com",
          },
          Action: "sts:AssumeRoleWithWebIdentity",
          Condition: {
            StringEquals: {
              "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
              "token.actions.githubusercontent.com:sub": ENVIRONMENTS.map(
                (name) => `repo:${repository}:environment:${name}`,
              ),
            },
          },
        },
      ],
    },
    additivePolicy: {
      Version: "2012-10-17",
      Statement: [
        {
          Sid: "CDKBootstrapRoleAssume",
          Effect: "Allow",
          Action: "sts:AssumeRole",
          Resource: [
            `${rolePrefix}-deploy-role-${accountId}-${region}`,
            `${rolePrefix}-file-publishing-role-${accountId}-${region}`,
            `${rolePrefix}-image-publishing-role-${accountId}-${region}`,
            `${rolePrefix}-lookup-role-${accountId}-${region}`,
          ],
        },
        {
          Sid: "CDKBootstrapVersionCheck",
          Effect: "Allow",
          Action: "ssm:GetParameter",
          Resource:
            `arn:aws:ssm:${region}:${accountId}:parameter/cdk-bootstrap/` +
            `${bootstrapQualifier}/version`,
        },
        {
          Sid: "DynamoDBSeedAndPublish",
          Effect: "Allow",
          Action: [
            "dynamodb:PutItem",
            "dynamodb:GetItem",
            "dynamodb:UpdateItem",
            "dynamodb:Query",
            "dynamodb:BatchWriteItem",
          ],
          Resource: [
            `arn:aws:dynamodb:${region}:${accountId}:table/ChapterFlowApp${suffix}`,
          ],
        },
      ],
    },
  };
}

function renderJson(value: unknown): string {
  const rendered = `${JSON.stringify(value, null, 2)}\n`;
  JSON.parse(rendered);
  return rendered;
}

export function renderIamArtifacts(
  config: IamArtifactConfig,
): RenderedIamArtifacts {
  const artifacts = buildIamArtifacts(config);
  return {
    ...artifacts,
    trustJson: renderJson(artifacts.trustPolicy),
    additivePolicyJson: renderJson(artifacts.additivePolicy),
    additivePolicyFile:
      `github-actions-${config.environment}-additive-policy.json`,
  };
}
