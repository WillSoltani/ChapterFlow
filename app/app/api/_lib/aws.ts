import "server-only";

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { S3Client } from "@aws-sdk/client-s3";
import { SFNClient } from "@aws-sdk/client-sfn";
import { mustServerEnv } from "./server-env";

export async function mustEnv(name: string): Promise<string> {
  return mustServerEnv(name);
}

export const REGION =
  process.env.AWS_REGION ||
  process.env.AWS_DEFAULT_REGION ||
  "us-east-1";

const ddb = new DynamoDBClient({ region: REGION });

export const ddbDoc = DynamoDBDocumentClient.from(ddb, {
  marshallOptions: { removeUndefinedValues: true },
});

export async function getTableName(): Promise<string> {
  return mustServerEnv("SECURE_DOC_TABLE");
}

export const s3 = new S3Client({ region: REGION });

export const sfn = new SFNClient({ region: REGION });
