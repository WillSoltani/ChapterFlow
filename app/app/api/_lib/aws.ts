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
  // NOTE: convertEmptyValues is intentionally OFF. With it on, the SDK rewrites
  // empty strings AND empty Sets to a NULL attribute on write (verified on
  // @aws-sdk/util-dynamodb 3.996.2). That silently corrupted entitlement
  // initialization: `unlockedBookIds = if_not_exists(unlockedBookIds, <empty Set>)`
  // stored unlockedBookIds as NULL, and the later `ADD unlockedBookIds :bookSet`
  // in reserveBookEntitlement then threw a ValidationException (ADD takes only
  // Number/Set, not NULL). With the flag off, empty strings store natively as
  // S:"" and empty Sets must not be written at all (marshal throws on them) —
  // callers create Set-typed attributes lazily via ADD. Do not re-enable.
  marshallOptions: { removeUndefinedValues: true },
});

export async function getTableName(): Promise<string> {
  return mustServerEnv("SECURE_DOC_TABLE");
}

export const s3 = new S3Client({ region: REGION });

export const sfn = new SFNClient({ region: REGION });
