import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3 from "aws-cdk-lib/aws-s3";
export declare class ChapterFlowBackendStack extends cdk.Stack {
    readonly appTable: dynamodb.Table;
    readonly analyticsTable: dynamodb.Table;
    readonly ingestBucket: s3.Bucket;
    readonly contentBucket: s3.Bucket;
    readonly appRunnerRuntimeRole: iam.Role;
    readonly ssmPrefix: string;
    constructor(scope: Construct, id: string, props?: cdk.StackProps);
}
