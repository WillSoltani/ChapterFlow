import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as lambda from "aws-cdk-lib/aws-lambda";
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
export declare class ChapterFlowFrontendStack extends cdk.Stack {
    readonly distribution: cloudfront.Distribution;
    readonly serverFunction: lambda.Function;
    constructor(scope: Construct, id: string, props: ChapterFlowFrontendStackProps);
}
