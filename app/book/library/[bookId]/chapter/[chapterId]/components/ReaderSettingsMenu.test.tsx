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

function menu(
  onClose: () => void,
  overrides: Partial<React.ComponentProps<typeof ReaderSettingsMenu>> = {},
) {
  return (
    <ReaderSettingsMenu
      open
      onClose={onClose}
      activeDepth="standard"
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
      {...overrides}
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

test("settings menu leaves Escape to a modal dialog open above it", async () => {
  setPhone(false);
  let closed = 0;
  const view = render(<header>{menu(() => (closed += 1))}</header>);
  await waitFor(() => view.getByRole("dialog", { name: "Reading settings" }));
  const modal = document.createElement("div");
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  document.body.appendChild(modal);
  try {
    fireEvent.keyDown(document, { key: "Escape" });
    assert.equal(closed, 0);
  } finally {
    modal.remove();
  }
  fireEvent.keyDown(document, { key: "Escape" });
  assert.equal(closed, 1);
});

test("modes use the Settings names, with no 'recommended' badge", async () => {
  setPhone(false);
  const view = render(<header>{menu(() => {})}</header>);
  await waitFor(() => view.getByRole("dialog", { name: "Reading settings" }));
  for (const name of [/Lite/, /Standard/, /Deeper/]) assert.ok(view.getByRole("button", { name }));
  assert.equal(view.queryByText("REC"), null);
  assert.equal(view.queryByText(/Guided|Challenge|recommended/i), null);
});

test("the highlighted mode is the depth the reader actually gets", async () => {
  setPhone(false);
  const picked: string[] = [];
  const view = render(
    <header>
      {menu(() => {}, {
        activeDepth: "simple",
        onChangeLearningMode: (mode) => picked.push(mode),
      })}
    </header>,
  );
  await waitFor(() => view.getByRole("dialog", { name: "Reading settings" }));
  const lite = view.getByRole("button", { name: /Lite/ });
  assert.equal(lite.getAttribute("aria-pressed"), "true");
  assert.equal(view.getByRole("button", { name: /Standard/ }).getAttribute("aria-pressed"), "false");
  // Tapping the highlighted option still reports it (it confirms the choice).
  fireEvent.click(lite);
  fireEvent.click(view.getByRole("button", { name: /Deeper/ }));
  assert.deepEqual(picked, ["guided", "challenge"]);
});

test("spacing and typeface use the Settings names and offer OpenDyslexic", async () => {
  setPhone(false);
  const fonts: string[] = [];
  const view = render(
    <header>
      {menu(() => {}, {
        fontFamily: "opendyslexic",
        onChangeFontFamily: (value) => fonts.push(value),
      })}
    </header>,
  );
  await waitFor(() => view.getByRole("dialog", { name: "Reading settings" }));
  assert.equal(view.getByRole("button", { name: "Comfortable" }).getAttribute("aria-pressed"), "true");
  assert.equal(view.queryByText("Cozy"), null);
  assert.ok(view.getByRole("button", { name: "Sans-Serif" }));
  const dyslexic = view.getByRole("button", { name: "OpenDyslexic" });
  assert.equal(dyslexic.getAttribute("aria-pressed"), "true");
  assert.equal(view.getByRole("button", { name: "Sans-Serif" }).getAttribute("aria-pressed"), "false");
  fireEvent.click(view.getByRole("button", { name: "Serif" }));
  assert.deepEqual(fonts, ["serif"]);
});
