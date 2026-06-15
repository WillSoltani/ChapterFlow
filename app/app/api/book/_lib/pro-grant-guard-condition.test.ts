// Executable enforcement coverage (#109) for the gift / flow_points
// "may this grant overwrite the existing entitlement?" guard.
//
// grantUpgradeApplies() in pro-grant-guard-core.ts is the human-readable SPEC; the
// LIVE enforcement is the DynamoDB ConditionExpression from
// grantUpgradeConditionExpression(), used by both write sites (the gift-claim route
// and redeemFlowPointsReward). `tsx --test` cannot reach real DynamoDB, so this file
// evaluates the REAL condition string with a small, faithful in-memory evaluator
// (supporting exactly the operators the guard uses) and asserts it returns the same
// accept/reject decision as the spec across the full truth table — proving the
// shipped condition matches grantUpgradeApplies and that the two sites stay in
// lockstep. (Full ConditionExpression semantics are tracked for a DynamoDB-Local
// harness in the issue; this closes the unit-level gap noted in the PR review.)

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  grantUpgradeApplies,
  grantUpgradeConditionExpression,
  GRANT_UPGRADE_CONDITION_NAMES,
  GRANT_UPGRADE_CONDITION_VALUES,
  type ExistingGrant,
} from "./pro-grant-guard-core";

// ── Minimal DynamoDB item + ConditionExpression evaluator ──
// An attribute is absent, a DynamoDB NULL, or a string (S) — the full domain of the
// entitlement fields this guard inspects.
type Attr = { S: string } | { NULL: true };
type Item = Record<string, Attr | undefined>;

