import "../../tests/_lib/dom";

import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { cleanup, render, screen } from "@testing-library/react";
import { HeroSessionCard } from "./HeroSessionCard";

// next/link's idle-callback fallback reads `self`, which jsdom globals omit.
Object.defineProperty(globalThis, "self", { configurable: true, writable: true, value: globalThis });

// D4 / C13: Home's main card opens the chapter it names and keeps the
// dashboard return (`?from=dashboard`).

afterEach(cleanup);

const currentBook = {
  id: "atomic-habits",
  title: "Atomic Habits",
  author: "James Clear",
  coverUrl: "/book-covers/atomic-habits.webp",
  currentChapter: 4,
  totalChapters: 20,
  progressPercent: 15,
  currentLoopStep: "summary" as const,
  estimatedMinutes: 12,
};

test("active reader: Continue chapter N links to chapter N with ?from=dashboard", () => {
  render(
    <HeroSessionCard userState="active_reader" currentBook={currentBook} firstName="Sam" />,
  );
  const link = screen.getByText("Continue chapter 4").closest("a");
  assert.ok(link, "the CTA is a link");
  assert.equal(
    link.getAttribute("href"),
    "/book/library/atomic-habits/chapter/4?from=dashboard",
  );
});

// LIVE-21: one starter book reads "1 book", not "1 books".
test("a one-book starter shelf says 'We picked 1 book'", () => {
  render(
    <HeroSessionCard
      userState="new_user"
      currentBook={null}
      firstName="Sam"
      starterShelfBooks={[
        { id: "atomic-habits", title: "Atomic Habits", author: "James Clear", coverUrl: "" },
      ]}
    />,
  );
  assert.ok(screen.getByText("We picked 1 book based on your interests"));
});
