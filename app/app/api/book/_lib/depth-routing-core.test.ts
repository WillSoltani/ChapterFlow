import { test } from "node:test";
import assert from "node:assert/strict";
import { depthModelKey } from "./depth-routing-core";

test("depthModelKey uses uppercase PK/SK to match the table schema", () => {
  const key = depthModelKey("user-123", "book-abc");

  // The app table key schema is uppercase PK/SK. Lowercase keys make DynamoDB
  // reject Get/Put with a ValidationException (the depth-recommendation route
  // then 500s). Guard against that casing regression.
  assert.ok("PK" in key, "key must have an uppercase PK attribute");
  assert.ok("SK" in key, "key must have an uppercase SK attribute");
  assert.ok(!("pk" in key), "key must NOT have a lowercase pk attribute");
  assert.ok(!("sk" in key), "key must NOT have a lowercase sk attribute");
});

test("depthModelKey builds the per-user / per-book key values", () => {
  const key = depthModelKey("user-123", "book-abc");

  assert.equal(key.PK, "BOOKUSER#user-123");
  assert.equal(key.SK, "DEPTHMODEL#book-abc");
});
