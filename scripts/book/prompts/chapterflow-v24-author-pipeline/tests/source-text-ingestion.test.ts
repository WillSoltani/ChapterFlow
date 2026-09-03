/**
 * WP source-ingestion (R-046) — the pipeline reads the book.
 *
 * These tests pin the INGESTION half: reading a UTF-8 text file, normalizing its
 * newlines, hashing it, and the quote-matching primitive every later grounding
 * check is built on. They are hermetic: a small synthetic text plus a 20 KB slice
 * of the public-domain Gutenberg Autobiography when that file is present.
 */

import assert from "node:assert/strict";
import { createHash } from "crypto";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { resolve } from "path";

import { test } from "./harness.js";
import {
  MAX_SOURCE_QUOTE_CHARS,
  MIN_SOURCE_QUOTE_CHARS,
  discoverSourceTextPath,
  findQuoteOffsets,
  ingestSourceText,
  normalizeIngestedText,
  quoteIsGrounded,
} from "../src/source/sourceText.js";

function tempDir(): string {
  return mkdtempSync(resolve(tmpdir(), "cf-source-text-"));
}

test("R-046: normalization converts CRLF and lone CR to LF and strips a BOM", () => {
  assert.equal(normalizeIngestedText("﻿a\r\nb\rc\n"), "a\nb\nc\n");
  // Idempotent: normalizing twice changes nothing.
  const once = normalizeIngestedText("x\r\ny");
  assert.equal(normalizeIngestedText(once), once);
});

test("R-046: ingestion records the sha256 and byte length of the NORMALIZED text", () => {
  const dir = tempDir();
  try {
    const path = resolve(dir, "book.txt");
    writeFileSync(path, "Line one.\r\nLine two.\r\n", "utf8");
    const ingested = ingestSourceText(path);
    assert.equal(ingested.text, "Line one.\nLine two.\n");
    assert.equal(ingested.byteLength, Buffer.byteLength(ingested.text, "utf8"));
    assert.equal(
      ingested.sha256,
      createHash("sha256").update(ingested.text, "utf8").digest("hex"),
      "the recorded digest must be the digest of the frozen (normalized) bytes, so a later stage can verify the frozen copy",
    );
    assert.equal(ingested.path, path);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("R-046: two different texts produce two different digests (run identity can bind them)", () => {
  const dir = tempDir();
  try {
    const a = resolve(dir, "a.txt");
    const b = resolve(dir, "b.txt");
    writeFileSync(a, "The first text.\n", "utf8");
    writeFileSync(b, "The second text.\n", "utf8");
    assert.notEqual(ingestSourceText(a).sha256, ingestSourceText(b).sha256);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("R-046: ingestion fails closed on a missing file and on a non-absolute path", () => {
  assert.throws(() => ingestSourceText("relative/path.txt"), /SOURCE_TEXT_INVALID/);
  assert.throws(() => ingestSourceText(resolve(tmpdir(), "cf-does-not-exist-xyz.txt")), /SOURCE_TEXT_NOT_FOUND/);
});

test("R-046: ingestion fails closed on an empty text rather than freezing zero bytes", () => {
  const dir = tempDir();
  try {
    const path = resolve(dir, "empty.txt");
    writeFileSync(path, "   \n\n  ", "utf8");
    assert.throws(() => ingestSourceText(path), /SOURCE_TEXT_EMPTY/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("R-046: discovery finds <pipeline>/sources/<bookId>.txt and returns null otherwise", () => {
  const dir = tempDir();
  try {
    mkdirSync(resolve(dir, "sources"), { recursive: true });
    writeFileSync(resolve(dir, "sources", "some-book.txt"), "text\n", "utf8");
    assert.equal(discoverSourceTextPath(dir, "some-book"), resolve(dir, "sources", "some-book.txt"));
    assert.equal(discoverSourceTextPath(dir, "other-book"), null);
    // A bookId that is not a plain slug can never address a file outside sources/.
    assert.equal(discoverSourceTextPath(dir, "../etc/passwd"), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── quote matching ────────────────────────────────────────────────────────────

const SPAN = "He gave me, accordingly, three great puffy rolls.  I was surpriz'd at the quantity,\nbut took it.";

test("R-046: a verbatim quote matches across whitespace differences and returns raw offsets", () => {
  const hit = findQuoteOffsets(SPAN, "three great puffy rolls.   I was surpriz'd at the\n quantity");
  assert.ok(hit, "whitespace-normalized matching must accept a re-wrapped quote");
  assert.equal(SPAN.slice(hit!.start, hit!.end).replace(/\s+/g, " "), "three great puffy rolls. I was surpriz'd at the quantity");
});

test("R-046: typographic quotes and dashes normalize to their ASCII forms", () => {
  const span = 'She said "we do not take kings so" - and laughed.';
  assert.ok(quoteIsGrounded(span, '“we do not take kings so” — and laughed'));
});

test("R-046: a quote that is NOT in the span does not match (case is significant)", () => {
  assert.equal(findQuoteOffsets(SPAN, "three small puffy rolls, and a Dutch dollar"), null);
  assert.equal(
    findQuoteOffsets(SPAN, "THREE GREAT PUFFY ROLLS. I WAS SURPRIZ'D"),
    null,
    "a case-folded match would admit a quote retyped from memory — the exact failure mode this check exists for",
  );
});

test("R-046: quote length bounds are enforced by the matcher's own contract", () => {
  assert.equal(findQuoteOffsets(SPAN, "rolls"), null, `a quote under ${MIN_SOURCE_QUOTE_CHARS} chars proves nothing`);
  const tooLong = `${"x".repeat(MAX_SOURCE_QUOTE_CHARS + 1)}`;
  assert.equal(findQuoteOffsets(`prefix ${tooLong} suffix`, tooLong), null, "an over-long quote is rejected even when it is present");
});
