# Source Discovery

## Objective
Freeze a lawful, high-signal source bundle for `The One Thing` before any chapter work begins.

## Candidate Scan
- The official THE ONE Thing book page confirms the book identity, author pair, official positioning, and rights-safe overview language.
- Google Books confirms the Bard Press bibliographic record, page count, and core ISBN family.
- Hachette UK confirms an international English trade-family release without surfacing chapter-level structural changes.
- Library catalog records from AOU and NCW confirm the chapter order, part headings, and first-edition family metadata.
- SuperSummary and Vince Imbat provide secondary chapter-level framing support aligned to the locked TOC.

## Deviation Found And Repaired
The launch artifact and run manifest named `Jocko Willink, Jim Collins` as the authors of `The One Thing`.

Discovery found no authoritative record for that title-author pairing.
All authoritative sources converged on `Gary Keller` and `Jay Papasan`.

Repair action:
- corrected the live run manifest author fields before any chapter artifact generation
- locked the source bundle to the canonical Gary Keller / Jay Papasan work
- preserved the run root and book slug because the title match remained correct

## Decision
The run auto-locks the dominant English Bard Press / John Murray trade family for `The ONE Thing: The Surprisingly Simple Truth Behind Extraordinary Results`.

Working edition policy:
- use the Bard Press first-edition family as the canonical core structure
- treat the John Murray UK trade family as the same chapter family
- run the numbered pipeline on Chapters `1-18`
- treat the opening three chapters as the pre-Part-1 framing block before `Part 1: The Lies`

No edition question was needed because:
- the English chapter map remained stable across the reviewed trade-family records
- no translation ambiguity was requested
- no abridged-vs-full chapter-count conflict surfaced

## Working Policy
- Use paraphrase-first throughout the run.
- Permit exact quotes only where the frozen bundle explicitly exposes them and the support is unambiguous.
- Treat the official book page, bibliographic metadata, library TOC records, and reputable secondary chapter summaries as the lawful evidence surface.
- Stay narrow when a chapter's support surface is thin; do not infer unsupported anecdotes or claims.
