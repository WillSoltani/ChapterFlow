/**
 * WP-101 (pipeline side) — the fresh emission is GENUINELY produced by
 * promoteBook and satisfies the WP-102 frozen emission↔adapter parity
 * contract with zero drift. The cross-boundary consumer assertions (the same
 * bytes surviving the REAL server + client web adapters, field-by-field,
 * including richness fields) live in the app-side sibling test:
 *   app/app/api/book/_lib/fresh-emit-adapter.test.ts
 * (that test imports `buildFreshEmission` from this package across the
 * root/pipeline boundary — see its header comment for why that's safe).
 *
 * Scope: FRESH emissions only (V25 S-Tier §8 WP-101). This does not gate the
 * 140 shipped `book-packages/*.v21.json` — that corpus has 5 known envelope-
 * parity drift cases (2 genuine) and is intentionally left alone here; the
 * slim-contract test already guards it.
 */
import assert from "node:assert/strict";

import { test } from "./harness.js";
import { buildFreshEmission, cleanupFreshEmission, FRESH_EMIT_BOOK_ID } from "./freshEmitFixture.js";
import {
  validateEmissionParity,
  EMISSION_ADAPTER_SURFACE,
} from "../src/contracts/emissionPackage.js";
import { V21_SCHEMA_VERSION } from "../src/types.js";

test("fresh emission is genuinely produced by promoteBook (not a hand-built package)", () => {
  try {
    const emission = buildFreshEmission();
    // Genuinely written to disk by promoteBook's own transactional publish step —
    // re-read independently of the in-memory result to prove it's real bytes on disk,
    // not just an in-memory object promoteBook happened to also return.
    assert.match(emission.packagePath, new RegExp(`${FRESH_EMIT_BOOK_ID}\\.v21\\.json$`));
    assert.equal(emission.parsed.schemaVersion, V21_SCHEMA_VERSION);
    assert.match(emission.parsed.packageId as string, new RegExp(`^${FRESH_EMIT_BOOK_ID}-v21-\\d+$`));
    // The shipped package carries reader content only (K1) — no embedded manifest.
    assert.equal((emission.parsed as any).productionManifest, undefined);
    const chapters = emission.parsed.chapters as Array<Record<string, unknown>>;
    assert.equal(chapters.length, 1);
    assert.equal(emission.sha256.length, 64, "sha256 evidence hash must be a real digest");
  } finally {
    cleanupFreshEmission();
  }
});

test("fresh emission carries every richness field WP-101 must prove round-trips (pre-adapter)", () => {
  try {
    const emission = buildFreshEmission();
    const chapter = (emission.parsed.chapters as Array<Record<string, unknown>>)[0];
    assert.ok(typeof chapter.hook === "string" && chapter.hook.length > 0, "hook");
    assert.ok(Array.isArray(chapter.memorableLines) && (chapter.memorableLines as unknown[]).length > 0, "memorableLines");
    assert.ok(Array.isArray(chapter.examples) && (chapter.examples as unknown[]).length > 0, "examples");
    assert.ok(chapter.implementationPlan && typeof chapter.implementationPlan === "object", "implementationPlan");
    assert.ok(Array.isArray(chapter.reviewCards) && (chapter.reviewCards as unknown[]).length > 0, "reviewCards");
    assert.ok(chapter.experiencePlan && typeof chapter.experiencePlan === "object", "experiencePlan");
    const ep = chapter.experiencePlan as Record<string, unknown>;
    assert.ok(ep.failureRecovery, "experiencePlan.failureRecovery");
    assert.ok(ep.transferPrompt, "experiencePlan.transferPrompt");
    assert.ok(ep.behaviorLoop, "experiencePlan.behaviorLoop");
  } finally {
    cleanupFreshEmission();
  }
});

test("fresh emission satisfies the WP-102 frozen emission<->adapter parity contract with zero drift", () => {
  try {
    const emission = buildFreshEmission();
    const errors = validateEmissionParity(emission.parsed);
    assert.deepEqual(errors, [], `emission carries fields the web adapters don't consume: ${errors.join("; ")}`);
  } finally {
    cleanupFreshEmission();
  }
});

test("negative: a field the adapters do not consume is caught as drift by the frozen parity contract", () => {
  try {
    const emission = buildFreshEmission();
    const mutated = JSON.parse(JSON.stringify(emission.parsed)) as any;
    mutated.chapters[0].audioNarration = "https://example.invalid/narration.mp3";
    const errors = validateEmissionParity(mutated);
    assert.ok(
      errors.some((e) => e.includes("audioNarration")),
      `expected a drift finding for the unconsumed field, got: ${JSON.stringify(errors)}`,
    );
  } finally {
    cleanupFreshEmission();
  }
});

test("sanity: the parity surface this test relies on still requires the richness fields WP-101 covers", () => {
  // Guards against the contract quietly demoting a required field to optional
  // (which would silently narrow this WP's coverage without any test failing).
  assert.ok(EMISSION_ADAPTER_SURFACE.chapter.required.includes("hook"));
  assert.ok(EMISSION_ADAPTER_SURFACE.chapter.required.includes("examples"));
  assert.ok(EMISSION_ADAPTER_SURFACE.chapter.required.includes("implementationPlan"));
  assert.ok(EMISSION_ADAPTER_SURFACE.chapter.required.includes("reviewCards"));
  assert.ok(EMISSION_ADAPTER_SURFACE.chapter.optional.includes("memorableLines"));
  assert.ok(EMISSION_ADAPTER_SURFACE.chapter.optional.includes("experiencePlan"));
});
