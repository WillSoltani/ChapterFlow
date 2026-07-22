import * as cdk from "aws-cdk-lib";

/**
 * ChapterFlow runs three environments in ONE AWS account, separated by a
 * resource-name suffix. The single source of truth for env -> names/policies.
 *
 * CRITICAL — prod preservation: prod uses an EMPTY suffix, so every stack id
 * and physical resource name is byte-identical to what is already deployed
 * (`ChapterFlowBackend`, `ChapterFlowApp`, `ChapterFlowServer`, ...). That
 * makes `cdk deploy -c env=prod` a zero-diff on the live, data-bearing
 * resources. dev/staging append `-dev` / `-staging`, so they stand up as fresh,
 * independent stacks that never collide with prod's globally-unique names
 * (Lambda function names, IAM role names, CloudFront cache-policy names, etc.).
 *
 * Select the env with `-c env=<dev|staging|prod>` (or CHAPTERFLOW_ENV).
 * Default is `dev` so a bare `cdk deploy` can never accidentally touch prod.
 */

export type EnvName = "dev" | "staging" | "prod";

export interface ChapterFlowEnvConfig {
  readonly env: EnvName;
  /** "" for prod, "-dev"/"-staging" otherwise. Appended to every named resource. */
  readonly resourceSuffix: string;
  /** CloudFormation stack ids. */
  readonly backendStackId: string;
  readonly frontendStackId: string;
  /** Physical DynamoDB table names. */
  readonly tableName: string;
  readonly analyticsTableName: string;
  /** SSM parameter namespace (also what the running app reads config from). */
  readonly ssmPrefix: string;
  /**
   * Apex domain for this env, or undefined to serve on the CloudFront domain
   * only (the deploy health check always uses the CloudFront domain). Override
   * per-env with the CHAPTERFLOW_DOMAIN_NAME secret.
   */
  readonly domainName?: string;
  /** Stateful-resource lifecycle. prod/staging retain; dev is disposable. */
  readonly removalPolicy: cdk.RemovalPolicy;
  readonly deletionProtection: boolean;
  readonly pointInTimeRecovery: boolean;
  /**
   * Per-function Lambda reserved concurrency (WS6-001). Reserved concurrency
   * is BOTH a ceiling (caps a runaway function's blast radius on downstream
   * DynamoDB/SES/Cognito) AND a guaranteed floor (that many concurrent
   * invocations always have capacity, immune to other functions' bursts).
   *
   * Two AWS rules make this account-wide, not per-function: (1) every
   * function's reserved concurrency is deducted from ONE pool — the
   * account's total concurrency limit (default 1000, region-scoped) — so
   * reservations sum across every Lambda in the account, not just this
   * stack; (2) AWS refuses to apply any reservation that would leave less
   * than 100 units of UNRESERVED concurrency account-wide (deploy-time
   * `InvalidParameterValueException`). dev/staging/prod share ONE AWS
   * account (see the class doc above), so their sums are additive against
   * that same 1000 and same 100-unit floor — see
   * reserved-concurrency.test.ts's cross-env guard.
   */
  readonly lambdaConcurrency: {
    readonly server: number;
    readonly image: number;
    readonly revalidation: number;
    readonly dynamoProvider: number;
    readonly warmer: number;
    readonly reminder: number;
    readonly suppression: number;
    readonly preSignUp: number;
  };
  readonly region: string;
}

const DEV_STAGING_LAMBDA_CONCURRENCY = {
  server: 25,
  image: 5,
  revalidation: 2,
  dynamoProvider: 2,
  warmer: 2,
  reminder: 2,
  suppression: 2,
  preSignUp: 2,
};

const PROD_LAMBDA_CONCURRENCY = {
  server: 400,
  image: 60,
  revalidation: 10,
  dynamoProvider: 2,
  warmer: 2,
  reminder: 5,
  suppression: 5,
  preSignUp: 10,
};

const REGION = "us-east-1";
/** The production apex domain. dev/staging must never resolve to this. */
const PROD_APEX_DOMAIN = "chapterflow.ca";

export function resolveEnvName(app: cdk.App): EnvName {
  const raw =
    (app.node.tryGetContext("env") as string | undefined) ??
    process.env.CHAPTERFLOW_ENV ??
    "dev";
  const env = raw.trim().toLowerCase();
  if (env === "dev" || env === "staging" || env === "prod") return env;
  throw new Error(
    `Invalid environment "${raw}". Use -c env=dev|staging|prod (or set ` +
      `CHAPTERFLOW_ENV). Defaults to "dev" when unset.`,
  );
}

export function resolveEnvConfig(app: cdk.App): ChapterFlowEnvConfig {
  const env = resolveEnvName(app);
  const suffix = env === "prod" ? "" : `-${env}`;
  // Retain data for prod + staging; dev is fully disposable so it can be torn
  // down (`cdk destroy -c env=dev`) without a deletion-protection block.
  const retain = env !== "dev";

  // prod always has a domain (default to the live apex); dev/staging only get
  // a custom domain if one is explicitly provided for that env.
  const domainName =
    process.env.CHAPTERFLOW_DOMAIN_NAME ||
    (env === "prod" ? PROD_APEX_DOMAIN : undefined);

  // SAFETY: a dev/staging deploy must NEVER point at the prod apex — the
  // frontend stack would mint a cert + Route53 A/AAAA records for
  // chapterflow.ca/app./www. and overwrite PROD's live DNS (full outage).
  // CHAPTERFLOW_DOMAIN_NAME must be set as a PER-ENVIRONMENT secret; a leaked
  // repo-level secret would otherwise reach dev/staging via `secrets: inherit`.
  if (env !== "prod" && domainName === PROD_APEX_DOMAIN) {
    throw new Error(
      `Refusing to deploy "${env}" against the production apex domain ` +
        `"${PROD_APEX_DOMAIN}". CHAPTERFLOW_DOMAIN_NAME must be a per-environment ` +
        `secret (or unset for ${env}) — a repo-level secret leaks prod DNS into ${env}.`,
    );
  }

  return {
    env,
    resourceSuffix: suffix,
    backendStackId: `ChapterFlowBackend${suffix}`,
    frontendStackId: `ChapterFlowFrontend${suffix}`,
    tableName: `ChapterFlowApp${suffix}`,
    analyticsTableName: `ChapterFlowInsights${suffix}`,
    ssmPrefix: `/chapterflow/${env}`,
    domainName,
    removalPolicy: retain ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    deletionProtection: retain,
    pointInTimeRecovery: retain,
    lambdaConcurrency:
      env === "prod" ? PROD_LAMBDA_CONCURRENCY : DEV_STAGING_LAMBDA_CONCURRENCY,
    region: REGION,
  };
}
