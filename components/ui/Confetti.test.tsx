import "../../tests/_lib/dom";

import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { cleanup, render } from "@testing-library/react";

// The OS does NOT ask for reduced motion here; only the in-app setting does.
Object.defineProperty(window, "matchMedia", {
  configurable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent() {
      return true;
    },
  }),
});

afterEach(() => {
  cleanup();
  delete document.documentElement.dataset.motion;
});

test("in-app Reduce motion stops the confetti burst", async () => {
  const { Confetti } = await import("./Confetti");
  document.documentElement.dataset.motion = "reduced";
  const view = render(<Confetti />);
  assert.equal(view.container.querySelector("canvas"), null);
});

test("confetti still bursts when no motion setting asks for less", async () => {
  const { Confetti } = await import("./Confetti");
  document.documentElement.dataset.motion = "normal";
  const view = render(<Confetti />);
  assert.ok(view.container.querySelector("canvas"));
});
