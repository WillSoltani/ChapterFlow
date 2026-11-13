import { test } from "node:test";
import assert from "node:assert/strict";
import { BookClientError } from "@/lib/client/book-api";
import { ERROR_CODES } from "@/app/app/api/book/_lib/errors";
import { ERROR_MESSAGES, getBookErrorMessage } from "./error-messages";

test("every published server error code has a reader message", () => {
  for (const code of Object.values(ERROR_CODES)) {
    const message = ERROR_MESSAGES[code];
    assert.ok(message && message.trim().length > 0, `${code} has a message`);
  }
});

test("reader messages read like sentences, not developer strings", () => {
  for (const [code, message] of Object.entries(ERROR_MESSAGES)) {
    assert.match(message, /^[A-Z]/, `${code} starts with a capital`);
    assert.match(message, /[.!]$/, `${code} ends with a full stop`);
    assert.doesNotMatch(message, /[_{}[\]]|\bnull\b|\bundefined\b/, `${code} has no code-like text`);
  }
});

test("a mapped code shows the reader message instead of the server text", () => {
  const err = new BookClientError("responses must answer exactly the 5 assigned question(s).", 400, "invalid_answers");
  assert.equal(getBookErrorMessage(err), ERROR_MESSAGES.invalid_answers);
  const stale = new BookClientError("raw", 409, "quiz_session_stale");
  assert.equal(getBookErrorMessage(stale), ERROR_MESSAGES.quiz_session_stale);
});

test("the existing mapped codes keep their messages", () => {
  assert.equal(ERROR_MESSAGES.unauthenticated, "Your session has expired. Please sign in again.");
  assert.equal(ERROR_MESSAGES.chapter_locked, "Complete the previous chapter to unlock this one.");
  assert.equal(ERROR_MESSAGES.server_error, "Something went wrong. Please try again.");
});

test("an unmapped code falls back to the server message; a plain error to its text", () => {
  assert.equal(getBookErrorMessage(new BookClientError("Server says hi.", 400, "not_a_known_code")), "Server says hi.");
  assert.equal(getBookErrorMessage(new Error("plain")), "plain");
  assert.equal(getBookErrorMessage(null), ERROR_MESSAGES.server_error);
});
