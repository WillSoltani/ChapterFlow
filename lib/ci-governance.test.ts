import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

// WS6-016: CODEOWNERS / PR template / a versioned required-checks ruleset must
// exist, and the ruleset's required_status_checks contexts must not drift from
// the actual ci.yml job display names — the failure mode this audit finding
// exists to close is "required checks are only described in scattered ci.yml
// comments" (three of them, plus docs/CI_CD.md), which silently rot. Pure
// node:fs — no server-only import, safe for the root `find app lib -name
// '*.test.ts'` glob.

const REPO_ROOT = path.join(process.cwd());
const CODEOWNERS_PATH = path.join(REPO_ROOT, ".github", "CODEOWNERS");
const PR_TEMPLATE_PATH = path.join(
  REPO_ROOT,
  ".github",
  "pull_request_template.md",
);
const RULESET_PATH = path.join(
  REPO_ROOT,
  ".github",
  "rulesets",
  "main-branch.json",
);
const CI_YML_PATH = path.join(REPO_ROOT, ".github", "workflows", "ci.yml");

test("`.github/CODEOWNERS` exists", () => {
  assert.equal(existsSync(CODEOWNERS_PATH), true, CODEOWNERS_PATH);
});

test("`.github/pull_request_template.md` exists", () => {
  assert.equal(existsSync(PR_TEMPLATE_PATH), true, PR_TEMPLATE_PATH);
});

test("`.github/rulesets/main-branch.json` parses as JSON", () => {
  assert.equal(existsSync(RULESET_PATH), true, RULESET_PATH);
  const raw = readFileSync(RULESET_PATH, "utf8");
  assert.doesNotThrow(() => JSON.parse(raw));
});

test("every required_status_checks context is a real ci.yml job `name:`", () => {
  const raw = readFileSync(RULESET_PATH, "utf8");
  const ruleset = JSON.parse(raw) as {
    rules: Array<{
      type: string;
      parameters?: { required_status_checks?: Array<{ context: string }> };
    }>;
  };

  const requiredChecksRule = ruleset.rules.find(
    (r) => r.type === "required_status_checks",
  );
  assert.ok(
    requiredChecksRule,
    "ruleset must contain a required_status_checks rule",
  );
  const contexts =
    requiredChecksRule!.parameters?.required_status_checks?.map(
      (c) => c.context,
    ) ?? [];
  assert.ok(contexts.length > 0, "required_status_checks must be non-empty");

  const ciYml = readFileSync(CI_YML_PATH, "utf8");
  // Job display names are declared as `    name: <Display Name>` under each
  // job id in ci.yml.
  const declaredNames = new Set(
    [...ciYml.matchAll(/^\s{4}name:\s*(.+)\s*$/gm)].map((m) => m[1]!.trim()),
  );

  for (const context of contexts) {
    assert.ok(
      declaredNames.has(context),
      `ruleset required check "${context}" has no matching ci.yml job \`name:\` (drift)`,
    );
  }
});
