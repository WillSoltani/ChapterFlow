Release assembly rules

The release package must be built by reading:
- `validated/ch01.chapter.json`
- `validated/ch02.chapter.json`
- ...
- `validated/chNN.chapter.json`

Then:
- sort by chapter number
- carry `book` metadata forward from the source-locked manifest / edition lock rather than from the raw launch placeholder
- require canonical title and author, non-empty categories and tags when supported by the frozen bundle, a fuller edition object, and an explicit chapter scope
- assemble into one book object
- write `release/{bookId}.modern.json`

Forbidden:
- regenerating chapter objects during release
- calling builder functions for breakdowns or examples during release
- normalizing approved prose during assembly
- copying thin placeholder `book` metadata into release when richer locked metadata already exists
