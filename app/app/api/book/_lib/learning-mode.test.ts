import { test } from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_LEARNING_MODE,
  isValidLearningMode,
  resolveLearningMode,
} from "./learning-mode";

test("isValidLearningMode accepts only the three canonical modes", () => {
  assert.equal(isValidLearningMode("guided"), true);
  assert.equal(isValidLearningMode("standard"), true);
  assert.equal(isValidLearningMode("challenge"), true);

  assert.equal(isValidLearningMode("deep"), false);
  assert.equal(isValidLearningMode("GUIDED"), false);
  assert.equal(isValidLearningMode(""), false);
  assert.equal(isValidLearningMode(undefined), false);
  assert.equal(isValidLearningMode(null), false);
  assert.equal(isValidLearningMode(3), false);
  assert.equal(isValidLearningMode({ learningMode: "challenge" }), false);
});

test("resolveLearningMode prefers the canonical top-level key", () => {
  assert.equal(resolveLearningMode({ learningMode: "challenge" }), "challenge");
  assert.equal(resolveLearningMode({ learningMode: "guided" }), "guided");
  assert.equal(resolveLearningMode({ learningMode: "standard" }), "standard");
});

test("resolveLearningMode falls back to extended.learningMode (self-heals pre-mirror users)", () => {
  // The bug this fixes: mode was only ever written under `extended`, so before
  // the backfill these readers were silently treated as "standard".
  assert.equal(
    resolveLearningMode({ extended: { learningMode: "challenge" } }),
    "challenge",
  );
  assert.equal(
    resolveLearningMode({ extended: { learningMode: "guided" } }),
    "guided",
  );
});

test("resolveLearningMode: top-level wins over extended when both present", () => {
  assert.equal(
    resolveLearningMode({
      learningMode: "guided",
      extended: { learningMode: "challenge" },
    }),
    "guided",
  );
});

test("resolveLearningMode: invalid top-level falls through to a valid extended", () => {
  assert.equal(
    resolveLearningMode({
      learningMode: "bogus",
      extended: { learningMode: "challenge" },
    }),
    "challenge",
  );
});

test("resolveLearningMode defaults to standard when absent / malformed", () => {
  assert.equal(resolveLearningMode(undefined), DEFAULT_LEARNING_MODE);
  assert.equal(resolveLearningMode(null), DEFAULT_LEARNING_MODE);
  assert.equal(resolveLearningMode({}), DEFAULT_LEARNING_MODE);
  assert.equal(resolveLearningMode({ learningMode: "bogus" }), DEFAULT_LEARNING_MODE);
  assert.equal(
    resolveLearningMode({ extended: { learningMode: "bogus" } }),
    DEFAULT_LEARNING_MODE,
  );
  // `extended` is not a record (legacy / corrupt shape) — must not throw.
  assert.equal(resolveLearningMode({ extended: "challenge" }), DEFAULT_LEARNING_MODE);
  assert.equal(resolveLearningMode({ extended: null }), DEFAULT_LEARNING_MODE);
  assert.equal(DEFAULT_LEARNING_MODE, "standard");
});
