import { test } from "node:test";
import assert from "node:assert/strict";

import journeys from "@/content/journeys/journeys.json";
import { BOOKS_CATALOG } from "@/app/book/data/booksCatalog";
import type { JourneyDefinition } from "@/app/app/api/book/_lib/types";

// Every bookId referenced by a Learning Journey must resolve to a book the app
// can actually render. The journey detail route derives each step's
// title/cover/link from the published catalog (me/journeys/[journeyId]/route.ts
// -> listPublishedLibraryCatalog), so an unresolvable bookId surfaces as the raw
// slug, its `/book/library/<id>` link 404s, and — because the completion gate
// requires every book done — the journey can never reach 100%, stranding its
// badge + bonus IP. That is JOURNEY-1 (`decision-mastery -> black-box-thinking`).
//
// The runtime published catalog is AWS-backed (DynamoDB + S3) and not reachable
// from a unit test, so this guard asserts against BOOKS_CATALOG
// (booksCatalog.metadata.json) — the curated catalog the app's non-AWS path
// treats as the published set. It is the tightest static proxy: it rejects both
// never-authored ids and authored-but-uncatalogued ones (book-packages/ would be
// too lenient, including unpublished WIP packages that 404 at runtime).

const journeyDefs = journeys as JourneyDefinition[];
const catalogIds = new Set(BOOKS_CATALOG.map((book) => book.id));

test("journey + catalog fixtures are non-empty (guards against a vacuous pass)", () => {
  assert.ok(journeyDefs.length > 0, "expected at least one journey definition");
  assert.ok(catalogIds.size > 0, "expected a non-empty catalog");
});

for (const journey of journeyDefs) {
  for (const entry of journey.books) {
    test(`journey "${journey.journeyId}" -> "${entry.bookId}" resolves to a catalog book`, () => {
      assert.ok(
        catalogIds.has(entry.bookId),
        `Journey "${journey.journeyId}" references "${entry.bookId}", which is not in the curated catalog (booksCatalog.metadata.json). ` +
          `Add the book to the catalog or remove the journey entry.`,
      );
    });
  }
}
