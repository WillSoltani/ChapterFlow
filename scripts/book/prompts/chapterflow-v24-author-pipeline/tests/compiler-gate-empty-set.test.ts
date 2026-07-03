/**
 * Regression for the "structurally valid, content absent" trap: when the
 * canonical chapter index is missing/unreadable/blocked,
 * resolveExpectedSourceChapters().ok is false and its blocker findings must
 * propagate into every compiler-gate consumer instead of being silently
 * discarded as an empty chapter list. An empty list previously read as
 * "nothing to check" -> PASS, masking a bookId that produced zero chapters.
 */

import assert from "node:assert/strict";
import { mkdirSync } from "fs";
import { tmpdir } from "os";
import { resolve } from "path";

import { checkSourcePacketGate } from "../src/compiler/sourcePacketGate.js";
import { checkBlueprintGate } from "../src/compiler/blueprintGate.js";
import { checkSectionGate } from "../src/sections/sectionGate.js";
import { assembleSections } from "../src/sections/assembleSections.js";
import { test } from "./harness.js";

const BOOK = "zz-fixture-no-canonical-index";

function freshStateRoot(label: string): string {
  const stateRoot = resolve(tmpdir(), `cf-v23-empty-set-${label}-${process.pid}-${Date.now()}`);
  mkdirSync(stateRoot, { recursive: true });
  return stateRoot;
}

test("source-packet-gate blocks (not PASS-0) when the canonical chapter index does not resolve", () => {
  const roots = { stateRoot: freshStateRoot("source-packet") };
  const report = checkSourcePacketGate(BOOK, roots);
  assert.equal(report.chaptersChecked, 0);
  assert.equal(report.passed, false, "an unresolved index must not read as PASS");
  assert.ok(report.findings.some((f) => f.severity === "blocker"), "must surface a blocker finding, not an empty findings list");
});

test("blueprint-gate blocks (not PASS-0) when the canonical chapter index does not resolve", () => {
  const roots = { stateRoot: freshStateRoot("blueprint") };
  const report = checkBlueprintGate(BOOK, roots);
  assert.equal(report.chaptersChecked, 0);
  assert.equal(report.passed, false, "an unresolved index must not read as PASS");
  assert.ok(report.findings.some((f) => f.severity === "blocker"), "must surface a blocker finding, not an empty findings list");
});

test("section-gate blocks (not PASS-0) when the canonical chapter index does not resolve", () => {
  const roots = { stateRoot: freshStateRoot("section") };
  const report = checkSectionGate(BOOK, roots);
  assert.equal(report.chaptersChecked, 0);
  assert.equal(report.passed, false, "an unresolved index must not read as PASS");
  assert.ok(report.findings.some((f) => f.severity === "blocker"), "must surface a blocker finding, not an empty findings list");
});

test("assemble-sections reports a finding (so the CLI exits non-zero) when the canonical chapter index does not resolve", () => {
  const roots = { stateRoot: freshStateRoot("assemble") };
  const result = assembleSections(BOOK, roots);
  assert.equal(result.written.length, 0);
  assert.ok(result.findings.length > 0, "must surface a finding instead of silently writing 0 chapters as success");
  assert.match(result.findings[0], /no resolvable chapters/);
});
