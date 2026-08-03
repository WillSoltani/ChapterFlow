import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import {
  BOOK_DETAIL_CACHE_CONTROL,
  CONCEPT_GRAPH_CACHE_CONTROL,
} from "./cache-control-core";

const root = process.cwd();
const source = (relativePath: string) =>
  readFileSync(path.join(root, relativePath), "utf8");

test("book-detail cache-control is public with a bounded freshness window", () => {
  assert.ok(BOOK_DETAIL_CACHE_CONTROL.startsWith("public"));
  assert.match(BOOK_DETAIL_CACHE_CONTROL, /max-age=\d+/);
  assert.match(BOOK_DETAIL_CACHE_CONTROL, /stale-while-revalidate=\d+/);
});

test("concept-graph cache-control is private (auth-gated route must never enter a shared cache)", () => {
  assert.ok(CONCEPT_GRAPH_CACHE_CONTROL.startsWith("private"));
  assert.ok(!CONCEPT_GRAPH_CACHE_CONTROL.includes("s-maxage"));
  assert.ok(!CONCEPT_GRAPH_CACHE_CONTROL.includes("public"));
});

test("book-detail route sets the Cache-Control header via the shared constant", () => {
  const routeSource = source("app/app/api/book/books/[bookId]/route.ts");
  assert.ok(routeSource.includes("BOOK_DETAIL_CACHE_CONTROL"));
  assert.match(routeSource, /headers\.set\(\s*"Cache-Control"/);
});

test("concept-graph route sets the Cache-Control header via the shared constant", () => {
  const routeSource = source(
    "app/app/api/book/books/[bookId]/concept-graph/route.ts"
  );
  assert.ok(routeSource.includes("CONCEPT_GRAPH_CACHE_CONTROL"));
  assert.match(routeSource, /headers\.set\(\s*"Cache-Control"/);
});
