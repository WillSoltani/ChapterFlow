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
const sfn = __importStar(require("aws-cdk-lib/aws-stepfunctions"));
const sfnTasks = __importStar(require("aws-cdk-lib/aws-stepfunctions-tasks"));
const path = __importStar(require("path"));
class StorageStack extends cdk.Stack {
    table;
    rawBucket;
    outputBucket;
    kmsKey;
    convertWorker;
    convertStateMachine;
    constructor(scope, id, props) {
        super(scope, id, props);
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
                    allowedOrigins: ["http://localhost:3000", "https://soltani.org", "https://www.soltani.org"],
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
        });
        this.outputBucket = new s3.Bucket(this, "OutputsBucket", {
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            encryption: s3.BucketEncryption.KMS,
            encryptionKey: this.kmsKey,
            enforceSSL: true,
            versioned: true,
            cors: [
                {
                    allowedOrigins: ["http://localhost:3000", "https://soltani.org", "https://www.soltani.org"],
                    allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.HEAD],
                    allowedHeaders: ["*"],
                    exposedHeaders: ["ETag"],
                    maxAge: 3000,
                },
            ],
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
        });
        // With ts-node, __dirname is infra/lib — go up one level to reach infra/
        const infraRoot = path.resolve(__dirname, "..");
        const workerDir = path.join(infraRoot, "lib", "lambdas", "convert-worker");
        // Convert Worker Lambda — container image to support large native deps
        // (pdfjs-dist alone is ~220 MB unzipped, exceeding the 250 MB zip limit)
        // --------------------------
        this.convertWorker = new lambda.DockerImageFunction(this, "ConvertWorker", {
            code: lambda.DockerImageCode.fromImageAsset(workerDir),
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
        this.convertStateMachine = new sfn.StateMachine(this, "ConvertStateMachine", {
            stateMachineType: sfn.StateMachineType.STANDARD,
            definitionBody: sfn.DefinitionBody.fromChainable(invokeWorker),
            timeout: cdk.Duration.minutes(5),
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
exports.StorageStack = StorageStack;
