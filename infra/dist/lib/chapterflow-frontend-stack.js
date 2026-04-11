"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChapterFlowFrontendStack = void 0;
const path = __importStar(require("path"));
const cdk = __importStar(require("aws-cdk-lib"));
const acm = __importStar(require("aws-cdk-lib/aws-certificatemanager"));
const cloudfront = __importStar(require("aws-cdk-lib/aws-cloudfront"));
const origins = __importStar(require("aws-cdk-lib/aws-cloudfront-origins"));
const dynamodb = __importStar(require("aws-cdk-lib/aws-dynamodb"));
const events = __importStar(require("aws-cdk-lib/aws-events"));
const targets = __importStar(require("aws-cdk-lib/aws-events-targets"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const route53 = __importStar(require("aws-cdk-lib/aws-route53"));
const route53Targets = __importStar(require("aws-cdk-lib/aws-route53-targets"));
const s3 = __importStar(require("aws-cdk-lib/aws-s3"));
const s3deploy = __importStar(require("aws-cdk-lib/aws-s3-deployment"));
const sqs = __importStar(require("aws-cdk-lib/aws-sqs"));
const eventSources = __importStar(require("aws-cdk-lib/aws-lambda-event-sources"));
// ---------------------------------------------------------------------------
// Stack
// ---------------------------------------------------------------------------
class ChapterFlowFrontendStack extends cdk.Stack {
    distribution;
    serverFunction;
    constructor(scope, id, props) {
        super(scope, id, props);
        const backend = props.backendStack;
        const domainName = props.domainName ?? "chapterflow.ca";
        const appDomain = `app.${domainName}`;
        const openNextDir = path.join(__dirname, "../../.open-next");
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
            autoDeleteObjects: true,
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
                iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole"),
            ],
        });
        // DynamoDB access — app tables (same as App Runner role)
        const ddbResources = [
            backend.appTable.tableArn,
            `${backend.appTable.tableArn}/index/*`,
            backend.analyticsTable.tableArn,
            `${backend.analyticsTable.tableArn}/index/*`,
        ];
        lambdaRole.addToPolicy(new iam.PolicyStatement({
            sid: "AppDynamoDbAccess",
            actions: [
                "dynamodb:BatchGetItem",
                "dynamodb:BatchWriteItem",
                "dynamodb:DeleteItem",
                "dynamodb:DescribeTable",
                "dynamodb:GetItem",
                "dynamodb:PutItem",
                "dynamodb:Query",
                "dynamodb:TransactWriteItems",
                "dynamodb:UpdateItem",
            ],
            resources: ddbResources,
        }));
        // DynamoDB access — ISR cache table
        lambdaRole.addToPolicy(new iam.PolicyStatement({
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
        }));
        // S3 access — app buckets (same as App Runner role)
        lambdaRole.addToPolicy(new iam.PolicyStatement({
            sid: "AppS3Access",
            actions: ["s3:GetObject", "s3:PutObject"],
            resources: [
                `${backend.ingestBucket.bucketArn}/*`,
                `${backend.contentBucket.bucketArn}/*`,
            ],
        }));
        lambdaRole.addToPolicy(new iam.PolicyStatement({
            sid: "AppS3MetadataAccess",
            actions: ["s3:GetBucketLocation"],
            resources: [
                backend.ingestBucket.bucketArn,
                backend.contentBucket.bucketArn,
            ],
        }));
        // S3 access — static assets + cache bucket
        lambdaRole.addToPolicy(new iam.PolicyStatement({
            sid: "AssetsBucketAccess",
            actions: [
                "s3:GetObject",
                "s3:PutObject",
                "s3:DeleteObject",
                "s3:ListBucket",
            ],
            resources: [assetsBucket.bucketArn, `${assetsBucket.bucketArn}/*`],
        }));
        // SSM access (same as App Runner role)
        lambdaRole.addToPolicy(new iam.PolicyStatement({
            sid: "SsmConfigAccess",
            actions: ["ssm:GetParameter", "ssm:GetParameters"],
            resources: [
                `arn:${cdk.Aws.PARTITION}:ssm:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:parameter${backend.ssmPrefix}/*`,
            ],
        }));
        // SQS access — revalidation queue
        lambdaRole.addToPolicy(new iam.PolicyStatement({
            sid: "RevalidationQueueAccess",
            actions: [
                "sqs:SendMessage",
                "sqs:ReceiveMessage",
                "sqs:DeleteMessage",
                "sqs:GetQueueAttributes",
                "sqs:GetQueueUrl",
            ],
            resources: [revalidationQueue.queueArn],
        }));
        // -------------------------------------------------------------------
        // Common Lambda environment variables
        // -------------------------------------------------------------------
        const commonEnv = {
            // App data resources
            BOOK_TABLE_NAME: backend.appTable.tableName,
            BOOK_ANALYTICS_TABLE_NAME: backend.analyticsTable.tableName,
            BOOK_INGEST_BUCKET: backend.ingestBucket.bucketName,
            BOOK_CONTENT_BUCKET: backend.contentBucket.bucketName,
            SSM_PARAMETER_PREFIX: backend.ssmPrefix,
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
            code: lambda.Code.fromAsset(path.join(openNextDir, "server-functions/default")),
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
            code: lambda.Code.fromAsset(path.join(openNextDir, "image-optimization-function")),
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
            code: lambda.Code.fromAsset(path.join(openNextDir, "revalidation-function")),
            memorySize: 256,
            timeout: cdk.Duration.seconds(30),
            role: lambdaRole,
            environment: commonEnv,
            architecture: lambda.Architecture.X86_64,
        });
        revalidationFn.addEventSource(new eventSources.SqsEventSource(revalidationQueue, { batchSize: 5 }));
        // -------------------------------------------------------------------
        // Lambda — DynamoDB provider (tag cache init)
        // -------------------------------------------------------------------
        const dynamoProviderFn = new lambda.Function(this, "DynamoProviderFn", {
            functionName: "ChapterFlowDynamoProvider",
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: "index.handler",
            code: lambda.Code.fromAsset(path.join(openNextDir, "dynamodb-provider")),
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
        // Warmer needs to invoke the server function
        lambdaRole.addToPolicy(new iam.PolicyStatement({
            sid: "InvokeServerFn",
            actions: ["lambda:InvokeFunction"],
            resources: [this.serverFunction.functionArn],
        }));
        // -------------------------------------------------------------------
        // S3 deployment — upload static assets
        // -------------------------------------------------------------------
        new s3deploy.BucketDeployment(this, "DeployAssets", {
            sources: [s3deploy.Source.asset(path.join(openNextDir, "assets"))],
            destinationBucket: assetsBucket,
            destinationKeyPrefix: "_assets",
            prune: false,
        });
        // Deploy cache assets (ISR pre-rendered pages)
        new s3deploy.BucketDeployment(this, "DeployCache", {
            sources: [s3deploy.Source.asset(path.join(openNextDir, "cache"))],
            destinationBucket: assetsBucket,
            destinationKeyPrefix: "_cache",
            prune: false,
        });
        // -------------------------------------------------------------------
        // ACM Certificate
        // -------------------------------------------------------------------
        let certificate;
        let hostedZone;
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
        const serverOriginDomain = cdk.Fn.select(2, cdk.Fn.split("/", serverFnUrl.url));
        const imageOriginDomain = cdk.Fn.select(2, cdk.Fn.split("/", imageFnUrl.url));
        const s3Origin = origins.S3BucketOrigin.withOriginAccessControl(assetsBucket, { originPath: "/_assets" });
        const serverOrigin = new origins.HttpOrigin(serverOriginDomain, {
            protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
            customHeaders: { "x-forwarded-host": appDomain },
        });
        const imageOrigin = new origins.HttpOrigin(imageOriginDomain, {
            protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
        });
        // Cache policies
        const serverCachePolicy = new cloudfront.CachePolicy(this, "ServerCachePolicy", {
            cachePolicyName: "ChapterFlowServerPolicy",
            defaultTtl: cdk.Duration.seconds(0),
            maxTtl: cdk.Duration.days(365),
            minTtl: cdk.Duration.seconds(0),
            headerBehavior: cloudfront.CacheHeaderBehavior.allowList("x-open-next-cache-key", "rsc", "next-router-prefetch", "next-router-state-tree", "next-url", "accept"),
            queryStringBehavior: cloudfront.CacheQueryStringBehavior.all(),
            cookieBehavior: cloudfront.CacheCookieBehavior.none(),
            enableAcceptEncodingGzip: true,
            enableAcceptEncodingBrotli: true,
        });
        const staticCachePolicy = new cloudfront.CachePolicy(this, "StaticCachePolicy", {
            cachePolicyName: "ChapterFlowStaticPolicy",
            defaultTtl: cdk.Duration.days(30),
            maxTtl: cdk.Duration.days(365),
            minTtl: cdk.Duration.days(1),
            queryStringBehavior: cloudfront.CacheQueryStringBehavior.none(),
            cookieBehavior: cloudfront.CacheCookieBehavior.none(),
            enableAcceptEncodingGzip: true,
            enableAcceptEncodingBrotli: true,
        });
        // Origin request policy for server function — forward all headers/cookies
        const serverOriginRequestPolicy = new cloudfront.OriginRequestPolicy(this, "ServerOriginRequestPolicy", {
            originRequestPolicyName: "ChapterFlowServerOriginRequest",
            headerBehavior: cloudfront.OriginRequestHeaderBehavior.all("CloudFront-Viewer-Country"),
            queryStringBehavior: cloudfront.OriginRequestQueryStringBehavior.all(),
            cookieBehavior: cloudfront.OriginRequestCookieBehavior.all(),
        });
        this.distribution = new cloudfront.Distribution(this, "Distribution", {
            comment: "ChapterFlow OpenNext",
            defaultBehavior: {
                origin: serverOrigin,
                viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                cachePolicy: serverCachePolicy,
                originRequestPolicy: serverOriginRequestPolicy,
                allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
                responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
            },
            additionalBehaviors: {
                "_next/static/*": {
                    origin: s3Origin,
                    viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                    cachePolicy: staticCachePolicy,
                    allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
                },
                "_next/image*": {
                    origin: imageOrigin,
                    viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                    cachePolicy: serverCachePolicy,
                    originRequestPolicy: serverOriginRequestPolicy,
                    allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
                },
                "_next/data/*": {
                    origin: serverOrigin,
                    viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                    cachePolicy: serverCachePolicy,
                    originRequestPolicy: serverOriginRequestPolicy,
                    allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
                },
                "BUILD_ID": {
                    origin: s3Origin,
                    viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                    cachePolicy: staticCachePolicy,
                },
                "favicon.ico": {
                    origin: s3Origin,
                    viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                    cachePolicy: staticCachePolicy,
                },
                "icon.svg": {
                    origin: s3Origin,
                    viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                    cachePolicy: staticCachePolicy,
                },
                "robots.txt": {
                    origin: s3Origin,
                    viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                    cachePolicy: staticCachePolicy,
                },
                "sitemap.xml": {
                    origin: s3Origin,
                    viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                    cachePolicy: staticCachePolicy,
                },
                "fonts/*": {
                    origin: s3Origin,
                    viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                    cachePolicy: staticCachePolicy,
                },
                "book-covers/*": {
                    origin: s3Origin,
                    viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
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
                target: route53.RecordTarget.fromAlias(new route53Targets.CloudFrontTarget(this.distribution)),
            });
            new route53.AaaaRecord(this, "AppAaaaRecord", {
                zone: hostedZone,
                recordName: appDomain,
                target: route53.RecordTarget.fromAlias(new route53Targets.CloudFrontTarget(this.distribution)),
            });
            // chapterflow.ca (root)
            new route53.ARecord(this, "RootARecord", {
                zone: hostedZone,
                target: route53.RecordTarget.fromAlias(new route53Targets.CloudFrontTarget(this.distribution)),
            });
            new route53.AaaaRecord(this, "RootAaaaRecord", {
                zone: hostedZone,
                target: route53.RecordTarget.fromAlias(new route53Targets.CloudFrontTarget(this.distribution)),
            });
            // www.chapterflow.ca
            new route53.ARecord(this, "WwwARecord", {
                zone: hostedZone,
                recordName: `www.${domainName}`,
                target: route53.RecordTarget.fromAlias(new route53Targets.CloudFrontTarget(this.distribution)),
            });
            new route53.AaaaRecord(this, "WwwAaaaRecord", {
                zone: hostedZone,
                recordName: `www.${domainName}`,
                target: route53.RecordTarget.fromAlias(new route53Targets.CloudFrontTarget(this.distribution)),
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
exports.ChapterFlowFrontendStack = ChapterFlowFrontendStack;
