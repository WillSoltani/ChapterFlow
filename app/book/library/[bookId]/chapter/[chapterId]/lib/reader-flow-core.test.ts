import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildNextChapterRoute,
  buildReauthReturnTo,
  computeProgressPercent,
  decidePhaseTransition,
  mapLearningStyleToDepth,
  modeToDepth,
  requiredScenarioInteractions,
} from "./reader-flow-core";

test("reader depth mappings preserve the fast/default and learning-mode contracts", () => {
  assert.equal(mapLearningStyleToDepth("concise"), "simple");
  assert.equal(mapLearningStyleToDepth("deep"), "deeper");
  assert.equal(mapLearningStyleToDepth("balanced"), "standard");
  assert.equal(modeToDepth("guided"), "simple");
  assert.equal(modeToDepth("standard"), "standard");
  assert.equal(modeToDepth("challenge"), "deeper");
});

test("chapter progress keeps the existing phase weights and halfway display", () => {
  assert.equal(computeProgressPercent("summary", new Set()), 17);
  assert.equal(computeProgressPercent("summary", new Set(["summary"])), 33);
  assert.equal(computeProgressPercent("examples", new Set(["summary"])), 50);
  assert.equal(computeProgressPercent("quiz", new Set(["summary", "examples"])), 83);
  assert.equal(computeProgressPercent("quiz", new Set(["summary", "examples", "quiz"])), 100);
});

test("phase transitions preserve forward completion/interstitial and accessible backward navigation", () => {
  assert.deepEqual(
    decidePhaseTransition({
      current: "summary",
      target: "examples",
      targetAccessible: true,
      skipInterstitial: false,
    }),
    { kind: "forward-interstitial", completeCurrent: true },
  );
  assert.deepEqual(
    decidePhaseTransition({
      current: "examples",
      target: "quiz",
      targetAccessible: true,
      skipInterstitial: true,
    }),
    { kind: "direct", completeCurrent: true },
  );
  assert.deepEqual(
    decidePhaseTransition({
      current: "quiz",
      target: "summary",
      targetAccessible: true,
      skipInterstitial: false,
    }),
    { kind: "direct", completeCurrent: false },
  );
  assert.deepEqual(
    decidePhaseTransition({
      current: "quiz",
      target: "examples",
      targetAccessible: false,
      skipInterstitial: false,
    }),
    { kind: "blocked", completeCurrent: false },
  );
});

test("only Challenge mode requires every default-visible scenario interaction", () => {
  assert.equal(requiredScenarioInteractions("guided", 2), 0);
  assert.equal(requiredScenarioInteractions("standard", 2), 0);
  assert.equal(requiredScenarioInteractions("challenge", 0), 0);
  assert.equal(requiredScenarioInteractions("challenge", 2), 2);
});

test("reader routes preserve encoding, session propagation, and relative reauth returnTo", () => {
  assert.equal(
    buildNextChapterRoute("book / id", "chapter / id", false),
    "/book/library/book%20%2F%20id/chapter/chapter%20%2F%20id",
  );
  assert.equal(
    buildNextChapterRoute("book / id", "chapter / id", true),
    "/book/library/book%20%2F%20id/chapter/chapter%20%2F%20id?session=1",
  );
  assert.equal(
    buildReauthReturnTo("/book/library/a/chapter/b", "session=1&from=dashboard"),
    "/book/library/a/chapter/b?session=1&from=dashboard",
  );
  assert.equal(buildReauthReturnTo("/book/library/a/chapter/b", ""), "/book/library/a/chapter/b");
});
