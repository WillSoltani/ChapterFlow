import { test } from "node:test";
import assert from "node:assert/strict";
import {
  classifyWebhookClaim,
  leaseExpiryMs,
  leaseTtlEpochSeconds,
} from "./webhook-claim-core";

const NOW = 1_700_000_000_000; // fixed epoch ms
const LEASE_MS = 900_000; // 900s

// ─── classifyWebhookClaim — the lease state machine ───────────────────────────

test("claim when no marker exists", () => {
  assert.equal(classifyWebhookClaim(null, NOW, LEASE_MS), "claim");
  assert.equal(classifyWebhookClaim(undefined, NOW, LEASE_MS), "claim");
});

test("done when marker is DONE (permanent idempotency, safe to ack)", () => {
  assert.equal(
    classifyWebhookClaim({ status: "DONE" }, NOW, LEASE_MS),
    "done",
  );
});

test("in_progress when PROCESSING and lease has NOT expired (must NOT ack)", () => {
  assert.equal(
    classifyWebhookClaim(
      { status: "PROCESSING", leaseExpiresAt: NOW + 1 },
      NOW,
      LEASE_MS,
    ),
    "in_progress",
  );
});

test("reclaim when PROCESSING and lease HAS expired", () => {
  assert.equal(
    classifyWebhookClaim(
      { status: "PROCESSING", leaseExpiresAt: NOW - 1 },
      NOW,
      LEASE_MS,
    ),
    "reclaim",
  );
});

test("lease-expiry boundary is strict '<' (exactly-at-expiry stays in_progress)", () => {
  assert.equal(
    classifyWebhookClaim(
      { status: "PROCESSING", leaseExpiresAt: NOW },
      NOW,
      LEASE_MS,
    ),
    "in_progress",
    "leaseExpiresAt === nowMs must NOT be reclaimable",
  );
});

test("PROCESSING with missing/malformed leaseExpiresAt fails safe to in_progress (not reclaim)", () => {
  for (const bad of [undefined, null, "soon", NaN]) {
    assert.equal(
      classifyWebhookClaim(
        { status: "PROCESSING", leaseExpiresAt: bad as unknown },
        NOW,
        LEASE_MS,
      ),
      "in_progress",
      `leaseExpiresAt=${String(bad)} must not be reclaimable`,
    );
  }
});

test("unknown/legacy marker (no status) is treated as already-processed → done", () => {
  // Old BOOK_STRIPE_WEBHOOK_EVENT rows written under the record-last scheme have
  // no `status` field; their existence must still short-circuit reprocessing.
  assert.equal(classifyWebhookClaim({ eventId: "evt_1" } as never, NOW, LEASE_MS), "done");
  assert.equal(classifyWebhookClaim({ status: "WEIRD" }, NOW, LEASE_MS), "done");
});

// ─── lease arithmetic helpers ─────────────────────────────────────────────────

test("leaseExpiryMs adds leaseSeconds in ms", () => {
  assert.equal(leaseExpiryMs(NOW, 900), NOW + 900_000);
});

test("leaseTtlEpochSeconds lingers >= 24h past the lease, in epoch seconds", () => {
  const ttl = leaseTtlEpochSeconds(NOW, 900);
  const nowSec = Math.floor(NOW / 1000);
  assert.equal(ttl, nowSec + 900 + 24 * 60 * 60);
  assert.ok(ttl > nowSec + 24 * 60 * 60, "ttl must outlast a long Stripe retry window");
});
