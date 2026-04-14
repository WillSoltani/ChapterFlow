import * as path from "path";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
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
// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ChapterFlowFrontendStackProps extends cdk.StackProps {
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

    const domainName = props.domainName ?? "chapterflow.ca";
    const appDomain = `app.${domainName}`;
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
      tableName: "ChapterFlowNextCache",
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

    const revalidationQueue = new sqs.Queue(this, "RevalidationQueue", {
      queueName: "ChapterFlowRevalidation.fifo",
      fifo: true,
      contentBasedDeduplication: true,
      visibilityTimeout: cdk.Duration.seconds(30),
      retentionPeriod: cdk.Duration.days(1),
    });

    // -------------------------------------------------------------------
    // IAM — Lambda execution role
    // -------------------------------------------------------------------

    const lambdaRole = new iam.Role(this, "LambdaRole", {
      roleName: "ChapterFlowLambdaRole",
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AWSLambdaBasicExecutionRole",
        ),
      ],
    });

    // DynamoDB access — app tables (same as App Runner role)
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

    // SSM access — the app's getServerEnv() tries multiple candidate paths
    // (prefixed, bare name, lowercase) so we grant access to all parameters.
    lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "SsmConfigAccess",
        actions: ["ssm:GetParameter", "ssm:GetParameters"],
        resources: [
          `arn:${cdk.Aws.PARTITION}:ssm:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:parameter/*`,
        ],
      }),
    );

    // SES access — notification emails
    lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "SesSendAccess",
        actions: ["ses:SendEmail", "sesv2:SendEmail"],
        resources: ["*"],
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

    const commonEnv: Record<string, string> = {
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
      NODE_ENV: "production",
      // Merge caller-provided env vars (secrets come from here)
      ...(props.serverEnv ?? {}),
    };

    // -------------------------------------------------------------------
    // Lambda — Server function
    // -------------------------------------------------------------------

    this.serverFunction = new lambda.Function(this, "ServerFn", {
      functionName: "ChapterFlowServer",
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
    });

    const serverFnUrl = this.serverFunction.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      invokeMode: lambda.InvokeMode.RESPONSE_STREAM,
    });

    // -------------------------------------------------------------------
    // Lambda — Image optimization
    // -------------------------------------------------------------------

    const imageFn = new lambda.Function(this, "ImageFn", {
      functionName: "ChapterFlowImage",
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset(
        path.join(openNextDir, "image-optimization-function"),
      ),
      memorySize: 1536,
      timeout: cdk.Duration.seconds(25),
      role: lambdaRole,
      environment: {
        BUCKET_NAME: assetsBucket.bucketName,
        BUCKET_KEY_PREFIX: "_assets",
        ...commonEnv,
      },
      architecture: lambda.Architecture.X86_64,
    });

    const imageFnUrl = imageFn.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
    });

    // -------------------------------------------------------------------
    // Lambda — Revalidation (triggered by SQS)
    // -------------------------------------------------------------------

    const revalidationFn = new lambda.Function(this, "RevalidationFn", {
      functionName: "ChapterFlowRevalidation",
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset(
        path.join(openNextDir, "revalidation-function"),
      ),
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      role: lambdaRole,
      environment: commonEnv,
      architecture: lambda.Architecture.X86_64,
    });

    revalidationFn.addEventSource(
      new eventSources.SqsEventSource(revalidationQueue, { batchSize: 5 }),
    );

    // -------------------------------------------------------------------
    // Lambda — DynamoDB provider (tag cache init)
    // -------------------------------------------------------------------

    const dynamoProviderFn = new lambda.Function(this, "DynamoProviderFn", {
      functionName: "ChapterFlowDynamoProvider",
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset(
        path.join(openNextDir, "dynamodb-provider"),
      ),
      memorySize: 256,
      timeout: cdk.Duration.minutes(15),
      role: lambdaRole,
      environment: commonEnv,
      architecture: lambda.Architecture.X86_64,
    });

    // -------------------------------------------------------------------
    // Lambda — Warmer (keeps server function warm)
    // -------------------------------------------------------------------

    const warmerFn = new lambda.Function(this, "WarmerFn", {
      functionName: "ChapterFlowWarmer",
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset(path.join(openNextDir, "warmer-function")),
      memorySize: 256,
      timeout: cdk.Duration.minutes(1),
      role: lambdaRole,
      environment: {
        FUNCTION_NAME: "ChapterFlowServer",
        CONCURRENCY: "1",
        ...commonEnv,
      },
      architecture: lambda.Architecture.X86_64,
    });

    // Invoke warmer every 5 minutes
    const warmerRule = new events.Rule(this, "WarmerSchedule", {
      schedule: events.Schedule.rate(cdk.Duration.minutes(5)),
    });
    warmerRule.addTarget(new targets.LambdaFunction(warmerFn));

    // Warmer needs to invoke the server function.
    // Use a constructed ARN instead of this.serverFunction.functionArn to
    // avoid a circular dependency: DefaultPolicy → ServerFn → DefaultPolicy.
    lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "InvokeServerFn",
        actions: ["lambda:InvokeFunction"],
        resources: [
          cdk.Arn.format(
            {
              service: "lambda",
              resource: "function",
              resourceName: "ChapterFlowServer",
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
        domainName: appDomain,
        subjectAlternativeNames: [domainName, `www.${domainName}`],
        validation: acm.CertificateValidation.fromDns(hostedZone),
      });
    }

    // -------------------------------------------------------------------
    // CloudFront Distribution
    // -------------------------------------------------------------------

    // Parse Lambda function URLs to hostnames for CloudFront origins
    const serverOriginDomain = cdk.Fn.select(
      2,
      cdk.Fn.split("/", serverFnUrl.url),
    );
    const imageOriginDomain = cdk.Fn.select(
      2,
      cdk.Fn.split("/", imageFnUrl.url),
    );

    // Use OAI instead of OAC to avoid circular dependency:
    // OAC creates a bucket policy referencing the Distribution ID, but the
    // Distribution depends on the bucket as origin → cycle.
    // OAI grants access to an identity, not the distribution, breaking the cycle.
    const s3Origin = origins.S3BucketOrigin.withOriginAccessIdentity(
      assetsBucket,
      { originPath: "/_assets" },
    );

    const serverOrigin = new origins.HttpOrigin(serverOriginDomain, {
      protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
      customHeaders: { "x-forwarded-host": appDomain },
    });

    const imageOrigin = new origins.HttpOrigin(imageOriginDomain, {
      protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
    });

    // Cache policies
    const serverCachePolicy = new cloudfront.CachePolicy(
      this,
      "ServerCachePolicy",
      {
        cachePolicyName: "ChapterFlowServerPolicy",
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
        cachePolicyName: "ChapterFlowStaticPolicy",
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
    // (set as a custom header on the origin — see HttpOrigin customHeaders).
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
      ...(certificate
        ? {
            certificate,
            domainNames: [appDomain, domainName, `www.${domainName}`],
          }
        : {}),
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: "/",
          ttl: cdk.Duration.seconds(0),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: "/",
          ttl: cdk.Duration.seconds(0),
        },
      ],
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
