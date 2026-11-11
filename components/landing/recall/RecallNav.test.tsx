import "../../../tests/_lib/dom";

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
let pathname = "/pricing";

Object.defineProperty(globalThis, "self", {
  configurable: true,
  writable: true,
  value: window,
});

Module._load = function patchedLoad(request, parent, isMain) {
  if (request === "next/navigation") {
    return { usePathname: () => pathname };
  }
  return originalLoad.call(this, request, parent, isMain);
};

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
  document.body.style.overflow = "";
  document.body.style.paddingRight = "";
  globalThis.fetch = originalFetch;
  pathname = "/pricing";
});

after(() => {
  Module._load = originalLoad;
  Reflect.deleteProperty(globalThis, "self");
});

test("mobile public navigation traps and restores focus while deduplicating the persistent CTA", async () => {
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ loggedIn: false }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  let sentinelTop = 640;
  const sentinel = document.createElement("div");
  sentinel.dataset.publicHeroEnd = "";
  sentinel.getBoundingClientRect = () =>
    ({
      x: 0,
      y: sentinelTop,
      top: sentinelTop,
      right: 0,
      bottom: sentinelTop + 1,
      left: 0,
      width: 0,
      height: 1,
      toJSON() {},
    }) as DOMRect;
  document.body.appendChild(sentinel);

  const { RecallNav } = await import("./RecallNav");
  let view: ReturnType<typeof render>;
  try {
    view = render(<RecallNav />);
  } catch (error) {
    if (error instanceof AggregateError) throw error.errors[0];
    throw error;
  }
  const trigger = view.getByRole("button", { name: "Open navigation menu" });

  assert.equal(trigger.getAttribute("aria-haspopup"), "dialog");
  assert.equal(trigger.getAttribute("aria-expanded"), "false");
  assert.equal(trigger.getAttribute("aria-controls"), "chapterflow-public-navigation");
  assert.equal(view.queryByRole("link", { name: "Start free" }), null);

  trigger.focus();
  fireEvent.click(trigger);
  const dialog = await view.findByRole("dialog", { name: "Navigation" });
  const close = view.getByRole("button", { name: "Close navigation menu" });

  assert.ok(dialog);
  await waitFor(() => assert.equal(document.activeElement, close));
  assert.equal(document.body.style.overflow, "hidden");
  assert.equal(view.getAllByRole("link", { name: "Start free" }).length, 1);
  for (const pricing of view.getAllByRole("link", { name: "Pricing" })) {
    assert.equal(pricing.getAttribute("aria-current"), "page");
  }

  fireEvent.keyDown(document, { key: "Escape" });
  await waitFor(() => {
    assert.equal(view.queryByRole("dialog", { name: "Navigation" }), null);
    assert.equal(document.activeElement, trigger);
    assert.equal(document.body.style.overflow, "");
  });
  assert.equal(view.queryByRole("link", { name: "Start free" }), null);

  sentinelTop = -1;
  fireEvent.scroll(window);
  await waitFor(() =>
    assert.equal(view.getAllByRole("link", { name: "Start free" }).length, 1),
  );

  fireEvent.click(trigger);
  await view.findByRole("dialog", { name: "Navigation" });
  await waitFor(() =>
    assert.equal(view.getAllByRole("link", { name: "Start free" }).length, 1),
  );

  pathname = "/books";
  view.rerender(<RecallNav />);
  await waitFor(() => {
    assert.equal(view.queryByRole("dialog", { name: "Navigation" }), null);
    assert.equal(document.body.style.overflow, "");
  });
});

