import { test } from "node:test";
import assert from "node:assert/strict";
import { REQUIRED_SERVER_ENV, validateRequiredServerEnv } from "./boot-env-core";

const ALL_PRESENT: Record<string, string> = Object.fromEntries(
  REQUIRED_SERVER_ENV.map(({ name }) => [name, `test-value-${name}`]),
);

test("REQUIRED_SERVER_ENV is a non-empty, name-deduplicated list", () => {
  assert.ok(REQUIRED_SERVER_ENV.length > 0);
  const names = REQUIRED_SERVER_ENV.map((v) => v.name);
  assert.deepEqual(new Set(names).size, names.length, "no duplicate names");
  for (const { name, reason } of REQUIRED_SERVER_ENV) {
    assert.ok(name.trim().length > 0, "name must be non-empty");
    assert.ok(reason.trim().length > 0, `reason for ${name} must be non-empty`);
  }
});

test("all required vars present -> no missing", () => {
  const { missing } = validateRequiredServerEnv(ALL_PRESENT);
  assert.deepEqual(missing, []);
});

test("all required vars absent -> every name reported missing", () => {
  const { missing } = validateRequiredServerEnv({});
  assert.deepEqual(
    new Set(missing),
    new Set(REQUIRED_SERVER_ENV.map((v) => v.name)),
  );
});

test("mixed present/missing -> only the actually-missing names are reported", () => {
  const partial: Record<string, string> = { ...ALL_PRESENT };
  const [first, second] = REQUIRED_SERVER_ENV;
  delete partial[first.name];
  delete partial[second.name];

  const { missing } = validateRequiredServerEnv(partial);
  assert.deepEqual(new Set(missing), new Set([first.name, second.name]));
});

test("an empty-string or whitespace-only value counts as missing", () => {
  const [first, second] = REQUIRED_SERVER_ENV;
  const withBlankValues: Record<string, string> = {
    ...ALL_PRESENT,
    [first.name]: "",
    [second.name]: "   ",
  };

  const { missing } = validateRequiredServerEnv(withBlankValues);
  assert.deepEqual(new Set(missing), new Set([first.name, second.name]));
});

test("unrelated env vars are ignored and never reported missing", () => {
  const { missing } = validateRequiredServerEnv({
    ...ALL_PRESENT,
    SOME_UNRELATED_VAR: undefined,
    ANOTHER_UNRELATED_VAR: "",
  });
  assert.deepEqual(missing, []);
});

test("validateRequiredServerEnv reads real process.env-shaped input (undefined values allowed)", () => {
  const envLike: Record<string, string | undefined> = {
    ...ALL_PRESENT,
    PATH: undefined,
  };
  const { missing } = validateRequiredServerEnv(envLike);
  assert.deepEqual(missing, []);
});
