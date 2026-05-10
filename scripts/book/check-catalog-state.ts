#!/usr/bin/env tsx

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
  const lib = await import("@/app/app/api/book/_lib/library-catalog");
  restore();

  const params = {
    tableName: process.env.BOOK_TABLE_NAME!,
    contentBucket: process.env.BOOK_CONTENT_BUCKET!,
  };

  for (const id of ["tiny-habits", "how-to-win-friends-and-influence-people"]) {
    try {
      const detail = await lib.getPublishedLibraryBookDetail({ ...params, bookId: id });
      console.log(`\n=== ${id} (catalog) ===`);
      console.log(`title: ${detail.title}`);
      console.log(`chapterCount: ${detail.chapters.length}`);
      console.log(`first 3 chapter IDs:`);
      for (const ch of detail.chapters.slice(0, 3)) {
        console.log(`  ${ch.id} (#${ch.number} "${ch.title}")`);
      }
    } catch (err: any) {
      console.log(`\n=== ${id} (catalog) ===`);
      console.log(`ERROR: ${err.message}`);
    }
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
