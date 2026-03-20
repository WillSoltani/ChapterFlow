#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { ChapterFlowBackendStack } from "../lib/chapterflow-backend-stack";

const app = new cdk.App();

new ChapterFlowBackendStack(app, "ChapterFlowBackend", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: "us-east-1",
  },
  synthesizer: new cdk.DefaultStackSynthesizer({
    qualifier: "willfresh1",
  }),
});

app.synth();
