import "../../../tests/_lib/dom";

import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { AskBookDrawer } from "./AskBookDrawer";

afterEach(cleanup);

test("Ask drawer closes on Escape, but not while a modal dialog is open above it", () => {
  const changes: boolean[] = [];
  render(
    <AskBookDrawer bookId="b" bookTitle="Book" open onOpenChange={(open) => changes.push(open)} />,
  );
  const notes = document.createElement("div");
  notes.setAttribute("role", "dialog");
  notes.setAttribute("aria-modal", "true");
  document.body.appendChild(notes);
  try {
    fireEvent.keyDown(document, { key: "Escape" });
    assert.deepEqual(changes, []);
  } finally {
    notes.remove();
  }
  fireEvent.keyDown(document, { key: "Escape" });
  assert.deepEqual(changes, [false]);
});
