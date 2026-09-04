/**
 * R-285 — Project Gutenberg emphasis markers must not make a correctly copied
 * quotation unquotable.
 *
 * EVIDENCE (live Franklin run 2026-09-04T19:51:59Z, attempt 4, ch02 attempt 2 —
 * `research-runs/the-autobiography-of-benjamin-franklin/<run>/rejected/ch02.attempt2.json`):
 *
 *   quotation ch02.quote.assembly-order "James Franklin should no longer print\n
 *   the paper called the New England Courant." is not verbatim in this chapter's
 *   source text — copy the line exactly or drop it
 *
 * The model copied the line correctly. The frozen text (sources/
 * the-autobiography-of-benjamin-franklin.txt, lines 736-737) reads:
 *
 *   House (a very odd one), that "_James Franklin should no longer print
 *   the paper called the New England Courant_."
 *
 * Gutenberg renders italics as underscore pairs, and the markers sit ADJACENT to
 * the words — `"_James` and `Courant_."` — so a quotation of that sentence can
 * never match: to match it the model would have to reproduce a typesetting
 * artifact as if it were the author's punctuation, which is the opposite of
 * "copy the words exactly". That is a whole class, not one line: the same run
 * lost `ch02.case.spectator_practice` on `_Spectator_`.
 *
 * THE FIX IS AT INGESTION, not in the matcher. Every offset in the system —
 * chapter-map spans, `sourceRef` citations, the fidelity judge's span text, the
 * excerpt windows the writers read — is an index into the FROZEN text, and the
 * frozen text is exactly what `normalizeIngestedText` returns. Folding the
 * markers only inside the quote matcher would leave the writers and both judges
 * reading `_Spectator_`, and would let a quote resolve to offsets whose slice
 * does not equal the quote. Stripping at ingestion keeps one text, one digest and
 * one coordinate system.
 *
 * CONSEQUENCE, stated rather than hidden: the sha256 of every ingested text that
 * contains emphasis markers CHANGES, so a book with a frozen run must be
 * re-researched (a resume against a different digest refuses, by design).
 */

import assert from "node:assert/strict";
import { createHash } from "crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { resolve } from "path";

import { test } from "./harness.js";
import { FRANKLIN_SLICE_PATH } from "./helpers.js";
import {
  findQuoteOffsets,
  ingestSourceText,
  normalizeIngestedText,
  quoteIsGrounded,
  stripGutenbergEmphasis,
} from "../src/source/sourceText.js";
import { resolveChapterMap } from "../src/source/chapterMap.js";

/** The two source lines, verbatim, that the live rejection was measured against. */
const ASSEMBLY_ORDER_SOURCE =
  'House (a very odd one), that "_James Franklin should no longer print\nthe paper called the New England Courant_."';

/** What the model wrote, verbatim, in ch02.quote.assembly-order. */
const ASSEMBLY_ORDER_QUOTE =
  "James Franklin should no longer print\nthe paper called the New England Courant.";

test("R-285: a Gutenberg italic run spanning a line break is stripped at ingestion", () => {
  const normalized = normalizeIngestedText(ASSEMBLY_ORDER_SOURCE);
  assert.equal(
    normalized,
    'House (a very odd one), that "James Franklin should no longer print\nthe paper called the New England Courant."',
  );
  assert.equal(normalized.includes("_"), false);
});

test("R-285: the live ch02.quote.assembly-order quotation matches the normalized text", () => {
  const normalized = normalizeIngestedText(ASSEMBLY_ORDER_SOURCE);
  assert.equal(
    quoteIsGrounded(normalized, ASSEMBLY_ORDER_QUOTE),
    true,
    "the quotation the live run rejected must ground against the normalized text",
  );
  const hit = findQuoteOffsets(normalized, ASSEMBLY_ORDER_QUOTE);
  assert.ok(hit, "expected offsets for the grounded quotation");
  // The offsets are usable as offsets: the slice they name is the quoted line.
  assert.match(normalized.slice(hit.start, hit.end), /^James Franklin should no longer print/);
  assert.match(normalized.slice(hit.start, hit.end), /New England Courant\.$/);
});

test("R-285: single-word and phrase emphasis is stripped; a snake_case token is not", () => {
  // Real Gutenberg forms from this very book.
  assert.equal(normalizeIngestedText("an odd volume of the _Spectator_."), "an odd volume of the Spectator.");
  assert.equal(
    normalizeIngestedText('entitled _Magnalia Christi Americana_, as "_a\ngodly, learned Englishman_,"'),
    'entitled Magnalia Christi Americana, as "a\ngodly, learned Englishman,"',
  );
  assert.equal(normalizeIngestedText("I must not _presume_, that"), "I must not presume, that");

  // An underscore INSIDE a token is part of the token, never emphasis.
  assert.equal(normalizeIngestedText("the snake_case column"), "the snake_case column");
  assert.equal(normalizeIngestedText("read handle_click and set_state twice"), "read handle_click and set_state twice");
  // An UNPAIRED marker is left alone: nothing to fold.
  assert.equal(normalizeIngestedText("a _private field with no closing mark"), "a _private field with no closing mark");
  // Emphasis and an identifier can coexist on one line without either eating the other.
  assert.equal(normalizeIngestedText("Use _really_ good snake_case names."), "Use really good snake_case names.");
  // Emphasis never crosses a paragraph break.
  assert.equal(normalizeIngestedText("_open\n\nclose_"), "_open\n\nclose_");
});

