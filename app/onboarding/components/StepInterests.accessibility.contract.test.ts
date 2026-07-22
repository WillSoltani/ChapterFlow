import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const componentPath = new URL("./StepInterests.tsx", import.meta.url);
const source = readFileSync(componentPath, "utf8");

test("interest submission rejects empty and partial choices but preserves the valid flow", async () => {
  assert.match(
    source,
    /export function getInterestContinueDecision\(selectedCount: number\)/,
    "the Continue decision must be a directly testable contract",
  );

  const component = (await import("./StepInterests")) as unknown as {
    getInterestContinueDecision: (selectedCount: number) => {
      canContinue: boolean;
      validationMessage: string | null;
    };
  };

  assert.deepEqual(component.getInterestContinueDecision(0), {
    canContinue: false,
    validationMessage: "Select 3 more interests to continue.",
  });
  assert.deepEqual(component.getInterestContinueDecision(2), {
    canContinue: false,
    validationMessage: "Select 1 more interest to continue.",
  });
  assert.deepEqual(component.getInterestContinueDecision(3), {
    canContinue: true,
    validationMessage: null,
  });
});

test("Continue stays operable and is always described by the persistent requirement", () => {
  const continueButton = source.match(/<Button[\s\S]*?>\s*Continue[\s\S]*?<\/Button>/)?.[0];
  assert.ok(continueButton, "missing Continue button");
  assert.doesNotMatch(continueButton, /\bdisabled=/, "Continue must not become an unreachable dead end");
  assert.match(continueButton, /onClick=\{handleContinue\}/);
  assert.match(continueButton, /aria-describedby=\{requirementId\}/);
  assert.match(source, /<p\s+id=\{requirementId\}/, "the requirement must remain in the accessibility tree");
});

test("invalid activation announces once and returns focus to the interests group", () => {
  assert.match(source, /const interestsGridRef = useRef<HTMLDivElement>\(null\)/);
  assert.match(
    source,
    /<motion\.div[\s\S]*?ref=\{interestsGridRef\}[\s\S]*?role="group"[\s\S]*?tabIndex=\{-1\}/,
    "the topic group must be a programmatic focus target",
  );
  assert.match(source, /interestsGridRef\.current\?\.focus\(\)/);
  assert.match(source, /<p\s+id=\{validationId\}\s+role="alert"/);
  assert.doesNotMatch(
    source,
    /role="alert"[^>]*aria-live|aria-live[^>]*role="alert"/,
    "role=alert already supplies assertive live semantics; duplicating aria-live can double-announce",
  );
  assert.match(
    source,
    /aria-hidden="true"/,
    "the animated visual counter must not compete with the validation announcement",
  );
});
