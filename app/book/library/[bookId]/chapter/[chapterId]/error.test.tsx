import "../../../../../../tests/_lib/dom";

import assert from "node:assert/strict";
import { after, afterEach, before, test } from "node:test";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { installRouteHarness } from "@/tests/_lib/route-harness";

// next/link's idle-callback fallback reads `self`, which jsdom globals omit.
Object.defineProperty(globalThis, "self", { configurable: true, writable: true, value: globalThis });

const order: string[] = [];
const harness = installRouteHarness({
  "next/navigation": {
    useRouter: () => ({
      refresh: () => order.push("refresh"),
      push: () => {},
      replace: () => {},
      prefetch: () => {},
      back: () => {},
      forward: () => {},
    }),
  },
});

let ChapterError: typeof import("./error").default;

before(async () => {
  ({ default: ChapterError } = await import("./error"));
});

afterEach(() => {
  cleanup();
  order.length = 0;
});

after(() => harness.restore());

test("SHELL-12: Try again re-requests the server data, then resets the boundary", async () => {
  const originalError = console.error;
  console.error = () => {};
  try {
    const view = render(
      <ChapterError error={new Error("boom")} reset={() => order.push("reset")} />,
    );
    await act(async () => {
      fireEvent.click(view.getByRole("button", { name: "Try again" }));
    });
  } finally {
    console.error = originalError;
  }
  assert.deepEqual(order, ["refresh", "reset"]);
});
