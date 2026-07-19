import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { register } from "@/instrumentation";
import {
  RUNTIME_ENV_REQUIREMENTS,
  buildSyntheticRuntimeEnvironment,
  validateRuntimeEnvironment,
} from "@/app/app/api/_lib/boot-env-core";
import { PROD_E2E_ENV } from "@/playwright.config";

// register() (root instrumentation.ts, WS3-012) must be a complete no-op
// everywhere except a genuine production runtime boot — see the guard
// comments in instrumentation.ts for why. instrumentation.ts imports nothing
// but the `server-only`-free boot-env-core module, so it is safe to import
// directly here with no Module._load patching (unlike ./auth.test.ts, which
// needs that dance because auth.ts pulls in `server-only`).

const TRACKED_KEYS = [
  "NEXT_RUNTIME",
  "NODE_ENV",
  "NEXT_PHASE",
  ...new Set(RUNTIME_ENV_REQUIREMENTS.flatMap(({ names }) => names)),
];
const originalValues = new Map<string, string | undefined>();

// next/types/global.d.ts augments NodeJS.ProcessEnv.NODE_ENV as a readonly
// literal union, so a plain `process.env.NODE_ENV = "..."` fails typecheck
// even though it works fine at runtime — Object.defineProperty goes through a
// signature TS does not tie to that readonly modifier, so route every env
// mutation in this file through it (including the delete case) for one
// consistent, typecheck-clean helper.
function setEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }
  Object.defineProperty(process.env, key, {
    value,
    writable: true,
    configurable: true,
    enumerable: true,
  });
}

before(() => {
  for (const key of TRACKED_KEYS) originalValues.set(key, process.env[key]);
});

after(() => {
  for (const [key, value] of originalValues) setEnv(key, value);
});

function clearAllTrackedKeys() {
  for (const key of TRACKED_KEYS) setEnv(key, undefined);
}

function setAllRequiredVars() {
  for (const [name, value] of Object.entries(
    buildSyntheticRuntimeEnvironment("prod"),
  )) {
    setEnv(name, value);
  }
}

beforeEach(() => {
  clearAllTrackedKeys();
});

test("no-op on a non-nodejs runtime, even with NODE_ENV=production and every required var missing", async () => {
  setEnv("NEXT_RUNTIME", "edge");
  setEnv("NODE_ENV", "production");
  // Required vars deliberately left unset — if the runtime guard did not
  // short-circuit first, this would throw.
  await assert.doesNotReject(() => register());
});

test("no-op outside NODE_ENV=production (dev), even with every required var missing", async () => {
  setEnv("NEXT_RUNTIME", "nodejs");
  setEnv("NODE_ENV", "development");
  await assert.doesNotReject(() => register());
});

test("no-op during the production BUILD phase, even with every required var missing (the CI/`next build` trap)", async () => {
  setEnv("NEXT_RUNTIME", "nodejs");
  setEnv("NODE_ENV", "production");
  setEnv("NEXT_PHASE", "phase-production-build");
  await assert.doesNotReject(() => register());
});

test("a real production runtime boot with a required var missing throws, listing the missing name(s)", async () => {
  setEnv("NEXT_RUNTIME", "nodejs");
  setEnv("NODE_ENV", "production");
  // NEXT_PHASE intentionally left unset — this is "phase-production-server".
  setAllRequiredVars();
  const missingName = "BOOK_TABLE_NAME";
  setEnv(missingName, undefined);

  await assert.rejects(
    () => register(),
    (err: unknown) => err instanceof Error && err.message.includes(missingName),
    `expected register() to reject with an error mentioning ${missingName}`,
  );
});

test("a real production runtime boot with every required var present resolves cleanly", async () => {
  setEnv("NEXT_RUNTIME", "nodejs");
  setEnv("NODE_ENV", "production");
  setAllRequiredVars();

  await assert.doesNotReject(() => register());
});

test("the production E2E server supplies every required boot variable", () => {
  assert.deepEqual(validateRuntimeEnvironment(PROD_E2E_ENV).failures, []);
});
