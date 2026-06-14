import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as cloudwatchActions from "aws-cdk-lib/aws-cloudwatch-actions";
import * as sns from "aws-cdk-lib/aws-sns";
import * as snsSubscriptions from "aws-cdk-lib/aws-sns-subscriptions";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as ses from "aws-cdk-lib/aws-ses";
import * as ssm from "aws-cdk-lib/aws-ssm";
import * as path from "path";
import { type EnvName } from "./env-config";

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
    "https://chapterflow.ca",
    "https://www.chapterflow.ca",
    "https://app.chapterflow.ca",
    "https://auth.chapterflow.ca",
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

export interface ChapterFlowBackendStackProps extends cdk.StackProps {
  /** dev | staging | prod. */
  readonly envName: EnvName;
  /** "" for prod, "-dev"/"-staging" otherwise — appended to named resources. */
  readonly resourceSuffix: string;
  readonly tableName: string;
  readonly analyticsTableName: string;
  readonly ssmPrefix: string;
  readonly removalPolicy: cdk.RemovalPolicy;
  readonly deletionProtection: boolean;
  readonly pointInTimeRecovery: boolean;
}

export class ChapterFlowBackendStack extends cdk.Stack {
  public readonly appTable: dynamodb.Table;
  public readonly analyticsTable: dynamodb.Table;
  public readonly ingestBucket: s3.Bucket;
  public readonly contentBucket: s3.Bucket;
  public readonly appRunnerRuntimeRole: iam.Role;
  public readonly ssmPrefix: string;

  constructor(scope: Construct, id: string, props: ChapterFlowBackendStackProps) {
    super(scope, id, props);
    applyStandardTags(this);
    cdk.Tags.of(this).add("Environment", props.envName);

    const suffix = props.resourceSuffix;
    const allowedWebOrigins = resolveAllowedWebOrigins();
    this.ssmPrefix = props.ssmPrefix;

    this.appTable = new dynamodb.Table(this, "ChapterFlowAppTable", {
      tableName: props.tableName,
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: props.pointInTimeRecovery,
      },
      deletionProtection: props.deletionProtection,
      removalPolicy: props.removalPolicy,
    });

