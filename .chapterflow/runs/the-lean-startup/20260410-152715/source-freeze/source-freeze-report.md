# Source Freeze Report

## Book

- Title: The Lean Startup
- Author: Eric Ries
- Locked edition: 2011 English Crown Business / Portfolio Penguin trade family
- Rights mode: startup_light

## What was frozen

- `book-source.md`: consolidated frozen bundle with edition metadata, part structure, chapter list, and narrow paraphrase summaries for chapters 1-12 plus epilogue and movement chapter.
- `toc.json`: canonical chapter order and page anchors.
- `source-discovery.md`: decision log.
- `sidecars/source/source-heading-index.json`: chapter heading index for downstream sidecar generation.

## Why this freeze is sufficient for strict v13 progression

- It establishes a stable chapter order before any brief or draft work.
- It names the dominant edition family and explains why no user clarification was required.
- It gives chapter-local, paraphrase-first support narrow enough to avoid speculative expansion.

## Known limits

- No full text is frozen.
- Some chapter-level examples in the published book are not recoverable from the authorized preview bundle and are therefore excluded.
- All downstream prose must stay narrower than a full-text-supported run.
