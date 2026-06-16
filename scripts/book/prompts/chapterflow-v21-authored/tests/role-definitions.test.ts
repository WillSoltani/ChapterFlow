/**
 * WS-3/WS-4 — roles/ROLE-DEFINITIONS.json is the single source of truth for the
 * pipeline's roles and their recommended GPT reasoning/verbosity. These tests pin
 * completeness (every reviewer + phase role has an entry), validity (effort/verbosity
 * enums; every promptPath resolves on disk), and that the emitted hint header carries
 * the role's settings.
 */

import assert from "node:assert/strict";
import { existsSync } from "fs";
import { resolve } from "path";

import { test } from "./harness.js";
import { PIPELINE_DIR } from "./helpers.js";
import { loadRoleDefinitions, getRole, roleHintHeader } from "../src/roles.js";
import { SUBMISSION_ROLES } from "../src/qc/orchestrator/schemas.js";

const EFFORTS = new Set(["minimal", "low", "medium", "high"]);
const VERBS = new Set(["low", "medium", "high"]);
const PHASE_ROLES = ["research", "write", "write-orchestrate", "qc-orchestrate", "repair", "publish"];

test("every reviewer role and phase role has a definition", () => {
  const ids = new Set(loadRoleDefinitions().map((r) => r.roleId));
  for (const role of SUBMISSION_ROLES) assert.ok(ids.has(role), `missing role definition for QC role ${role}`);
  for (const role of PHASE_ROLES) assert.ok(ids.has(role), `missing role definition for phase role ${role}`);
});

test("every role has valid effort/verbosity, a model hint, boundaries, and a promptPath that exists", () => {
  for (const r of loadRoleDefinitions()) {
    assert.ok(EFFORTS.has(r.reasoningEffort), `${r.roleId}: bad reasoningEffort ${r.reasoningEffort}`);
    assert.ok(VERBS.has(r.verbosity), `${r.roleId}: bad verbosity ${r.verbosity}`);
    assert.ok(r.modelHint && r.modelHint.length > 0, `${r.roleId}: missing modelHint`);
    assert.ok(Array.isArray(r.boundaries) && r.boundaries.length > 0, `${r.roleId}: missing boundaries`);
    assert.ok(existsSync(resolve(PIPELINE_DIR, r.promptPath)), `${r.roleId}: promptPath does not exist: ${r.promptPath}`);
  }
});

test("the depth mapping is sensible: authoring/reviewing = high, orchestrators/publish = minimal", () => {
  for (const role of ["write", "research", "bar", "confirm", "keyA", "keyB", "repair"]) {
    assert.equal(getRole(role)!.reasoningEffort, "high", `${role} should be high reasoning`);
  }
  for (const role of ["write-orchestrate", "qc-orchestrate", "publish"]) {
    assert.equal(getRole(role)!.reasoningEffort, "minimal", `${role} should be minimal reasoning`);
  }
});

test("roleHintHeader emits the role's reasoning + verbosity (and is empty for an unknown role)", () => {
  const h = roleHintHeader("write");
  assert.match(h, /ROLE: write/);
  assert.match(h, /reasoning: high/);
  assert.match(h, /verbosity: high/);
  assert.equal(roleHintHeader("nope-not-a-role"), "");
});
