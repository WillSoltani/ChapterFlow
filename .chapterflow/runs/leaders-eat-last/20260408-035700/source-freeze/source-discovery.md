# Source Discovery — Leaders Eat Last

## Discovery summary
- Title supplied: *Leaders Eat Last*
- Author supplied: Simon Sinek
- Discovery date: 2026-04-08
- Discovery mode: `web_first`
- Rights posture: modern trade book; no pirate mirrors or unauthorized full text allowed

## Search and selection path
1. Confirmed the official book framing on Simon Sinek's site and the U.S. trade-family metadata on Penguin Random House.
2. Froze the Google Books 2017 paperback metadata page because it cleanly exposes the selected paperback ISBN, publication date, and the revised-edition description about the expanded chapter and appendix on leading millennials.
3. Froze the Google Books 2014 ebook metadata page to preserve the earlier same-family publication anchor and Google Books's related-editions trail.
4. Froze the Open Library 2017 paperback-family record as a same-year paperback corroboration source, but treated it as supporting evidence rather than the lock source because its ISBN belongs to a different market paperback family.
5. Froze the UIGM catalog record because it exposes the most complete stable table of contents found during the run, preserving the 8 parts and all 27 numbered chapters, including chapter 24 as `The Abstract Generation`.
6. Froze the OverDrive metadata page because it independently repeats the expanded-chapter and appendix wording tied to the Simon Sinek "Millenials in the workplace" framing.

## Pagination note
- The frozen sources disagree on pagination and format-specific extent:
- Google Books 2017 reports 368 pages.
- Google Books 2014 surfaces a 370-page ebook family.
- The frozen catalog TOC record reports a 350-page physical item.
- Open Library exposes a same-year paperback family entry with a different market ISBN.
- Because the run is coverage-only and these sources do not give one unambiguous stable page system for all chapter boundaries, `state/chapter-index.json` leaves `startPage` and `endPage` as `null` to avoid false precision.

## Frozen bundle contents
- `source-freeze/edition-lock.json`
- `source-freeze/source-ledger.json`
- `source-freeze/source-discovery.md`
- `source-freeze/toc.json`
- `source-freeze/source-bundle/simon-sinek-official.html`
- `source-freeze/source-bundle/penguin-random-house.html`
- `source-freeze/source-bundle/google-books-2017.html`
- `source-freeze/source-bundle/google-books-2014.html`
- `source-freeze/source-bundle/openlibrary-2017-paperback.html`
- `source-freeze/source-bundle/openlibrary-2017-paperback.json`
- `source-freeze/source-bundle/uigm-catalog-toc.html`
- `source-freeze/source-bundle/overdrive-2017.html`
- `sidecars/source-heading-index.json`
- `sidecars/source/ch01.source.txt` through `sidecars/source/ch27.source.txt`
- `sidecars/source/ch01.source.json` through `sidecars/source/ch27.source.json`
- `state/chapter-index.json`

## What was not frozen
- No unauthorized scans, OCR copies, or pirate ebook mirrors were used.
- No full lawful text was discovered and frozen for this run.
- No unstable live retailer reviews or user annotations were treated as chapter truth.
- No chapter summaries from tertiary study-guide sites were used as locked chapter evidence.

## Operating implications
- This is a coverage-only freeze, so later chapter work must remain paraphrase-first and claim-light.
- The run is locked to the revised English trade family centered on the U.S. paperback published May 23, 2017, while still treating the Jan 7, 2014 hardcover and ebook as same-family corroboration.
- `toc.json` preserves the 8-part and 27-chapter structure needed for the ChapterFlow state machine.
- `state/chapter-index.json` uses one ticket per numbered chapter, not one ticket per part.
- Because pagination is not stable across the frozen sources, later chapter tickets should rely on part / chapter titles and source IDs rather than page-based boundaries.
