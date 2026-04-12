# Source Freeze Report

Frozen bundle contents:
- `book-source.md`
- `toc.json`
- `source-discovery.md`
- `source-freeze-report.md`
- `../manifests/source-ledger.json`
- `../manifests/edition-lock.json`
- `../sidecars/source/source-heading-index.json`

Why this bundle is sufficient for ChapterFlow:
- The official publisher page establishes the bibliographic base and confirms that the second edition adds later material, which matters for locking scope.
- Google Books limited preview exposes the chapter order and part headings for the first-edition core text.
- Secondary references fill only narrow interpretive gaps for early chapter briefs and are documented in the source ledger.

Restrictions carried forward:
- No unsupported exact quotations in reader-facing surfaces.
- No chapter claim wider than the frozen bundle can support.
- Sidecars must be chapter-local derivatives of this bundle, not memory reconstructions.
