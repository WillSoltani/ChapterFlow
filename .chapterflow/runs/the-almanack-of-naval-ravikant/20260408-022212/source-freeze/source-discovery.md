# Source Discovery — The Almanack of Naval Ravikant

## Discovery summary
- Title supplied: *The Almanack of Naval Ravikant*
- Author supplied: Eric Jorgenson
- Discovery date: 2026-04-08
- Discovery mode: `web_first`
- Rights posture: official site provides a free on-site reading experience plus downloadable PDF and EPUB

## Search and selection path
1. Confirmed on the official home page that the full book is posted as a public-service project and downloadable as PDF and EPUB.
2. Froze the official PDF and official EPUB from the same 2020 release family, using the PDF as the printed-page source of truth and the EPUB as the structured-text source of truth for sidecars.
3. Cross-checked the section structure on the official table-of-contents page and the EPUB NCX so the run could preserve the full printed TOC while collapsing the learning pipeline to six major ChapterFlow sections.
4. Used Open Library to confirm the 2020 Magrathea paperback and hardcover dates, the related Scribe ebook record, and the 242-page physical edition family.
5. Used WorldCat as additional corroboration for the Magrathea print family and the paperback / hardcover ISBN pair.
6. Reviewed official Simon & Schuster second-edition metadata to confirm a later 2025 revision exists, but kept the run locked to the earlier 2020 public-service family because it is the stable, fully accessible, rights-clean source bundle available for this run.
7. Reviewed the official translations page to confirm that translation choices exist and matter, but remain out of scope because no translation was requested.

## Frozen bundle contents
- `source-freeze/edition-lock.json`
- `source-freeze/source-ledger.json`
- `source-freeze/source-discovery.md`
- `source-freeze/toc.json`
- `source-freeze/source-bundle/official-home.html`
- `source-freeze/source-bundle/official-toc.html`
- `source-freeze/source-bundle/official-2020-edition.pdf`
- `source-freeze/source-bundle/official-2020-edition.epub`
- `source-freeze/source-bundle/official-2020-epub-content.opf.xml`
- `source-freeze/source-bundle/official-2020-epub-toc.ncx.xml`
- `source-freeze/source-bundle/openlibrary-2020-edition.html`
- `source-freeze/source-bundle/worldcat-2021-print-record.html`
- `source-freeze/source-bundle/simon-schuster-2025-second-edition.snapshot.txt`
- `source-freeze/source-bundle/official-translations.html`
- `sidecars/source-heading-index.json`
- `sidecars/source/ch01.source.txt` through `sidecars/source/ch06.source.txt`
- `sidecars/source/ch01.source.json` through `sidecars/source/ch06.source.json`
- `state/chapter-index.json`

## What was not frozen
- No pirate mirrors, OCR scans, or unlicensed reposts were used.
- No translation text was frozen for chapter truth.
- No live post-publication recommended-reading updates from the website were treated as chapter truth.
- No chapter content was sourced from secondary summaries.

## Operating implications
- Chapter truth is locked to the 2020 official PDF/EPUB family, not to the mutable current state of the website and not to the later 2025 second edition.
- `state/chapter-index.json` intentionally uses a 6-entry ChapterFlow section map instead of mirroring every TOC line as a chapter ticket.
- The alias `How to Live` is retained only as a home-page alias for the `Philosophy` section.
- Section sidecars were extracted from the locked EPUB because it preserves the frozen 2020 text in machine-readable XHTML; printed page boundaries remain anchored to the frozen PDF TOC.
- `Naval’s Recommended Reading` stays anchored to the locked ebook/PDF content, not the expanded live page that may accumulate links after publication.
