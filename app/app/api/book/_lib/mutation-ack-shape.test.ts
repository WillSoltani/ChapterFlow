import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

// This test intentionally does NOT import any `route.ts` module: those pull
// `server-only` transitively and would throw under the test runner. It reads
// route source as text instead. The native-contract registry (imported below)
// is plain TS with no `server-only` dependency.

const here = path.dirname(fileURLToPath(import.meta.url));
const bookApiRoot = path.resolve(here, ".."); // app/app/api/book

// The only routes permitted to still emit `ok: true` are the two operations
// pinned by the native contract with authority pointer "/ok" and decoded by
// live iOS models (ShareEventResponse, RedeemFlowPointsResponse). Removing
// `/ok` from those responses is an iOS-coordinated breaking change tracked as a
// native-contract deprecation item (see WS4-006 versioning); until that ships,
// literal "no ok:true anywhere under app/app/api/book/**" is unreachable.
const OK_TRUE_ALLOWLIST = new Set([
  "me/share-events/route.ts",
  "me/flow-points/redeem/route.ts",
]);

function collectRouteFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectRouteFiles(full));
    } else if (entry.isFile() && entry.name === "route.ts") {
      out.push(full);
    }
  }
  return out;
}

const OK_TRUE = /\bok:\s*true\b/;

test("book API route responses do not use ok:true outside the native-contract allowlist", () => {
  const offenders: string[] = [];
  for (const file of collectRouteFiles(bookApiRoot)) {
    const rel = path.relative(bookApiRoot, file).split(path.sep).join("/");
    if (!OK_TRUE.test(readFileSync(file, "utf8"))) continue;
    if (!OK_TRUE_ALLOWLIST.has(rel)) offenders.push(rel);
  }
  assert.deepEqual(
    offenders,
    [],
    `route.ts files using ok:true outside the allowlist (${[...OK_TRUE_ALLOWLIST].join(", ")}):\n${offenders.join("\n")}`,
  );
});

test("allowlisted routes are still pinned by the native contract", async () => {
  const { nativeContractOperationDefinitions } = await import(
    "../_contracts/native-contract-registry"
  );
  for (const id of ["share-event.post", "flow-points-redeem.post"]) {
    const op = nativeContractOperationDefinitions.find((o) => o.id === id);
    assert.ok(op, `expected native-contract op ${id} to exist`);
    const payload = JSON.stringify(op.fixtures?.success?.payload ?? {});
    assert.match(
      payload,
      /"ok":true/,
      `op ${id} responseBody must still pin ok:true (allowlist self-retires when the contract drops /ok)`,
    );
  }
});
