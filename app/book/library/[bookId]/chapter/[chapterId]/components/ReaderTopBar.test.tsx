import "../../../../../../../tests/_lib/dom";

import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { createRef, useState } from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { ReaderTopBar } from "./ReaderTopBar";

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
  window.history.replaceState(null, "", "/");
});

function Bar({ showProgress = true }: { showProgress?: boolean }) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  return (
    <ReaderTopBar
      bookId="atomic-habits"
      chapterOrder={4}
      totalChapters={20}
      chapterTitle="The Man Who Didn't Look Right"
      contentRef={createRef<HTMLDivElement>()}
      currentPhase="summary"
      completedPhases={new Set()}
      isPhaseAccessible={() => true}
      getLockMessage={() => null}
      onSelectPhase={() => {}}
      neighbours={{ prev: null, next: null }}
      progressOverride={null}
      showProgress={showProgress}
      focusMode={false}
      onToggleFocus={() => {}}
      audioOpen={false}
      onToggleAudio={() => {}}
      audioSlot={null}
      askOpen={false}
      onOpenAsk={() => {}}
      onOpenNotes={() => {}}
      settingsOpen={settingsOpen}
      onToggleSettings={() => setSettingsOpen((open) => !open)}
      settingsMenu={settingsOpen ? <div role="dialog" aria-label="Reading settings" /> : null}
      onOpenShortcuts={() => {}}
      columnMaxWidth="40rem"
    />
  );
}

const stepTrigger = (view: ReturnType<typeof render>) =>
  view.getByRole("button", { name: /Chapter 4, Summary/ });

test("the progress hairline follows the reader's progress-bar setting", () => {
  const shown = render(<Bar />);
  assert.ok(shown.getByRole("progressbar", { name: "Progress through Summary" }));
  shown.unmount();
  const hidden = render(<Bar showProgress={false} />);
  assert.equal(hidden.queryByRole("progressbar"), null);
});

test("Listen has no single-key hint in its tooltip", () => {
  const view = render(<Bar />);
  assert.equal(view.getByRole("button", { name: "Listen to this chapter" }).getAttribute("title"), "Listen");
});

test("Back honours only the known ?from= origin", async () => {
  window.history.replaceState(null, "", "/?from=dashboard");
  const fromDashboard = render(<Bar />);
  await waitFor(() => fromDashboard.getByRole("link", { name: "Back to dashboard" }));
  assert.equal(fromDashboard.getByRole("link", { name: "Back to dashboard" }).getAttribute("href"), "/dashboard");
  fromDashboard.unmount();

  window.history.replaceState(null, "", "/?from=https%3A%2F%2Fexample.com");
  const other = render(<Bar />);
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(other.getByRole("link", { name: "Back to book" }).getAttribute("href"), "/book/library/atomic-habits");
});

test("opening reading settings closes the step menu, and the step menu closes settings", async () => {
  setPhone(false);
  const view = render(<Bar />);
  fireEvent.click(stepTrigger(view));
  await waitFor(() => view.getByRole("dialog", { name: "Chapter steps" }));
  fireEvent.mouseDown(view.getByRole("button", { name: "Reading settings" }));
  fireEvent.click(view.getByRole("button", { name: "Reading settings" }));
  await waitFor(() => assert.equal(view.queryByRole("dialog", { name: "Chapter steps" }), null));
  assert.ok(view.getByRole("dialog", { name: "Reading settings" }));
  // Closing the step menu must not pull focus away from the settings button.
  assert.equal(document.activeElement, view.getByRole("button", { name: "Reading settings" }));

  fireEvent.click(stepTrigger(view));
  await waitFor(() => view.getByRole("dialog", { name: "Chapter steps" }));
  assert.equal(view.queryByRole("dialog", { name: "Reading settings" }), null);
});

test("on a phone the step sheet closes on Escape and focus returns to the trigger", async () => {
  setPhone(true);
  const view = render(<Bar />);
  fireEvent.click(stepTrigger(view));
  await waitFor(() => view.getByRole("dialog", { name: "Chapter steps" }));
  fireEvent.keyDown(document, { key: "Escape" });
  await waitFor(() => assert.equal(view.queryByRole("dialog", { name: "Chapter steps" }), null));
  await waitFor(() => assert.equal(document.activeElement, stepTrigger(view)));
});
