/**
 * Regression: verifyProductionPackage must never throw because of input SHAPE.
 *
 * The bug: the verifier cast parsed JSON to BookPackageV21 and read `pkg.book`
 * before proving `pkg` was a non-null object, so a package whose top-level value
 * was `null` (valid JSON) crashed with "Cannot read properties of null" instead
 * of returning a structured PPKG finding. These tests pin the fail-closed
 * contract for every valid-JSON top-level value, through BOTH the packageData
 * and the file-loaded entry points, plus the CLI surface.
 *
 * These tests use an ISOLATED OS temp dir (not the shared tests/.tmp): the suite
 * has pre-existing flakiness where some files call cleanTmp() and nuke the whole
 * shared tmp dir, which can race with lingering async writes. Staying out of that
 * blast radius keeps this regression deterministic.
 */

import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { resolve } from "path";

import { verifyProductionPackage } from "../src/verifyProductionPackage.js";
import { runCli } from "./helpers.js";
import { test } from "./harness.js";

/** Every valid-JSON top-level value that is NOT a plain object. Each must fail
 *  closed with PPKG.package_malformed and must never throw. Arrays are included
 *  because a JSON array is a valid object in JS but not a valid package. */
const NON_OBJECT_VALUES: Array<{ label: string; value: unknown }> = [
  { label: "null", value: null },
  { label: "true", value: true },
  { label: "false", value: false },
  { label: "0", value: 0 },
  { label: "7", value: 7 },
  { label: "empty string", value: "" },
  { label: "string", value: "package" },
  { label: "empty array", value: [] },
  { label: "array with null", value: [null] },
];

/** Raw JSON bytes for the file-based path — the same values as above, written
 *  to disk so the JSON.parse + validation path is exercised end to end. */
const NON_OBJECT_JSON: string[] = ["null", "true", "false", "0", "7", '""', '"package"', "[]", "[null]"];

function malformed(result: { findings: Array<{ checkId: string }> }): boolean {
  return result.findings.some((f) => f.checkId === "PPKG.package_malformed");
}

test("verifyProductionPackage fails closed (never throws) for non-object packageData", () => {
  for (const c of NON_OBJECT_VALUES) {
    let result;
    try {
      result = verifyProductionPackage({ packageData: c.value });
    } catch (err) {
      assert.fail(`verifyProductionPackage threw for packageData=${c.label}: ${(err as Error).message}`);
    }
    assert.equal(result.ok, false, `${c.label}: ok must be false`);
    assert.equal(result.contentId, null, `${c.label}: contentId must be null`);
    assert.ok(
      malformed(result),
      `${c.label}: expected PPKG.package_malformed, got [${result.findings.map((f) => f.checkId).join(", ")}]`,
    );
  }
});

test("verifyProductionPackage returns specific field findings (not malformed) for an empty object", () => {
  // An empty object IS a valid object shape, so it must NOT be flagged malformed;
  // the existing per-field blockers must still surface unchanged.
  const result = verifyProductionPackage({ packageData: {} });
  assert.equal(result.ok, false);
  assert.equal(result.contentId, null);
  assert.ok(!malformed(result), "an object must not produce PPKG.package_malformed");
  const ids = result.findings.map((f) => f.checkId);
  assert.ok(ids.includes("PPKG.book_id_missing"), `expected PPKG.book_id_missing, got [${ids.join(", ")}]`);
  assert.ok(ids.includes("PPKG.chapters_missing"), `expected PPKG.chapters_missing, got [${ids.join(", ")}]`);
});

test("verifyProductionPackage treats file-loaded non-object JSON the same as packageData and never throws", () => {
  const dir = mkdtempSync(resolve(tmpdir(), "ppkg-malformed-file-"));
  try {
    for (const raw of NON_OBJECT_JSON) {
      const packagePath = resolve(dir, "package.v21.json");
      writeFileSync(packagePath, raw, "utf8");
      let result;
      try {
        result = verifyProductionPackage({ packagePath });
      } catch (err) {
        assert.fail(`verifyProductionPackage threw for file contents ${raw}: ${(err as Error).message}`);
      }
      assert.equal(result.ok, false, `${raw}: ok must be false`);
      assert.equal(result.contentId, null, `${raw}: contentId must be null`);
      assert.ok(
        malformed(result),
        `${raw}: expected PPKG.package_malformed, got [${result.findings.map((f) => f.checkId).join(", ")}]`,
      );
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("verify-production-package CLI fails closed with structured output (no stack trace) on a null package", () => {
  const dir = mkdtempSync(resolve(tmpdir(), "ppkg-malformed-cli-"));
  const packagePath = resolve(dir, "null-package.v21.json");
  writeFileSync(packagePath, "null", "utf8");
  try {
    const cli = runCli(["verify-production-package", packagePath]);
    assert.notEqual(cli.status, 0, `expected a nonzero exit, got ${cli.status}\n${cli.out}`);
    assert.match(cli.out, /BLOCK/, cli.out);
    assert.match(cli.out, /PPKG\.package_malformed/, cli.out);
    // Proof the input-shape crash is gone: the CLI must NOT surface the raw
    // TypeError / stack trace that the unsafe pkg.book access produced.
    assert.doesNotMatch(cli.out, /Cannot read properties of null/, cli.out);
    assert.doesNotMatch(cli.out, /\bTypeError\b/, cli.out);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
