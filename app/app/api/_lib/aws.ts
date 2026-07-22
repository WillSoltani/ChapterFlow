import "server-only";

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { S3Client } from "@aws-sdk/client-s3";
import { SFNClient } from "@aws-sdk/client-sfn";

// Shared AWS SDK v3 client-config factory (WS4-016). Kept in aws.ts so it does
// not exist as a separate module in the shared app/book TypeScript closure.
// It is a pure config object — every AWS client construction site (this module,
// cloudwatch-metrics.ts, cognito-admin.ts, email-service.ts, server-env.ts, the
// health probes, book-requests) spreads it into a client constructor config.
//
// Without an explicit requestHandler timeout the SDK's default
// NodeHttpHandler has NO connection/socket timeout, so a stalled TCP
// connection or a server that accepts-but-never-responds hangs until the
// Lambda's own execution timeout kills the whole invocation — no client-level
// deadline, no retry, no clean error. Setting both timeouts here means a
// stalled call fails fast at the client boundary instead.
//
// NodeHttpHandler's `requestTimeout` is socket-IDLE time (time with no bytes
// received), not a hard end-to-end deadline — so a slow-but-steadily-streaming
// S3 GetObject body stays safe even past this value. `connectionTimeout` is
// TCP-connect time only.
//
// SDK 3.1073.0 accepts the plain-object `requestHandler` shorthand (spread
// into a client's constructor config) without a direct
// `@smithy/node-http-handler` dependency — the client lazily builds the real
// NodeHttpHandler from it.
export function makeAwsClientConfig(overrides?: {
  connectionTimeout?: number;
  requestTimeout?: number;
  maxAttempts?: number;
}): {
  requestHandler: {
    connectionTimeout: number;
    requestTimeout: number;
    throwOnRequestTimeout: true;
  };
  retryMode: "adaptive";
  maxAttempts: number;
} {
  return {
    requestHandler: {
      connectionTimeout: overrides?.connectionTimeout ?? 1000,
      requestTimeout: overrides?.requestTimeout ?? 5000,
      // @smithy/node-http-handler >=4.x only LOGS a WARN when requestTimeout is
      // exceeded unless this is set — without it a stalled socket never
      // actually rejects at the client deadline, defeating the whole point of
      // this factory.
      throwOnRequestTimeout: true,
    },
    retryMode: "adaptive" as const,
    maxAttempts: overrides?.maxAttempts ?? 3,
  };
}

export const awsClientConfig = Object.freeze(makeAwsClientConfig());

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
