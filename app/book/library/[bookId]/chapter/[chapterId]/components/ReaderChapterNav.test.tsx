import "../../../../../../../tests/_lib/dom";

import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { useRef, useState } from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { ReaderStepMenu } from "./ReaderChapterNav";

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
function Harness() {
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
        neighbours={{ prev: null, next: null }}
      />
      <button type="button">Elsewhere</button>
    </>
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
  await waitFor(() => assert.equal(view.queryByRole("dialog", { name: "Chapter steps" }), null));
  assert.equal(document.activeElement, view.getByRole("button", { name: "Steps" }));
});

test("desktop popover closes on an outside click and returns focus to its trigger", async () => {
  setPhone(false);
  const view = render(<Harness />);
  await openMenu(view);
  fireEvent.mouseDown(view.getByRole("button", { name: "Elsewhere" }));
  await waitFor(() => assert.equal(view.queryByRole("dialog", { name: "Chapter steps" }), null));
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
  await waitFor(() => assert.equal(view.queryByRole("dialog", { name: "Chapter steps" }), null));
});

test("phone step menu is a sheet that closes on Escape", async () => {
  setPhone(true);
  const view = render(<Harness />);
  const sheet = await openMenu(view);
  assert.equal(sheet.getAttribute("aria-modal"), "true");
  fireEvent.keyDown(document, { key: "Escape" });
  await waitFor(() => assert.equal(view.queryByRole("dialog", { name: "Chapter steps" }), null));
});