test("R-285: normalization stays a pure re-typography — no trimming, no re-wrapping", () => {
  assert.equal(normalizeIngestedText("﻿a\r\nb\rc\n"), "a\nb\nc\n");
  assert.equal(normalizeIngestedText("  leading and trailing  \n"), "  leading and trailing  \n");
});

test("R-285: the digest and the chapter map are computed over the SAME stripped text", () => {
  const dir = mkdtempSync(resolve(tmpdir(), "cf-italics-"));
  try {
    const body = [
      "CHAPTER ONE",
      "",
      "The first unit opens with an order of the House (a very odd one), that",
      '"_James Franklin should no longer print',
      'the paper called the New England Courant_."',
      "",
      "CHAPTER TWO",
      "",
      "The second unit reports that he met with an odd volume of the _Spectator_,",
      "and read it over and over, and was much delighted with the writing in it.",
      "",
    ].join("\n");
    const path = resolve(dir, "italic-book.txt");
    writeFileSync(path, body, "utf8");
    const ingested = ingestSourceText(path);

    // The record hashes what it returns, and what it returns carries no markers.
    assert.equal(ingested.text.includes("_"), false);
    assert.equal(ingested.sha256, createHash("sha256").update(ingested.text, "utf8").digest("hex"));
    assert.equal(ingested.byteLength, Buffer.byteLength(ingested.text, "utf8"));
    // The stated consequence: the digest is NOT the digest of the raw bytes.
    assert.notEqual(ingested.sha256, createHash("sha256").update(body, "utf8").digest("hex"));

    // Anchors are copied out of the text the model would be shown, and they
    // resolve to offsets whose slices are the chapters — 100% coverage.
    const { map, problems } = resolveChapterMap({
      bookId: "italic-book",
      sourceText: ingested.text,
      sourceTextSha256: ingested.sha256,
      chapters: [{ number: 1, title: "One" }, { number: 2, title: "Two" }],
      spans: [
        {
          chapterNumber: 1,
          startAnchor: "CHAPTER ONE\n\nThe first unit opens with an order",
          endAnchor: "the paper called the New England Courant.\"",
        },
        {
          chapterNumber: 2,
          startAnchor: "CHAPTER TWO\n\nThe second unit reports that he met",
          endAnchor: "much delighted with the writing in it.",
        },
      ],
    });
    assert.deepEqual(problems, [], "the chapter map must resolve against the stripped text");
    assert.ok(map, "expected a resolved chapter map");
    assert.equal(map.sourceTextLength, ingested.text.length);
    assert.equal(map.sourceTextSha256, ingested.sha256);
    for (const span of map.spans) {
      assert.ok(span.endOffset > span.startOffset, `span ${span.chapterNumber} is empty`);
      assert.equal(ingested.text.slice(span.startOffset, span.endOffset).includes("_"), false);
    }
    // Chapter 1's span carries the assembly order, quotable as written.
    const chapterOne = ingested.text.slice(map.spans[0].startOffset, map.spans[0].endOffset);
    assert.equal(quoteIsGrounded(chapterOne, ASSEMBLY_ORDER_QUOTE), true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("R-285: the public-domain slice loses its emphasis markers and keeps its prose", () => {
  if (!existsSync(FRANKLIN_SLICE_PATH)) return; // fixture-optional, same policy as the other slice tests
  const raw = readFileSync(FRANKLIN_SLICE_PATH, "utf8");
  assert.ok(raw.includes("_"), "the fixture is the wrong one if it carries no emphasis markers");
  const normalized = normalizeIngestedText(raw);
  assert.equal(normalized.includes("_"), false, "no emphasis marker survives ingestion");
  // The words are all still there: only the markers left.
  assert.equal(normalized.length, raw.replace(/_/g, "").length);
  assert.equal(
    quoteIsGrounded(normalized, 'as "a godly, learned Englishman," if I remember the words rightly'),
    true,
    "a quotation spanning an italic run and a line break must ground",
  );
});

/**
 * REVIEW ROUND 2 (minor): the doc comment now states what the shape-based rule
 * folds BESIDES italics, so a reader of `normalizeIngestedText` learns it from
 * the file rather than from a surprising diff. This test pins that stated
 * behaviour in both directions — the delimiter pairs fold, the identifier forms
 * the guards were written for do not — so the doc and the regex cannot drift.
 */
test("R-285: delimiter-style underscore PAIRS fold too, exactly as the doc comment says", () => {
  assert.equal(stripGutenbergEmphasis("set _DEBUG_ before the run"), "set DEBUG before the run");
  assert.equal(stripGutenbergEmphasis("call foo(_x) then bar(y_) twice"), "call foo(x) then bar(y) twice");
  // Only the markers go; the words between them are never touched.
  assert.equal(stripGutenbergEmphasis("_DEBUG_"), "DEBUG");
  // And the identifier cases the guards exist for stay whole.
  for (const identifier of ["handle_click", "set_state", "__init__", "a_b_c"]) {
    assert.equal(stripGutenbergEmphasis(identifier), identifier);
  }
});
