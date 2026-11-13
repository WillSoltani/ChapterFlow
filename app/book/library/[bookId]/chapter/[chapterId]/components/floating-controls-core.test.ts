import assert from "node:assert/strict";
import { test } from "node:test";
import { nextFloatingControlsHidden } from "./floating-controls-core";

const base = { prevY: 0, y: 0, hidden: false, viewportH: 800, docH: 4000 };

test("scrolling down through the text hides the floating controls", () => {
  assert.equal(nextFloatingControlsHidden({ ...base, prevY: 400, y: 460 }), true);
});

test("scrolling up shows them again", () => {
  assert.equal(nextFloatingControlsHidden({ ...base, prevY: 460, y: 400, hidden: true }), false);
});

test("tiny scroll jitter keeps the current state", () => {
  assert.equal(nextFloatingControlsHidden({ ...base, prevY: 400, y: 403, hidden: true }), true);
  assert.equal(nextFloatingControlsHidden({ ...base, prevY: 400, y: 397, hidden: false }), false);
});

test("controls are visible at the top of the page", () => {
  assert.equal(nextFloatingControlsHidden({ ...base, prevY: 90, y: 20, hidden: true }), false);
  assert.equal(nextFloatingControlsHidden({ ...base, prevY: 0, y: 30 }), false);
});

test("controls come back at the end of the page, where the padding keeps text clear", () => {
  assert.equal(
    nextFloatingControlsHidden({ ...base, prevY: 3100, y: 3190, hidden: true, docH: 4000 }),
    false,
  );
});
