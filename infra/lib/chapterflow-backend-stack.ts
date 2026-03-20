import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as ssm from "aws-cdk-lib/aws-ssm";

function normalizeCorsOrigin(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
}

function resolveAllowedWebOrigins(): string[] {
  const defaults = [
    "http://localhost:3000",
    "https://siliconx.ca",
    "https://www.siliconx.ca",
    "https://chapterflow.siliconx.ca",
    "https://auth.siliconx.ca",
  ];

  const envCandidates = [
    process.env.WEB_ALLOWED_ORIGINS || "",
    process.env.APP_BASE_URL || "",
    process.env.CHAPTERFLOW_SITE_BASE_URL || "",
    process.env.CHAPTERFLOW_APP_BASE_URL || "",
    process.env.CHAPTERFLOW_AUTH_BASE_URL || "",
  ]
    .join(",")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const normalized = new Set<string>();
  for (const candidate of [...defaults, ...envCandidates]) {
    const value = normalizeCorsOrigin(candidate);
    if (value) normalized.add(value);
  }

  return Array.from(normalized);
}

function normalizeSsmPrefix(raw?: string): string {
  const trimmed = (raw || "").trim();
  if (!trimmed) return "/chapterflow/prod";
  const prefixed = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return prefixed.endsWith("/") ? prefixed.slice(0, -1) : prefixed;
}

function applyStandardTags(scope: Construct) {
  cdk.Tags.of(scope).add("App", "ChapterFlow");
  cdk.Tags.of(scope).add("System", "Backend");
  cdk.Tags.of(scope).add("ManagedBy", "CDK");
  cdk.Tags.of(scope).add("Region", "us-east-1");
}

function buildThrottleMetric(table: dynamodb.Table): cloudwatch.MathExpression {
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
      table.metricThrottledRequestsForOperation(operation, {
        period: cdk.Duration.minutes(5),
        statistic: "sum",
      }),
    ])
  );

  return new cloudwatch.MathExpression({
    expression: Object.keys(usingMetrics).join(" + "),
    usingMetrics,
    period: cdk.Duration.minutes(5),
  });
}

export class ChapterFlowBackendStack extends cdk.Stack {
  public readonly appTable: dynamodb.Table;
  public readonly analyticsTable: dynamodb.Table;
  public readonly ingestBucket: s3.Bucket;
  public readonly contentBucket: s3.Bucket;
  public readonly appRunnerRuntimeRole: iam.Role;
  public readonly ssmPrefix: string;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    applyStandardTags(this);

    const allowedWebOrigins = resolveAllowedWebOrigins();
    this.ssmPrefix = normalizeSsmPrefix(process.env.CHAPTERFLOW_SSM_PARAMETER_PREFIX);

