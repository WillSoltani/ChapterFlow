import assert from "node:assert/strict";
import { test } from "node:test";

import {
  deriveUserState,
  homeShelfBooks,
  isNewUserShelf,
  type WorkspaceStateInput,
} from "./workspace-state-core";

// HOME-06: Home picks its main card in the order new_user → free_limit_reached
// → between_books → returning (only with a current book) → quiz → active.

const reading = { progressPercent: 15, status: "in_progress" as const };
const finished = { progressPercent: 100, status: "completed" as const };

function input(over: Partial<WorkspaceStateInput> = {}): WorkspaceStateInput {
  return {
    currentBook: { currentLoopStep: "summary" },
    userBooks: [reading],
    user: { isPro: false, streakCount: 3 },
    ...over,
  };
}

test("no started books is a new reader", () => {
  assert.equal(deriveUserState(input({ userBooks: [], currentBook: null }), null), "new_user");
});

test("a finished reader with no current book sees 'between books', even with no streak", () => {
  const state = deriveUserState(
    input({ currentBook: null, userBooks: [finished], user: { isPro: true, streakCount: 0 } }),
    null,
  );
  assert.equal(state, "between_books");
});

test("a free reader with no free books left and no current book sees the limit card, even with no streak", () => {
  const state = deriveUserState(
    input({ currentBook: null, userBooks: [finished], user: { isPro: false, streakCount: 0 } }),
    { remainingFreeStarts: 0 },
  );
  assert.equal(state, "free_limit_reached");
});

test("an unknown allowance never shows the limit card", () => {
  const state = deriveUserState(
    input({ currentBook: null, userBooks: [finished], user: { isPro: false, streakCount: 0 } }),
    null,
  );
  assert.equal(state, "between_books");
});

test("'returning' needs a current book", () => {
  assert.equal(
    deriveUserState(input({ user: { isPro: false, streakCount: 0 } }), { remainingFreeStarts: 0 }),
    "returning",
  );
  assert.equal(
    deriveUserState(
      input({ currentBook: null, user: { isPro: false, streakCount: 0 } }),
      { remainingFreeStarts: 1 },
    ),
    "between_books",
  );
});

test("with a streak, the current book drives quiz / active", () => {
  assert.equal(
    deriveUserState(input({ currentBook: { currentLoopStep: "quiz" } }), null),
    "quiz_pending",
  );
  assert.equal(deriveUserState(input(), null), "active_reader");
});

test("books not started leave Home's shelf", () => {
  const shelf = homeShelfBooks([
    { id: "a", progressPercent: 0, status: "not_started" as const },
    { id: "b", progressPercent: 0, status: "in_progress" as const },
    { id: "c", progressPercent: 100, status: "completed" as const },
  ]);
  assert.deepEqual(shelf.map((b) => b.id), ["b", "c"]);
});

test("a reader who only browsed a book page is still new", () => {
  const shelf = homeShelfBooks([{ progressPercent: 0, status: "not_started" as const }]);
  assert.equal(isNewUserShelf(shelf), true);
  assert.equal(deriveUserState(input({ userBooks: shelf, currentBook: null }), null), "new_user");
});

test("a chapter opened (0% done) is not a new reader", () => {
  assert.equal(isNewUserShelf([{ progressPercent: 0, status: "in_progress" }]), false);
});
