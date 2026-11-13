import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isPreferencesSyncPath,
  serverDocumentThemeSettings,
  shouldApplyServerPreferences,
} from "./preferences-sync-core";

test("sync runs on the signed-in pages that do not load preferences themselves", () => {
  for (const path of [
    "/dashboard",
    "/book/library",
    "/book/library/atomic-habits",
    "/book/progress",
    "/book/badges",
    "/rewards",
  ]) {
    assert.equal(isPreferencesSyncPath(path), true, path);
  }
  for (const path of [
    "/",
    "/pricing",
    "/book/settings",
    "/book/settings/billing",
    "/book/library/atomic-habits/chapter/atomic-habits-ch04",
    "/onboarding",
    "/book/onboarding",
    "/dashboards",
    "/rewardsx",
    "/bookish",
    null,
  ]) {
    assert.equal(isPreferencesSyncPath(path), false, String(path));
  }
});

test("server preferences apply on a device with nothing saved", () => {
  assert.equal(
    shouldApplyServerPreferences({
      hasServerSettings: true,
      localPayload: null,
      lastSyncedAt: "2026-11-13T10:00:00.000Z",
      serverUpdatedAt: "2026-11-01T10:00:00.000Z",
    }),
    true,
  );
});

test("server preferences apply only when newer than what this device last saw", () => {
  const base = { hasServerSettings: true, localPayload: "{}" };
  assert.equal(
    shouldApplyServerPreferences({
      ...base,
      lastSyncedAt: "2026-11-12T10:00:00.000Z",
      serverUpdatedAt: "2026-11-13T10:00:00.000Z",
    }),
    true,
  );
  assert.equal(
    shouldApplyServerPreferences({
      ...base,
      lastSyncedAt: "2026-11-13T10:00:00.000Z",
      serverUpdatedAt: "2026-11-13T10:00:00.000Z",
    }),
    false,
  );
  assert.equal(
    shouldApplyServerPreferences({ ...base, lastSyncedAt: null, serverUpdatedAt: "2026-11-13T10:00:00.000Z" }),
    true,
  );
  assert.equal(
    shouldApplyServerPreferences({ ...base, lastSyncedAt: null, serverUpdatedAt: null }),
    false,
  );
});

test("nothing applies when the server has no saved settings", () => {
  assert.equal(
    shouldApplyServerPreferences({
      hasServerSettings: false,
      localPayload: null,
      lastSyncedAt: null,
      serverUpdatedAt: "2026-11-13T10:00:00.000Z",
    }),
    false,
  );
});

test("the theme subset is read from the server settings and bad values are dropped", () => {
  assert.deepEqual(
    serverDocumentThemeSettings({
      appearance: { theme: "dark", reducedMotion: true, accentColor: "rose" },
      accessibility: { highContrastMode: true },
      extended: {
        colorBlindMode: "deuteranopia",
        scheduledDarkMode: true,
        darkModeFrom: "21:00",
        darkModeTo: "07:00",
        dailyGoalPreset: 10,
      },
    }),
    {
      theme: "dark",
      reducedMotion: true,
      highContrastMode: true,
      colorBlindMode: "deuteranopia",
      scheduledDarkMode: true,
      darkModeFrom: "21:00",
      darkModeTo: "07:00",
    },
  );
  assert.deepEqual(
    serverDocumentThemeSettings({
      appearance: { theme: "neon", reducedMotion: "yes" },
      extended: { colorBlindMode: "sepia", darkModeFrom: "late" },
    }),
    {},
  );
});
