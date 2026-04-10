# Source Discovery

## Objective
Freeze a lawful, high-signal source bundle for `Pitch Anything` before any chapter work begins.

## Candidate Scan
- McGraw Hill's official product page confirms the 2011 English edition, the ISBN family, the full three-section / eleven-chapter table of contents, and the book's official STRONG-method overview.
- Google Books confirms the same English bibliographic record, publisher, and page-count metadata.
- Oren Klaff's official site confirms the author-side positioning and current presentation of the book's practical promise.
- Fnac repeats the publisher TOC and March 2011 trade metadata, giving a second chapter-map confirmation.
- Shortform, StoryShots, and getAbstract provide secondary paraphrase-first support for the croc-brain, frame-control, status, hookpoint, prize, and neediness concepts when the frozen primary preview remains limited.

## Deviation Found And Repaired
The launch manifest drifted before execution:
- title was saved as `“Pitch-Anything“`
- author was truncated to `“Oren`
- `editionSelectionMode` incorrectly contained `Klaff”`

Repair action:
- restored the canonical title `Pitch Anything`
- restored the canonical author `Oren Klaff`
- restored `editionSelectionMode = ask_if_ambiguous`
- updated the live manifest before any chapter artifact generation

## Decision
The run auto-locks the dominant English McGraw-Hill trade family for `Pitch Anything: An Innovative Method for Presenting, Persuading, and Winning the Deal`.

Working edition policy:
- use the 2011 McGraw-Hill Professional English family as the canonical structure
- treat print and ebook ISBN variants as the same chapter family
- run the numbered pipeline on Chapters `1-11`
- use paraphrase-first support from the lawful web bundle rather than reconstructing full text

No edition question was needed because:
- no translation ambiguity surfaced
- no abridged-vs-full conflict surfaced
- official and secondary chapter maps stayed aligned

## Working Policy
- Use paraphrase-first throughout the run.
- Permit exact quotes only where the frozen bundle exposes them clearly and the support is unambiguous.
- Treat McGraw Hill, Google Books, the author page, and the frozen chapter map as the primary evidence surface.
- Treat secondary summaries as chapter-framing support only.
- Stay narrower rather than speculative whenever support thins out.
