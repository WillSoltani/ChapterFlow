import assert from "node:assert/strict";
import test from "node:test";
import {
  VISIBLE_PER_SIDE,
  getCoverflowPresentation,
} from "./RecallCoverflowPresentation";

test("floors every in-stage cover at 0.5 on the #06070A canvas (WS5-011)", () => {
  assert.deepEqual(getCoverflowPresentation(0), { beyond: false, desktopOpacity: 1 });
  assert.deepEqual(getCoverflowPresentation(1), {
    beyond: false,
    desktopOpacity: 0.6599999999999999,
  });
  assert.deepEqual(getCoverflowPresentation(2), { beyond: false, desktopOpacity: 0.5 });
  for (let distance = 0; distance <= VISIBLE_PER_SIDE; distance++) {
    assert.ok(
      getCoverflowPresentation(distance).desktopOpacity >= 0.5,
      `in-stage distance ${distance} must render at >= 0.5`,
    );
  }
});

test("keeps off-stage covers fully hidden", () => {
  assert.deepEqual(getCoverflowPresentation(3), { beyond: true, desktopOpacity: 0 });
  assert.deepEqual(getCoverflowPresentation(-3), { beyond: true, desktopOpacity: 0 });
});
