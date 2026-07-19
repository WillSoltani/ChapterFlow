import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const readerPath = new URL("./ChapterReaderClient.tsx", import.meta.url);
const source = readFileSync(readerPath, "utf8");
const settingsPath = new URL("./hooks/useReaderSettings.ts", import.meta.url);
const settingsSource = readFileSync(settingsPath, "utf8");

function assertFastDefaultContract(candidate: string) {
  assert.match(
    candidate,
    /defaultToFastPath:\s*bookPrefsHydrated\s*&&\s*!bookPrefs\.extended\.profileCustomized\s*,/,
    "Fast may be the default only after book preferences hydrate and while the profile is not customized",
  );
}

test("reader shell stays slim and composes the route-local reader authorities", () => {
  const physicalLines = source.split("\n").length;
  assert.ok(
    physicalLines <= 500,
    `ChapterReaderClient.tsx must be <=500 physical lines; found ${physicalLines}`,
  );

  for (const authority of [
    "useReaderAccess",
    "useReaderSettings",
    "useReaderProgress",
    "useReaderPhaseFlow",
    "useChapterQuiz",
    "useReaderExamples",
  ]) {
    assert.match(source, new RegExp(`\\b${authority}\\(`), `missing ${authority} composition`);
  }

  for (const view of [
    "ReaderAccessState",
    "ReaderChrome",
    "ReaderPhaseContent",
    "ReaderOverlays",
  ]) {
    assert.match(source, new RegExp(`<${view}\\b`), `missing ${view} composition`);
  }
});

test("Fast defaults only after book preferences hydrate and before profile customization", () => {
  assertFastDefaultContract(settingsSource);

  const missingHydrationGuard = settingsSource.replace(
    "bookPrefsHydrated && !bookPrefs.extended.profileCustomized",
    "!bookPrefs.extended.profileCustomized",
  );
  assert.throws(
    () => assertFastDefaultContract(missingHydrationGuard),
    /Fast may be the default only after book preferences hydrate/,
  );

  const missingCustomizationGuard = settingsSource.replace(
    "bookPrefsHydrated && !bookPrefs.extended.profileCustomized",
    "bookPrefsHydrated",
  );
  assert.throws(
    () => assertFastDefaultContract(missingCustomizationGuard),
    /while the profile is not customized/,
  );
});
