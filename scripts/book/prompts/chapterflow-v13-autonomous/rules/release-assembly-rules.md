Release assembly rules

The release package must be built by reading:
- `validated/ch01.chapter.json`
- `validated/ch02.chapter.json`
- ...
- `validated/chNN.chapter.json`

Then:
- sort by chapter number
- assemble into one book object
- write `release/{bookId}.modern.json`

Forbidden:
- regenerating chapter objects during release
- calling builder functions for breakdowns or examples during release
- normalizing approved prose during assembly
