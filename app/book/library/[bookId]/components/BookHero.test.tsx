import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { LibraryBookEntry } from "@/app/book/_lib/library-data";
import { BookHero } from "./BookHero";

const entry = {
  id: "atomic-habits",
  title: "Atomic Habits",
  author: "James Clear",
  category: "Productivity",
  difficulty: "Medium",
  synopsis: "Small habits.",
  status: "not_started",
  progressPercent: 0,
  chaptersTotal: 20,
  chaptersCompleted: 0,
  isNew: false,
  lastActivityAt: new Date(0).toISOString(),
} as unknown as LibraryBookEntry;

function render(progress: { progressPercent: number; completedCount: number; currentChapterOrder: number }) {
  return renderToStaticMarkup(
    createElement(BookHero, {
      entry,
      avgScore: 0,
      unlockedCount: 1,
      totalCount: 20,
      appliedCount: 0,
      firstChapterMinutes: 14,
      onContinue: () => {},
      isSaved: false,
      onToggleSaved: () => {},
      accessBlocked: false,
      freeStartsLeft: 2,
      ...progress,
    }),
  );
}

test("HOME-21: a book not started says it uses one of the free books", () => {
  const html = render({ progressPercent: 0, completedCount: 0, currentChapterOrder: 1 });
  assert.match(html, /Starting this book uses 1 of your 2 free books/);
});

test("HOME-21: a book already started never says starting it uses a free book", () => {
  const html = render({ progressPercent: 15, completedCount: 3, currentChapterOrder: 4 });
  assert.match(html, /Continue chapter 4/);
  assert.doesNotMatch(html, /Starting this book uses/);
});
