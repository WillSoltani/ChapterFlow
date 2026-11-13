import { test, before, beforeEach, after, mock } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { BookApiError } from "./errors";

// API-15: getServerBookPackage cached each package for the life of the server,
// so a republished book kept serving its old quiz. This drives the real
// book-package-source.ts with a fake S3 read and a mocked clock.

const require = createRequire(import.meta.url);
const Module = require("node:module") as {
  _load: (request: string, parent: unknown, isMain: boolean) => unknown;
};
const originalLoad = Module._load;

const s3 = {
  reads: 0,
  packages: new Map<string, { version: number }>(),
};

Module._load = function patchedLoad(request: string, parent: unknown, isMain: boolean) {
  if (request === "server-only") return {};
  if (request === "./env") return { getBookContentBucket: async () => "content-bucket" };
  if (request === "./storage") {
    return {
      readJsonFromS3: async (_bucket: string, key: string) => {
        s3.reads += 1;
        const bookId = key.replace("book-content/packages/", "").replace(".v21.json", "");
        const pkg = s3.packages.get(bookId);
        if (!pkg) throw new BookApiError(404, "not_found", "missing");
        return { ...pkg };
      },
    };
  }
  if (request === "@/app/book/data/book-package-core") {
    return {
      normalizeAnyPackage: (raw: unknown) => raw,
      isStrictReaderSchema: () => true,
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};

let getServerBookPackage: typeof import("./book-package-source").getServerBookPackage;

before(async () => {
  mock.timers.enable({ apis: ["Date"], now: 1_000_000 });
  ({ getServerBookPackage } = await import("./book-package-source"));
});

after(() => {
  mock.timers.reset();
});

beforeEach(() => {
  s3.reads = 0;
});

test("a republished package is picked up after 5 minutes", async () => {
  s3.packages.set("book-a", { version: 1 });
  assert.deepEqual(await getServerBookPackage("book-a"), { version: 1 });
  s3.packages.set("book-a", { version: 2 });
  mock.timers.tick(4 * 60 * 1000);
  assert.deepEqual(await getServerBookPackage("book-a"), { version: 1 }, "still cached");
  mock.timers.tick(60 * 1000);
  assert.deepEqual(await getServerBookPackage("book-a"), { version: 2 }, "refetched");
  assert.equal(s3.reads, 2);
});

test("a package that was missing is found again after 60 seconds", async () => {
  assert.equal(await getServerBookPackage("book-b"), undefined);
  s3.packages.set("book-b", { version: 1 });
  mock.timers.tick(30 * 1000);
  assert.equal(await getServerBookPackage("book-b"), undefined, "missing is cached briefly");
  mock.timers.tick(30 * 1000);
  assert.deepEqual(await getServerBookPackage("book-b"), { version: 1 });
  assert.equal(s3.reads, 2);
});

test("every tone of a book refreshes with the package", async () => {
  s3.packages.set("book-c", { version: 1 });
  assert.deepEqual(await getServerBookPackage("book-c", "gentle"), { version: 1 });
  assert.deepEqual(await getServerBookPackage("book-c", "direct"), { version: 1 });
  assert.equal(s3.reads, 1, "one S3 read serves every tone");
  s3.packages.set("book-c", { version: 2 });
  mock.timers.tick(5 * 60 * 1000);
  assert.deepEqual(await getServerBookPackage("book-c", "gentle"), { version: 2 });
  assert.deepEqual(await getServerBookPackage("book-c", "direct"), { version: 2 });
  assert.equal(s3.reads, 2);
});
