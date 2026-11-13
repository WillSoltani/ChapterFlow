import "../../../../../../../tests/_lib/dom";

import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { cleanup, render, screen } from "@testing-library/react";
import { CHAPTER_NOTES_MAX_CHARS } from "@/app/app/api/book/_lib/http-guards-core";
import { NotesDrawer } from "./NotesDrawer";

afterEach(cleanup);

function renderDrawer(notes: string, syncFailed: boolean) {
  return render(
    <NotesDrawer
      open
      onClose={() => {}}
      notes={notes}
      onNotesChange={() => {}}
      onAddNote={() => {}}
      onExport={() => {}}
      onPinTakeaway={() => {}}
      syncFailed={syncFailed}
    />
  );
}

test("the notes box is capped at the server limit and counts characters", () => {
  renderDrawer("Twelve chars", false);
  const box = screen.getByRole("textbox");
  assert.equal(box.getAttribute("maxlength"), String(CHAPTER_NOTES_MAX_CHARS));
  const counter = screen.getByText(`12 / ${CHAPTER_NOTES_MAX_CHARS.toLocaleString()}`);
  assert.equal(box.getAttribute("aria-describedby")?.includes(counter.id), true);
  assert.equal(screen.queryByText("Changes saved on this device only."), null);
});

test("the notes panel says when changes stay on this device", () => {
  renderDrawer("", true);
  assert.ok(screen.getByText("Changes saved on this device only."));
});
