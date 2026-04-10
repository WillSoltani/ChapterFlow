# Web-First Source Discovery Rules

Use the web first.

Goals:
- identify exact edition / translation / chapter map
- locate lawful source material
- freeze enough chapter-local evidence to support faithful chapter writing

## Source Sufficiency Gate

The pipeline may proceed in full-fidelity mode only when the source freeze includes:
- exact edition/translation lock
- reliable chapter map / TOC
- enough lawful chapter-local material to support chapter-specific prose

Insufficient for full-fidelity generation:
- title + author metadata only
- TOC only
- publisher blurb + catalog entries only
- isolated excerpt context with no real chapter-local evidence

If the book is copyrighted and lawful chapter-local source coverage is too thin, stop with:
`TRUE BLOCKER: insufficient lawful source coverage for full-fidelity ChapterFlow generation.`

Do not fabricate a full book from metadata, chapter titles, or seed summaries.
