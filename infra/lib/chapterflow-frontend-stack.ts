import * as fs from "fs";
import * as path from "path";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as cloudwatchActions from "aws-cdk-lib/aws-cloudwatch-actions";
import * as sns from "aws-cdk-lib/aws-sns";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as route53Targets from "aws-cdk-lib/aws-route53-targets";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as eventSources from "aws-cdk-lib/aws-lambda-event-sources";
import * as logs from "aws-cdk-lib/aws-logs";
import * as wafv2 from "aws-cdk-lib/aws-wafv2";
import { type EnvName } from "./env-config";
import { buildWebAclRules } from "./waf-rules";

// ---------------------------------------------------------------------------
// WS6-033: DynamoDB metrics by table NAME (this stack only has
// props.appTableName/analyticsTableName strings — see the ARN-by-name
// construction above — not the dynamodb.Table constructs the backend stack
// owns, so it can't call table.metricThrottledRequestsForOperation() etc.
// directly). Mirrors the shape of buildThrottleMetric in
// chapterflow-backend-stack.ts for the golden-signals dashboard below.
// ---------------------------------------------------------------------------

function buildThrottleMetricByName(tableName: string): cloudwatch.MathExpression {
  const operations = [
    "BatchGetItem",
    "BatchWriteItem",
    "DeleteItem",
    "GetItem",
    "PutItem",
    "Query",
    "TransactWriteItems",
    "UpdateItem",
  ];

  const usingMetrics = Object.fromEntries(
    operations.map((operation, index) => [
      `m${index}`,
      new cloudwatch.Metric({
        namespace: "AWS/DynamoDB",
        metricName: "ThrottledRequests",
        dimensionsMap: { TableName: tableName, Operation: operation },
        statistic: "sum",
        period: cdk.Duration.minutes(5),
      }),
    ]),
  );

  return new cloudwatch.MathExpression({
    expression: Object.keys(usingMetrics).join(" + "),
    usingMetrics,
    period: cdk.Duration.minutes(5),
  });
}

