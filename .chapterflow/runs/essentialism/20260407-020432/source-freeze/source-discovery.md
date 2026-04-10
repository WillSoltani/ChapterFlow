# Source Discovery

## Objective
Freeze a lawful, high-signal source bundle for `Essentialism` before any chapter work begins.

## Candidate Scan
- Greg McKeown's official book page confirms the book identity and explicitly states that the 10th-anniversary edition adds a new introduction and 21-day challenge on top of the original book.
- The Penguin Random House product page confirms the 2014 hardcover, 2020 paperback, ebook, and audiobook trade-family metadata for the English edition.
- Open Library provides a normalized table of contents for the 2014 Crown Business edition, including all four parts, Chapters `1-20`, and `Appendix: Leadership Essentials`.
- SummaryPedia provides short chapter-by-chapter summaries aligned with the official TOC.
- Graham Mann's notes provide secondary support for chapter-level mechanisms and examples, especially in the early mindset chapters and later execution chapters.

## Decision
The run auto-locks the dominant English Crown trade family for `Essentialism: The Disciplined Pursuit of Less`.

Working edition policy:
- use the 2014 Crown Business edition as the canonical core structure
- treat the 2020 Crown Currency paperback as the same chapter family
- treat the 2024 10th-anniversary introduction and 21-day challenge as supplemental extras
- run the numbered pipeline on Chapters `1-20`
- keep `Appendix: Leadership Essentials` frozen as a contextual extra, not a numbered chapter

No edition question was needed because:
- the numbered chapter count and order remain stable across the reviewed English trade-family variants
- the 10th-anniversary additions are prefatory or bonus extras rather than renumbered chapter content
- no translation or abridged-vs-full ambiguity was requested

## Working Policy
- Use paraphrase-first throughout the run.
- Permit exact quotes only where the frozen bundle explicitly exposes them and the support is unambiguous.
- Treat the TOC, official framing pages, and reputable secondary chapter summaries as the lawful evidence surface.
- Stay narrow when a chapter's support surface is thin; do not infer unsupported anecdotes or claims.
