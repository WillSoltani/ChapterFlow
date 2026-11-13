import "../../../../../../../tests/_lib/dom";

import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { cleanup, render } from "@testing-library/react";
import { ReaderAccessState } from "./ReaderAccessState";
import type { useReaderAccess } from "../hooks/useReaderAccess";

// next/link's idle-callback fallback reads `self`, which jsdom globals omit.
Object.defineProperty(globalThis, "self", { configurable: true, writable: true, value: globalThis });

afterEach(() => cleanup());

type Access = ReturnType<typeof useReaderAccess>;

function access(overrides: Partial<Access>): Access {
  return {
    entry: { title: "Book", author: "" },
    chapters: [],
    chapterNumber: 5,
    baseChapter: undefined,
    chapter: undefined,
    contentHydrated: true,
    contentStatus: null,
    errorCode: null,
    servingOfflineCopy: false,
    initialProgressFloor: undefined,
    hasAttestedSeed: false,
    effectiveOnboardingComplete: true,
    bookAccessStatus: "ready",
    bookAccessMessage: null,
    paywallHit: false,
    initialReaderReady: false,
    retryContent: () => {},
    ...overrides,
  } as Access;
}

function renderState(overrides: Partial<Access>, currentChapterNumber?: number) {
  return render(
    <ReaderAccessState
      bookId="atomic-habits"
      pathname="/book/library/atomic-habits/chapter/ch-5"
      search=""
      onboardingHydrated
      progressHydrated
      chapterHydrated
      isLocked={false}
      currentChapterNumber={currentChapterNumber}
      access={access(overrides)}
    />,
  );
}

test("a chapter the server reports as locked shows the Chapter locked card with Continue chapter N", () => {
  const view = renderState({ contentStatus: 403, errorCode: "chapter_locked" }, 3);
  assert.ok(view.getByRole("heading", { name: "Chapter locked" }));
  assert.equal(view.queryByText(/couldn.t be confirmed/), null);
  const cont = view.getByRole("link", { name: "Continue chapter 3" });
  assert.equal(cont.getAttribute("href"), "/book/library/atomic-habits/chapter/3");
  assert.ok(view.getByRole("link", { name: "Back to chapters" }));
});

test("the locked card never links to the locked chapter itself", () => {
  const view = renderState({ contentStatus: 403, errorCode: "chapter_locked" }, 5);
  assert.ok(view.getByRole("heading", { name: "Chapter locked" }));
  assert.equal(view.queryByRole("link", { name: /Continue chapter/ }), null);
});

test("a 403 without the locked code keeps the generic no-access card", () => {
  const view = renderState({ contentStatus: 403, errorCode: "book_not_started" }, 3);
  assert.ok(view.getByRole("heading", { name: "You don't have access to this chapter" }));
});

test("a 402 book-limit answer on the chapter shows the paywall card", () => {
  const view = renderState({ contentStatus: 402, errorCode: "paywall_book_limit" }, 3);
  assert.ok(view.getByRole("heading", { name: /Unlimited books for/ }));
  assert.equal(view.queryByText(/couldn.t be confirmed/), null);
  const upgrade = view.getAllByRole("link").find((link) => link.getAttribute("href") === "/book/settings?upgrade=1");
  assert.ok(upgrade, "upgrade link goes to the settings subscription card");
});

test("ACCT-12: the reader's upgrade button says Upgrade to Pro and qualifies the trial", () => {
  const cases: Array<Partial<Access>> = [
    { contentStatus: 402, errorCode: "paywall_book_limit" },
    { bookAccessStatus: "blocked", paywallHit: true },
  ];
  for (const overrides of cases) {
    const view = renderState(overrides);
    const upgrade = view.getByRole("link", { name: "Upgrade to Pro" });
    assert.equal(upgrade.getAttribute("href"), "/book/settings?upgrade=1");
    assert.ok(view.getByText("New subscribers get 14 days free."));
    assert.equal(view.queryByText(/free trial/i), null);
    assert.equal(view.queryByText(/first 14 days are free/), null);
    view.unmount();
  }
});
