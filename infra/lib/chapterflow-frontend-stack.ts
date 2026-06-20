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
    // arbitrary identity. dev/staging without a verified domain have no identity
    // to scope to, so they fall back to "*" — same conditional shape as the
    // Cognito statement above.
    const sesIdentityResources = props.domainName
      ? [
          `arn:${cdk.Aws.PARTITION}:ses:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:identity/${props.domainName}`,
        ]
      : ["*"];
    lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "SesSendAccess",
        actions: ["ses:SendEmail", "sesv2:SendEmail"],
        resources: sesIdentityResources,
      }),
    );

    // Cognito admin access — the admin "erase user" tool resolves a user by
    // sub (ListUsers) and removes them from the pool (AdminDeleteUser) as part
    // of a GDPR-style complete erasure. Scoped to the configured pool when its
    // id is known at synth, otherwise to all pools.
    const cognitoUserPoolId = process.env.COGNITO_USER_POOL_ID;
    lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "CognitoAdminUserErasure",
        actions: ["cognito-idp:ListUsers", "cognito-idp:AdminDeleteUser"],
        resources: cognitoUserPoolId
          ? [
              `arn:${cdk.Aws.PARTITION}:cognito-idp:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:userpool/${cognitoUserPoolId}`,
            ]
          : ["*"],
      }),
    );

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

    // Server-only env: the infra vars PLUS the caller-provided secrets (Stripe
    // secret/webhook/price keys, Anthropic + ElevenLabs API keys,
    // AUTH_STATE_SECRET, full Cognito config — see infra/bin/app.ts). Only the
    // server Lambda needs these, so they are NOT spread into the auxiliary
    // functions below (least-privilege secret blast radius).
    const commonEnv: Record<string, string> = {
      ...baseInfraEnv,
      // Merge caller-provided env vars (secrets come from here)
      ...(props.serverEnv ?? {}),
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
      timeout: cdk.Duration.seconds(30),
      role: lambdaRole,
      environment: commonEnv,
      architecture: lambda.Architecture.X86_64,
      logRetention: logs.RetentionDays.ONE_MONTH,
    });

    // authType NONE — public Function URL fronted by CloudFront. An earlier
    // change (X2) locked this to AWS_IAM + Origin Access Control, but OAC SigV4
    // signing against a RESPONSE_STREAM Function URL was rejected at runtime:
    // every route 403'd with Lambda "Forbidden / Function URL authorization"
    // (AccessDeniedException), a failure cdk synth cannot catch. Reverted to
    // restore service. Data is still gated by the app's own auth (requireUser /
    // requireActiveBookUser); re-locking via OAC is a tracked follow-up that MUST
    // be validated on a non-prod deploy (custom origin-request policy excluding
    // Host + Authorization, and UNSIGNED-PAYLOAD signing for the stream).
    const serverFnUrl = this.serverFunction.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      invokeMode: lambda.InvokeMode.RESPONSE_STREAM,
    });

    // -------------------------------------------------------------------
    // Lambda — Image optimization
    // -------------------------------------------------------------------

    const imageFn = new lambda.Function(this, "ImageFn", {
      functionName: name("ChapterFlowImage"),
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset(
        path.join(openNextDir, "image-optimization-function"),
      ),
      memorySize: 1536,
      timeout: cdk.Duration.seconds(25),
      // Least-privilege: its own auto-created role (basic execution) plus read
      // on the assets bucket only (granted below). No app secrets, no
      // DynamoDB / SES / Cognito access — image optimization needs none of it.
      environment: {
        BUCKET_NAME: assetsBucket.bucketName,
        BUCKET_KEY_PREFIX: "_assets",
        ...baseInfraEnv,
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

    const revalidationFn = new lambda.Function(this, "RevalidationFn", {
      functionName: name("ChapterFlowRevalidation"),
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset(
        path.join(openNextDir, "revalidation-function"),
      ),
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      // Least-privilege: its own auto-created role plus the ISR cache table; SQS
      // consume permissions are granted by addEventSource() below. No secrets.
      environment: baseInfraEnv,
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
    // see the serverFnUrl note above for why and the re-locking follow-up.
    const serverOrigin = new origins.FunctionUrlOrigin(serverFnUrl, {
      // Tell OpenNext the public host (custom domain). With no custom domain
      // (dev/staging), omit it — OpenNext falls back to the CloudFront host.
      ...(appDomain
        ? { customHeaders: { "x-forwarded-host": appDomain } }
        : {}),
    });

    const imageOrigin = new origins.FunctionUrlOrigin(imageFnUrl);

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
      rules: [
        {
          name: "AWSManagedCommonRuleSet",
          priority: 1,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: "AWS",
              name: "AWSManagedRulesCommonRuleSet",
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: "AWSManagedCommonRuleSet",
            sampledRequestsEnabled: true,
          },
        },
        {
          // Per-IP rate limit: block a source IP sending >2000 requests in any
          // rolling 5-minute window (baseline volumetric/bot mitigation).
          name: "RateLimitPerIp",
          priority: 2,
          action: { block: {} },
          statement: {
            rateBasedStatement: {
              limit: 2000,
              aggregateKeyType: "IP",
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: "RateLimitPerIp",
            sampledRequestsEnabled: true,
          },
        },
      ],
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

    const makeAlarm = (
      id: string,
      metric: cloudwatch.IMetric,
      threshold: number,
      alarmDescription: string,
      opts?: { evaluationPeriods?: number; datapointsToAlarm?: number },
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
      return alarm;
    };

    const alarmPeriod = cdk.Duration.minutes(5);

    // Server Lambda — errors, throttles, and latency approaching the 30s timeout.
    makeAlarm(
      "ServerFnErrorsAlarm",
      this.serverFunction.metricErrors({ period: alarmPeriod, statistic: "sum" }),
      5,
      "ChapterFlow server Lambda returned ≥5 errors in 5 minutes (elevated 5xx).",
    );
    makeAlarm(
      "ServerFnThrottlesAlarm",
      this.serverFunction.metricThrottles({ period: alarmPeriod, statistic: "sum" }),
      1,
      "ChapterFlow server Lambda is being throttled (concurrency limit hit).",
    );
    makeAlarm(
      "ServerFnDurationAlarm",
      this.serverFunction.metricDuration({ period: alarmPeriod, statistic: "p99" }),
      20000,
      "ChapterFlow server Lambda p99 duration ≥20s — approaching the 30s timeout.",
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
      { evaluationPeriods: 3, datapointsToAlarm: 3 },
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

    new cdk.CfnOutput(this, "ServerFunctionUrl", {
      value: serverFnUrl.url,
    });

    if (certificate) {
      new cdk.CfnOutput(this, "AppUrl", {
        value: `https://${appDomain}`,
      });
    }
  }
}
