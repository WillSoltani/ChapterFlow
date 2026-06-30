/**
 * source-verify-import — closes the two-path footgun: the workbench downloads to its own dir, but
 * `source-verify-check` (default) and the publish gate read the CANONICAL path
 * (`.chapterflow/source-verify-<book>.md`). Import validates a filled record and writes it there,
 * so the publish gate reads the exact verified record. Guards: a valid record lands at canonical;
 * an unparseable one is rejected.
 */

import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { resolve } from "path";

import { test } from "./harness.js";
import { runCli, TMP_DIR } from "./helpers.js";
import { sourceVerifyRecordPath } from "../src/critics/sourceVerify.js";

const BOOK = "zz-fixture-sv-import";
const VALID = JSON.stringify({
  schemaVersion: "source-verify-record-v1",
  bookId: BOOK,
  chapters: [{ chapterNumber: 1, items: [{ id: "x", kind: "named_example", verdict: "VERIFIED", sourceRef: "Book p.1", note: "checked against the source" }] }],
});

test("source-verify-import writes a valid record to the canonical path the publish gate reads", () => {
  const canonical = sourceVerifyRecordPath(BOOK);
  const tmp = resolve(TMP_DIR, `${BOOK}.record.json`);
  try {
    mkdirSync(TMP_DIR, { recursive: true });
    writeFileSync(tmp, VALID, "utf8");
    rmSync(canonical, { force: true });
    const { status } = runCli(["source-verify-import", BOOK, "--record", tmp]);
    assert.equal(status, 0);
    assert.ok(existsSync(canonical), "canonical record must exist after import");
    assert.equal(readFileSync(canonical, "utf8"), VALID, "imported content matches the downloaded record");
  } finally {
    rmSync(tmp, { force: true });
    rmSync(canonical, { force: true });
  }
});

test("source-verify-import rejects an unparseable record (no canonical write)", () => {
  const canonical = sourceVerifyRecordPath(BOOK);
  const tmp = resolve(TMP_DIR, `${BOOK}.bad.json`);
  try {
    mkdirSync(TMP_DIR, { recursive: true });
    writeFileSync(tmp, "{ not valid json", "utf8");
    rmSync(canonical, { force: true });
    const { status } = runCli(["source-verify-import", BOOK, "--record", tmp]);
    assert.notEqual(status, 0, "an invalid record must be rejected");
    assert.equal(existsSync(canonical), false, "a rejected record must not be written to canonical");
  } finally {
    rmSync(tmp, { force: true });
    rmSync(canonical, { force: true });
  }
});
