#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { StorageStack } from "../lib/storage-stack";

const app = new cdk.App();

new StorageStack(app, "CloudPortfolioStorage", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: "us-east-1",
  },
  synthesizer: new cdk.DefaultStackSynthesizer({
    qualifier: "willfresh1",
  }),
});

app.synth();
