import "../../tests/_lib/dom";

import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { after, afterEach, test } from "node:test";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";

const require = createRequire(import.meta.url);
const Module = require("node:module") as {
  _load: (request: string, parent: unknown, isMain: boolean) => unknown;
};
const originalLoad = Module._load;
const calls: string[] = [];

// next/link schedules prefetch work through `self`.
Object.defineProperty(globalThis, "self", { configurable: true, writable: true, value: window });

Module._load = function patchedLoad(request, parent, isMain) {
  if (request === "next/navigation") {
    return {
      usePathname: () => "/dashboard",
      useRouter: () => ({
        refresh: () => calls.push("refresh"),
        push() {},
        replace() {},
        prefetch() {},
      }),
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};

afterEach(() => {
  cleanup();
  calls.length = 0;
});

after(() => {
  Module._load = originalLoad;
  Reflect.deleteProperty(globalThis, "self");
});

test("Try again asks the server for the page again before resetting the boundary", async () => {
  const { RouteError } = await import("./RouteError");
  const view = render(
    <RouteError title="Something went wrong" message="Your progress is safe." reset={() => calls.push("reset")} />,
  );
  fireEvent.click(view.getByRole("button", { name: "Try again" }));
  await waitFor(() => assert.deepEqual(calls, ["refresh", "reset"]));
  assert.equal(view.getByRole("link", { name: "Back to Home" }).getAttribute("href"), "/dashboard");
});

test("a not-found screen has no retry and keeps its ways out", async () => {
  const { RouteError } = await import("./RouteError");
  const view = render(
    <RouteError
      title="We couldn't find that page"
      message="It may have moved."
      secondaryLinks={[{ href: "/book/library", label: "Browse library" }]}
    />,
  );
  assert.equal(view.queryByRole("button", { name: "Try again" }), null);
  assert.equal(view.getByRole("link", { name: "Back to Home" }).getAttribute("href"), "/dashboard");
  assert.equal(view.getByRole("link", { name: "Browse library" }).getAttribute("href"), "/book/library");
});
