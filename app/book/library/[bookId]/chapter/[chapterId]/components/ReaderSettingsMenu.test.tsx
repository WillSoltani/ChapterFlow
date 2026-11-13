import "../../../../../../../tests/_lib/dom";

import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { ReaderSettingsMenu } from "./ReaderSettingsMenu";

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

function menu(onClose: () => void) {
  return (
    <ReaderSettingsMenu
      open
      onClose={onClose}
      learningMode="standard"
      onChangeLearningMode={() => {}}
      showDepthSelector={false}
      focusMode={false}
      onToggleFocus={() => {}}
      fontSize={16}
      onChangeFontSize={() => {}}
      lineSpacing="comfortable"
      onChangeLineSpacing={() => {}}
      contentWidth={800}
      onChangeContentWidth={() => {}}
    />
  );
}

// The reader header uses backdrop-filter, which makes it the containing block
// for position:fixed. On a phone the sheet must therefore live outside it.
test("on a phone the settings sheet renders in document.body, outside the header", async () => {
  setPhone(true);
  const view = render(<header data-testid="hdr">{menu(() => {})}</header>);
  const dialog = await waitFor(() => view.getByRole("dialog", { name: "Reading settings" }));
  assert.equal(view.getByTestId("hdr").contains(dialog), false);
  assert.ok(document.body.contains(dialog));
});

test("on desktop the settings dropdown stays inside its anchor", async () => {
  setPhone(false);
  const view = render(<header data-testid="hdr">{menu(() => {})}</header>);
  const dialog = await waitFor(() => view.getByRole("dialog", { name: "Reading settings" }));
  assert.equal(view.getByTestId("hdr").contains(dialog), true);
});

test("phone sheet has a close control and closes on Escape", async () => {
  setPhone(true);
  let closed = 0;
  const view = render(<header>{menu(() => (closed += 1))}</header>);
  await waitFor(() => view.getByRole("dialog", { name: "Reading settings" }));
  fireEvent.click(view.getByRole("button", { name: "Close settings" }));
  assert.equal(closed, 1);
  fireEvent.keyDown(document, { key: "Escape" });
  assert.equal(closed, 2);
});
