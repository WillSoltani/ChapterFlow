import { test } from "node:test";
import assert from "node:assert/strict";
import { tokenizeQuery, scoreBookMatch, SEARCH_STOP_WORDS } from "./useGlobalSearch";

test("tokenizeQuery drops stop-words so common words can't flood the panel", () => {
  // "by" is the headline bug: indexed book text is "<title> by <author>".
  assert.deepEqual(tokenizeQuery("by"), []);
  assert.deepEqual(tokenizeQuery("the"), []);
  assert.deepEqual(tokenizeQuery("the by and of to"), []);
  // Stop-words are stripped but real terms survive.
  assert.deepEqual(tokenizeQuery("the power of habit"), ["power", "habit"]);
  assert.deepEqual(tokenizeQuery("art of war"), ["art", "war"]);
});

test("tokenizeQuery lowercases and drops sub-2-char tokens", () => {
  assert.deepEqual(tokenizeQuery("  DEEP   Work "), ["deep", "work"]);
  assert.deepEqual(tokenizeQuery("a x deep"), ["deep"]); // "a" stop-word, "x" too short
});

test("SEARCH_STOP_WORDS contains the reported flood words", () => {
  for (const w of ["by", "the", "and", "of", "to"]) {
    assert.ok(SEARCH_STOP_WORDS.has(w), `expected "${w}" to be a stop-word`);
  }
});

test("scoreBookMatch ranks title hits above author-only hits", () => {
  const titleHit = scoreBookMatch("Atomic Habits", "James Clear", ["habits"]);
  const authorHit = scoreBookMatch("Deep Work", "James Clear", ["james"]);
  assert.ok(titleHit > 0, "title term should score");
  assert.ok(authorHit > 0, "author term should score");
  assert.ok(titleHit > authorHit, "a title match must outrank an author-only match");
});

test("scoreBookMatch no longer surfaces books via hidden tags (the 'habit' flood fix)", () => {
  // These books matched "habit" only through tags pre-fix; with title+author-only
  // matching they must score 0, while a genuine title match scores.
  assert.equal(scoreBookMatch("Deep Work", "Cal Newport", ["habit"]), 0);
  assert.equal(scoreBookMatch("Antifragile", "Nassim Nicholas Taleb", ["habit"]), 0);
  assert.equal(scoreBookMatch("Crucial Conversations", "Kerry Patterson", ["habit"]), 0);
  assert.ok(scoreBookMatch("The Power of Habit", "Charles Duhigg", ["habit"]) > 0);
});

test("scoreBookMatch returns 0 when no term matches", () => {
  assert.equal(scoreBookMatch("Atomic Habits", "James Clear", ["quantum"]), 0);
});

test("scoreBookMatch rewards exact whole-word matches over partials", () => {
  const wholeWord = scoreBookMatch("Grit", "Angela Duckworth", ["grit"]); // exact word
  const partial = scoreBookMatch("Integrity", "Henry Cloud", ["grit"]); // substring of "inteGRITy"
  assert.ok(wholeWord > partial, "whole-word title match should beat a substring match");
});