function tableLatencyMetricByName(tableName: string): cloudwatch.Metric {
  return new cloudwatch.Metric({
    namespace: "AWS/DynamoDB",
    metricName: "SuccessfulRequestLatency",
    dimensionsMap: { TableName: tableName },
    statistic: "Average",
    period: cdk.Duration.minutes(5),
  });
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ChapterFlowFrontendStackProps extends cdk.StackProps {
  /** dev | staging | prod. Injected into the server Lambda as CHAPTERFLOW_ENV. */
  readonly envName: EnvName;
  /** "" for prod, "-dev"/"-staging" otherwise — appended to named resources. */
  readonly resourceSuffix: string;
  /**
   * Names/ARNs of backend resources. Using explicit strings instead of
   * cross-stack references so the backend stack can be deployed independently
   * without CloudFormation export conflicts.
   */
  readonly appTableName: string;
  readonly analyticsTableName: string;
  readonly ingestBucketName: string;
  readonly contentBucketName: string;
  readonly ssmPrefix: string;
  /**
   * The Route53 hosted zone domain name (e.g. "chapterflow.ca").
   * The app will be served at app.${domainName}.
   */
  readonly domainName?: string;
  /**
   * Environment variables to inject into the server Lambda.
   * Secrets (Stripe, Cognito, etc.) should be passed here from
   * GitHub Secrets → CDK context/env at deploy time.
   */
  readonly serverEnv?: Record<string, string>;
  /**
   * WS6-002 interim origin lock. When set, CloudFront injects it as the
   * x-origin-verify custom header on both public Function URL origins and it is
   * enforced by middleware.ts (server) + the image wrapper. Unset → no header,
   * no enforcement (today's behavior; keeps currently-deployed envs diff-clean
   * until the secret is introduced).
   */
  readonly originVerifySecret?: string;
  /**
   * "enforce" (default) rejects unverified requests; "log" only warns and lets
   * them through — the observation half of a two-phase rollout.
   */
  readonly originVerifyMode?: "enforce" | "log";
}

// ---------------------------------------------------------------------------
// Stack
// ---------------------------------------------------------------------------

export class ChapterFlowFrontendStack extends cdk.Stack {
  public readonly distribution: cloudfront.Distribution;
  public readonly serverFunction: lambda.Function;

  constructor(
    scope: Construct,
    id: string,
    props: ChapterFlowFrontendStackProps,
  ) {
    super(scope, id, props);

    const suffix = props.resourceSuffix;
    // Append the env suffix to every explicitly-named (globally-unique) resource
    // so dev/staging never collide with prod. "" for prod => identical names.
    const name = (base: string) => `${base}${suffix}`;
    // prod has a domain; dev/staging may have none (serve on the CloudFront
    // domain — the deploy health check uses that domain regardless).
    const domainName = props.domainName;
    const appDomain = domainName ? `app.${domainName}` : undefined;
    const openNextDir = path.join(__dirname, "../../.open-next");

    // Construct ARNs from known names to avoid cross-stack references
    const appTableArn = cdk.Arn.format(
      { service: "dynamodb", resource: "table", resourceName: props.appTableName },
      this,
    );
    const analyticsTableArn = cdk.Arn.format(
      { service: "dynamodb", resource: "table", resourceName: props.analyticsTableName },
      this,
    );
    const ingestBucketArn = `arn:${cdk.Aws.PARTITION}:s3:::${props.ingestBucketName}`;
    const contentBucketArn = `arn:${cdk.Aws.PARTITION}:s3:::${props.contentBucketName}`;

    cdk.Tags.of(this).add("App", "ChapterFlow");
    cdk.Tags.of(this).add("System", "Frontend");
    cdk.Tags.of(this).add("ManagedBy", "CDK");
    cdk.Tags.of(this).add("Environment", props.envName);

    // -------------------------------------------------------------------
    // S3 — static assets + ISR cache
    // -------------------------------------------------------------------

    const assetsBucket = new s3.Bucket(this, "StaticAssets", {
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // -------------------------------------------------------------------
    // DynamoDB — ISR tag cache (used by OpenNext for revalidateTags)
    // -------------------------------------------------------------------

    const cacheTable = new dynamodb.Table(this, "CacheTable", {
      tableName: name("ChapterFlowNextCache"),
      partitionKey: { name: "tag", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "path", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      timeToLiveAttribute: "revalidatedAt",
    });

    // OpenNext queries this GSI to check if cached pages have been
    // revalidated (by path + revalidatedAt timestamp).
    cacheTable.addGlobalSecondaryIndex({
      indexName: "revalidate",
      partitionKey: { name: "path", type: dynamodb.AttributeType.STRING },
      sortKey: {
        name: "revalidatedAt",
        type: dynamodb.AttributeType.STRING,
      },
    });

    // -------------------------------------------------------------------
    // SQS — ISR revalidation queue
    // -------------------------------------------------------------------

    // Dead-letter queue for revalidation messages that repeatedly fail to
    // process. A FIFO source requires a FIFO DLQ. Messages landing here mean ISR
    // revalidation is silently broken — a CloudWatch alarm (below) pages on it.
    const revalidationDlq = new sqs.Queue(this, "RevalidationDlq", {
      queueName: `ChapterFlowRevalidationDlq${suffix}.fifo`,
      fifo: true,
      contentBasedDeduplication: true,
      retentionPeriod: cdk.Duration.days(14),
    });

    const revalidationQueue = new sqs.Queue(this, "RevalidationQueue", {
      queueName: `ChapterFlowRevalidation${suffix}.fifo`,
      fifo: true,
      contentBasedDeduplication: true,
      visibilityTimeout: cdk.Duration.seconds(30),
      retentionPeriod: cdk.Duration.days(1),
      deadLetterQueue: { queue: revalidationDlq, maxReceiveCount: 5 },
    });

    // -------------------------------------------------------------------
    // IAM — Lambda execution role
    // -------------------------------------------------------------------

    const lambdaRole = new iam.Role(this, "LambdaRole", {
      roleName: name("ChapterFlowLambdaRole"),
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AWSLambdaBasicExecutionRole",
        ),
      ],
    });

    // DynamoDB access — app + analytics tables, scoped to their exact ARNs.
    // `dynamodb:Scan` is intentionally retained: the admin metrics routes plus
    // economy-health and soft-decay full-table-Scan to compute aggregates, and
    // OpenNext runs EVERY route (user + admin) in this single server Lambda, so
    // the role can't drop Scan without breaking those dashboards. Resource scope
    // (no `*`) keeps the blast radius to these two tables. Future hardening:
    // move admin/Scan paths to a dedicated least-privilege function and remove
    // Scan from this role.
    const ddbResources = [
      appTableArn,
      `${appTableArn}/index/*`,
      analyticsTableArn,
      `${analyticsTableArn}/index/*`,
    ];

    lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "AppDynamoDbAccess",
        actions: [
          "dynamodb:BatchGetItem",
          "dynamodb:BatchWriteItem",
          "dynamodb:DeleteItem",
          "dynamodb:DescribeTable",
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:TransactWriteItems",
          "dynamodb:UpdateItem",
        ],
        resources: ddbResources,
      }),
    );

    // CloudWatch metrics read access — used by the admin Ops page to surface
    // Lambda invocation counts, latency p50/p95, error rates, DynamoDB
    // throttle counters, and S3 bucket sizes. CloudWatch metric reads are
    // not resource-scoped so we use "*".
    lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "CloudWatchMetricsRead",
        actions: [
          "cloudwatch:GetMetricStatistics",
          "cloudwatch:ListMetrics",
          "cloudwatch:GetMetricData",
        ],
        resources: ["*"],
      }),
    );

    // CloudWatch metrics write access — the server emits custom operational
    // metrics (e.g. StripeCancellationFailure via putOpsMetric) that a backend
    // alarm pages on. PutMetricData isn't resource-scoped, so we constrain it to
    // the ChapterFlow/Ops namespace instead.
    lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "CloudWatchMetricsWrite",
        actions: ["cloudwatch:PutMetricData"],
        resources: ["*"],
        conditions: {
          StringEquals: { "cloudwatch:namespace": "ChapterFlow/Ops" },
        },
      }),
    );

    // DynamoDB access — ISR cache table
    lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "CacheDynamoDbAccess",
        actions: [
          "dynamodb:BatchGetItem",
          "dynamodb:BatchWriteItem",
          "dynamodb:DeleteItem",
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:UpdateItem",
          "dynamodb:DescribeTable",
        ],
        resources: [cacheTable.tableArn, `${cacheTable.tableArn}/index/*`],
      }),
    );

    // S3 access — app buckets (same as App Runner role)
    lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "AppS3Access",
        actions: ["s3:GetObject", "s3:PutObject"],
        resources: [
          `${ingestBucketArn}/*`,
          `${contentBucketArn}/*`,
        ],
      }),
    );

    lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "AppS3MetadataAccess",
        actions: ["s3:GetBucketLocation"],
        resources: [ingestBucketArn, contentBucketArn],
      }),
    );

    // S3 access — static assets + cache bucket
    lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "AssetsBucketAccess",
        actions: [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket",
        ],
        resources: [assetsBucket.bucketArn, `${assetsBucket.bucketArn}/*`],
      }),
    );

    // SSM access — scoped to THIS env's parameter namespace only.
    // getServerEnv() (app/app/api/_lib/server-env.ts) resolves every value from
    // process.env first and only falls back to SSM; when it does, it tries the
    // prefixed parameter (`${SSM_PARAMETER_PREFIX}/<KEY>`) BEFORE any bare-name
    // candidate, so the role never needs access outside the prefix. The
    // unreachable bare-name fallbacks now return AccessDenied instead of
    // ParameterNotFound — server-env treats both as skippable (isMissingParameterError).
    lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "SsmConfigAccess",
        actions: ["ssm:GetParameter", "ssm:GetParameters"],
        resources: [
          `arn:${cdk.Aws.PARTITION}:ssm:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:parameter${props.ssmPrefix}/*`,
        ],
      }),
    );

    // SES access — transactional/notification emails are sent from an address
    // on the app's verified domain (e.g. info@chapterflow.ca via SES_SENDER_EMAIL).
    // Scope SendEmail to that domain's SES identity so the role can't send as an
    // arbitrary identity.
    //
    // WS6-003: all three envs share ONE AWS account and SES is account-global, so
    // a "*" resource here would reach the PROD SES identities from a dev/staging
    // role. We therefore add this statement ONLY when this env's verified domain is
    // known at synth (prod always has it — bin/app.ts asserts it). A non-prod synth
    // without a domain gets NO SES grant at all, so an email send there fails closed
    // with AccessDenied in that env instead of gaining an account-wide send.
    if (props.domainName) {
      lambdaRole.addToPolicy(
        new iam.PolicyStatement({
          sid: "SesSendAccess",
          actions: ["ses:SendEmail", "sesv2:SendEmail"],
          resources: [
            `arn:${cdk.Aws.PARTITION}:ses:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:identity/${props.domainName}`,
          ],
        }),
      );
    }

    // Cognito admin access — the admin "erase user" tool resolves a user by
    // sub (ListUsers) and removes them from the pool (AdminDeleteUser) as part
    // of a GDPR-style complete erasure. AdminUserGlobalSignOut additionally
    // revokes a user's outstanding refresh tokens server-side on self-delete /
    // deactivate (step-up auth, #5 Tier 2) so a stolen refresh token dies
    // immediately. Scoped to the configured pool.
    //
    // WS6-003: all three envs share ONE AWS account and Cognito is account-global,
    // so a "*" resource here would grant AdminDeleteUser on the PROD user pool from
    // a dev/staging role. We therefore add this statement ONLY when this env's pool
    // id is known at synth (prod always has it — bin/app.ts asserts it). A non-prod
    // synth without COGNITO_USER_POOL_ID gets NO Cognito grant at all, so the
    // admin-erasure tool there fails closed with AccessDenied in that env instead of
    // reaching the prod pool.
    //
    // DEPLOY ORDER (HIGH if mis-ordered): ship this IAM grant BEFORE the
    // app code that calls AdminUserGlobalSignOut, or the call fails AccessDenied,
    // is swallowed into an ops-failure, and the delete still returns success
    // (sessions look revoked but aren't).
    const cognitoUserPoolId = process.env.COGNITO_USER_POOL_ID;
    if (cognitoUserPoolId) {
      lambdaRole.addToPolicy(
        new iam.PolicyStatement({
          sid: "CognitoAdminUserErasure",
          actions: [
            "cognito-idp:ListUsers",
            "cognito-idp:AdminDeleteUser",
            "cognito-idp:AdminUserGlobalSignOut",
          ],
          resources: [
            `arn:${cdk.Aws.PARTITION}:cognito-idp:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:userpool/${cognitoUserPoolId}`,
          ],
        }),
      );
    }

    // SQS access — revalidation queue
    lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "RevalidationQueueAccess",
        actions: [
          "sqs:SendMessage",
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes",
          "sqs:GetQueueUrl",
        ],
        resources: [revalidationQueue.queueArn],
      }),
    );

    // -------------------------------------------------------------------
    // Common Lambda environment variables
    // -------------------------------------------------------------------

    // Secrets-free infrastructure env: resource names plus the OpenNext ISR
    // cache/queue wiring. Safe to hand to the auxiliary functions (image
    // optimizer, revalidation, dynamo provider, warmer) — none of them run
    // application code that needs the Stripe / AI / auth secrets.
    const baseInfraEnv: Record<string, string> = {
      // App data resources
      BOOK_TABLE_NAME: props.appTableName,
      BOOK_ANALYTICS_TABLE_NAME: props.analyticsTableName,
      BOOK_INGEST_BUCKET: props.ingestBucketName,
      BOOK_CONTENT_BUCKET: props.contentBucketName,
      SSM_PARAMETER_PREFIX: props.ssmPrefix,
      // OpenNext ISR infrastructure
      CACHE_BUCKET_NAME: assetsBucket.bucketName,
      CACHE_BUCKET_KEY_PREFIX: "_cache",
      CACHE_DYNAMO_TABLE: cacheTable.tableName,
      REVALIDATION_QUEUE_URL: revalidationQueue.queueUrl,
      REVALIDATION_QUEUE_REGION: this.region,
      // App config
      CHAPTERFLOW_DEPLOYMENT_MODE: "standalone",
      CHAPTERFLOW_ENV: props.envName,
      NODE_ENV: "production",
    };

    // WS6-002 interim origin lock. Only the two inbound-HTTP functions (server +
    // image) enforce the shared secret, so it goes ONLY into their env — never
    // into baseInfraEnv, which is spread into the revalidation / warmer / dynamo
    // provider functions. (The revalidation fn separately receives the SECRET
    // alone — not via baseInfraEnv — because its outbound ISR self-fetch hits
    // the raw server Function URL and must stamp the header; see its wrapper.)
    // Emitted only when the secret is set, so unset = no env diff.
    const originVerifySecret = props.originVerifySecret;
    const originVerifyEnv: Record<string, string> = originVerifySecret
      ? {
          ORIGIN_VERIFY_SECRET: originVerifySecret,
          ORIGIN_VERIFY_MODE: props.originVerifyMode ?? "enforce",
        }
      : {};

    // Server-only env: the infra vars PLUS the caller-provided secrets (Stripe
    // secret/webhook/price keys, Anthropic + ElevenLabs API keys,
    // AUTH_STATE_SECRET, full Cognito config — see infra/bin/app.ts). Only the
    // server Lambda needs these, so they are NOT spread into the auxiliary
    // functions below (least-privilege secret blast radius).
    const commonEnv: Record<string, string> = {
      ...baseInfraEnv,
      // Merge caller-provided env vars (secrets come from here)
      ...(props.serverEnv ?? {}),
      ...originVerifyEnv,
    };

    // -------------------------------------------------------------------
    // Lambda — Server function
    // -------------------------------------------------------------------

    this.serverFunction = new lambda.Function(this, "ServerFn", {
      functionName: name("ChapterFlowServer"),
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset(
        path.join(openNextDir, "server-functions/default"),
      ),
      memorySize: 1024,
      // Apple's official Production verifier allows an OCSP responder up to
      // 30s before returning a retryable failure. Leave enough time to map that
      // failure to the stable 503 response rather than hard-killing Lambda.
      timeout: cdk.Duration.seconds(45),
      role: lambdaRole,
      environment: commonEnv,
      architecture: lambda.Architecture.X86_64,
      logRetention: logs.RetentionDays.ONE_MONTH,
      // WS6-029: the server Lambda is the fan-out hop (DynamoDB/S3/Stripe/
      // Cognito/Anthropic/ElevenLabs) that ServerFnDurationAlarm watches at
      // p99>=20s; ACTIVE tracing is what lets an operator see WHERE that time
      // went. The auxiliary OpenNext functions below (Image/Revalidation/
      // Warmer/DynamoProvider) are single-hop plumbing and stay untraced.
      tracing: lambda.Tracing.ACTIVE,
    });

    // authType NONE — public Function URL fronted by CloudFront. An earlier
    // change (X2) locked this to AWS_IAM + Origin Access Control, but OAC SigV4
    // signing against a RESPONSE_STREAM Function URL was rejected at runtime:
    // every route 403'd with Lambda "Forbidden / Function URL authorization"
    // (AccessDeniedException), a failure cdk synth cannot catch. Reverted to
    // restore service.
    //
    // WS6-002 interim mitigation (current): when originVerifySecret is set,
    // CloudFront injects a shared-secret x-origin-verify header on this origin
    // and middleware.ts rejects any request lacking it (the image origin is
    // guarded the same way by the origin-verify wrapper). That closes the
    // direct-Function-URL bypass without SigV4. Data is also still gated by the
    // app's own auth (requireUser / requireActiveBookUser).
    //
    // The AWS_IAM + OAC re-lock remains the tracked follow-up and MUST be
    // validated on a non-prod deploy before shipping (custom origin-request
    // policy excluding Host + Authorization, and UNSIGNED-PAYLOAD signing for the
    // stream) — cdk synth cannot catch the runtime 403 failure mode.
    const serverFnUrl = this.serverFunction.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      invokeMode: lambda.InvokeMode.RESPONSE_STREAM,
    });

    // -------------------------------------------------------------------
    // Lambda — Image optimization
    // -------------------------------------------------------------------

    // The image Function URL is authType NONE too, so it gets the same interim
    // origin lock — but as a Lambda (no middleware in front), the check runs in a
    // thin wrapper prepended to the generated handler. Bundle the generated dir
    // PLUS infra/assets/origin-verify-wrapper.mjs into the asset and point the
    // handler at the wrapper. The wrapper no-ops without ORIGIN_VERIFY_SECRET, so
    // it is applied unconditionally. Bundling uses a LOCAL bundler only (a plain
    // fs.cpSync copy) and never docker: tryBundle throws on failure rather than
    // returning false, so CDK cannot silently fall back to the (unavailable)
    // docker path. The `image` is a required field but is never invoked.
    const imageSourceDir = path.join(openNextDir, "image-optimization-function");
    const originVerifyWrapper = path.join(
      __dirname,
      "../assets/origin-verify-wrapper.mjs",
    );
    const imageFn = new lambda.Function(this, "ImageFn", {
      functionName: name("ChapterFlowImage"),
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "origin-verify-wrapper.handler",
      code: lambda.Code.fromAsset(imageSourceDir, {
        bundling: {
          image: cdk.DockerImage.fromRegistry(
            "public.ecr.aws/docker/library/node:20",
          ),
          local: {
            tryBundle(outputDir: string): boolean {
              fs.cpSync(imageSourceDir, outputDir, { recursive: true });
              fs.cpSync(
                originVerifyWrapper,
                path.join(outputDir, "origin-verify-wrapper.mjs"),
              );
              return true;
            },
          },
        },
      }),
      memorySize: 1536,
      timeout: cdk.Duration.seconds(25),
      // Least-privilege: its own auto-created role (basic execution) plus read
      // on the assets bucket only (granted below). No app secrets, no
      // DynamoDB / SES / Cognito access — image optimization needs none of it.
      // The origin-verify secret (server-only class) is added ONLY when set so
      // the wrapper can enforce; unset = no env diff.
      environment: {
        BUCKET_NAME: assetsBucket.bucketName,
        BUCKET_KEY_PREFIX: "_assets",
        ...baseInfraEnv,
        ...originVerifyEnv,
      },
      architecture: lambda.Architecture.X86_64,
      logRetention: logs.RetentionDays.ONE_MONTH,
    });
    // Image optimization only reads original images from the assets bucket.
    assetsBucket.grantRead(imageFn);

    const imageFnUrl = imageFn.addFunctionUrl({
      // authType NONE — see the serverFnUrl note above (OAC lock reverted).
      authType: lambda.FunctionUrlAuthType.NONE,
    });

    // -------------------------------------------------------------------
    // Lambda — Revalidation (triggered by SQS)
    // -------------------------------------------------------------------

    // The revalidation adapter re-renders a stale ISR page with a HEAD request
    // to the host the server saw when enqueuing — which is the RAW server
    // Function URL domain (CloudFront strips the viewer Host header), so the
    // self-fetch bypasses CloudFront and would be 403'd by the origin lock in
    // enforce mode (breaking ISR and paging RevalidationDlqDepthAlarm). The
    // wrapper injects x-origin-verify into this function's outbound HTTPS so the
    // self-fetch stays authorized — see origin-verify-revalidation-wrapper.mjs.
    // Same local-only bundling contract as ImageFn above (throws, never docker).
    const revalidationSourceDir = path.join(
      openNextDir,
      "revalidation-function",
    );
    const revalidationWrapper = path.join(
      __dirname,
      "../assets/origin-verify-revalidation-wrapper.mjs",
    );
    const revalidationFn = new lambda.Function(this, "RevalidationFn", {
      functionName: name("ChapterFlowRevalidation"),
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "origin-verify-revalidation-wrapper.handler",
      code: lambda.Code.fromAsset(revalidationSourceDir, {
        bundling: {
          image: cdk.DockerImage.fromRegistry(
            "public.ecr.aws/docker/library/node:20",
          ),
          local: {
            tryBundle(outputDir: string): boolean {
              fs.cpSync(revalidationSourceDir, outputDir, { recursive: true });
              fs.cpSync(
                revalidationWrapper,
                path.join(
                  outputDir,
                  "origin-verify-revalidation-wrapper.mjs",
                ),
              );
              return true;
            },
          },
        },
      }),
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      // Least-privilege: its own auto-created role plus the ISR cache table; SQS
      // consume permissions are granted by addEventSource() below. No app
      // secrets — the origin-verify secret is the one exception, carried ONLY so
      // the wrapper can stamp the OUTBOUND self-fetch (this fn takes no inbound
      // HTTP); emitted only when set, so unset = no env diff.
      environment: {
        ...baseInfraEnv,
        ...(originVerifySecret
          ? { ORIGIN_VERIFY_SECRET: originVerifySecret }
          : {}),
      },
      architecture: lambda.Architecture.X86_64,
      logRetention: logs.RetentionDays.ONE_MONTH,
    });
    cacheTable.grantReadWriteData(revalidationFn);

    revalidationFn.addEventSource(
      new eventSources.SqsEventSource(revalidationQueue, { batchSize: 5 }),
    );

    // -------------------------------------------------------------------
    // Lambda — DynamoDB provider (tag cache init)
    // -------------------------------------------------------------------

    const dynamoProviderFn = new lambda.Function(this, "DynamoProviderFn", {
      functionName: name("ChapterFlowDynamoProvider"),
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset(
        path.join(openNextDir, "dynamodb-provider"),
      ),
      memorySize: 256,
      timeout: cdk.Duration.minutes(15),
      // Least-privilege: its own auto-created role plus the ISR cache table only.
      environment: baseInfraEnv,
      architecture: lambda.Architecture.X86_64,
      logRetention: logs.RetentionDays.ONE_MONTH,
    });
    cacheTable.grantReadWriteData(dynamoProviderFn);

    // -------------------------------------------------------------------
    // Lambda — Warmer (keeps server function warm)
    // -------------------------------------------------------------------

    const warmerFn = new lambda.Function(this, "WarmerFn", {
      functionName: name("ChapterFlowWarmer"),
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset(path.join(openNextDir, "warmer-function")),
      memorySize: 256,
      timeout: cdk.Duration.minutes(1),
      // Least-privilege: its own auto-created role plus invoke on the server
      // function only (granted below via a constructed ARN). No secrets.
      environment: {
        FUNCTION_NAME: name("ChapterFlowServer"),
        CONCURRENCY: "1",
        ...baseInfraEnv,
      },
      architecture: lambda.Architecture.X86_64,
      logRetention: logs.RetentionDays.ONE_MONTH,
    });

    // Invoke warmer every 5 minutes
    const warmerRule = new events.Rule(this, "WarmerSchedule", {
      schedule: events.Schedule.rate(cdk.Duration.minutes(5)),
    });
    warmerRule.addTarget(new targets.LambdaFunction(warmerFn));

    // Warmer needs to invoke the server function. Attach this to the warmer's
    // OWN role (not the shared server role — least-privilege), and use a
    // constructed ARN instead of this.serverFunction.functionArn to avoid a
    // circular dependency (WarmerRole → ServerFn GetAtt → …).
    warmerFn.addToRolePolicy(
      new iam.PolicyStatement({
        sid: "InvokeServerFn",
        actions: ["lambda:InvokeFunction"],
        resources: [
          cdk.Arn.format(
            {
              service: "lambda",
              resource: "function",
              resourceName: name("ChapterFlowServer"),
            },
            this,
          ),
        ],
      }),
    );

    // -------------------------------------------------------------------
    // S3 deployment — upload static assets
    // -------------------------------------------------------------------

    new s3deploy.BucketDeployment(this, "DeployAssets", {
      sources: [s3deploy.Source.asset(path.join(openNextDir, "assets"))],
      destinationBucket: assetsBucket,
      destinationKeyPrefix: "_assets",
      prune: false,
      memoryLimit: 1024,
      ephemeralStorageSize: cdk.Size.mebibytes(1024),
    });

    // Deploy cache assets (ISR pre-rendered pages)
    new s3deploy.BucketDeployment(this, "DeployCache", {
      sources: [s3deploy.Source.asset(path.join(openNextDir, "cache"))],
      destinationBucket: assetsBucket,
      destinationKeyPrefix: "_cache",
      prune: false,
      memoryLimit: 512,
    });

    // Deploy the authored book packages to the content bucket. The server reads
    // these from S3 at runtime (quiz/audio/ask) instead of bundling all ~37.6 MB
    // into the ServerFn, which would exceed Lambda's 250 MiB unzipped limit (#257).
    // BucketDeployment uses its OWN managed-Lambda role to write — the GitHub OIDC
    // deploy role has no direct s3:PutObject on the content bucket, which is why a
    // plain in-workflow upload failed (#259). Each file is named <bookId>.v21.json,
    // so it lands at book-content/packages/<bookId>.v21.json where
    // getServerBookPackage() fetches it. prune:false + the dedicated key prefix
    // mean it never touches the other book-content/* prefixes (books/, library/, …).
    const bookContentBucket = s3.Bucket.fromBucketName(
      this,
      "BookPackagesContentBucket",
      props.contentBucketName,
    );
    new s3deploy.BucketDeployment(this, "DeployBookPackages", {
      sources: [
        s3deploy.Source.asset(path.join(__dirname, "../../book-packages"), {
          exclude: ["README.md", "_quarantined", "_quarantined/**"],
        }),
      ],
      destinationBucket: bookContentBucket,
      destinationKeyPrefix: "book-content/packages",
      contentType: "application/json",
      prune: false,
      memoryLimit: 512,
    });

    // -------------------------------------------------------------------
    // ACM Certificate
    // -------------------------------------------------------------------

    let certificate: acm.ICertificate | undefined;
    let hostedZone: route53.IHostedZone | undefined;

    // Only create certificate and DNS records if we have a domain
    if (domainName) {
      hostedZone = route53.HostedZone.fromLookup(this, "HostedZone", {
        domainName,
      });

      certificate = new acm.Certificate(this, "Certificate", {
        domainName: `app.${domainName}`,
        subjectAlternativeNames: [domainName, `www.${domainName}`],
        validation: acm.CertificateValidation.fromDns(hostedZone),
      });
    }

    // -------------------------------------------------------------------
    // CloudFront Distribution
    // -------------------------------------------------------------------

    // Use OAI instead of OAC to avoid circular dependency:
    // OAC creates a bucket policy referencing the Distribution ID, but the
    // Distribution depends on the bucket as origin → cycle.
    // OAI grants access to an identity, not the distribution, breaking the cycle.
    const s3Origin = origins.S3BucketOrigin.withOriginAccessIdentity(
      assetsBucket,
      { originPath: "/_assets" },
    );

    // Plain Function URL origins (no OAC). The OAC lock (X2) is reverted here —
    // see the serverFnUrl note above for why and the re-locking follow-up. The
    // interim origin lock rides on custom origin headers instead: CloudFront
    // injects x-origin-verify (WS6-002) alongside the existing x-forwarded-host.
    const serverCustomHeaders: Record<string, string> = {
      // Tell OpenNext the public host (custom domain). With no custom domain
      // (dev/staging), omit it — OpenNext falls back to the CloudFront host.
      ...(appDomain ? { "x-forwarded-host": appDomain } : {}),
      // WS6-002 shared secret; omitted when unset so the header (and its diff)
      // only appear once the secret is introduced.
      ...(originVerifySecret ? { "x-origin-verify": originVerifySecret } : {}),
    };
    const serverOrigin = new origins.FunctionUrlOrigin(serverFnUrl, {
      // Must exceed ServerFn's timeout so CloudFront never closes first during
      // the official verifier's worst-case OCSP timeout path.
      readTimeout: cdk.Duration.seconds(60),
      ...(Object.keys(serverCustomHeaders).length > 0
        ? { customHeaders: serverCustomHeaders }
        : {}),
    });

    const imageOrigin = originVerifySecret
      ? new origins.FunctionUrlOrigin(imageFnUrl, {
          customHeaders: { "x-origin-verify": originVerifySecret },
        })
      : new origins.FunctionUrlOrigin(imageFnUrl);

    // Cache policies
    const serverCachePolicy = new cloudfront.CachePolicy(
      this,
      "ServerCachePolicy",
      {
        cachePolicyName: name("ChapterFlowServerPolicy"),
        defaultTtl: cdk.Duration.seconds(0),
        maxTtl: cdk.Duration.days(365),
        minTtl: cdk.Duration.seconds(0),
        headerBehavior: cloudfront.CacheHeaderBehavior.allowList(
          "x-open-next-cache-key",
          "rsc",
          "next-router-prefetch",
          "next-router-state-tree",
          "next-url",
          "accept",
        ),
        queryStringBehavior:
          cloudfront.CacheQueryStringBehavior.all(),
        cookieBehavior: cloudfront.CacheCookieBehavior.none(),
        enableAcceptEncodingGzip: true,
        enableAcceptEncodingBrotli: true,
      },
    );

    const staticCachePolicy = new cloudfront.CachePolicy(
      this,
      "StaticCachePolicy",
      {
        cachePolicyName: name("ChapterFlowStaticPolicy"),
        defaultTtl: cdk.Duration.days(30),
        maxTtl: cdk.Duration.days(365),
        minTtl: cdk.Duration.days(1),
        queryStringBehavior: cloudfront.CacheQueryStringBehavior.none(),
        cookieBehavior: cloudfront.CacheCookieBehavior.none(),
        enableAcceptEncodingGzip: true,
        enableAcceptEncodingBrotli: true,
      },
    );

    // Origin request policy for server function.
    // IMPORTANT: Do NOT forward the Host header — Lambda Function URLs
    // reject requests where Host doesn't match their own domain, returning
    // {"Message":null}. Instead, we pass the real host via x-forwarded-host
    // (set as a custom header on the origin — see FunctionUrlOrigin customHeaders).
    //
    // Use the AWS-managed AllViewerExceptHostHeader policy which forwards
    // all viewer headers, cookies, and query strings BUT excludes the Host
    // header so the Lambda Function URL receives its own hostname (and
    // OpenNext reads x-forwarded-host for the public-facing host).
    //
    // Note: the AllViewerAndCloudFrontHeaders-2022-06 policy DOES forward
    // the viewer Host header, which broke Lambda Function URL with
    // {"Message":null}. Without that policy, CloudFront does NOT auto-add
    // the cloudfront-viewer-* geo headers to origin requests. Geographic
    // intelligence will be picked up from other headers if available
    // (x-forwarded-for, etc.) or deferred until we add Lambda@Edge / a
    // CloudFront Function for geo header injection.
    const serverOriginRequestPolicy =
      cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER;

    // -------------------------------------------------------------------
    // WAFv2 — edge firewall for the distribution
    // -------------------------------------------------------------------
    // The SSR app is publicly reachable; the bare Function URLs gave it no edge
    // rate-limiting or bot protection. Attach a WebACL with the AWS managed
    // common rule set and a per-IP rate limit. CLOUDFRONT-scoped WebACLs must
    // live in us-east-1 — this stack is pinned there (env-config REGION) because
    // its ACM cert is consumed directly by CloudFront, so this is always valid.
    const webAcl = new wafv2.CfnWebACL(this, "WebAcl", {
      name: name("ChapterFlowWebAcl"),
      scope: "CLOUDFRONT",
      defaultAction: { allow: {} },
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: name("ChapterFlowWebAcl"),
        sampledRequestsEnabled: true,
      },
      // Rule list (incl. the AWS managed common rule set with ruleActionOverrides
      // that downgrade XSS-lookalike body/query/cookie + body-size sub-rules to
      // Count) is built in waf-rules.ts so its shape is unit-testable without an
      // App/Stack synth context. See that file for the false-positive rationale.
      rules: buildWebAclRules(),
    });

    this.distribution = new cloudfront.Distribution(this, "Distribution", {
      comment: "ChapterFlow OpenNext",
      defaultBehavior: {
        origin: serverOrigin,
        viewerProtocolPolicy:
          cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: serverCachePolicy,
        originRequestPolicy: serverOriginRequestPolicy,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        responseHeadersPolicy:
          cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
      },
      additionalBehaviors: {
        "_next/static/*": {
          origin: s3Origin,
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: staticCachePolicy,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        },
        "_next/image*": {
          origin: imageOrigin,
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: serverCachePolicy,
          originRequestPolicy: serverOriginRequestPolicy,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        },
        "_next/data/*": {
          origin: serverOrigin,
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: serverCachePolicy,
          originRequestPolicy: serverOriginRequestPolicy,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        },
        "BUILD_ID": {
          origin: s3Origin,
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: staticCachePolicy,
        },
        "favicon.ico": {
          origin: s3Origin,
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: staticCachePolicy,
        },
        "icon.svg": {
          origin: s3Origin,
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: staticCachePolicy,
        },
        "robots.txt": {
          origin: s3Origin,
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: staticCachePolicy,
        },
        "sitemap.xml": {
          origin: s3Origin,
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: staticCachePolicy,
        },
        "fonts/*": {
          origin: s3Origin,
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: staticCachePolicy,
        },
        "book-covers/*": {
          origin: s3Origin,
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: staticCachePolicy,
        },
      },
      ...(certificate && appDomain && domainName
        ? {
            certificate,
            domainNames: [appDomain, domainName, `www.${domainName}`],
          }
        : {}),
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      webAclId: webAcl.attrArn,
      // NOTE: deliberately NO errorResponses mapping 403/404 → 200 "/".
      // CloudFront custom error responses fire on the ORIGIN status regardless
      // of path, so rewriting 4xx to a 200 homepage would corrupt every JSON
      // 403/404 the API legitimately returns (account_deleted, chapter_locked,
      // book_not_found, admin 404s) and turn removed deep links into soft-404s.
      // OpenNext serves the Next.js not-found page with a real 404 status.
    });

    // -------------------------------------------------------------------
    // Route53 — DNS records (only when domain + hosted zone exist)
    // -------------------------------------------------------------------

    if (hostedZone) {
      // app.chapterflow.ca
      new route53.ARecord(this, "AppARecord", {
        zone: hostedZone,
        recordName: appDomain,
        target: route53.RecordTarget.fromAlias(
          new route53Targets.CloudFrontTarget(this.distribution),
        ),
      });

      new route53.AaaaRecord(this, "AppAaaaRecord", {
        zone: hostedZone,
        recordName: appDomain,
        target: route53.RecordTarget.fromAlias(
          new route53Targets.CloudFrontTarget(this.distribution),
        ),
      });

      // chapterflow.ca (root)
      new route53.ARecord(this, "RootARecord", {
        zone: hostedZone,
        target: route53.RecordTarget.fromAlias(
          new route53Targets.CloudFrontTarget(this.distribution),
        ),
      });

      new route53.AaaaRecord(this, "RootAaaaRecord", {
        zone: hostedZone,
        target: route53.RecordTarget.fromAlias(
          new route53Targets.CloudFrontTarget(this.distribution),
        ),
      });

      // www.chapterflow.ca
      new route53.ARecord(this, "WwwARecord", {
        zone: hostedZone,
        recordName: `www.${domainName}`,
        target: route53.RecordTarget.fromAlias(
          new route53Targets.CloudFrontTarget(this.distribution),
        ),
      });

      new route53.AaaaRecord(this, "WwwAaaaRecord", {
        zone: hostedZone,
        recordName: `www.${domainName}`,
        target: route53.RecordTarget.fromAlias(
          new route53Targets.CloudFrontTarget(this.distribution),
        ),
      });
    }

    // -------------------------------------------------------------------
    // CloudWatch alarms — Lambda / SQS / CloudFront / billing webhook
    // -------------------------------------------------------------------

    // Reuse the backend stack's ops SNS topic (same account/region) by
    // reconstructing its ARN by name. This matches the codebase's
    // reference-by-name convention (the backend OpsFailure alarm references a
    // CloudWatch metric by name across stacks the same way) and avoids
    // CloudFormation cross-stack export coupling. Email subscriptions are
    // managed on the backend topic (CHAPTERFLOW_OPS_ALERT_EMAIL).
    const opsTopic = sns.Topic.fromTopicArn(
      this,
      "OpsAlertsTopic",
      `arn:${cdk.Aws.PARTITION}:sns:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:ChapterFlowOpsAlerts${suffix}`,
    );
    const opsAction = new cloudwatchActions.SnsAction(opsTopic);

    // Critical (paging) topic (WS6-034) — reconstructed by ARN, same
    // cross-stack-by-name convention as opsTopic above. Subscriptions live on
    // the backend topic (CHAPTERFLOW_OPS_PAGER_URL / CHAPTERFLOW_OPS_CRITICAL_ALERT_EMAIL).
    const opsCriticalTopic = sns.Topic.fromTopicArn(
      this,
      "OpsCriticalTopic",
      `arn:${cdk.Aws.PARTITION}:sns:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:ChapterFlowOpsCritical${suffix}`,
    );
    const criticalAction = new cloudwatchActions.SnsAction(opsCriticalTopic);

    const makeAlarm = (
      id: string,
      metric: cloudwatch.IMetric,
      threshold: number,
      alarmDescription: string,
      opts?: {
        evaluationPeriods?: number;
        datapointsToAlarm?: number;
        // WS6-034: "critical" ADDS criticalAction alongside opsAction (never
        // instead of) so the existing inbox keeps full visibility.
        severity?: "critical" | "warning";
      },
    ): cloudwatch.Alarm => {
      const alarm = new cloudwatch.Alarm(this, id, {
        metric,
        threshold,
        evaluationPeriods: opts?.evaluationPeriods ?? 1,
        datapointsToAlarm: opts?.datapointsToAlarm ?? 1,
        comparisonOperator:
          cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        alarmDescription,
      });
      alarm.addAlarmAction(opsAction);
      if (opts?.severity === "critical") {
        alarm.addAlarmAction(criticalAction);
      }
      return alarm;
    };

    const alarmPeriod = cdk.Duration.minutes(5);

    // Server Lambda — errors, throttles, and latency trending toward the 45s timeout.
    makeAlarm(
      "ServerFnErrorsAlarm",
      this.serverFunction.metricErrors({ period: alarmPeriod, statistic: "sum" }),
      5,
      "ChapterFlow server Lambda returned ≥5 errors in 5 minutes (elevated 5xx).",
      { severity: "critical" },
    );
    makeAlarm(
      "ServerFnThrottlesAlarm",
      this.serverFunction.metricThrottles({ period: alarmPeriod, statistic: "sum" }),
      1,
      "ChapterFlow server Lambda is being throttled (concurrency limit hit).",
      { severity: "critical" },
    );
    makeAlarm(
      "ServerFnDurationAlarm",
      this.serverFunction.metricDuration({ period: alarmPeriod, statistic: "p99" }),
      20000,
      "ChapterFlow server Lambda p99 duration ≥20s — early warning below the 45s timeout.",
      { evaluationPeriods: 3, datapointsToAlarm: 2 },
    );

    // Revalidation Lambda errors + dead-letter / stuck-queue depth.
    makeAlarm(
      "RevalidationFnErrorsAlarm",
      revalidationFn.metricErrors({ period: alarmPeriod, statistic: "sum" }),
      1,
      "ISR revalidation Lambda is erroring — cached pages may be stale.",
    );
    makeAlarm(
      "RevalidationDlqDepthAlarm",
      revalidationDlq.metricApproximateNumberOfMessagesVisible({
        period: alarmPeriod,
        statistic: "max",
      }),
      1,
      "Revalidation messages have landed in the DLQ — ISR revalidation is failing.",
      { severity: "critical" },
    );
    makeAlarm(
      "RevalidationQueueAgeAlarm",
      revalidationQueue.metricApproximateAgeOfOldestMessage({
        period: alarmPeriod,
        statistic: "max",
      }),
      300,
      "Oldest revalidation message is >5 min old — the queue is backing up.",
    );

    // CloudFront edge 5xx rate (percent). Sustained over 3 periods to avoid
    // paging on a transient blip.
    makeAlarm(
      "CloudFront5xxAlarm",
      this.distribution.metric5xxErrorRate({ period: alarmPeriod, statistic: "Average" }),
      1,
      "CloudFront is serving >1% 5xx responses at the edge.",
      { evaluationPeriods: 3, datapointsToAlarm: 3, severity: "critical" },
    );

    // Stripe webhook processing failures — the server emits this custom metric
    // (putOpsMetric, ChapterFlow/Ops namespace) when a delivery fails after
    // signature verification. Referenced by name, like the backend OpsFailure alarm.
    makeAlarm(
      "StripeWebhookFailureAlarm",
      new cloudwatch.Metric({
        namespace: "ChapterFlow/Ops",
        metricName: "StripeWebhookFailure",
        statistic: "Sum",
        period: alarmPeriod,
      }),
      1,
      "A Stripe webhook delivery failed to process (post-signature). Stripe will retry; check the billing webhook logs and reconciliation tool.",
      { severity: "critical" },
    );

    // -------------------------------------------------------------------
    // SLO burn-rate alerting — edge availability (WS6-030)
    // -------------------------------------------------------------------
    // Multi-window multi-burn-rate alerts on the edge-availability SLI, per the
    // Google SRE Workbook (Ch. 5) and docs/SLOS.md. The static CloudFront5xx
    // alarm above pages on a fixed 1% threshold regardless of how fast the
    // monthly error budget is actually burning — it over-pages on a low-traffic
    // blip and under-pages on a slow leak. These page on budget burn RATE
    // instead, so the alert stays calibrated as traffic grows.
    //
    // SLI: edge availability = 1 − CloudFront 5xxErrorRate. This is the paging
    // SLI because it is what users see, including cached / CDN-served paths the
    // server Lambda never handles (see docs/SLOS.md).
    //
    // These constants ARE the SLO objective — every threshold below is derived
    // from them; changing one here must change docs/SLOS.md too.
    const SLO_EDGE_AVAILABILITY_TARGET = 0.999; // 99.9% monthly = 43.2 min/mo budget — docs/SLOS.md
    const SLO_FAST_BURN_MULTIPLE = 14.4; // page: 2% of the monthly budget in 1h — docs/SLOS.md
    const SLO_SLOW_BURN_MULTIPLE = 6; // page: 5% of the monthly budget in 6h — docs/SLOS.md

    // burn rate = (5xxErrorRate% / 100) / (1 − target). One MathExpression per
    // window; the window is set by the underlying metric's period (kept equal to
    // the expression's to avoid a period-mismatch warning).
    const edgeBurnRateMetric = (
      label: string,
      window: cdk.Duration,
    ): cloudwatch.MathExpression =>
      new cloudwatch.MathExpression({
        expression: `rate5xx / 100 / (1 - ${SLO_EDGE_AVAILABILITY_TARGET})`,
        usingMetrics: {
          rate5xx: this.distribution.metric5xxErrorRate({
            period: window,
            statistic: "Average",
          }),
        },
        period: window,
        label,
      });

    // Four threshold alarms with NO actions of their own — the two
    // CompositeAlarms below (long-window AND short-window) carry the paging
    // action. Requiring the short window too stops stale paging: once the
    // incident clears, the 5m/30m window recovers within one period and drops
    // the composite, instead of holding ALARM for the whole long window.
    const burnAlarm = (
      id: string,
      alarmName: string,
      metric: cloudwatch.IMetric,
      multiple: number,
      alarmDescription: string,
    ): cloudwatch.Alarm =>
      new cloudwatch.Alarm(this, id, {
        alarmName,
        metric,
        threshold: multiple,
        evaluationPeriods: 1,
        datapointsToAlarm: 1,
        comparisonOperator:
          cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        alarmDescription,
      });

    const sloFastBurn1h = burnAlarm(
      "SloFastBurn1hAlarm",
      `ChapterFlowSloFastBurn1h${suffix}`,
      edgeBurnRateMetric("edge availability burn rate (1h)", cdk.Duration.hours(1)),
      SLO_FAST_BURN_MULTIPLE,
      "SLO edge-availability fast-burn member (1h window): edge 5xx burning the 99.9% monthly budget at ≥14.4× sustainable (5xx ≥1.44%). Long window of the fast-burn pair; page only via ChapterFlowSloFastBurn.",
    );
    const sloFastBurn5m = burnAlarm(
      "SloFastBurn5mAlarm",
      `ChapterFlowSloFastBurn5m${suffix}`,
      edgeBurnRateMetric("edge availability burn rate (5m)", cdk.Duration.minutes(5)),
      SLO_FAST_BURN_MULTIPLE,
      "SLO edge-availability fast-burn member (5m window): edge 5xx burn ≥14.4× sustainable. Short window of the fast-burn pair — clears within one period on recovery.",
    );
    const sloSlowBurn6h = burnAlarm(
      "SloSlowBurn6hAlarm",
      `ChapterFlowSloSlowBurn6h${suffix}`,
      edgeBurnRateMetric("edge availability burn rate (6h)", cdk.Duration.hours(6)),
      SLO_SLOW_BURN_MULTIPLE,
      "SLO edge-availability slow-burn member (6h window): edge 5xx burning the 99.9% monthly budget at ≥6× sustainable (5xx ≥0.6%). Long window of the slow-burn pair; page only via ChapterFlowSloSlowBurn.",
    );
    const sloSlowBurn30m = burnAlarm(
      "SloSlowBurn30mAlarm",
      `ChapterFlowSloSlowBurn30m${suffix}`,
      edgeBurnRateMetric("edge availability burn rate (30m)", cdk.Duration.minutes(30)),
      SLO_SLOW_BURN_MULTIPLE,
      "SLO edge-availability slow-burn member (30m window): edge 5xx burn ≥6× sustainable. Short window of the slow-burn pair — clears within one period on recovery.",
    );

    // Composite alarms carry the paging action. Fast-burn additionally pages
    // opsCriticalTopic (WS6-034) — a budget exhausted in ~50h is a "needs a
    // human NOW" outage; slow-burn (~5 days to exhaustion) stays on the
    // existing ticket-grade topic only.
    const sloFastBurnAlarm = new cloudwatch.CompositeAlarm(this, "SloFastBurnAlarm", {
      compositeAlarmName: `ChapterFlowSloFastBurn${suffix}`,
      alarmRule: cloudwatch.AlarmRule.allOf(
        cloudwatch.AlarmRule.fromAlarm(sloFastBurn1h, cloudwatch.AlarmState.ALARM),
        cloudwatch.AlarmRule.fromAlarm(sloFastBurn5m, cloudwatch.AlarmState.ALARM),
      ),
      alarmDescription:
        "PAGE — SLO edge-availability FAST burn (99.9% monthly). Edge 5xx is burning the 43.2-min/mo error budget at ≥14.4× sustainable on BOTH the 1h and 5m windows (5xx ≥1.44%); at this rate the whole month's budget is exhausted in ~50h (2% per hour). Runbook: docs/OPERATIONS.md §4 → docs/SLOS.md.",
    });
    sloFastBurnAlarm.addAlarmAction(opsAction);
    sloFastBurnAlarm.addAlarmAction(criticalAction);

    const sloSlowBurnAlarm = new cloudwatch.CompositeAlarm(this, "SloSlowBurnAlarm", {
      compositeAlarmName: `ChapterFlowSloSlowBurn${suffix}`,
      alarmRule: cloudwatch.AlarmRule.allOf(
        cloudwatch.AlarmRule.fromAlarm(sloSlowBurn6h, cloudwatch.AlarmState.ALARM),
        cloudwatch.AlarmRule.fromAlarm(sloSlowBurn30m, cloudwatch.AlarmState.ALARM),
      ),
      alarmDescription:
        "PAGE — SLO edge-availability SLOW burn (99.9% monthly). Edge 5xx is burning the 43.2-min/mo error budget at ≥6× sustainable on BOTH the 6h and 30m windows (5xx ≥0.6%); at this rate the whole month's budget is exhausted in ~5 days (5% per 6h). Runbook: docs/OPERATIONS.md §4 → docs/SLOS.md.",
    });
    sloSlowBurnAlarm.addAlarmAction(opsAction);

    // -------------------------------------------------------------------
    // CloudWatch dashboard — golden signals (WS6-033)
    // -------------------------------------------------------------------
    // Version-controlled, out-of-band view of this stack's health. The in-app
    // admin Ops dashboard is served BY the server Lambda, so it disappears
    // exactly when an incident takes that Lambda down; this dashboard reads
    // straight from CloudWatch and survives that failure mode. One dashboard
    // per stack — this one binds only metrics the frontend stack can
    // reference without a cross-stack CloudFormation export (constructs
    // in-stack; ChapterFlow/Ops + the DynamoDB table names by-name, same
    // convention as the alarms above).
    const goldenSignalsDashboard = new cloudwatch.Dashboard(this, "GoldenSignalsDashboard", {
      dashboardName: `ChapterFlowGoldenSignals${suffix}`,
      // Keep each widget's own 5-minute period (matching the alarms) instead
      // of letting it drift with the dashboard's selected time range.
      periodOverride: cloudwatch.PeriodOverride.INHERIT,
    });

    // TRAFFIC
    goldenSignalsDashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: "Server Lambda invocations (sum)",
        left: [this.serverFunction.metricInvocations({ period: alarmPeriod, statistic: "sum" })],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: "CloudFront requests (sum)",
        left: [this.distribution.metricRequests({ period: alarmPeriod, statistic: "sum" })],
        width: 12,
      }),
    );

    // LATENCY
    goldenSignalsDashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: "Server Lambda duration — p50 / p95 / p99 (ms)",
        left: [
          this.serverFunction.metricDuration({ period: alarmPeriod, statistic: "p50" }),
          this.serverFunction.metricDuration({ period: alarmPeriod, statistic: "p95" }),
          this.serverFunction.metricDuration({ period: alarmPeriod, statistic: "p99" }),
        ],
        width: 24,
      }),
    );

    // ERRORS
    goldenSignalsDashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: "Server Lambda errors (sum)",
        left: [this.serverFunction.metricErrors({ period: alarmPeriod, statistic: "sum" })],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: "Server Lambda throttles (sum)",
        left: [this.serverFunction.metricThrottles({ period: alarmPeriod, statistic: "sum" })],
        width: 12,
      }),
    );
    goldenSignalsDashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: "CloudFront 4xxErrorRate (%)",
        left: [this.distribution.metric4xxErrorRate({ period: alarmPeriod, statistic: "Average" })],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: "CloudFront 5xxErrorRate (%)",
        left: [this.distribution.metric5xxErrorRate({ period: alarmPeriod, statistic: "Average" })],
        width: 12,
      }),
    );
    goldenSignalsDashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: "OpsFailure (ChapterFlow/Ops, dimensionless rollup — sum)",
        left: [
          new cloudwatch.Metric({
            namespace: "ChapterFlow/Ops",
            metricName: "OpsFailure",
            statistic: "Sum",
            period: alarmPeriod,
          }),
        ],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: "StripeWebhookFailure (ChapterFlow/Ops, dimensionless rollup — sum)",
        left: [
          new cloudwatch.Metric({
            namespace: "ChapterFlow/Ops",
            metricName: "StripeWebhookFailure",
            statistic: "Sum",
            period: alarmPeriod,
          }),
        ],
        width: 12,
      }),
    );

    // SATURATION
    goldenSignalsDashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: "Server Lambda concurrent executions (max)",
        left: [this.serverFunction.metric("ConcurrentExecutions", { period: alarmPeriod, statistic: "max" })],
        width: 24,
      }),
    );

    // ISR — revalidation queue + DLQ
    goldenSignalsDashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: "Revalidation queue depth (messages visible, max)",
        left: [
          revalidationQueue.metricApproximateNumberOfMessagesVisible({
            period: alarmPeriod,
            statistic: "max",
          }),
        ],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: "Revalidation queue oldest message age (s, max)",
        left: [
          revalidationQueue.metricApproximateAgeOfOldestMessage({
            period: alarmPeriod,
            statistic: "max",
          }),
        ],
        width: 12,
      }),
    );
    goldenSignalsDashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: "Revalidation DLQ depth (messages visible, max)",
        left: [
          revalidationDlq.metricApproximateNumberOfMessagesVisible({
            period: alarmPeriod,
            statistic: "max",
          }),
        ],
        width: 24,
      }),
    );

    // DYNAMODB — app + analytics tables, referenced by name (see
    // buildThrottleMetricByName/tableLatencyMetricByName above).
    goldenSignalsDashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: "App table throttled requests (sum)",
        left: [buildThrottleMetricByName(props.appTableName)],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: "Analytics table throttled requests (sum)",
        left: [buildThrottleMetricByName(props.analyticsTableName)],
        width: 12,
      }),
    );
    goldenSignalsDashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: "App table successful request latency (avg, ms)",
        left: [tableLatencyMetricByName(props.appTableName)],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: "Analytics table successful request latency (avg, ms)",
        left: [tableLatencyMetricByName(props.analyticsTableName)],
        width: 12,
      }),
    );

    // -------------------------------------------------------------------
    // Stack Outputs
    // -------------------------------------------------------------------

    new cdk.CfnOutput(this, "DistributionId", {
      value: this.distribution.distributionId,
    });

    new cdk.CfnOutput(this, "DistributionDomain", {
      value: this.distribution.distributionDomainName,
    });

    new cdk.CfnOutput(this, "ServerFunctionArn", {
      value: this.serverFunction.functionArn,
    });

    new cdk.CfnOutput(this, "GoldenSignalsDashboardName", {
      value: goldenSignalsDashboard.dashboardName,
    });

    // WS6-002: the ServerFunctionUrl output was removed — it leaked the raw
    // public Function URL (the very endpoint the origin lock exists to keep
    // traffic off) and no workflow consumes it. ServerFunctionArn stays.

    if (certificate) {
      new cdk.CfnOutput(this, "AppUrl", {
        value: `https://${appDomain}`,
      });
    }
  }
}