    this.appTable.addGlobalSecondaryIndex({
      indexName: "quiz-scope-createdAt-index",
      partitionKey: { name: "quizScope", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "createdAt", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    this.analyticsTable = new dynamodb.Table(this, "ChapterFlowAnalyticsTable", {
      tableName: props.analyticsTableName,
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: props.pointInTimeRecovery,
      },
      deletionProtection: props.deletionProtection,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
      removalPolicy: props.removalPolicy,
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
      roleName: `ChapterFlowAppRuntimeRole${suffix}`,
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

    // Operational-alerts SNS topic. Failures that need a human (table
    // throttling, or a Stripe cancellation that failed during account
    // delete/deactivate) publish here. Subscribe an inbox by setting
    // CHAPTERFLOW_OPS_ALERT_EMAIL at synth time (then confirm the SES/SNS email).
    const opsAlertsTopic = new sns.Topic(this, "ChapterFlowOpsAlerts", {
      topicName: `ChapterFlowOpsAlerts${suffix}`,
      displayName: "ChapterFlow operational alerts",
    });
    const opsAlertEmail = process.env.CHAPTERFLOW_OPS_ALERT_EMAIL;
    if (opsAlertEmail) {
      opsAlertsTopic.addSubscription(new snsSubscriptions.EmailSubscription(opsAlertEmail));
    }
    const opsAlarmAction = new cloudwatchActions.SnsAction(opsAlertsTopic);

    const appTableThrottlesAlarm = new cloudwatch.Alarm(this, "ChapterFlowAppTableThrottlesAlarm", {
      metric: buildThrottleMetric(this.appTable),
      threshold: 1,
      evaluationPeriods: 1,
      datapointsToAlarm: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: "Alerts when ChapterFlow operational table experiences throttling.",
    });
    appTableThrottlesAlarm.addAlarmAction(opsAlarmAction);

    const analyticsTableThrottlesAlarm = new cloudwatch.Alarm(this, "ChapterFlowAnalyticsTableThrottlesAlarm", {
      metric: buildThrottleMetric(this.analyticsTable),
      threshold: 1,
      evaluationPeriods: 1,
      datapointsToAlarm: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: "Alerts when ChapterFlow analytics table experiences throttling.",
    });
    analyticsTableThrottlesAlarm.addAlarmAction(opsAlarmAction);

    // Alarm on the unified `OpsFailure` metric the server Lambda emits
    // (recordOpsFailure → putOpsMetric, namespace "ChapterFlow/Ops"). One metric
    // covers every failure kind (stripe cancellation, stripe customer delete,
    // cognito delete, partial erasure). CloudWatch metrics are account/region-
    // global, so we reference by name with no cross-stack import. Any failure in
    // a 5-minute window pages the ops topic.
    const opsFailureAlarm = new cloudwatch.Alarm(
      this,
      "ChapterFlowOpsFailureAlarm",
      {
        metric: new cloudwatch.Metric({
          namespace: "ChapterFlow/Ops",
          metricName: "OpsFailure",
          statistic: "Sum",
          period: cdk.Duration.minutes(5),
        }),
        threshold: 1,
        evaluationPeriods: 1,
        datapointsToAlarm: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        alarmDescription:
          "An operational failure was recorded (Stripe cancellation/customer delete, Cognito delete, or partial account erasure). Follow up via the admin Ops dashboard (Operational failures panel).",
      },
    );
    opsFailureAlarm.addAlarmAction(opsAlarmAction);

    // -------------------------------------------------------------------
    // Lambda — Reading reminder cron (hourly)
    // -------------------------------------------------------------------

    // Pre-bundled with esbuild — run before deploying:
    //   npx esbuild lambda/reading-reminder-cron.ts --bundle --platform=node \
    //     --target=node20 --outfile=lambda/dist/reading-reminder-cron.js \
    //     --external:@aws-sdk/client-dynamodb --external:@aws-sdk/lib-dynamodb \
    //     --external:@aws-sdk/client-sesv2 --external:@aws-sdk/client-ssm
    // Reminder emails are always sent from this fixed address on the verified
    // chapterflow.ca domain, so SES SendEmail is scoped to that domain identity
    // (covers any @chapterflow.ca sender) rather than "*".
    const reminderSenderEmail = "info@chapterflow.ca";
    const reminderSenderDomain = reminderSenderEmail.split("@")[1];

    // SES configuration set name — applied to every send so bounce/complaint
    // events flow to the suppression handler (created below).
    const emailConfigSetName = `ChapterFlowEmail${suffix}`;

    // Email-compliance config for the cron's commercial emails (CASL/CAN-SPAM):
    // friendly sender, support reply-to, the legally-required postal address,
    // and the shared HMAC secret that signs one-click unsubscribe tokens. These
    // come from the deploy environment (same model as app secrets); the SAME
    // EMAIL_UNSUBSCRIBE_SECRET must be set on the app runtime so its public
    // unsubscribe route can verify cron-minted tokens. EMAIL_POSTAL_ADDRESS is a
    // launch blocker — emails are non-compliant until it is set.
    const reminderFn = new lambda.Function(this, "ReadingReminderCron", {
      functionName: `ChapterFlowReadingReminder${suffix}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "reading-reminder-cron.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "../lambda/dist")),
      memorySize: 256,
      timeout: cdk.Duration.minutes(5),
      environment: {
        BOOK_TABLE_NAME: this.appTable.tableName,
        SES_SENDER_EMAIL: reminderSenderEmail,
        SES_CONFIGURATION_SET: emailConfigSetName,
        APP_BASE_URL:
          process.env.CHAPTERFLOW_APP_BASE_URL ?? "https://chapterflow.siliconx.ca",
        // Owner-provided email config is read at runtime from SSM
        // (/chapterflow/<env>/EMAIL_*), the same params the app reads — so it is
        // set in ONE place. These are deploy-time fallbacks only.
        SSM_PARAMETER_PREFIX: this.ssmPrefix,
        EMAIL_SENDER_NAME: process.env.EMAIL_SENDER_NAME ?? "ChapterFlow",
        EMAIL_SUPPORT_ADDRESS:
          process.env.EMAIL_SUPPORT_ADDRESS ?? "support@chapterflow.ca",
        EMAIL_POSTAL_ADDRESS: process.env.EMAIL_POSTAL_ADDRESS ?? "",
        EMAIL_UNSUBSCRIBE_SECRET: process.env.EMAIL_UNSUBSCRIBE_SECRET ?? "",
      },
    });

    this.appTable.grantReadWriteData(reminderFn);
    reminderFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["ses:SendEmail", "sesv2:SendEmail"],
        resources: [
          `arn:${cdk.Aws.PARTITION}:ses:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:identity/${reminderSenderDomain}`,
        ],
      })
    );
    // Read the owner email config (EMAIL_*) from SSM at runtime.
    reminderFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["ssm:GetParameter", "ssm:GetParameters"],
        resources: [
          `arn:${cdk.Aws.PARTITION}:ssm:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:parameter${this.ssmPrefix}/*`,
        ],
      })
    );
    // Decrypt SecureString params — only when the call goes through SSM, so this
    // grant can't be used to decrypt anything else. Lets EMAIL_UNSUBSCRIBE_SECRET
    // be stored as a SecureString (a plain String also works).
    reminderFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["kms:Decrypt"],
        resources: ["*"],
        conditions: {
          StringEquals: { "kms:ViaService": `ssm.${cdk.Aws.REGION}.amazonaws.com` },
        },
      })
    );

    new events.Rule(this, "ReminderSchedule", {
      schedule: events.Schedule.rate(cdk.Duration.hours(1)),
      targets: [new targets.LambdaFunction(reminderFn)],
    });

    // -------------------------------------------------------------------
    // Email deliverability — SES configuration set + bounce/complaint suppression
    // -------------------------------------------------------------------
    // SES account-level suppression already blocks hard bounces/complaints; this
    // adds an app-layer suppression store (checked before commercial sends),
    // complaint-driven opt-out, and observability. Sends pass this config set so
    // bounce/complaint events publish to the topic → suppression handler.

    const emailConfigSet = new ses.CfnConfigurationSet(this, "EmailConfigSet", {
      name: emailConfigSetName,
    });

    const emailEventsTopic = new sns.Topic(this, "ChapterFlowEmailEvents", {
      topicName: `ChapterFlowEmailEvents${suffix}`,
    });
    // Allow SES to publish bounce/complaint events to the topic.
    emailEventsTopic.addToResourcePolicy(
      new iam.PolicyStatement({
        principals: [new iam.ServicePrincipal("ses.amazonaws.com")],
        actions: ["sns:Publish"],
        resources: [emailEventsTopic.topicArn],
      })
    );

    const emailEventDest = new ses.CfnConfigurationSetEventDestination(
      this,
      "EmailEventDest",
      {
        configurationSetName: emailConfigSetName,
        eventDestination: {
          enabled: true,
          matchingEventTypes: ["bounce", "complaint"],
          snsDestination: { topicArn: emailEventsTopic.topicArn },
        },
      }
    );
    emailEventDest.addDependency(emailConfigSet);

    // Pre-bundled with esbuild (same as the reminder cron):
    //   npx esbuild lambda/suppression-handler.ts --bundle --platform=node \
    //     --target=node20 --outfile=lambda/dist/suppression-handler.js \
    //     --external:@aws-sdk/client-dynamodb --external:@aws-sdk/lib-dynamodb
    const suppressionFn = new lambda.Function(this, "EmailSuppressionHandler", {
      functionName: `ChapterFlowSuppressionHandler${suffix}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "suppression-handler.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "../lambda/dist")),
      memorySize: 256,
      timeout: cdk.Duration.minutes(1),
      environment: { BOOK_TABLE_NAME: this.appTable.tableName },
    });
    this.appTable.grantWriteData(suppressionFn);
    emailEventsTopic.addSubscription(new snsSubscriptions.LambdaSubscription(suppressionFn));

    // Expose the config-set name to the app runtime (read via getServerEnv → SSM).
    new ssm.StringParameter(this, "SesConfigurationSetParameter", {
      parameterName: `${this.ssmPrefix}/SES_CONFIGURATION_SET`,
      stringValue: emailConfigSetName,
    });

    // -------------------------------------------------------------------
    // Stack outputs
    // -------------------------------------------------------------------

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
    new cdk.CfnOutput(this, "OpsAlertsTopicArn", {
      value: opsAlertsTopic.topicArn,
    });
  }
}
