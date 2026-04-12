# Source Discovery

Run root: `.chapterflow/runs/the-obstacle-is-the-way/20260412-184146`

Book request:
- Title: The Obstacle Is the Way
- Author: Ryan Holiday

Discovery sequence:
1. Checked for an official publisher listing to anchor the canonical title and edition family.
2. Checked for a preview-capable edition page that exposed table-of-contents level support.
3. Cross-checked the chapter map with a library TOC record.

Findings:
- The dominant canonical baseline is the original 2014 Portfolio/Penguin trade edition.
- A later expanded anniversary edition exists and adds chapter-level material.
- Because the request used the base title, the run locks the original edition and excludes anniversary-only material from chapter generation.
- A complete lawful full text was not found in the allowed source ladder.
- A lawful preview-backed chapter map was found and frozen.

Frozen source bundle contents:
- `manifests/source-ledger.json`
- `manifests/edition-lock.json`
- `source-freeze/book-source.md`
- `source-freeze/toc.json`
- `source-freeze/source-freeze-report.md`
- `sidecars/source/source-heading-index.json`

Operational constraint:
- This run is paraphrase-first.
- Exact quotation is allowed only where the preview-backed source bundle directly supports it.
