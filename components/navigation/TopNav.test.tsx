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
const originalFetch = globalThis.fetch;

// next/link schedules prefetch work through `self`.
Object.defineProperty(globalThis, "self", {
  configurable: true,
  writable: true,
  value: window,
});

Module._load = function patchedLoad(request, parent, isMain) {
  if (request === "next/navigation") {
    return {
      usePathname: () => "/book/library",
      useRouter: () => ({ push() {}, replace() {}, refresh() {}, prefetch() {} }),
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};

const PROFILE_PATH = "/app/api/book/me/profile";
const profilePayload = {
  identity: {
    sub: "user-1",
    displayName: "Maya Chen",
    givenName: "Maya",
    source: "profile",
  },
  profile: { avatarDataUrl: "data:image/png;base64,AAAA" },
};

let releaseProfile: (() => void) | null = null;

globalThis.fetch = (async (input: RequestInfo | URL) => {
  const url = String(input);
  if (url.startsWith(PROFILE_PATH)) {
    await new Promise<void>((resolve) => {
      releaseProfile = resolve;
    });
    return Response.json(profilePayload);
  }
  if (url.includes("/me/is-admin")) return Response.json({ isAdmin: false });
  return Response.json({ notifications: [], unreadCount: 0 });
}) as typeof fetch;

async function renderNav(props: { name?: string; avatarUrl?: string | null } = {}) {
  const { TopNav } = await import("./TopNav");
  return render(
    <TopNav
      {...props}
      activeTab="library"
      searchQuery=""
      onSearchChange={() => {}}
      searchInputRef={{ current: null }}
    />,
  );
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

after(() => {
  Module._load = originalLoad;
  globalThis.fetch = originalFetch;
  Reflect.deleteProperty(globalThis, "self");
});

test("the header never shows a stand-in name while the profile loads, then shows the first name", async () => {
  const view = await renderNav({ name: "Maya Chen" });
  const header = view.container.querySelector("header");
  assert.ok(header);
  assert.equal(
    view.getByRole("link", { name: "ChapterFlow home" }).getAttribute("href"),
    "/dashboard",
  );

  await waitFor(() => assert.ok(releaseProfile, "profile request started"));
  assert.doesNotMatch(header.textContent ?? "", /Reader/);
  assert.doesNotMatch(header.textContent ?? "", /Maya/);

  releaseProfile?.();
  const chip = view.getByRole("link", { name: "Profile" });
  await waitFor(() => assert.equal(chip.textContent, "Maya"));
  assert.equal(chip.querySelector("img")?.getAttribute("src"), profilePayload.profile.avatarDataUrl);

  fireEvent.click(view.getByRole("button", { name: "Open profile menu" }));
  await waitFor(() => assert.ok(view.getByText("Maya Chen")));
});

test("a later page shows the cached name and avatar on its first render", async () => {
  // Callers may pass a shorter or different name; the header reads the viewer itself.
  const view = await renderNav({ name: "Someone Else" });
  const chip = view.getByRole("link", { name: "Profile" });
  assert.equal(chip.textContent, "Maya");
  assert.equal(chip.querySelector("img")?.getAttribute("src"), profilePayload.profile.avatarDataUrl);
});

test("an avatar passed by the page wins over the cached one", async () => {
  const view = await renderNav({ avatarUrl: "data:image/png;base64,BBBB" });
  const chip = view.getByRole("link", { name: "Profile" });
  assert.equal(chip.querySelector("img")?.getAttribute("src"), "data:image/png;base64,BBBB");
});
