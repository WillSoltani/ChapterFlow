// Shared AWS SDK v3 client-config factory. NO `server-only` import here, and no
// imports from server-env/aws — this is a pure config object so it stays
// unit-testable outside the server-only boundary and importable from every AWS
// client construction site (aws.ts, cloudwatch-metrics.ts, cognito-admin.ts,
// email-service.ts, server-env.ts, the health probes, book-requests).
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
