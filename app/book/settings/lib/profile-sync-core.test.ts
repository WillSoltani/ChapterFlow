import assert from "node:assert/strict";
import { test } from "node:test";
import { buildOnboardingProfileSnapshot, diffOnboardingProfile } from "./profile-sync-core";

const source = {
  learningStyle: "balanced",
  quizIntensity: "standard",
  streakMode: true,
  motivationStyle: "gentle",
  dailyGoalMinutes: 20,
  reminderTime: "",
};

test("an empty reminder time is sent as null", () => {
  assert.equal(buildOnboardingProfileSnapshot(source).reminderTime, null);
  assert.equal(buildOnboardingProfileSnapshot({ ...source, reminderTime: " 07:00 " }).reminderTime, " 07:00 ");
});

test("an unchanged snapshot produces no write", () => {
  const snap = buildOnboardingProfileSnapshot(source);
  assert.equal(diffOnboardingProfile(snap, buildOnboardingProfileSnapshot({ ...source })), null);
});

test("only the fields the user changed are sent", () => {
  const baseline = buildOnboardingProfileSnapshot(source);
  const next = buildOnboardingProfileSnapshot({ ...source, dailyGoalMinutes: 30 });
  assert.deepEqual(diffOnboardingProfile(baseline, next), { dailyGoalMinutes: 30 });
});
