import { test } from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_STREAK_MODE,
  DEFAULT_STREAK_SKIP_DAYS,
  isValidStreakMode,
  resolveStreakMode,
  resolveStreakSkipDays,
} from "./streak-mode";

test("isValidStreakMode accepts only the three canonical modes", () => {
  assert.equal(isValidStreakMode("off"), true);
  assert.equal(isValidStreakMode("standard"), true);
  assert.equal(isValidStreakMode("flexible"), true);

  assert.equal(isValidStreakMode("Flexible"), false);
  assert.equal(isValidStreakMode(""), false);
  assert.equal(isValidStreakMode(true), false); // the onboarding boolean is NOT a streak mode
  assert.equal(isValidStreakMode(undefined), false);
  assert.equal(isValidStreakMode(null), false);
});

test("resolveStreakMode reads settings.extended.streakMode", () => {
  assert.equal(resolveStreakMode({ extended: { streakMode: "flexible" } }), "flexible");
  assert.equal(resolveStreakMode({ extended: { streakMode: "off" } }), "off");
  assert.equal(resolveStreakMode({ extended: { streakMode: "standard" } }), "standard");
});

test("resolveStreakMode defaults to standard when absent / malformed", () => {
  assert.equal(resolveStreakMode(undefined), DEFAULT_STREAK_MODE);
  assert.equal(resolveStreakMode(null), DEFAULT_STREAK_MODE);
  assert.equal(resolveStreakMode({}), DEFAULT_STREAK_MODE);
  assert.equal(resolveStreakMode({ extended: {} }), DEFAULT_STREAK_MODE);
  assert.equal(resolveStreakMode({ extended: { streakMode: "bogus" } }), DEFAULT_STREAK_MODE);
  assert.equal(resolveStreakMode({ extended: null }), DEFAULT_STREAK_MODE);
  assert.equal(resolveStreakMode({ extended: "flexible" }), DEFAULT_STREAK_MODE);
});

test("resolveStreakMode ignores the onboarding boolean at settings.streakMode / onboarding.streakMode", () => {
  // The onboarding flow stores a *boolean* on a different key; it must not be
  // mistaken for the tri-state mode (which lives under extended).
  assert.equal(resolveStreakMode({ streakMode: true }), DEFAULT_STREAK_MODE);
  assert.equal(resolveStreakMode({ onboarding: { streakMode: true } }), DEFAULT_STREAK_MODE);
  // extended still wins when both are present.
  assert.equal(
    resolveStreakMode({ streakMode: true, extended: { streakMode: "off" } }),
    "off",
  );
});

test("resolveStreakSkipDays reads + clamps settings.extended.streakSkipDays to [0,3]", () => {
  assert.equal(resolveStreakSkipDays({ extended: { streakSkipDays: 2 } }), 2);
  assert.equal(resolveStreakSkipDays({ extended: { streakSkipDays: 0 } }), 0);
  assert.equal(resolveStreakSkipDays({ extended: { streakSkipDays: 3 } }), 3);
  assert.equal(resolveStreakSkipDays({ extended: { streakSkipDays: 99 } }), 3); // clamp high
  assert.equal(resolveStreakSkipDays({ extended: { streakSkipDays: -5 } }), 0); // clamp low
  assert.equal(resolveStreakSkipDays({ extended: { streakSkipDays: 2.9 } }), 2); // truncate
});

test("resolveStreakSkipDays defaults when absent / malformed", () => {
  assert.equal(resolveStreakSkipDays(undefined), DEFAULT_STREAK_SKIP_DAYS);
  assert.equal(resolveStreakSkipDays({}), DEFAULT_STREAK_SKIP_DAYS);
  assert.equal(resolveStreakSkipDays({ extended: {} }), DEFAULT_STREAK_SKIP_DAYS);
  assert.equal(resolveStreakSkipDays({ extended: { streakSkipDays: "2" } }), DEFAULT_STREAK_SKIP_DAYS);
  assert.equal(resolveStreakSkipDays({ extended: { streakSkipDays: NaN } }), DEFAULT_STREAK_SKIP_DAYS);
});