test("persistent CTA works with IntersectionObserver but no ResizeObserver", async () => {
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ loggedIn: false }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  const w = window as unknown as Record<string, unknown>;
  const savedIO = w.IntersectionObserver;
  const savedRO = w.ResizeObserver;
  const observed: Array<{
    cb: (entries: Array<Partial<IntersectionObserverEntry>>) => void;
    targets: Element[];
  }> = [];
  class FakeIO {
    targets: Element[] = [];
    constructor(cb: (entries: Array<Partial<IntersectionObserverEntry>>) => void) {
      observed.push({ cb, targets: this.targets });
    }
    observe(el: Element) {
      this.targets.push(el);
    }
    disconnect() {}
  }
  w.IntersectionObserver = FakeIO;
  Reflect.deleteProperty(w, "ResizeObserver");
  try {
    const sentinel = document.createElement("div");
    sentinel.dataset.publicHeroEnd = "";
    document.body.appendChild(sentinel);
    const { RecallNav } = await import("./RecallNav");
    const view = render(<RecallNav />);
    assert.equal(view.queryByRole("link", { name: "Start free" }), null);
    const line = observed.find((o) => o.targets.includes(sentinel));
    assert.ok(line, "the sentinel is observed without ResizeObserver");
    line.cb([
      {
        target: sentinel,
        isIntersecting: false,
        boundingClientRect: { top: -1 } as DOMRectReadOnly,
      },
    ]);
    await waitFor(() =>
      assert.equal(view.getAllByRole("link", { name: "Start free" }).length, 1),
    );
  } finally {
    if (savedIO === undefined) Reflect.deleteProperty(w, "IntersectionObserver");
    else w.IntersectionObserver = savedIO;
    if (savedRO !== undefined) w.ResizeObserver = savedRO;
  }
});

test("a film start button turning on or off hands over with the nav's in the same frame (no React render left pending)", async () => {
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ loggedIn: false }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  const w = window as unknown as Record<string, unknown>;
  const savedIO = w.IntersectionObserver;
  const savedRO = w.ResizeObserver;
  const observed: Array<{
    cb: (entries: Array<Partial<IntersectionObserverEntry>>) => void;
    targets: Element[];
  }> = [];
  class FakeIO {
    targets: Element[] = [];
    constructor(cb: (entries: Array<Partial<IntersectionObserverEntry>>) => void) {
      observed.push({ cb, targets: this.targets });
    }
    observe(el: Element) {
      this.targets.push(el);
    }
    disconnect() {}
  }
  w.IntersectionObserver = FakeIO;
  Reflect.deleteProperty(w, "ResizeObserver");
  try {
    pathname = "/";
    // The film landing: the hero pin carries the hero start button; the Home
    // chapter's pin is a suppression zone whose button is off (data-cta-off).
    const hero = document.createElement("div");
    hero.setAttribute("data-public-sticky-cta-suppress", "");
    hero.setAttribute("data-public-hero-cta", "");
    hero.setAttribute("data-cta-off", "");
    const home = document.createElement("div");
    home.setAttribute("data-public-sticky-cta-suppress", "");
    home.setAttribute("data-cta-off", "");
    document.body.append(hero, home);
    const { RecallNav } = await import("./RecallNav");
    const view = render(<RecallNav />);
    const zones = observed.find((o) => o.targets.includes(home));
    assert.ok(zones, "the Home zone is observed");
    zones.cb([{ target: home, isIntersecting: true }]);
    await waitFor(() => assert.equal(view.getAllByRole("link", { name: "Start free" }).length, 1));

    // The pin's opacity crosses one half in a scrub tick: the attribute goes,
    // and once that tick's microtasks have run (before the browser paints)
    // the nav's button is gone. A render left to React's scheduler paints
    // one frame with both buttons.
    const microtasks = async () => {
      for (let i = 0; i < 5; i++) await Promise.resolve();
    };
    home.removeAttribute("data-cta-off");
    await microtasks();
    assert.equal(view.queryByRole("link", { name: "Start free" }), null, "the nav's button left with the tick that showed the chapter's");
    home.setAttribute("data-cta-off", "");
    await microtasks();
    assert.equal(view.queryAllByRole("link", { name: "Start free" }).length, 1, "the nav's button came back with the tick that hid the chapter's");
  } finally {
    if (savedIO === undefined) Reflect.deleteProperty(w, "IntersectionObserver");
    else w.IntersectionObserver = savedIO;
    if (savedRO !== undefined) w.ResizeObserver = savedRO;
  }
});
