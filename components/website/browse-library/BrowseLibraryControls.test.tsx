import "../../../tests/_lib/dom";

import assert from "node:assert/strict";
import { after, afterEach, test } from "node:test";
import { useState } from "react";
import { act, cleanup, fireEvent, render, waitFor, within } from "@testing-library/react";
import { BrowseLibraryFilterBar } from "./BrowseLibraryFilterBar";
import { BrowseLibrarySearchBar } from "./BrowseLibrarySearchBar";
import type { LibraryBook, SortOption } from "./browse-library-core";

const originalIntersectionObserver = globalThis.IntersectionObserver;
const originalSelf = Object.getOwnPropertyDescriptor(globalThis, "self");

Object.defineProperty(globalThis, "self", {
  configurable: true,
  writable: true,
  value: window,
});

class TestIntersectionObserver {
  observe() {}
  disconnect() {}
  unobserve() {}
  takeRecords() { return []; }
}

Object.defineProperty(globalThis, "IntersectionObserver", {
  configurable: true,
  writable: true,
  value: TestIntersectionObserver,
});

const books: LibraryBook[] = [
  {
    id: "deep-work",
    title: "Deep Work",
    author: "Cal Newport",
    category: "Focus",
    chapters: 8,
    difficulty: "medium",
    estimatedHours: 3,
    description: "A guide to focused work.",
  },
];

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

after(() => {
  if (originalIntersectionObserver) {
    globalThis.IntersectionObserver = originalIntersectionObserver;
  } else {
    Reflect.deleteProperty(globalThis, "IntersectionObserver");
  }
  if (originalSelf) Object.defineProperty(globalThis, "self", originalSelf);
  else Reflect.deleteProperty(globalThis, "self");
});

test("search suggestions stay open when Tab focus moves into a result link", async () => {
  function Harness() {
    const [query, setQuery] = useState("Deep");
    return (
      <>
        <BrowseLibrarySearchBar
          query={query}
          onChange={setQuery}
          books={books}
          onRequestBook={() => {}}
        />
        <button type="button">Outside search</button>
      </>
    );
  }

  const view = render(<Harness />);
  const search = view.getByRole("textbox", { name: "Search books" });

  act(() => search.focus());
  const result = await view.findByRole("link", { name: /Deep Work/ });
  const clear = view.getByRole("button", { name: "Clear search" });
  assert.ok(
    result.compareDocumentPosition(clear) & Node.DOCUMENT_POSITION_FOLLOWING,
    "the first Tab stop after the search input should be a suggestion, before Clear",
  );
  fireEvent.keyDown(search, { key: "Tab" });
  act(() => result.focus());

  await waitFor(() => {
    assert.equal(document.activeElement, result);
    assert.ok(view.getByRole("group", { name: "Search suggestions" }));
  });
  assert.equal(result.tagName, "A");
  assert.equal(result.getAttribute("href"), "/book/library/deep-work");

  fireEvent.keyDown(result, { key: "Enter" });
  assert.equal(document.activeElement, result);

  act(() => view.getByRole("button", { name: "Outside search" }).focus());
  await waitFor(() => assert.equal(view.queryByRole("group", { name: "Search suggestions" }), null));
});

test("category buttons expose pressed state and native sort retains selection", () => {
  let selectedCategory = "All";
  let selectedSort: SortOption = "popular";
  const view = render(
    <BrowseLibraryFilterBar
      categories={[{ name: "Focus", count: 1 }]}
      activeCategory="All"
      onCategoryChange={(category) => { selectedCategory = category; }}
      sortBy={selectedSort}
      onSortChange={(sort) => { selectedSort = sort; }}
      resultCount={1}
      totalCount={1}
    />,
  );

  const categoryGroup = view.getByRole("group", { name: "Filter by category" });
  const categoryButtons = within(categoryGroup).getAllByRole("button");
  assert.equal(view.queryByRole("tablist"), null);
  assert.equal(view.queryByRole("tab"), null);
  assert.equal(categoryButtons[0]?.getAttribute("aria-pressed"), "true");
  assert.equal(categoryButtons[1]?.getAttribute("aria-pressed"), "false");
  for (const category of categoryButtons) {
    assert.match(category.className, /min-h-\[44px\]/);
  }
  fireEvent.click(categoryButtons[1]!);
  assert.equal(selectedCategory, "Focus");

  const sort = view.getByRole("combobox", { name: "Sort books" });
  assert.equal(sort.tagName, "SELECT");
  assert.match(sort.className, /min-h-\[44px\]/);
  act(() => sort.focus());
  fireEvent.change(sort, { target: { value: "alphabetical" } });
  assert.equal(selectedSort, "alphabetical");
  assert.equal(document.activeElement, sort);
  assert.equal(view.queryByRole("listbox"), null);
});
