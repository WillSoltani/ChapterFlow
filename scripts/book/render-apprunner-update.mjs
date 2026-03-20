#!/usr/bin/env node

import fs from "node:fs";

const inputPath = process.argv[2];

if (!inputPath) {
  console.error("Usage: node scripts/book/render-apprunner-update.mjs <describe-service.json>");
  process.exit(1);
}

const bookTableName = process.env.BOOK_TABLE_NAME;
const bookAnalyticsTableName = process.env.BOOK_ANALYTICS_TABLE_NAME;
const bookIngestBucket = process.env.BOOK_INGEST_BUCKET;
const bookContentBucket = process.env.BOOK_CONTENT_BUCKET;
const ssmParameterPrefix = process.env.SSM_PARAMETER_PREFIX;
const instanceRoleArn = process.env.APP_RUNNER_INSTANCE_ROLE_ARN;
const connectionArn = process.env.APP_RUNNER_CONNECTION_ARN;

for (const [name, value] of Object.entries({
  BOOK_TABLE_NAME: bookTableName,
  BOOK_ANALYTICS_TABLE_NAME: bookAnalyticsTableName,
  BOOK_INGEST_BUCKET: bookIngestBucket,
  BOOK_CONTENT_BUCKET: bookContentBucket,
  SSM_PARAMETER_PREFIX: ssmParameterPrefix,
  APP_RUNNER_INSTANCE_ROLE_ARN: instanceRoleArn,
  APP_RUNNER_CONNECTION_ARN: connectionArn,
})) {
  if (!value) {
    console.error(`Missing required env: ${name}`);
    process.exit(1);
  }
}

const raw = fs.readFileSync(inputPath, "utf8");
const parsed = JSON.parse(raw);
const service = parsed?.Service;

if (!service?.ServiceArn || !service?.SourceConfiguration?.CodeRepository) {
  console.error("Input file does not look like an App Runner describe-service response.");
  process.exit(1);
}

const codeRepository = service.SourceConfiguration.CodeRepository;
const codeConfig = codeRepository.CodeConfiguration;
const codeValues = codeConfig?.CodeConfigurationValues || {};
const envVars = {
  ...(codeValues.RuntimeEnvironmentVariables || {}),
  BOOK_TABLE_NAME: bookTableName,
  BOOK_ANALYTICS_TABLE_NAME: bookAnalyticsTableName,
  BOOK_INGEST_BUCKET: bookIngestBucket,
  BOOK_CONTENT_BUCKET: bookContentBucket,
  SSM_PARAMETER_PREFIX: ssmParameterPrefix,
};

delete envVars.SECURE_DOC_TABLE;
delete envVars.RAW_BUCKET;
delete envVars.OUTPUT_BUCKET;
delete envVars.CONVERT_SFN_ARN;

const payload = {
  ServiceArn: service.ServiceArn,
  SourceConfiguration: {
    CodeRepository: {
      RepositoryUrl: codeRepository.RepositoryUrl,
      SourceCodeVersion: codeRepository.SourceCodeVersion,
      CodeConfiguration: {
        ConfigurationSource: codeConfig?.ConfigurationSource || "API",
        CodeConfigurationValues: {
          Runtime: codeValues.Runtime,
          BuildCommand: codeValues.BuildCommand,
          StartCommand: codeValues.StartCommand,
          Port: codeValues.Port,
          RuntimeEnvironmentVariables: envVars,
          RuntimeEnvironmentSecrets: codeValues.RuntimeEnvironmentSecrets || {},
        },
      },
      SourceDirectory: codeRepository.SourceDirectory || "/",
    },
    AutoDeploymentsEnabled: service.SourceConfiguration.AutoDeploymentsEnabled === true,
    AuthenticationConfiguration: {
      ConnectionArn: connectionArn,
    },
  },
  InstanceConfiguration: {
    Cpu: service.InstanceConfiguration?.Cpu,
    Memory: service.InstanceConfiguration?.Memory,
    InstanceRoleArn: instanceRoleArn,
  },
  AutoScalingConfigurationArn:
    service.AutoScalingConfigurationSummary?.AutoScalingConfigurationArn,
  HealthCheckConfiguration: service.HealthCheckConfiguration,
  NetworkConfiguration: service.NetworkConfiguration,
  ObservabilityConfiguration: {
    ObservabilityEnabled:
      service.ObservabilityConfiguration?.ObservabilityEnabled === true,
    ...(service.ObservabilityConfiguration?.ObservabilityConfigurationArn
      ? {
          ObservabilityConfigurationArn:
            service.ObservabilityConfiguration.ObservabilityConfigurationArn,
        }
      : {}),
  },
};

process.stdout.write(JSON.stringify(payload, null, 2));
