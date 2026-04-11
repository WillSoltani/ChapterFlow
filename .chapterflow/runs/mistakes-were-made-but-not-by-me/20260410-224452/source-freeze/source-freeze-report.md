# Source Freeze Report

## Status
Frozen before skeleton generation: `yes`

## Locked edition
- `Mistakes Were Made (but Not by Me) Third Edition`
- Authors: `Carol Tavris`, `Elliot Aronson`
- Publication year: `2020`

## Frozen assets
- [`book-source.md`](./book-source.md): normalized source bundle summary
- [`toc.json`](./toc.json): chapter map and page anchors
- [`../manifests/source-ledger.json`](../manifests/source-ledger.json): source inventory
- [`../manifests/edition-lock.json`](../manifests/edition-lock.json): edition decision
- [`../sidecars/source/source-heading-index.json`](../sidecars/source/source-heading-index.json): heading index for chapter-local sidecars

## Working interpretation policy
- Use the 2020 third edition as the authority.
- Treat Google Books preview metadata as the primary authorized source.
- Treat the publisher TOC as the chapter-order authority.
- Treat library and bibliographic records as cross-checks only.
- Do not use unsupported anecdotes, claims, or quotations that cannot be tied back to this bundle.

## Known limitations
- No complete source text is frozen.
- Chapter prose must stay narrower than a full-text adaptation.
- Exact quotations are not authorized unless separately verified from the frozen preview.
