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
exports.StorageStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const dynamodb = __importStar(require("aws-cdk-lib/aws-dynamodb"));
const s3 = __importStar(require("aws-cdk-lib/aws-s3"));
const kms = __importStar(require("aws-cdk-lib/aws-kms"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
const cloudwatch = __importStar(require("aws-cdk-lib/aws-cloudwatch"));
const sfn = __importStar(require("aws-cdk-lib/aws-stepfunctions"));
const sfnTasks = __importStar(require("aws-cdk-lib/aws-stepfunctions-tasks"));
const path = __importStar(require("path"));
function normalizeCorsOrigin(raw) {
    const trimmed = raw.trim();
    if (!trimmed)
        return null;
    try {
        const parsed = new URL(trimmed);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:")
            return null;
        return `${parsed.protocol}//${parsed.host}`;
    }
    catch {
        return null;
    }
}
function resolveAllowedWebOrigins() {
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
    const normalized = new Set();
    for (const candidate of [...defaults, ...envCandidates]) {
        const value = normalizeCorsOrigin(candidate);
        if (value)
            normalized.add(value);
    }
    return Array.from(normalized);
}
class StorageStack extends cdk.Stack {
    table;
    analyticsTable;
    rawBucket;
    outputBucket;
    kmsKey;
    convertWorker;
    convertStateMachine;
    constructor(scope, id, props) {
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
        this.table.addGlobalSecondaryIndex({
            indexName: "quiz-scope-createdAt-index",
            partitionKey: { name: "quizScope", type: dynamodb.AttributeType.STRING },
            sortKey: { name: "createdAt", type: dynamodb.AttributeType.STRING },
            projectionType: dynamodb.ProjectionType.ALL,
        });
        // Analytics table — separate from main app table for independent scaling and querying
        this.analyticsTable = new dynamodb.Table(this, "BookAnalyticsTable", {
            tableName: "ChapterFlowAnalytics",
            partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
            sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
            stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
            // RETAIN: never drop analytics data on stack destroy
            removalPolicy: cdk.RemovalPolicy.RETAIN,
        });
        // GSI 1 — query events by date and type: "all quiz_attempts on 2024-01-15"
        this.analyticsTable.addGlobalSecondaryIndex({
            indexName: "eventDate-eventType-index",
            partitionKey: { name: "eventDate", type: dynamodb.AttributeType.STRING },
            sortKey: { name: "eventType", type: dynamodb.AttributeType.STRING },
            projectionType: dynamodb.ProjectionType.ALL,
        });
        // GSI 2 — query user snapshots by plan: "all PRO users sorted by last activity"
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
        new cdk.CfnOutput(this, "AnalyticsTableName", { value: this.analyticsTable.tableName });
        new cdk.CfnOutput(this, "RawBucketName", { value: this.rawBucket.bucketName });
        new cdk.CfnOutput(this, "OutputBucketName", { value: this.outputBucket.bucketName });
        new cdk.CfnOutput(this, "KmsKeyArn", { value: this.kmsKey.keyArn });
        new cdk.CfnOutput(this, "ConvertStateMachineArn", {
            value: this.convertStateMachine.stateMachineArn,
        });
    }
}
exports.StorageStack = StorageStack;
