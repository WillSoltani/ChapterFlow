import "../../tests/_lib/dom";

import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { cleanup, render } from "@testing-library/react";
import { ContinueLearningCard } from "./ContinueLearningCard";
import type { ActiveBook } from "./progressTypes";

// next/link's idle-callback fallback reads `self`, which jsdom globals omit.
Object.defineProperty(globalThis, "self", { configurable: true, writable: true, value: globalThis });

afterEach(() => cleanup());

const BOOK: ActiveBook = {
  id: "atomic-habits",
  title: "Atomic Habits",
  author: "James Clear",
  coverUrl: "",
  totalChapters: 20,
  completedChapters: 3,
  currentChapterNumber: 4,
  currentChapterTitle: "CH.04 The Man Who Didn't Look Right",
  currentStep: "summary",
  currentStepNumber: 1,
  lastActivity: "",
  lastActivityDate: "",
  readersCount: 0,
  resumeChapterId: "atomic-habits-ch04",
};

test("C13: Continue names the resume chapter and opens it by number", () => {
  const view = render(<ContinueLearningCard primaryBook={BOOK} otherBooks={[]} />);
  const link = view.getByRole("link", { name: /Continue chapter 4/ });
  assert.equal(link.getAttribute("href"), "/book/library/atomic-habits/chapter/4");
  assert.ok(view.getByText(/Chapter 4 of 20/).textContent?.includes("CH.04 The Man Who Didn't Look Right"));
});

test("C13: a started book with nothing completed continues chapter 1", () => {
  const view = render(
    <ContinueLearningCard
      primaryBook={{ ...BOOK, completedChapters: 0, currentChapterNumber: 1, currentChapterTitle: "CH.01 Start" }}
      otherBooks={[]}
    />,
  );
  const link = view.getByRole("link", { name: /Continue chapter 1/ });
  assert.equal(link.getAttribute("href"), "/book/library/atomic-habits/chapter/1");
});
