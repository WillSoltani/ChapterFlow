import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "fs";
import { resolve } from "path";

import { test } from "./harness.js";
import { STATE_CHAPTERS, writeFixtureBook } from "./helpers.js";
import { makeChapter } from "./helpers.js";
import { CANONICAL_STATE, REPO_ROOT } from "../src/lib/chapterPaths.js";
import { resolveBookIdentifier } from "../src/qc/auto/resolveBook.js";

const INDEX_DIR = resolve(CANONICAL_STATE, "indexes");
const PACKAGES_DIR = resolve(REPO_ROOT, "book-packages");

const BOOKS = [
  "zz-resolve-exact",
  "zz-resolve-title",
  "zz-resolve-ambiguous-a",
  "zz-resolve-ambiguous-b",
];

function cleanup(): void {
  for (const book of BOOKS) {
    rmSync(resolve(INDEX_DIR, `${book}.json`), { force: true });
    rmSync(resolve(PACKAGES_DIR, `${book}.v21.json`), { force: true });
    rmSync(resolve(STATE_CHAPTERS, `${book}-ch01.v21-native.chapter.json`), { force: true });
  }
}

test("qc-auto resolver resolves exact bookId from state indexes", () => {
  try {
    cleanup();
    mkdirSync(INDEX_DIR, { recursive: true });
    writeFileSync(resolve(INDEX_DIR, "zz-resolve-exact.json"), JSON.stringify({ bookId: "zz-resolve-exact" }), "utf8");
    const result = resolveBookIdentifier("zz-resolve-exact");
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.bookId, "zz-resolve-exact");
  } finally {
    cleanup();
  }
});

test("qc-auto resolver resolves title from v21 package", () => {
  try {
    cleanup();
    mkdirSync(PACKAGES_DIR, { recursive: true });
    writeFileSync(resolve(PACKAGES_DIR, "zz-resolve-title.v21.json"), JSON.stringify({ book: { title: "Resolver Fixture Title" } }), "utf8");
    const result = resolveBookIdentifier("Resolver Fixture Title");
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.bookId, "zz-resolve-title");
  } finally {
    cleanup();
  }
});

test("qc-auto resolver rejects ambiguous title matches", () => {
  try {
    cleanup();
    mkdirSync(PACKAGES_DIR, { recursive: true });
    writeFileSync(resolve(PACKAGES_DIR, "zz-resolve-ambiguous-a.v21.json"), JSON.stringify({ book: { title: "Duplicate Fixture Title" } }), "utf8");
    writeFileSync(resolve(PACKAGES_DIR, "zz-resolve-ambiguous-b.v21.json"), JSON.stringify({ book: { title: "Duplicate Fixture Title" } }), "utf8");
    const result = resolveBookIdentifier("Duplicate Fixture Title");
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.reason, "ambiguous");
      assert.equal(result.candidates?.length, 2);
    }
  } finally {
    cleanup();
  }
});

test("qc-auto resolver rejects missing books", () => {
  cleanup();
  const result = resolveBookIdentifier("definitely missing resolver fixture");
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "not_found");
});

test("qc-auto resolver sees slug from chapter files", () => {
  try {
    cleanup();
    writeFixtureBook(STATE_CHAPTERS, [makeChapter("zz-resolve-exact", 1)]);
    const result = resolveBookIdentifier("ZZ Resolve Exact");
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.bookId, "zz-resolve-exact");
  } finally {
    cleanup();
  }
});
