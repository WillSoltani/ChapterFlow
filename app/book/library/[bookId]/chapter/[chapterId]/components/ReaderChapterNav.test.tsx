import "../../../../../../../tests/_lib/dom";

import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { useRef, useState } from "react";
import { cleanup, fireEvent, render, waitFor, within } from "@testing-library/react";
import { ChapterPager, ReaderStepMenu, type ChapterNeighbours } from "./ReaderChapterNav";

// next/link's idle-callback fallback reads `self`, which jsdom globals omit.
Object.defineProperty(globalThis, "self", { configurable: true, writable: true, value: globalThis });

const realMatchMedia = window.matchMedia;

function setPhone(isPhone: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (query: string) => ({
      matches: query.includes("prefers-reduced-motion") || (isPhone && query.includes("max-width")),
      media: query,
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent: () => true,
    }),
  });
}

afterEach(() => {
  cleanup();
  Object.defineProperty(window, "matchMedia", { configurable: true, value: realMatchMedia });
});

// The trigger is deliberately not focused on click (Safari and touch browsers
// do not focus a clicked button), so focus return cannot lean on the opener.
function Harness({
  neighbours = { prev: null, next: null },
}: {
  neighbours?: ChapterNeighbours;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={triggerRef} type="button" onClick={() => setOpen((value) => !value)}>
        Steps
      </button>
      <ReaderStepMenu
        open={open}
        onClose={() => setOpen(false)}
        triggerRef={triggerRef}
        chapterOrder={2}
        totalChapters={3}
        chapterTitle="Two"
        currentPhase="summary"
        completedPhases={new Set()}
        isPhaseAccessible={() => true}
        getLockMessage={() => null}
        onSelectPhase={() => {}}
        neighbours={neighbours}
      />
      <button type="button">Elsewhere</button>
    </>
  );
}

// A closed layer leaves the document after its exit transition. The check is
// cheap on purpose: comparing a DOM node with null builds a very large failure
// message on every retry, which starves the transition on a busy machine.
async function waitForGone(query: () => HTMLElement | null) {
  await waitFor(
    () => {
      if (query()) throw new Error("still in the document");
    },
    { timeout: 10_000 },
  );
}

async function openMenu(view: ReturnType<typeof render>) {
  fireEvent.click(view.getByRole("button", { name: "Steps" }));
  return waitFor(() => view.getByRole("dialog", { name: "Chapter steps" }));
}

test("desktop popover closes on Escape and returns focus to its trigger", async () => {
  setPhone(false);
  const view = render(<Harness />);
  await openMenu(view);
  fireEvent.keyDown(document, { key: "Escape" });
  await waitForGone(() => view.queryByRole("dialog", { name: "Chapter steps" }));
  assert.equal(document.activeElement, view.getByRole("button", { name: "Steps" }));
});

test("desktop popover closes on an outside click and returns focus to its trigger", async () => {
  setPhone(false);
  const view = render(<Harness />);
  await openMenu(view);
  fireEvent.mouseDown(view.getByRole("button", { name: "Elsewhere" }));
  await waitForGone(() => view.queryByRole("dialog", { name: "Chapter steps" }));
  assert.equal(document.activeElement, view.getByRole("button", { name: "Steps" }));
});

test("desktop popover leaves Escape to a modal dialog open above it", async () => {
  setPhone(false);
  const view = render(<Harness />);
  await openMenu(view);
  const modal = document.createElement("div");
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  document.body.appendChild(modal);
  try {
    fireEvent.keyDown(document, { key: "Escape" });
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.ok(view.queryByRole("dialog", { name: "Chapter steps" }));
  } finally {
    modal.remove();
  }
  fireEvent.keyDown(document, { key: "Escape" });
  await waitForGone(() => view.queryByRole("dialog", { name: "Chapter steps" }));
});

test("phone step menu is a sheet that closes on Escape", async () => {
  setPhone(true);
  const view = render(<Harness />);
  const sheet = await openMenu(view);
  assert.equal(sheet.getAttribute("aria-modal"), "true");
  fireEvent.keyDown(document, { key: "Escape" });
  await waitForGone(() => view.queryByRole("dialog", { name: "Chapter steps" }));
});

// The reader attaches onFollow to the next chapter link once the quiz is
// passed and the chapter is not finished yet, so the finish flow (and its
// loop-complete Insight Points claim) runs before the next chapter opens.
function finishingNeighbours(onFollow: () => void): ChapterNeighbours {
  return {
    prev: { order: 1, title: "One", href: "/book/library/b/chapter/c1", locked: false },
    next: { order: 3, title: "Three", href: "/book/library/b/chapter/c3", locked: false, onFollow },
  };
}

test("the pager's next chapter link runs the finish flow before it navigates", () => {
  let finished = 0;
  const view = render(<ChapterPager neighbours={finishingNeighbours(() => (finished += 1))} />);
  fireEvent.click(view.getByRole("link", { name: "Chapter 1" }));
  assert.equal(finished, 0);
  fireEvent.click(view.getByRole("link", { name: "Chapter 3" }));
  assert.equal(finished, 1);
});

test("the step menu's next chapter row runs the finish flow and closes the menu", async () => {
  setPhone(false);
  let finished = 0;
  const view = render(<Harness neighbours={finishingNeighbours(() => (finished += 1))} />);
  const menu = await openMenu(view);
  fireEvent.click(within(menu).getByRole("link", { name: /Next chapter/ }));
  assert.equal(finished, 1);
  await waitForGone(() => view.queryByRole("dialog", { name: "Chapter steps" }));
});
