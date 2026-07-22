import assert from "node:assert/strict";
import test from "node:test";
import {
  MOBILE_EDGE_OPACITY_CLASS,
  getCoverflowPresentation,
} from "./RecallCoverflowPresentation";

test("keeps the existing five-cover desktop presentation", () => {
  assert.deepEqual(getCoverflowPresentation(0), {
    beyond: false,
    desktopOpacity: 1,
    mobileOpacityClassName: "",
  });
  assert.deepEqual(getCoverflowPresentation(1), {
    beyond: false,
    desktopOpacity: 0.6599999999999999,
    mobileOpacityClassName: "",
  });
  assert.deepEqual(getCoverflowPresentation(2), {
    beyond: false,
    desktopOpacity: 0.31999999999999995,
    mobileOpacityClassName: MOBILE_EDGE_OPACITY_CLASS,
  });
});

test("raises only the phone edge-cover floor and keeps off-stage covers hidden", () => {
  assert.equal(MOBILE_EDGE_OPACITY_CLASS, "max-sm:opacity-50");
  assert.deepEqual(getCoverflowPresentation(3), {
    beyond: true,
    desktopOpacity: 0,
    mobileOpacityClassName: "",
  });
});
