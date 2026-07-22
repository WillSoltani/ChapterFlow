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

// WS4-007 (final audit remainder): the flat-stack `{ ok, processed }` ack leaked
// through POST /book/me/billing/apple/verify — but the `ok:true` literal lived in
// the response BUILDER (_lib/apple-verify-service-core.ts), not the route.ts the
// scan above walks, so it slipped the route grep. The native contract for that
// endpoint pins only `/entitlement/*` and never decodes `ok`/`processed`, so the
// fix was removal (not an allowlist). This guard locks the builder against a
// regression AND proves removal stays contract-safe.
test("apple/verify response builder does not re-introduce the flat ok/processed ack", () => {
  const builder = readFileSync(
    path.join(bookApiRoot, "_lib", "apple-verify-service-core.ts"),
    "utf8",
  );
  assert.doesNotMatch(
    builder,
    /\bok:\s*true\b/,
    "apple-verify-service-core.ts must not emit the flat `ok: true` ack (WS4-007)",
  );
  assert.doesNotMatch(
    builder,
    /\bprocessed:\s*true\b/,
    "apple-verify-service-core.ts must not emit the flat `processed: true` ack (WS4-007)",
  );
});

test("native contract for apple/verify never pinned ok/processed (removal is contract-safe)", async () => {
  const { nativeContractOperationDefinitions } = await import(
    "../_contracts/native-contract-registry"
  );
  const op = nativeContractOperationDefinitions.find(
    (o) => o.id === "apple-verify.post",
  );
  assert.ok(op, "expected native-contract op apple-verify.post to exist");
  const payload = JSON.stringify(op.fixtures?.success?.payload ?? {});
  assert.doesNotMatch(
    payload,
    /"ok":/,
    "apple-verify.post pins /entitlement/* only; it must not promise /ok to iOS",
  );
  assert.doesNotMatch(
    payload,
    /"processed":/,
    "apple-verify.post must not promise /processed to iOS",
  );
});
