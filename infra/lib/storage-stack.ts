import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as kms from "aws-cdk-lib/aws-kms";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";

import * as sfn from "aws-cdk-lib/aws-stepfunctions";
import * as sfnTasks from "aws-cdk-lib/aws-stepfunctions-tasks";
import * as path from "path";

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
    "https://soltani.org",
    "https://www.soltani.org",
  ];

  const envCandidates = [
    process.env.WEB_ALLOWED_ORIGINS || "",
    process.env.APP_BASE_URL || "",
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

export class StorageStack extends cdk.Stack {
  public readonly table: dynamodb.Table;
  public readonly rawBucket: s3.Bucket;
  public readonly outputBucket: s3.Bucket;
  public readonly kmsKey: kms.Key;

  public readonly convertWorker: lambda.Function;
  public readonly convertStateMachine: sfn.StateMachine;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    const allowedWebOrigins = resolveAllowedWebOrigins();

    this.kmsKey = new kms.Key(this, "SecureDocKmsKey", {
      enableKeyRotation: true,
    });

    this.table = new dynamodb.Table(this, "SecureDocAppTable", {
      tableName: "SecureDocApp",
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },

      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.rawBucket = new s3.Bucket(this, "RawUploadsBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: this.kmsKey,
      enforceSSL: true,
      versioned: true,
      cors: [
        {
          allowedOrigins: allowedWebOrigins,
          allowedMethods: [
            s3.HttpMethods.PUT,
            s3.HttpMethods.POST,
            s3.HttpMethods.GET,
            s3.HttpMethods.HEAD,
          ],
          allowedHeaders: ["*"],
          exposedHeaders: ["ETag"],
          maxAge: 3000,
        },
      ],

      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      lifecycleRules: [
        {
          id: "raw-upload-maintenance",
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(7),
          noncurrentVersionExpiration: cdk.Duration.days(30),
        },
      ],
    });

    this.outputBucket = new s3.Bucket(this, "OutputsBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: this.kmsKey,
      enforceSSL: true,
      versioned: true,
      cors: [
        {
          allowedOrigins: allowedWebOrigins,
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.HEAD],
          allowedHeaders: ["*"],
          exposedHeaders: ["ETag"],
          maxAge: 3000,
        },
      ],

      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      lifecycleRules: [
        {
          id: "output-maintenance",
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(7),
          noncurrentVersionExpiration: cdk.Duration.days(30),
        },
      ],
    });

    // With ts-node, __dirname is infra/lib — go up one level to reach infra/
    const infraRoot = path.resolve(__dirname, "..");
    const workerDir = path.join(infraRoot, "lib", "lambdas", "convert-worker");

    // Convert Worker Lambda — container image to support large native deps
    // (pdfjs-dist alone is ~220 MB unzipped, exceeding the 250 MB zip limit)
    // --------------------------
    const convertWorkerFunctionName = `${cdk.Stack.of(this).stackName}-ConvertWorker`;
    const convertWorkerLogGroup = new logs.LogGroup(this, "ConvertWorkerLogs", {
      logGroupName: `/aws/lambda/${convertWorkerFunctionName}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.convertWorker = new lambda.DockerImageFunction(this, "ConvertWorker", {
      code: lambda.DockerImageCode.fromImageAsset(workerDir),
      functionName: convertWorkerFunctionName,
      logGroup: convertWorkerLogGroup,

      /**
       * x86_64 matches the linux/amd64 platform in the Dockerfile.
       * Native packages (sharp, @napi-rs/canvas) are compiled for linux-x64-gnu.
       */
      architecture: lambda.Architecture.X86_64,

      memorySize: 2048,
      timeout: cdk.Duration.minutes(2),

      environment: {
        SECURE_DOC_TABLE: this.table.tableName,
        RAW_BUCKET: this.rawBucket.bucketName,
        OUTPUT_BUCKET: this.outputBucket.bucketName,
      },
    });

    this.table.grantReadWriteData(this.convertWorker);
    this.rawBucket.grantRead(this.convertWorker);
    this.outputBucket.grantWrite(this.convertWorker);
    this.kmsKey.grantEncryptDecrypt(this.convertWorker);

    // --------------------------
    // Step Functions: single-task state machine (v1)
    // --------------------------
    const invokeWorker = new sfnTasks.LambdaInvoke(this, "InvokeConvertWorker", {
      lambdaFunction: this.convertWorker,
      payloadResponseOnly: true,
      retryOnServiceExceptions: true,
    });

    // Retry transient Lambda failures (throttling, service errors) up to 2 times
    invokeWorker.addRetry({
      errors: ["Lambda.ServiceException", "Lambda.AWSLambdaException", "Lambda.SdkClientException", "Lambda.TooManyRequestsException"],
      maxAttempts: 2,
      interval: cdk.Duration.seconds(2),
      backoffRate: 2,
    });

    const convertStateMachineLogGroup = new logs.LogGroup(this, "ConvertStateMachineLogs", {
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.convertStateMachine = new sfn.StateMachine(this, "ConvertStateMachine", {
      stateMachineType: sfn.StateMachineType.STANDARD,
      definitionBody: sfn.DefinitionBody.fromChainable(invokeWorker),
      timeout: cdk.Duration.minutes(5),
      logs: {
        destination: convertStateMachineLogGroup,
        level: sfn.LogLevel.ERROR,
        includeExecutionData: false,
      },
    });

    new cloudwatch.Alarm(this, "ConvertWorkerErrorsAlarm", {
      metric: this.convertWorker.metricErrors({
        period: cdk.Duration.minutes(5),
        statistic: "sum",
      }),
      threshold: 1,
      evaluationPeriods: 1,
      datapointsToAlarm: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: "Alerts when convert worker Lambda reports one or more errors in 5 minutes.",
    });

    new cloudwatch.Alarm(this, "ConvertStateMachineFailedAlarm", {
      metric: this.convertStateMachine.metricFailed({
        period: cdk.Duration.minutes(5),
        statistic: "sum",
      }),
      threshold: 1,
      evaluationPeriods: 1,
      datapointsToAlarm: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: "Alerts when conversion Step Functions executions fail.",
    });

    new cdk.CfnOutput(this, "SecureDocTableName", { value: this.table.tableName });
    new cdk.CfnOutput(this, "RawBucketName", { value: this.rawBucket.bucketName });
    new cdk.CfnOutput(this, "OutputBucketName", { value: this.outputBucket.bucketName });
    new cdk.CfnOutput(this, "KmsKeyArn", { value: this.kmsKey.keyArn });

    new cdk.CfnOutput(this, "ConvertStateMachineArn", {
      value: this.convertStateMachine.stateMachineArn,
    });
  }
}
