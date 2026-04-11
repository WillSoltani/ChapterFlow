# Source Discovery

Run: `good-strategy-bad-strategy/20260410-153032`

Discovery date: `2026-04-10`

## Goal

Freeze a lawful, chapter-usable source bundle for *Good Strategy Bad Strategy: The Difference and Why It Matters* before any chapter work.

## Search result summary

1. Google Books exposed an authorized listing for the 2011 Crown edition with bibliographic metadata and a visible table of contents.
2. Penguin Random House Higher Education exposed an official page for ISBN `9780307886231` with publisher metadata and visible Chapter 1 excerpt text.
3. UCLA Anderson confirmed author identity at the institutional level.
4. Apple Books matched the page count and publisher family as a secondary cross-check.

## Selection outcome

The run locks to the 2011 U.S. Crown / Crown Currency edition for ISBN `9780307886231`.

This was auto-locked because:

- the Google Books and Penguin Random House records align cleanly;
- no translation choice exists for the working English text;
- no competing revised chapter map surfaced during discovery;
- the chapter sequence needed for ChapterFlow is visible from authorized sources.

## Frozen source bundle contents

- `source-freeze/book-source.md`
- `source-freeze/toc.json`
- `source-freeze/source-freeze-report.md`
- `manifests/source-ledger.json`
- `manifests/edition-lock.json`
- `sidecars/source/source-heading-index.json`

## Use constraints

- Exact quotation is allowed only where the frozen authorized preview directly supports it.
- The Chapter 1 Apple turnaround excerpt is directly supported.
- Later chapters currently rely on table-of-contents support plus narrower paraphrase-first use until chapter-local sidecars are built from frozen material and reputable secondary context.
