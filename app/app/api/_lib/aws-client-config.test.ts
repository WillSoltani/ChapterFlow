import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

import { installServerOnlyShim } from "@/tests/_lib/server-only-shim";

// aws.ts imports `server-only`, which throws at module-load under the test
// runner. Shim it, then dynamically import the config factory so this test
// stays runnable and stays OUT of the shared app/book TypeScript closure.
let restoreServerOnly: (() => void) | undefined;
let makeAwsClientConfig: typeof import("./aws").makeAwsClientConfig;

before(async () => {
  restoreServerOnly = installServerOnlyShim();
  ({ makeAwsClientConfig } = await import("./aws"));
});

after(() => restoreServerOnly?.());

test("makeAwsClientConfig: emits explicit requestHandler timeouts, adaptive retryMode, and bounded maxAttempts", () => {
  const config = makeAwsClientConfig();

  assert.equal(typeof config.requestHandler.connectionTimeout, "number");
  assert.ok(Number.isFinite(config.requestHandler.connectionTimeout));
  assert.ok(config.requestHandler.connectionTimeout > 0);

  assert.equal(typeof config.requestHandler.requestTimeout, "number");
  assert.ok(Number.isFinite(config.requestHandler.requestTimeout));
  assert.ok(config.requestHandler.requestTimeout > 0);

  assert.equal(config.retryMode, "adaptive");
  assert.ok(config.maxAttempts >= 1);
  assert.equal(config.requestHandler.throwOnRequestTimeout, true);

  const overridden = makeAwsClientConfig({
    connectionTimeout: 111,
    requestTimeout: 222,
    maxAttempts: 7,
  });
  assert.equal(overridden.requestHandler.connectionTimeout, 111);
  assert.equal(overridden.requestHandler.requestTimeout, 222);
  assert.equal(overridden.maxAttempts, 7);
});

test("stalled S3 socket rejects at the client deadline, not the Lambda timeout", async () => {
  const server = http.createServer(() => {
    /* accept, never respond */
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as AddressInfo).port;
  const client = new S3Client({
    region: "us-east-1",
    endpoint: `http://127.0.0.1:${port}`,
    forcePathStyle: true,
    credentials: { accessKeyId: "test-access-key-id", secretAccessKey: "test-secret-access-key" },
    ...makeAwsClientConfig({ requestTimeout: 250, connectionTimeout: 250, maxAttempts: 1 }),
  });
  const t0 = Date.now();
  await assert.rejects(client.send(new GetObjectCommand({ Bucket: "b", Key: "k" })));
  assert.ok(Date.now() - t0 < 5000, "must reject at the client deadline");
  server.close();
});
