# Source Discovery

Run: `the-33-strategies-of-war/20260411-021103`

Discovery date: `2026-04-11`

## Goal

Freeze a lawful, strict-v13 source bundle for *The 33 Strategies of War* before any chapter work.

## Search result summary

1. Google Books exposes authorized metadata for the 2007 Penguin reprint with ISBN `9780143112785`, 512 pages, and a stable bibliographic record.
2. Penguin Random House Retail confirms the same 2007 paperback, its on-sale date, and the claim that it is the only authorized paperback edition in the US.
3. Penguin Random House's main title page cross-checks the 2007 paperback, 2007 ebook, and 2025 hardcover, which supports the judgment that the chapter-level content is stable across current authorized US formats.
4. The local ChapterFlow structured reference already contains the five-part structure, all 33 strategy titles, and the Part VI meta-lessons; it is frozen as secondary support, not as verbatim book text.

## Selection outcome

The run locks to the 2007 U.S. Penguin paperback reprint for ISBN `9780143112785`.

This was auto-locked because:

- the Google Books and Penguin Random House records align cleanly;
- no translation choice exists for the working English text;
- no materially different revised chapter order surfaced during discovery;
- the strict-v13 run needs the book's native 33-strategy structure, and the frozen bundle supports that structure without relying on the earlier 10-chapter consolidation.

## Frozen source bundle contents

- `source-freeze/book-source.txt`
- `source-freeze/toc.json`
- `source-freeze/source-freeze-report.md`
- `manifests/source-ledger.json`
- `manifests/edition-lock.json`
- `sidecars/source/source-heading-index.json`

## Use constraints

- Use paraphrase-first throughout.
- Treat the frozen `book-source.txt` as secondary support only; it is not the book text.
- Exact quotation is allowed only where the frozen authorized preview directly supports it.
- Claims about chapter titles, part structure, and edition metadata are supported by the frozen bundle.
- Claims about chapter-level interpretation must stay within the support provided by the frozen authorized metadata plus the frozen secondary reference.
