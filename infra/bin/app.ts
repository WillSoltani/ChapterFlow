#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { ChapterFlowBackendStack } from "../lib/chapterflow-backend-stack";

const app = new cdk.App();

new ChapterFlowBackendStack(app, "ChapterFlowBackend", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: "us-east-1",
  },
});
