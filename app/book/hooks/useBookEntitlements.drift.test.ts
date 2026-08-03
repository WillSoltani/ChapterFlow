import { test } from "node:test";
import assert from "node:assert/strict";
// Type-only imports: erased at runtime, so this test never executes the
// "use client" hook module or the server type module — it only pins their types.
import type { ProSource } from "@/lib/entitlement-types";
import type { BookUserEntitlement } from "@/app/app/api/book/_lib/types";
import type { EntitlementsResponse } from "@/app/book/hooks/useBookEntitlements";

// Compile-time drift guard for WS3-014. The client billing hook's proSource
// union must stay equal to the server entitlement's proSource union (the shared
// `ProSource` source of truth). If either side stops deriving from ProSource and
// drifts — e.g. the client drops "admin" again — one of the mutual-assignability
// checks below resolves to `false` and this file fails `tsc` (npm run verify).

type ServerProSource = NonNullable<BookUserEntitlement["proSource"]>;
type ClientProSource = NonNullable<EntitlementsResponse["entitlement"]["proSource"]>;

type Extends<A, B> = [A] extends [B] ? true : false;

// Every element must be `true`; a `false` breaks the literal-type assignment.
const _driftGuards: [
  Extends<ServerProSource, ProSource>, // server ⊆ shared
  Extends<ProSource, ServerProSource>, // shared ⊆ server  → server == shared
  Extends<ClientProSource, ProSource>, // client ⊆ shared
  Extends<ProSource, ClientProSource>, // shared ⊆ client  → client == shared
  Extends<"admin", ClientProSource>, // the specific leak WS3-014 fixes
] = [true, true, true, true, true];

test("entitlement proSource union does not drift between server and client", () => {
  // The real assertions are the type aliases above (they gate tsc). This body
  // keeps the file a valid runtime test and documents the closed set.
  assert.deepEqual(_driftGuards, [true, true, true, true, true]);
  const all: ProSource[] = [
    "stripe",
    "apple",
    "license",
    "flow_points",
    "gift_code",
    "admin",
  ];
  assert.equal(new Set(all).size, 6);
});
