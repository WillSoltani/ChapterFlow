import assert from "node:assert/strict";
import { test } from "node:test";
import { metadata } from "./layout";

test("the dashboard tab is titled Home | ChapterFlow", () => {
  assert.equal(metadata.title, "Home | ChapterFlow");
});
