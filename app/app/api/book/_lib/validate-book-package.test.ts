import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { validateBookPackage } from "./validate-book-package";
import { BookApiError } from "./errors";

const rawPackage = JSON.parse(
  readFileSync(
    join(process.cwd(), "book-packages", "atomic-habits.v21.json"),
    "utf8",
  ),
) as unknown;

test("validateBookPackage accepts a real bundled package", () => {
  const pkg = validateBookPackage(rawPackage);
  assert.ok(pkg.chapters.length > 0, "expected chapters to survive validation");
  assert.equal(typeof pkg.book, "object");
});

test("validateBookPackage rejects malformed input with a BookApiError", () => {
  assert.throws(
    () => validateBookPackage({}),
    (err: unknown) => err instanceof BookApiError,
  );
  assert.throws(() => validateBookPackage(null));
  assert.throws(() =>
    validateBookPackage({ schemaVersion: "x", book: {}, chapters: [] }),
  );
});
