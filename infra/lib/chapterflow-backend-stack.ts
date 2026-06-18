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
import * as sqs from "aws-cdk-lib/aws-sqs";
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

function resolveAllowedWebOrigins(envName: EnvName): string[] {
  // Canonical prod origins. dev/staging additionally allow localhost and the
  // legacy siliconx hosts for local/preview testing; prod must NOT — a prod
  // ingest bucket should never accept localhost or a legacy domain in its CORS.
  const prodOrigins = [
    "https://chapterflow.ca",
    "https://www.chapterflow.ca",
    "https://app.chapterflow.ca",
    "https://auth.chapterflow.ca",
  ];
  const nonProdOrigins = [
    "http://localhost:3000",
    "https://siliconx.ca",
    "https://www.siliconx.ca",
    "https://chapterflow.siliconx.ca",
    "https://auth.siliconx.ca",
  ];
  const defaults =
    envName === "prod" ? prodOrigins : [...prodOrigins, ...nonProdOrigins];

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
  /**
   * Apex domain for this env (prod resolves to chapterflow.ca), or undefined for
   * dev/staging without a verified SES identity. Scopes the reminder cron's SES
   * sender address + SendEmail grant to the env's verified domain.
   */
  readonly domainName?: string;
}

export class ChapterFlowBackendStack extends cdk.Stack {
  public readonly appTable: dynamodb.Table;
  public readonly analyticsTable: dynamodb.Table;
  public readonly ingestBucket: s3.Bucket;
  public readonly contentBucket: s3.Bucket;
  public readonly ssmPrefix: string;

