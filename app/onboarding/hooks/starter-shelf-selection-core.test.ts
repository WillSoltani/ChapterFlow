import assert from "node:assert/strict";
import { test } from "node:test";
import type { OnboardingBook } from "../data/books";
import {
  MAX_STARTER_SHELF_PICKS,
  advanceStarterShelfSelection,
  buildStarterShelf,
  createStarterShelfSelection,
  getStarterShelfFillerPicks,
} from "./starter-shelf-selection-core";

function book(id: string): OnboardingBook {
  return {
    id,
    title: id.toUpperCase(),
    author: "Author",
    category: "Category",
    difficulty: "Easy",
    estimatedHours: 1,
    gradient: "linear-gradient(black, white)",
    interests: [],
    tagline: "Tagline",
    cover: null,
  };
}

test("right swipes keep books in swipe order", () => {
  const first = advanceStarterShelfSelection(
    createStarterShelfSelection(),
    book("first"),
    "right",
  );
  const second = advanceStarterShelfSelection(first, book("second"), "right");

  assert.deepEqual(second.selectedBooks.map(({ id }) => id), ["first", "second"]);
  assert.equal(second.currentIndex, 2);
  assert.equal(second.isComplete, false);
});

test("the third keep completes the shelf with exactly three ordered books", () => {
  let selection = createStarterShelfSelection();
  for (const id of ["first", "second", "third"]) {
    selection = advanceStarterShelfSelection(selection, book(id), "right");
  }

  assert.equal(selection.isComplete, true);
  assert.equal(selection.selectedBooks.length, MAX_STARTER_SHELF_PICKS);
  assert.deepEqual(selection.selectedBooks.map(({ id }) => id), [
    "first",
    "second",
    "third",
  ]);
});

test("left swipes record each rejected id only once", () => {
  const first = advanceStarterShelfSelection(
    createStarterShelfSelection(),
    book("rejected"),
    "left",
  );
  const repeated = advanceStarterShelfSelection(first, book("rejected"), "left");

  assert.deepEqual(repeated.rejectedIds, ["rejected"]);
});

test("filler picks exclude selected and rejected books", () => {
  const candidates = [book("selected"), book("rejected"), book("next"), book("last")];
  const filler = getStarterShelfFillerPicks(
    candidates,
    [book("selected")],
    ["rejected"],
    2,
  );

  assert.deepEqual(filler.map(({ id }) => id), ["next", "last"]);
});

test("the final shelf keeps selected books first and caps the result at three", () => {
  const finalShelf = buildStarterShelf(
    [book("selected-first"), book("selected-second")],
    [book("filler-first"), book("filler-extra")],
  );

  assert.deepEqual(finalShelf.map(({ id }) => id), [
    "selected-first",
    "selected-second",
    "filler-first",
  ]);
});
