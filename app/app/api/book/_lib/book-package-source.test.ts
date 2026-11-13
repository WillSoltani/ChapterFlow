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

type Source = typeof import("./book-package-source");
let getServerBookPackage: Source["getServerBookPackage"];
let createExpiringPackageCache: Source["createExpiringPackageCache"];
let BOOK_PACKAGE_TTL_MS: Source["BOOK_PACKAGE_TTL_MS"];
let BOOK_PACKAGE_MISSING_TTL_MS: Source["BOOK_PACKAGE_MISSING_TTL_MS"];

before(async () => {
  mock.timers.enable({ apis: ["Date"], now: 1_000_000 });
  ({
    getServerBookPackage,
    createExpiringPackageCache,
    BOOK_PACKAGE_TTL_MS,
    BOOK_PACKAGE_MISSING_TTL_MS,
  } = await import("./book-package-source"));
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

// The cache on its own, driven by an injected clock.

function clock(start = 1_000_000) {
  let t = start;
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms;
    },
  };
}

test("TTLs are 5 minutes for a package and 60 seconds for a missing one", () => {
  assert.equal(BOOK_PACKAGE_TTL_MS, 300_000);
  assert.equal(BOOK_PACKAGE_MISSING_TTL_MS, 60_000);
});

test("an unknown key is a miss", () => {
  const cache = createExpiringPackageCache<{ v: number }>({ now: clock().now });
  assert.deepEqual(cache.get("book-a"), { hit: false });
});

test("a cached package is served until 5 minutes pass, then refetched", () => {
  const c = clock();
  const cache = createExpiringPackageCache<{ v: number }>({ now: c.now });
  cache.set("book-a", { v: 1 });
  assert.deepEqual(cache.get("book-a"), { hit: true, value: { v: 1 } });
  c.advance(BOOK_PACKAGE_TTL_MS - 1);
  assert.deepEqual(cache.get("book-a"), { hit: true, value: { v: 1 } });
  c.advance(1);
  assert.deepEqual(cache.get("book-a"), { hit: false });
  cache.set("book-a", { v: 2 });
  assert.deepEqual(cache.get("book-a"), { hit: true, value: { v: 2 } });
});

test("a missing package is remembered for 60 seconds only", () => {
  const c = clock();
  const cache = createExpiringPackageCache<{ v: number }>({ now: c.now });
  cache.set("book-b", null);
  assert.deepEqual(cache.get("book-b"), { hit: true, value: null });
  c.advance(BOOK_PACKAGE_MISSING_TTL_MS - 1);
  assert.deepEqual(cache.get("book-b"), { hit: true, value: null });
  c.advance(1);
  assert.deepEqual(cache.get("book-b"), { hit: false });
});

test("entries expire independently", () => {
  const c = clock();
  const cache = createExpiringPackageCache<{ v: number }>({ now: c.now });
  cache.set("book-a", { v: 1 });
  c.advance(BOOK_PACKAGE_TTL_MS - 1000);
  cache.set("book-c", { v: 3 });
  c.advance(1000);
  assert.deepEqual(cache.get("book-a"), { hit: false });
  assert.deepEqual(cache.get("book-c"), { hit: true, value: { v: 3 } });
});
