import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as kms from "aws-cdk-lib/aws-kms";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as sfn from "aws-cdk-lib/aws-stepfunctions";
export declare class StorageStack extends cdk.Stack {
    readonly table: dynamodb.Table;
    readonly analyticsTable: dynamodb.Table;
    readonly rawBucket: s3.Bucket;
    readonly outputBucket: s3.Bucket;
    readonly kmsKey: kms.Key;
    readonly convertWorker: lambda.Function;
    readonly convertStateMachine: sfn.StateMachine;
    constructor(scope: Construct, id: string, props?: cdk.StackProps);
}