    this.appTable = new dynamodb.Table(this, "ChapterFlowAppTable", {
      tableName: process.env.CHAPTERFLOW_BOOK_TABLE_NAME || "ChapterFlowApp",
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      deletionProtection: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    this.appTable.addGlobalSecondaryIndex({
      indexName: "quiz-scope-createdAt-index",
      partitionKey: { name: "quizScope", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "createdAt", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    this.analyticsTable = new dynamodb.Table(this, "ChapterFlowAnalyticsTable", {
      tableName:
        process.env.CHAPTERFLOW_BOOK_ANALYTICS_TABLE_NAME || "ChapterFlowInsights",
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      deletionProtection: true,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    this.analyticsTable.addGlobalSecondaryIndex({
      indexName: "eventDate-eventType-index",
      partitionKey: { name: "eventDate", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "eventType", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    this.analyticsTable.addGlobalSecondaryIndex({
      indexName: "plan-updatedAt-index",
      partitionKey: { name: "plan", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "updatedAt", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    this.analyticsTable.addGlobalSecondaryIndex({
      indexName: "contextKey-occurredAt-index",
      partitionKey: { name: "contextKey", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "occurredAt", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    this.ingestBucket = new s3.Bucket(this, "ChapterFlowIngestBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: true,
      cors: [
        {
          allowedOrigins: allowedWebOrigins,
          allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.POST],
          allowedHeaders: ["*"],
          exposedHeaders: ["ETag"],
          maxAge: 3000,
        },
      ],
      lifecycleRules: [
        {
          id: "chapterflow-ingest-maintenance",
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(7),
          noncurrentVersionExpiration: cdk.Duration.days(30),
        },
      ],
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    this.contentBucket = new s3.Bucket(this, "ChapterFlowContentBucket", {
      blockPublicAccess: new s3.BlockPublicAccess({
        blockPublicAcls: true,
        ignorePublicAcls: true,
        blockPublicPolicy: false,
        restrictPublicBuckets: false,
      }),
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: true,
      lifecycleRules: [
        {
          id: "chapterflow-content-maintenance",
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(7),
          noncurrentVersionExpiration: cdk.Duration.days(90),
        },
      ],
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    this.contentBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: "PublicReadLibraryCovers",
        effect: iam.Effect.ALLOW,
        principals: [new iam.AnyPrincipal()],
        actions: ["s3:GetObject"],
        resources: [`${this.contentBucket.bucketArn}/book-content/library/covers/*`],
      })
    );

    this.appRunnerRuntimeRole = new iam.Role(this, "ChapterFlowAppRuntimeRole", {
      roleName: process.env.CHAPTERFLOW_APP_RUNNER_ROLE_NAME || "ChapterFlowAppRuntimeRole",
      assumedBy: new iam.ServicePrincipal("tasks.apprunner.amazonaws.com"),
      description: "Least-privilege runtime role for the ChapterFlow App Runner service.",
    });

    const ddbResources = [
      this.appTable.tableArn,
      `${this.appTable.tableArn}/index/*`,
      this.analyticsTable.tableArn,
      `${this.analyticsTable.tableArn}/index/*`,
    ];

    this.appRunnerRuntimeRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "ChapterFlowDynamoDbAccess",
        effect: iam.Effect.ALLOW,
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
      })
    );

    this.appRunnerRuntimeRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "ChapterFlowIngestBucketAccess",
        effect: iam.Effect.ALLOW,
        actions: ["s3:GetObject", "s3:PutObject"],
        resources: [`${this.ingestBucket.bucketArn}/*`],
      })
    );

    this.appRunnerRuntimeRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "ChapterFlowContentBucketAccess",
        effect: iam.Effect.ALLOW,
        actions: ["s3:GetObject", "s3:PutObject"],
        resources: [`${this.contentBucket.bucketArn}/*`],
      })
    );

    this.appRunnerRuntimeRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "ChapterFlowBucketMetadataAccess",
        effect: iam.Effect.ALLOW,
        actions: ["s3:GetBucketLocation"],
        resources: [this.ingestBucket.bucketArn, this.contentBucket.bucketArn],
      })
    );

    const parameterNames = [
      `${this.ssmPrefix}/BOOK_TABLE_NAME`,
      `${this.ssmPrefix}/BOOK_ANALYTICS_TABLE_NAME`,
      `${this.ssmPrefix}/BOOK_INGEST_BUCKET`,
      `${this.ssmPrefix}/BOOK_CONTENT_BUCKET`,
    ];

    new ssm.StringParameter(this, "BookTableNameParameter", {
      parameterName: parameterNames[0],
      stringValue: this.appTable.tableName,
      description: "ChapterFlow operational table name.",
    });

    new ssm.StringParameter(this, "BookAnalyticsTableNameParameter", {
      parameterName: parameterNames[1],
      stringValue: this.analyticsTable.tableName,
      description: "ChapterFlow analytics table name.",
    });

    new ssm.StringParameter(this, "BookIngestBucketParameter", {
      parameterName: parameterNames[2],
      stringValue: this.ingestBucket.bucketName,
      description: "ChapterFlow ingest bucket name.",
    });

    new ssm.StringParameter(this, "BookContentBucketParameter", {
      parameterName: parameterNames[3],
      stringValue: this.contentBucket.bucketName,
      description: "ChapterFlow published content bucket name.",
    });

    this.appRunnerRuntimeRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "ChapterFlowSsmConfigAccess",
        effect: iam.Effect.ALLOW,
        actions: ["ssm:GetParameter", "ssm:GetParameters"],
        resources: parameterNames.map(
          (name) =>
            `arn:${cdk.Aws.PARTITION}:ssm:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:parameter${name}`
        ),
      })
    );

    new cloudwatch.Alarm(this, "ChapterFlowAppTableThrottlesAlarm", {
      metric: buildThrottleMetric(this.appTable),
      threshold: 1,
      evaluationPeriods: 1,
      datapointsToAlarm: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: "Alerts when ChapterFlow operational table experiences throttling.",
    });

    new cloudwatch.Alarm(this, "ChapterFlowAnalyticsTableThrottlesAlarm", {
      metric: buildThrottleMetric(this.analyticsTable),
      threshold: 1,
      evaluationPeriods: 1,
      datapointsToAlarm: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: "Alerts when ChapterFlow analytics table experiences throttling.",
    });

    new cdk.CfnOutput(this, "BookTableName", { value: this.appTable.tableName });
    new cdk.CfnOutput(this, "BookAnalyticsTableName", {
      value: this.analyticsTable.tableName,
    });
    new cdk.CfnOutput(this, "BookIngestBucketName", {
      value: this.ingestBucket.bucketName,
    });
    new cdk.CfnOutput(this, "BookContentBucketName", {
      value: this.contentBucket.bucketName,
    });
    new cdk.CfnOutput(this, "AppRunnerRuntimeRoleArn", {
      value: this.appRunnerRuntimeRole.roleArn,
    });
    new cdk.CfnOutput(this, "SsmParameterPrefix", {
      value: this.ssmPrefix,
    });
  }
}
