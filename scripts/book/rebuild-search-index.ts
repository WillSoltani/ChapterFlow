#!/usr/bin/env tsx

/**
 * Rebuild the production global-search index. Reads the current published
 * catalog from DynamoDB, fetches each book's manifest at its currentPublishedVersion,
 * and writes a flat search index to S3 at book-content/library/search-index.json.
 *
 *   set -a; source .env.local; set +a
 *   npx tsx scripts/book/rebuild-search-index.ts
 */

import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

function installServerOnlyShim(): () => void {
  const Module = require("node:module") as {
    _load: (request: string, parent: unknown, isMain: boolean) => unknown;
  };
  const originalLoad = Module._load;
  Module._load = function patchedLoad(
    request: string,
    parent: unknown,
    isMain: boolean,
  ) {
    if (request === "server-only") return {};
    return originalLoad.call(this, request, parent, isMain);
  };
  return () => {
    Module._load = originalLoad;
  };
}

async function main() {
  const restore = installServerOnlyShim();
  const { rebuildSearchIndex } = await import(
    "@/app/app/api/book/admin/books/[bookId]/versions/[version]/publish/search-index-builder"
  );
  restore();

  console.log("Rebuilding search index ...");
  // rebuildSearchIndex THROWS if any per-book/per-chapter read failed (it refuses
  // to overwrite the live index with a partial result); the main().catch below
  // turns that into a non-zero exit instead of a false "success".
  const result = await rebuildSearchIndex();
  console.log(
    `✓ Wrote ${result.documentCount} documents (${result.booksConsidered} books) to s3://...book-content/library/search-index.json`,
  );
}

main().catch((err) => {
  console.error("✗ Rebuild failed:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