  constructor(scope: Construct, id: string, props: ChapterFlowBackendStackProps) {
    super(scope, id, props);
    applyStandardTags(this);
    cdk.Tags.of(this).add("Environment", props.envName);

    const suffix = props.resourceSuffix;
    const allowedWebOrigins = resolveAllowedWebOrigins(props.envName);
    this.ssmPrefix = props.ssmPrefix;

    this.appTable = new dynamodb.Table(this, "ChapterFlowAppTable", {
      tableName: props.tableName,
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      // Cron + app writers stamp a numeric `ttl` on ephemeral records only
      // (nudge dedup markers, pairing invites, Ask-the-Book cache, rate-limit
      // counters). Without this attribute DynamoDB never reaps them: the
      // welcome-back nudge (non-rotating dedup key) would fire exactly once per
      // user for life, and every active user's partition would grow unbounded.
      // No durable entity stores `ttl`, so enabling it is safe; doing so on an
      // existing table is a non-destructive online operation.
      timeToLiveAttribute: "ttl",
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
      // No DynamoDB stream consumer exists (no DynamoEventSource / grantStreamRead
      // / tableStreamArn reference anywhere in infra or app); a stream here is dead
      // cost + the false appearance of a missing consumer. Add it back alongside a
      // real consumer if one is ever planned.
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

    // NOTE: there is no App Runner service. The app deploys to OpenNext Lambda
    // (ChapterFlowFrontend), whose own role grants DynamoDB/S3/SSM/SES access.
    // The former `ChapterFlowAppRuntimeRole` (assumed by tasks.apprunner.amazonaws.com)
    // had no consumer and stood as broad unused privilege — removed. Its CI
    // counterparts (apprunner:* + iam:PassRole) were dropped from
    // infra/iam/github-actions-dev-policy.json.

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

    // Deployed from the pre-bundled lambda/dist asset. The CI deploy workflow
    // (_deploy-infra.yml) rebuilds these bundles from source with esbuild on
    // every deploy and fails on drift, so a stale committed bundle can never
    // ship silently. To rebuild locally (run from the infra/ directory):
    //   npx esbuild lambda/reading-reminder-cron.ts --bundle --platform=node \
    //     --target=node20 --outfile=lambda/dist/reading-reminder-cron.js \
    //     --external:@aws-sdk/client-dynamodb --external:@aws-sdk/lib-dynamodb \
    //     --external:@aws-sdk/client-sesv2 --external:@aws-sdk/client-ssm
    //
    // Reminder emails are sent from this address on the env's verified domain.
    // prod resolves to info@chapterflow.ca (props.domainName) and scopes SES
    // SendEmail to that domain identity; dev/staging without a verified domain
    // fall back to a "*" grant (their commercial sends stay disabled by the
    // EMAIL_POSTAL_ADDRESS kill-switch until an identity is verified).
    // SES_SENDER_EMAIL overrides the address.
    const reminderSenderDomain = props.domainName;
    const reminderSenderEmail =
      process.env.SES_SENDER_EMAIL?.trim() ||
      (reminderSenderDomain ? `info@${reminderSenderDomain}` : "info@chapterflow.ca");

    // The cron mints CASL one-click-unsubscribe URLs, the List-Unsubscribe
    // header, and CTA links against APP_BASE_URL — it MUST be the live app host.
    // The legacy chapterflow.siliconx.ca fallback no longer serves the unsubscribe
    // route, so minting links there is a CASL/CAN-SPAM violation. Require it for
    // prod (fail the deploy loudly); dev/staging may omit it (commercial sends are
    // disabled there by the EMAIL_POSTAL_ADDRESS kill-switch, and the runtime
    // refuses to send when APP_BASE_URL is empty — see email-compliance.ts).
    const appBaseUrl = process.env.CHAPTERFLOW_APP_BASE_URL?.trim();
    if (props.envName === "prod" && !appBaseUrl) {
      throw new Error(
        "CHAPTERFLOW_APP_BASE_URL is required for a prod backend deploy: the " +
          "reminder/digest cron mints CASL one-click-unsubscribe + CTA links " +
          "against it. Set the prod CHAPTERFLOW_APP_BASE_URL secret (the same one " +
          "the app deploy uses) — refusing to mint email links to the dead " +
          "chapterflow.siliconx.ca host.",
      );
    }

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
    //
    // Dead-letter queue for the async (EventBridge-invoked) reminder cron. If a
    // whole invocation throws before the per-user isolation (e.g. resolveEmailConfig
    // SSM failure at handler entry, or the table Scan failing), Lambda exhausts its
    // async retries and CDK routes the failed event here instead of dropping that
    // hour's reminders/nudges silently (L16 / #98). A 14-day retention gives
    // operators a window to inspect/replay; the Errors/Duration alarms below page
    // the ops topic so a dropped hour never goes unnoticed.
    const reminderDlq = new sqs.Queue(this, "ChapterFlowReminderDlq", {
      retentionPeriod: cdk.Duration.days(14),
      enforceSSL: true,
    });
    const reminderTimeout = cdk.Duration.minutes(5);
    const reminderFn = new lambda.Function(this, "ReadingReminderCron", {
      functionName: `ChapterFlowReadingReminder${suffix}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "reading-reminder-cron.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "../lambda/dist")),
      memorySize: 256,
      timeout: reminderTimeout,
      deadLetterQueue: reminderDlq,
      environment: {
        BOOK_TABLE_NAME: this.appTable.tableName,
        SES_SENDER_EMAIL: reminderSenderEmail,
        SES_CONFIGURATION_SET: emailConfigSetName,
        // No siliconx.ca fallback: an empty value makes the runtime refuse to
        // send rather than mint links to a dead host (prod is guarded above).
        APP_BASE_URL: appBaseUrl ?? "",
        // Owner-provided email config is read at runtime from SSM
        // (/chapterflow/<env>/EMAIL_*), the same params the app reads — so it is
        // set in ONE place. These are deploy-time fallbacks only.
        SSM_PARAMETER_PREFIX: this.ssmPrefix,
        EMAIL_SENDER_NAME: process.env.EMAIL_SENDER_NAME ?? "ChapterFlow",
        EMAIL_SUPPORT_ADDRESS:
          process.env.EMAIL_SUPPORT_ADDRESS ?? "support@chapterflow.ca",
        EMAIL_POSTAL_ADDRESS: process.env.EMAIL_POSTAL_ADDRESS ?? "",
        EMAIL_UNSUBSCRIBE_SECRET: process.env.EMAIL_UNSUBSCRIBE_SECRET ?? "",
        // Behavior-loop day-3/7 commitment follow-up nudge. Ships dark: ""/"0" = off.
        // Flip to "true" (or "1") to enable without a code change.
        BOOK_ENABLE_COMMITMENT_FOLLOWUP:
          process.env.BOOK_ENABLE_COMMITMENT_FOLLOWUP ?? "",
      },
    });

    this.appTable.grantReadWriteData(reminderFn);
    // Scope SendEmail to the env's verified domain identity when known (prod);
    // dev/staging without a verified domain fall back to "*" — same conditional
    // shape as the frontend stack's SesSendAccess statement.
    reminderFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["ses:SendEmail", "sesv2:SendEmail"],
        resources: reminderSenderDomain
          ? [
              `arn:${cdk.Aws.PARTITION}:ses:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:identity/${reminderSenderDomain}`,
            ]
          : ["*"],
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

    // Page operators when the reminder cron errors (a whole-invocation throw that
    // will exhaust async retries and land in ChapterFlowReminderDlq above) so a
    // dropped hour of reminders/nudges never goes unnoticed.
    const reminderErrorsAlarm = new cloudwatch.Alarm(this, "ChapterFlowReminderErrorsAlarm", {
      metric: reminderFn.metricErrors({ period: cdk.Duration.minutes(5) }),
      threshold: 1,
      evaluationPeriods: 1,
      datapointsToAlarm: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription:
        "The reading-reminder cron is erroring (e.g. SSM/email-config failure at handler entry or a failing table Scan). After async retries are exhausted, the failed hour's event lands in ChapterFlowReminderDlq — inspect/replay it.",
    });
    reminderErrorsAlarm.addAlarmAction(opsAlarmAction);

    // Alarm when an invocation approaches the function timeout (>=80% of the
    // 5-minute budget) — the known-unfinished signal flagged in
    // reading-reminder-cron.ts. A slow hourly run risks timing out and dropping
    // that hour's reminders before the per-user isolation can complete.
    const reminderDurationAlarm = new cloudwatch.Alarm(this, "ChapterFlowReminderDurationAlarm", {
      metric: reminderFn.metricDuration({ period: cdk.Duration.minutes(5), statistic: "Maximum" }),
      threshold: reminderTimeout.toMilliseconds() * 0.8,
      evaluationPeriods: 1,
      datapointsToAlarm: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription:
        "The reading-reminder cron is approaching its 5-minute timeout (>=80% of budget). A timed-out run drops that hour's reminders/nudges — raise the timeout/memory or shard the workload.",
    });
    reminderDurationAlarm.addAlarmAction(opsAlarmAction);

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
    // Dead-letter queue for the async (SNS-invoked) suppression Lambda. The
    // handler rethrows on a DynamoDB write failure so the async invoke retries;
    // once Lambda exhausts its retries, CDK routes the failed event here instead
    // of dropping the bounce/complaint silently (M9 / #79). A 14-day retention
    // gives operators a window to inspect/replay.
    const suppressionDlq = new sqs.Queue(this, "ChapterFlowSuppressionDlq", {
      retentionPeriod: cdk.Duration.days(14),
      enforceSSL: true,
    });

    const suppressionFn = new lambda.Function(this, "EmailSuppressionHandler", {
      functionName: `ChapterFlowSuppressionHandler${suffix}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "suppression-handler.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "../lambda/dist")),
      memorySize: 256,
      timeout: cdk.Duration.minutes(1),
      environment: { BOOK_TABLE_NAME: this.appTable.tableName },
      deadLetterQueue: suppressionDlq,
    });
    this.appTable.grantWriteData(suppressionFn);
    emailEventsTopic.addSubscription(new snsSubscriptions.LambdaSubscription(suppressionFn));

    // Page operators when the suppression Lambda errors (e.g. repeated DynamoDB
    // write failures that will exhaust async retries and land in the DLQ above),
    // so a backlog of un-suppressed bounces/complaints never goes unnoticed.
    const suppressionErrorsAlarm = new cloudwatch.Alarm(this, "ChapterFlowSuppressionErrorsAlarm", {
      metric: suppressionFn.metricErrors({ period: cdk.Duration.minutes(5) }),
      threshold: 1,
      evaluationPeriods: 1,
      datapointsToAlarm: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription:
        "The SES suppression Lambda is erroring (likely DynamoDB write failures). After async retries are exhausted, failed bounce/complaint events land in ChapterFlowSuppressionDlq — inspect/replay them.",
    });
    suppressionErrorsAlarm.addAlarmAction(opsAlarmAction);

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
    new cdk.CfnOutput(this, "SsmParameterPrefix", {
      value: this.ssmPrefix,
    });
    new cdk.CfnOutput(this, "OpsAlertsTopicArn", {
      value: opsAlertsTopic.topicArn,
    });
  }
}
