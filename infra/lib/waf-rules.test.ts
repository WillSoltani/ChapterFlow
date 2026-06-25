import { test } from "node:test";
import assert from "node:assert/strict";
import type * as wafv2 from "aws-cdk-lib/aws-wafv2";
import {
  COMMON_RULE_SET_COUNT_OVERRIDES,
  buildCommonRuleSetActionOverrides,
  buildWebAclRules,
} from "./waf-rules";

// Regression for the WAF false-positive defect (cluster "waf-overrides"):
// AWSManagedRulesCommonRuleSet was attached with overrideAction:{none:{}} and
// NO ruleActionOverrides, so its Block-mode CrossSiteScripting_BODY /
// _QUERYARGUMENTS and SizeRestrictions_BODY sub-rules hard-403'd legitimate
// JSON API POSTs whose values contain XSS-lookalike text (display names,
// free-text) or simply exceed the 8 KB managed body-size default.

function getCount(action: wafv2.CfnWebACL.RuleActionProperty | unknown): unknown {
  return (action as { count?: unknown }).count;
}

test("the three defect-named sub-rules are downgraded to Count", () => {
  // These are the sub-rules the cluster cites as blocking legit traffic; they
  // MUST be in the override set or the 403 regression returns.
  for (const name of [
    "CrossSiteScripting_BODY",
    "CrossSiteScripting_QUERYARGUMENTS",
    "SizeRestrictions_BODY",
  ]) {
    assert.ok(
      COMMON_RULE_SET_COUNT_OVERRIDES.includes(name),
      `${name} must be overridden to Count`,
    );
  }
});

test("buildCommonRuleSetActionOverrides emits {name, actionToUse:{count:{}}} for every entry", () => {
  const overrides = buildCommonRuleSetActionOverrides();
  assert.equal(overrides.length, COMMON_RULE_SET_COUNT_OVERRIDES.length);
  for (const o of overrides) {
    assert.ok(o.name, "override needs a non-empty name");
    // count action present, and crucially NOT block.
    assert.notEqual(
      getCount(o.actionToUse),
      undefined,
      `${o.name} must use the count action`,
    );
    assert.equal(
      (o.actionToUse as { block?: unknown }).block,
      undefined,
      `${o.name} must NOT be block`,
    );
  }
});

test("the managed common rule set carries the ruleActionOverrides", () => {
  const rules = buildWebAclRules();
  const common = rules.find((r) => r.name === "AWSManagedCommonRuleSet");
  assert.ok(common, "AWSManagedCommonRuleSet rule must exist");

  const stmt = common!.statement as wafv2.CfnWebACL.StatementProperty;
  const managed =
    stmt.managedRuleGroupStatement as wafv2.CfnWebACL.ManagedRuleGroupStatementProperty;
  assert.equal(managed.vendorName, "AWS");
  assert.equal(managed.name, "AWSManagedRulesCommonRuleSet");

  // The whole point of the fix: overrides are present and non-empty.
  const overrides = managed.ruleActionOverrides as
    | wafv2.CfnWebACL.RuleActionOverrideProperty[]
    | undefined;
  assert.ok(
    overrides && overrides.length > 0,
    "managed common rule set must carry ruleActionOverrides (none = 403 regression)",
  );

  const overriddenToCount = new Set(
    overrides
      .filter((o) => getCount(o.actionToUse) !== undefined)
      .map((o) => o.name),
  );
  assert.ok(overriddenToCount.has("CrossSiteScripting_BODY"));
  assert.ok(overriddenToCount.has("SizeRestrictions_BODY"));

  // overrideAction stays `none` so all OTHER sub-rules keep their default
  // (Block) action — we only relaxed the three named false-positive rules.
  assert.deepEqual(common!.overrideAction, { none: {} });
});

test("the per-IP rate limit rule stays in Block mode (not weakened)", () => {
  const rules = buildWebAclRules();
  const rateLimit = rules.find((r) => r.name === "RateLimitPerIp");
  assert.ok(rateLimit, "RateLimitPerIp rule must still exist");
  assert.deepEqual(rateLimit!.action, { block: {} });

  const stmt = rateLimit!.statement as wafv2.CfnWebACL.StatementProperty;
  const rate =
    stmt.rateBasedStatement as wafv2.CfnWebACL.RateBasedStatementProperty;
  assert.equal(rate.limit, 2000);
  assert.equal(rate.aggregateKeyType, "IP");
});

test("rules are ordered by ascending priority", () => {
  const rules = buildWebAclRules();
  const priorities = rules.map((r) => r.priority);
  assert.deepEqual(priorities, [...priorities].sort((a, b) => a - b));
  assert.equal(new Set(priorities).size, priorities.length, "priorities unique");
});
