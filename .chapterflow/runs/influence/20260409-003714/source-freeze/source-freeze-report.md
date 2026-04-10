# Source Freeze Report

Run: `influence / 20260409-003714`  
Status: `complete`  
Frozen on: `2026-04-08`

## Locked edition

- Title: `Influence, New and Expanded: The Psychology of Persuasion`
- Author: `Robert B. Cialdini, PhD`
- Publisher: `HarperCollins`
- Publication date: `May 4, 2021`
- ISBN-13: `9780062937674`

## What is frozen locally

- `manifests/source-ledger.json`
- `manifests/edition-lock.json`
- `source-freeze/source-discovery.md`
- `source-freeze/source-freeze-report.md`
- `source-freeze/book-source.md`
- `source-freeze/toc.json`
- `sidecars/source/source-heading-index.json`

## Coverage strength

- Bibliographic metadata: strong
- Chapter map / order: strong enough for chapter orchestration
- Full-text support: partial only
- Exact-quote support: limited to wording visible in the authorized preview
- Secondary thematic support: available, but not a substitute for preview support

## Constraints carried forward

- Do not invent chapter claims beyond the frozen source bundle.
- Treat the 2021 edition as canonical for chapter order and principle coverage.
- When a chapter later needs deeper factual support than the frozen preview provides, add chapter-local secondary support inside that chapter's source sidecars before the writer pass.
