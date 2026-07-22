import { test } from "node:test";
import assert from "node:assert/strict";
import nextConfig from "../next.config";

const EXPECTED_HSTS = "max-age=31536000; includeSubDomains; preload";

test("WS8-003: the catch-all response emits exactly one preload-ready HSTS header", async () => {
  assert.ok(nextConfig.headers, "next.config must define response headers");
  const rules = await nextConfig.headers();
  const hstsEntries = rules.flatMap((rule) =>
    rule.headers
      .filter(
        (header) =>
          header.key.toLowerCase() === "strict-transport-security",
      )
      .map((header) => ({ source: rule.source, value: header.value })),
  );

  assert.deepEqual(hstsEntries, [
    {
      source: "/(.*)",
      value: EXPECTED_HSTS,
    },
  ]);
});