function tokenize(expr: string): string[] {
  const re = /\s*(<>|<=|>=|=|<|>|\(|\)|,|[#:\w]+)/g;
  const out: string[] = [];
  for (let m = re.exec(expr); m; m = re.exec(expr)) out.push(m[1]);
  return out;
}

// Faithful to DynamoDB for the operator subset the guard uses:
//   attribute_not_exists, attribute_type(_, NULL|S), <>, <, =, AND, OR, ( ).
function evalCondition(
  expr: string,
  names: Record<string, string>,
  values: Record<string, string>,
  item: Item
): boolean {
  const toks = tokenize(expr);
  let i = 0;
  const peek = () => toks[i];
  const next = () => toks[i++];

  const pathOf = (tok: string): string => (tok.startsWith("#") ? names[tok] : tok);
  type Resolved =
    | { kind: "absent" }
    | { kind: "null" }
    | { kind: "S"; v: string };
  const resolvePath = (tok: string): Resolved => {
    const a = item[pathOf(tok)];
    if (a === undefined) return { kind: "absent" };
    if ("NULL" in a) return { kind: "null" };
    return { kind: "S", v: a.S };
  };

  function parsePrimary(): boolean {
    const t = peek();
    if (t === "(") {
      next();
      const v = parseOr();
      assert.equal(next(), ")", "unbalanced parens");
      return v;
    }
    if (t === "attribute_not_exists") {
      next();
      next(); // '('
      const p = next();
      assert.equal(next(), ")");
      return resolvePath(p).kind === "absent";
    }
    if (t === "attribute_type") {
      next();
      next(); // '('
      const p = next();
      assert.equal(next(), ",");
      const typeName = values[next()];
      assert.equal(next(), ")");
      const r = resolvePath(p);
      if (typeName === "NULL") return r.kind === "null";
      if (typeName === "S") return r.kind === "S";
      return false;
    }
    // comparison: <path/#name> OP <:valueRef>
    const left = resolvePath(next());
    const op = next();
    const right = values[next()];
    switch (op) {
      case "=":
        return left.kind === "S" && left.v === right;
      case "<>":
        // missing attribute → comparison is false; a NULL value is "not equal" to a
        // string; otherwise string inequality.
        if (left.kind === "absent") return false;
        if (left.kind === "null") return true;
        return left.v !== right;
      case "<":
        return left.kind === "S" && left.v < right;
      case ">":
        return left.kind === "S" && left.v > right;
      case "<=":
        return left.kind === "S" && left.v <= right;
      case ">=":
        return left.kind === "S" && left.v >= right;
      default:
        throw new Error(`unsupported operator: ${op}`);
    }
  }

  // AND binds tighter than OR (DynamoDB precedence); operands are always parsed so the
  // token cursor stays correct (no short-circuit skipping).
  function parseAnd(): boolean {
    let v = parsePrimary();
    while (peek() === "AND") {
      next();
      const r = parsePrimary();
      v = v && r;
    }
    return v;
  }
  function parseOr(): boolean {
    let v = parseAnd();
    while (peek() === "OR") {
      next();
      const r = parseAnd();
      v = v || r;
    }
    return v;
  }

  const result = parseOr();
  assert.equal(i, toks.length, "trailing tokens after parse");
  return result;
}

// ── Trust the evaluator: hand-verified operator semantics ──
test("evaluator: attribute_not_exists", () => {
  const e = (item: Item) =>
    evalCondition("attribute_not_exists(#plan)", { "#plan": "plan" }, {}, item);
  assert.equal(e({}), true);
  assert.equal(e({ plan: { S: "PRO" } }), false);
  assert.equal(e({ plan: { NULL: true } }), false); // present-but-null still "exists"
});

test("evaluator: <> (absent → false, null → true, string → !=)", () => {
  const e = (item: Item) =>
    evalCondition("proSource <> :s", {}, { ":s": "stripe" }, item);
  assert.equal(e({}), false);
  assert.equal(e({ proSource: { S: "stripe" } }), false);
  assert.equal(e({ proSource: { S: "license" } }), true);
  assert.equal(e({ proSource: { NULL: true } }), true);
});

test("evaluator: < is string-ordered, false for absent/null", () => {
  const e = (item: Item) =>
    evalCondition("currentPeriodEnd < :e", {}, { ":e": "2026-06-15" }, item);
  assert.equal(e({ currentPeriodEnd: { S: "2026-06-14" } }), true);
  assert.equal(e({ currentPeriodEnd: { S: "2026-06-16" } }), false);
  assert.equal(e({ currentPeriodEnd: { NULL: true } }), false);
  assert.equal(e({}), false);
});

test("evaluator: attribute_type(_, NULL)", () => {
  const e = (item: Item) =>
    evalCondition("attribute_type(licenseExpiresAt, :n)", {}, { ":n": "NULL" }, item);
  assert.equal(e({ licenseExpiresAt: { NULL: true } }), true);
  assert.equal(e({ licenseExpiresAt: { S: "2026-01-01" } }), false);
  assert.equal(e({}), false);
});

test("evaluator: AND/OR precedence and grouping", () => {
  // A OR B AND C  ===  A OR (B AND C)
  const v = (a: string) =>
    evalCondition(`${a} = :t OR b = :t AND c = :t`, {}, { ":t": "1" }, {
      a: { S: a === "a" ? "1" : "0" },
      b: { S: "1" },
      c: { S: "0" },
    });
  assert.equal(v("a"), true); // a=1 → true OR (…)
  assert.equal(v("x"), false); // a≠1, and (b=1 AND c=0) → false
});

// ── The real guard: builder must match the audited literal at both sites ──
test("condition builder matches the audited literal (both expiry refs)", () => {
  assert.equal(
    grantUpgradeConditionExpression(":expires"),
    "(attribute_not_exists(#plan) OR #plan <> :proPlan) OR ((attribute_not_exists(proSource) OR proSource <> :stripeSource) AND (attribute_not_exists(proSource) OR proSource <> :adminSource) AND (attribute_not_exists(licenseExpiresAt) OR attribute_type(licenseExpiresAt, :nullType) OR licenseExpiresAt < :expires) AND (attribute_not_exists(currentPeriodEnd) OR attribute_type(currentPeriodEnd, :nullType) OR currentPeriodEnd < :expires))"
  );
  assert.equal(
    grantUpgradeConditionExpression(":periodEnd"),
    "(attribute_not_exists(#plan) OR #plan <> :proPlan) OR ((attribute_not_exists(proSource) OR proSource <> :stripeSource) AND (attribute_not_exists(proSource) OR proSource <> :adminSource) AND (attribute_not_exists(licenseExpiresAt) OR attribute_type(licenseExpiresAt, :nullType) OR licenseExpiresAt < :periodEnd) AND (attribute_not_exists(currentPeriodEnd) OR attribute_type(currentPeriodEnd, :nullType) OR currentPeriodEnd < :periodEnd))"
  );
});

// ── The enforcement coverage: the LIVE condition === the spec, exhaustively ──
test("live ConditionExpression matches grantUpgradeApplies across the full truth table", () => {
  const CANDIDATE = "2026-06-15T00:00:00.000Z";
  const PAST = "2020-01-01T00:00:00.000Z";
  const FUTURE = "2030-01-01T00:00:00.000Z";

  const condition = grantUpgradeConditionExpression(":candidateExpiry");
  const names: Record<string, string> = { ...GRANT_UPGRADE_CONDITION_NAMES };
  const values: Record<string, string> = {
    ...GRANT_UPGRADE_CONDITION_VALUES,
    ":candidateExpiry": CANDIDATE,
  };

  type Cell = string | null | undefined;
  const plans: Cell[] = [undefined, "FREE", "PRO"];
  const sources: Cell[] = [
    undefined,
    "stripe",
    "admin",
    "license",
    "gift_code",
    "flow_points",
  ];
  const expiries: Cell[] = [undefined, null, PAST, FUTURE];

  const toAttr = (v: Cell): Attr | undefined =>
    v === undefined ? undefined : v === null ? { NULL: true } : { S: v };

  let count = 0;
  for (const plan of plans)
    for (const proSource of sources)
      for (const licenseExpiresAt of expiries)
        for (const currentPeriodEnd of expiries) {
          const existing: ExistingGrant = {
            plan,
            proSource,
            licenseExpiresAt,
            currentPeriodEnd,
          };
          const item: Item = {
            plan: toAttr(plan),
            proSource: toAttr(proSource),
            licenseExpiresAt: toAttr(licenseExpiresAt),
            currentPeriodEnd: toAttr(currentPeriodEnd),
          };
          const live = evalCondition(condition, names, values, item);
          const spec = grantUpgradeApplies(existing, CANDIDATE);
          assert.equal(
            live,
            spec,
            `enforcement≠spec for ${JSON.stringify(existing)}: live=${live} spec=${spec}`
          );
          count++;
        }
  assert.equal(
    count,
    plans.length * sources.length * expiries.length * expiries.length
  );
});

// ── A couple of named money-path regressions, spelled out explicitly ──
test("flow_points pass cannot shorten a longer non-stripe grant (the sibling bug)", () => {
  const cond = grantUpgradeConditionExpression(":candidateExpiry");
  const names = { ...GRANT_UPGRADE_CONDITION_NAMES };
  const candidate = "2026-06-15T00:00:00.000Z";
  const values = { ...GRANT_UPGRADE_CONDITION_VALUES, ":candidateExpiry": candidate };

  // Active license that outlasts the candidate pass → must NOT apply.
  assert.equal(
    evalCondition(cond, names, values, {
      plan: { S: "PRO" },
      proSource: { S: "license" },
      licenseExpiresAt: { S: "2030-01-01T00:00:00.000Z" },
    }),
    false
  );
  // Longer existing flow_points grant (currentPeriodEnd in the future) → must NOT apply.
  assert.equal(
    evalCondition(cond, names, values, {
      plan: { S: "PRO" },
      proSource: { S: "flow_points" },
      currentPeriodEnd: { S: "2030-01-01T00:00:00.000Z" },
      licenseExpiresAt: { NULL: true },
    }),
    false
  );
  // Expired/short grant → DOES apply (refreshes access).
  assert.equal(
    evalCondition(cond, names, values, {
      plan: { S: "PRO" },
      proSource: { S: "flow_points" },
      currentPeriodEnd: { S: "2020-01-01T00:00:00.000Z" },
      licenseExpiresAt: { NULL: true },
    }),
    true
  );
});

test("stripe and admin grants are never overwritten", () => {
  const cond = grantUpgradeConditionExpression(":candidateExpiry");
  const names = { ...GRANT_UPGRADE_CONDITION_NAMES };
  const candidate = "2026-06-15T00:00:00.000Z";
  const values = { ...GRANT_UPGRADE_CONDITION_VALUES, ":candidateExpiry": candidate };
  for (const proSource of ["stripe", "admin"]) {
    assert.equal(
      evalCondition(cond, names, values, {
        plan: { S: "PRO" },
        proSource: { S: proSource },
      }),
      false,
      `${proSource} should never be overwritten`
    );
  }
});
