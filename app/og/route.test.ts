import assert from "node:assert/strict";
import test from "node:test";

import { GET } from "./route";

test("GET returns an explicit public immutable one-year cache contract", async () => {
  const response = await GET();

  assert.equal(
    response.headers.get("Cache-Control"),
    "public, max-age=31536000, immutable",
  );
});
