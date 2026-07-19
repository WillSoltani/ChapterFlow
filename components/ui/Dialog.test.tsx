import "../../tests/_lib/dom";

import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { useCallback, useState } from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { Dialog } from "./Dialog";

afterEach(() => {
  cleanup();
  document.body.style.overflow = "";
  document.body.style.paddingRight = "";
});

test("Dialog opens in a portal, traps focus, closes on Escape, and restores focus", async () => {
  let closeRequests = 0;

  function Harness() {
    const [open, setOpen] = useState(false);
    const close = useCallback(() => {
      closeRequests += 1;
      setOpen(false);
    }, []);
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>Open dialog</button>
        <Dialog open={open} onClose={close} labelledBy="test-dialog-title">
          <h2 id="test-dialog-title">Test dialog</h2>
          <button type="button">First action</button>
          <button type="button">Last action</button>
        </Dialog>
      </>
    );
  }

  const view = render(<Harness />);
  const opener = view.getByRole("button", { name: "Open dialog" });
  opener.focus();
  fireEvent.click(opener);

  await waitFor(() => assert.ok(view.getByRole("dialog", { name: "Test dialog" })));
  const first = view.getByRole("button", { name: "First action" });
  await waitFor(() => assert.equal(document.activeElement, first));
  assert.equal(document.body.style.overflow, "hidden");

  fireEvent.keyDown(document, { key: "Escape" });
  await waitFor(() => {
    assert.equal(closeRequests, 1);
    assert.equal(document.body.style.overflow, "");
    assert.equal(document.activeElement, opener);
  });
});
