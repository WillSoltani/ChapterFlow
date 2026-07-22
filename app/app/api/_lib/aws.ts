import "server-only";

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { S3Client } from "@aws-sdk/client-s3";
import { SFNClient } from "@aws-sdk/client-sfn";
import { awsClientConfig } from "./aws-client-config-core";

// WS6-029: passive X-Ray instrumentation. When the server Lambda runs with
// ACTIVE tracing (frontend ServerFn), the daemon address env var is set and we
// wrap each AWS SDK client so its calls become DynamoDB/S3/SFN subsegments under
// the request trace. This MUST NOT change request behavior: we only wrap when a
// tracing context is actually present (the daemon var is unset locally/in tests/
// at build), we tell the SDK to swallow a missing-segment context instead of
// throwing or log-spamming, and any failure in capture falls back to the raw
// client. `client` is `unknown`-typed by captureAWSv3Client so we thread the
// concrete type through a generic and cast the result back.
function traceClient<T>(client: T): T {
  if (!process.env.AWS_XRAY_DAEMON_ADDRESS) return client;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const xray = require("aws-xray-sdk-core");
    // A subsegment can be requested outside an active segment (e.g. a warm
    // invoke that isn't sampled); IGNORE_ERROR makes that a no-op rather than
    // an exception or an error log per call.
    xray.setContextMissingStrategy("IGNORE_ERROR");
    return xray.captureAWSv3Client(client) as T;
  } catch {
    return client;
  }
}

export const REGION =
  process.env.AWS_REGION ||
  process.env.AWS_DEFAULT_REGION ||
  "us-east-1";

// Wrap the base client before building the DocumentClient so DynamoDB calls
// issued through the doc client still surface as X-Ray subsegments.
const ddb = traceClient(new DynamoDBClient({ region: REGION, ...awsClientConfig }));

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

export const s3 = traceClient(new S3Client({ region: REGION, ...awsClientConfig }));

export const sfn = traceClient(new SFNClient({ region: REGION, ...awsClientConfig }));
