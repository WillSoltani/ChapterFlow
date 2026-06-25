/**
 * Per-book progress reset must sweep the per-chapter learning-state rows
 * (BOOK_USER_QUIZ_STATE / BOOK_USER_LOOP). The sweep is a single
 * `begins_with(SK, <prefix>)` Query over the user partition, so the prefix
 * builders are the load-bearing correctness boundary:
 *
 *  1. Each prefix must match EVERY per-chapter row for the target book…
 *  2. …and NOTHING for a sibling book whose id is a string prefix of the
 *     target's (the trailing `#` is what guarantees this).
 *
 * Regression for A5: a reset that did NOT clear these rows left the chapter-1
 * quiz-state at passed:true, and the quiz-submit short-circuit (`quizState?.passed`)
 * then prevented the reader from ever re-unlocking chapter 2.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  quizStateSk,
  quizStateSkPrefix,
  loopSk,
  loopSkPrefix,
} from "./keys";

test("quizStateSkPrefix matches every chapter's quiz-state SK for the book", () => {
  const bookId = "atomic-habits";
  const prefix = quizStateSkPrefix(bookId);
  for (const ch of [1, 2, 10, 42]) {
    assert.ok(
      quizStateSk(bookId, ch).startsWith(prefix),
      `quizStateSk ch ${ch} must start with the book prefix`,
    );
  }
});

test("loopSkPrefix matches every chapter's loop SK for the book", () => {
  const bookId = "atomic-habits";
  const prefix = loopSkPrefix(bookId);
  for (const ch of [1, 2, 10, 42]) {
    assert.ok(loopSk(bookId, ch).startsWith(prefix), `loopSk ch ${ch} must start with the book prefix`);
  }
});

test("a sibling book whose id is a string-prefix of the target is NOT swept", () => {
  // "the-mountain" is a string prefix of "the-mountain-is-you". Without the
  // trailing '#', begins_with would also match the sibling's rows and wipe the
  // wrong book's learning state. The '#' delimiter prevents that.
  const target = "the-mountain";
  const sibling = "the-mountain-is-you";

  const quizPrefix = quizStateSkPrefix(target);
  assert.ok(quizStateSk(target, 1).startsWith(quizPrefix));
  assert.ok(
    !quizStateSk(sibling, 1).startsWith(quizPrefix),
    "sibling book's quiz-state must NOT match the target's prefix",
  );

  const loopPrefix = loopSkPrefix(target);
  assert.ok(loopSk(target, 1).startsWith(loopPrefix));
  assert.ok(
    !loopSk(sibling, 1).startsWith(loopPrefix),
    "sibling book's loop row must NOT match the target's prefix",
  );
});

test("quiz-state and loop prefixes are disjoint (one Query can OR them safely)", () => {
  const bookId = "deep-work";
  assert.ok(!quizStateSk(bookId, 1).startsWith(loopSkPrefix(bookId)));
  assert.ok(!loopSk(bookId, 1).startsWith(quizStateSkPrefix(bookId)));
});
