import assert from "node:assert/strict";
import { test } from "node:test";
import { effectiveReadingProfile } from "./reading-profile-core";

// The Settings profile cards carry the same names as the reader's mode menu
// (Lite, Standard, Deeper), so the card that is ticked must be the depth the
// reader actually gets.

test("an account that never chose a depth reads Lite, whatever profile is stored", () => {
  assert.equal(
    effectiveReadingProfile({ profileCustomized: false, learningMode: "standard", readingProfile: "balanced" }),
    "quick",
  );
  assert.equal(
    effectiveReadingProfile({ profileCustomized: false, learningMode: "challenge", readingProfile: "deep" }),
    "quick",
  );
});

test("once a depth was chosen, the card follows the learning mode", () => {
  const stale = { profileCustomized: true, readingProfile: "balanced" } as const;
  assert.equal(effectiveReadingProfile({ ...stale, learningMode: "guided" }), "quick");
  assert.equal(effectiveReadingProfile({ ...stale, learningMode: "standard" }), "balanced");
  // A depth picked in the reader changes learningMode but not readingProfile.
  assert.equal(effectiveReadingProfile({ ...stale, learningMode: "challenge" }), "deep");
});

test("an unknown learning mode falls back to the stored profile", () => {
  assert.equal(
    effectiveReadingProfile({
      profileCustomized: true,
      learningMode: "something-else" as never,
      readingProfile: "deep",
    }),
    "deep",
  );
});
