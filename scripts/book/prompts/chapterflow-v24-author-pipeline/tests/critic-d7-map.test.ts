/**
 * WP-205 — the committed critic→D7 map (src/critics/criticD7Map.ts).
 *
 * Proves:
 *   1. COMPLETENESS — every top-level `src/critics/*.ts` module is mapped (no critic
 *      silently dropped or left unclassified).
 *   2. VALID D7 TARGETS — every cited D7 signal is a real rubric-v2 domain, base
 *      gate, layer-independence gate, or a declared floor-only sentinel.
 *   3. SUBSUMED ⇒ NON-BLOCKING — every critic the map marks as subsumed by a D7
 *      graded domain is advisory: none of its ids is a ship-gate blocker and none is
 *      in ENFORCED_MAJOR (the retired signals are proven non-blocking + non-referenced
 *      in any blocking path).
 *   4. RETAINED BLOCKERS STILL BLOCK — every module the map keeps as a blocking floor
 *      genuinely blocks (a representative id resolves to blocker severity or is an
 *      ENFORCED_MAJOR), so the consolidation dropped no blocker.
 */

import assert from "node:assert/strict";
import { readdirSync } from "fs";
import { resolve } from "path";

import { test } from "./harness.js";
import { PIPELINE_DIR } from "./helpers.js";
import {
  CRITIC_D7_MAP,
  D7_GRADED_DOMAIN_KEYS,
  D7_BASE_GATE_KEYS,
  D7_LAYER_INDEPENDENCE_KEY,
  D7_UNCOVERED_SENTINELS,
} from "../src/critics/criticD7Map.js";
import { SEVERITY_FROM_CATALOG, ENFORCED_MAJOR } from "../src/critics/finalGate.js";

const CRITICS_DIR = resolve(PIPELINE_DIR, "src", "critics");

function criticModules(): string[] {
  return readdirSync(CRITICS_DIR)
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts") && !f.endsWith(".d.ts"))
    .map((f) => f.replace(/\.ts$/, ""))
    .filter((m) => m !== "criticD7Map"); // the map does not map itself
}

test("critic→D7 map: covers every src/critics/*.ts module (completeness)", () => {
  const onDisk = criticModules();
  const mapped = new Set(Object.keys(CRITIC_D7_MAP));
  const missing = onDisk.filter((m) => !mapped.has(m));
  const extra = [...mapped].filter((m) => !onDisk.includes(m));
  assert.equal(missing.length, 0, `critic modules missing from the D7 map: ${missing.join(", ")}`);
  assert.equal(extra.length, 0, `D7 map keys with no module on disk: ${extra.join(", ")}`);
});

test("critic→D7 map: every cited D7 target is a valid domain / base gate / sentinel", () => {
  const valid = new Set<string>([
    ...D7_GRADED_DOMAIN_KEYS,
    ...D7_BASE_GATE_KEYS,
    D7_LAYER_INDEPENDENCE_KEY,
    ...D7_UNCOVERED_SENTINELS,
  ]);
  for (const [mod, entry] of Object.entries(CRITIC_D7_MAP)) {
    assert.ok(entry.d7.length > 0, `${mod} cites no D7 target`);
    for (const t of entry.d7) {
      assert.ok(valid.has(t), `${mod} cites unknown D7 target "${t}"`);
    }
  }
});

test("critic→D7 map: subsumed (advisory) critics are proven NON-BLOCKING", () => {
  for (const [mod, entry] of Object.entries(CRITIC_D7_MAP)) {
    if (entry.verdict !== "subsumed-advisory") continue;
    assert.notEqual(entry.blocking, "blocking", `${mod} is marked subsumed but classified blocking`);
    for (const id of entry.ids) {
      assert.ok(!ENFORCED_MAJOR.has(id), `${mod}: subsumed id ${id} is in ENFORCED_MAJOR (would block the ship gate)`);
      const sev = SEVERITY_FROM_CATALOG[id];
      if (sev !== undefined) {
        assert.notEqual(sev, "blocker", `${mod}: subsumed id ${id} resolves to blocker severity`);
      }
    }
  }
});

test("critic→D7 map: retained blocking-floor critics genuinely block (no dropped blocker)", () => {
  // For a per-chapter blocking-floor module, at least one representative id must
  // resolve to a real ship-gate blocker (blocker severity or an ENFORCED_MAJOR).
  // Book-level / cross-book / policy floors block through their own gate (bookGate,
  // source-reality, attestation), not SEVERITY_FROM_CATALOG, so they are exempt here.
  const perChapterBlocking = Object.entries(CRITIC_D7_MAP).filter(
    ([, e]) => e.role === "blocking-floor" && e.blocking === "blocking",
  );
  assert.ok(perChapterBlocking.length > 0, "expected per-chapter blocking-floor entries");
  for (const [mod, entry] of perChapterBlocking) {
    const blocks = entry.ids.some(
      (id) => SEVERITY_FROM_CATALOG[id] === "blocker" || ENFORCED_MAJOR.has(id),
    );
    assert.ok(blocks, `${mod}: no representative id resolves to a ship-gate blocker — a dropped blocker?`);
    assert.equal(entry.verdict, "retain-floor", `${mod}: a blocking floor must be retained, not retired`);
  }
});

test("critic→D7 map: no blocking module is marked as retired-to-advisory", () => {
  for (const [mod, entry] of Object.entries(CRITIC_D7_MAP)) {
    if (entry.blocking === "blocking") {
      assert.equal(entry.verdict, "retain-floor", `${mod}: a blocking module must retain-floor (never retire a blocker)`);
    }
  }
});
