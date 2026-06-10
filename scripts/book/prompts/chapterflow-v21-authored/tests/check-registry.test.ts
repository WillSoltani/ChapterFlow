/**
 * Source-level guards on the check-id namespace.
 *
 * SEVERITY_FROM_CATALOG is a JS object literal: a duplicate key silently
 * last-wins, which is how a severity can be clobbered without any runtime
 * signal. And catalog ids have already been double-booked once (C18/C19
 * live in BOTH supportSectionAudit and narrative — verified 2026-06-09).
 */

import assert from "node:assert/strict";
import { readFileSync } from "fs";
import { resolve } from "path";

import { test, xfail } from "./harness.js";
import { PIPELINE_DIR } from "./helpers.js";

const FINAL_GATE_SRC = readFileSync(resolve(PIPELINE_DIR, "src/critics/finalGate.ts"), "utf8");

/** Extract literal keys of the SEVERITY_FROM_CATALOG object from source. */
function severityMapKeys(): string[] {
  const start = FINAL_GATE_SRC.indexOf("SEVERITY_FROM_CATALOG");
  assert.ok(start >= 0, "SEVERITY_FROM_CATALOG not found in finalGate.ts");
  const open = FINAL_GATE_SRC.indexOf("{", start);
  let depth = 0;
  let end = open;
  for (let i = open; i < FINAL_GATE_SRC.length; i++) {
    if (FINAL_GATE_SRC[i] === "{") depth++;
    else if (FINAL_GATE_SRC[i] === "}") {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }
  const body = FINAL_GATE_SRC.slice(open + 1, end);
  const keys: string[] = [];
  for (const line of body.split("\n")) {
    const noComment = line.replace(/\/\/.*$/, "");
    const m = noComment.match(/^\s*["']?([A-Za-z][A-Za-z0-9_.]*)["']?\s*:/);
    if (m) keys.push(m[1]);
  }
  assert.ok(keys.length > 30, `parsed implausibly few severity keys (${keys.length}) — parser drift?`);
  return keys;
}

test("SEVERITY_FROM_CATALOG has no duplicate literal keys (silent last-wins)", () => {
  const keys = severityMapKeys();
  const seen = new Set<string>();
  const dupes = keys.filter((k) => (seen.has(k) ? true : (seen.add(k), false)));
  assert.deepEqual(dupes, [], `duplicate keys in SEVERITY_FROM_CATALOG: ${dupes.join(", ")}`);
});

/** Catalog prefixes (e.g. "C18") emitted as check ids inside one critic file. */
function catalogPrefixes(file: string): Set<string> {
  const src = readFileSync(resolve(PIPELINE_DIR, "src/critics", file), "utf8");
  const out = new Set<string>();
  for (const m of src.matchAll(/["']([A-Z]{1,3}\d{1,2})\.[a-z_]+["']/g)) out.add(m[1]);
  return out;
}

/** Catalog ids finalGate pushes for the narrative example checks
 *  (push("C18", …) after checkExampleSettingStamping, etc.). */
function narrativeCatalogIds(): Set<string> {
  const out = new Set<string>();
  const lines = FINAL_GATE_SRC.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (/checkExampleSettingStamping|checkExampleProtagonistReuse/.test(lines[i])) {
      for (let j = i; j < Math.min(i + 4, lines.length); j++) {
        const m = lines[j].match(/push\(\s*["'](C\d{1,2})["']/);
        if (m) { out.add(m[1]); break; }
      }
    }
  }
  return out;
}

test("catalog-id namespace: narrative's gate ids do not collide with supportSectionAudit's", () => {
  // Was the last open collision: supportSectionAudit owns C11–C21, and the
  // narrative checks were first renamed onto C18/C19 anyway — reproducing the
  // exact class the inline comment said was "caught in review". Renumbered to
  // C22/C23 in Phase 4; this test keeps the namespace honest (next free: C24+).
  const support = catalogPrefixes("supportSectionAudit.ts");
  const narrative = narrativeCatalogIds();
  assert.ok(narrative.size >= 2, "parser drift: expected to find the narrative push() catalog ids in finalGate.ts");
  const shared = [...narrative].filter((p) => support.has(p));
  assert.deepEqual(shared, [], `catalog prefixes meaning two different checks: ${shared.join(", ")}`);
});

test("severity map carries every AS5–AS12 intra-book check id", () => {
  // These are the checks promote currently skips (Phase 1 wires them in);
  // when that lands, their severities must already be registered.
  const keys = new Set(severityMapKeys());
  const required = [
    "AS5.chapter_quiz_prompt_matches_prior",
    "AS6.chapter_quiz_distractor_matches_prior",
    "AS7.chapter_card_matches_prior",
    "AS8.chapter_plan_matches_prior",
    "AS9.chapter_example_matches_prior",
    "AS10.chapter_field_ngram_matches_prior",
    "AS11.chapter_breakdown_paragraph_verbatim_prior",
    "AS12.chapter_quiz_position_matches_prior",
  ];
  const missing = required.filter((k) => !keys.has(k));
  // Some AS ids may intentionally live outside the map (they bypass runShipGate
  // today). If missing, that is information Phase 1 needs — fail loudly either way.
  assert.deepEqual(missing, [], `AS check ids missing from SEVERITY_FROM_CATALOG: ${missing.join(", ")}`);
});
