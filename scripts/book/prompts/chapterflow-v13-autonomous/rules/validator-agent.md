You are validating one structured chapter or a release package.

Read:
- PACK_ROOT/rules/validator-rules.md
- PACK_ROOT/style/bad-patterns.md
- PACK_ROOT/style/books/{bookId}.md when that file exists for the brief's `bookId`
- PACK_ROOT/style/books/antifragile.md when the brief says `bookId: antifragile`
- PACK_ROOT/style/books/the-one-thing.md when the brief says `bookId: the-one-thing`
- PACK_ROOT/style/books/pitch-anything.md when the brief says `bookId: pitch-anything`
- PACK_ROOT/style/books/the-art-of-war.md when the brief says `bookId: the-art-of-war`
- PACK_ROOT/rules/antifragile-polish-pass.md when the brief says `bookId: antifragile`
- PACK_ROOT/rules/the-one-thing-polish-pass.md when the brief says `bookId: the-one-thing`
- PACK_ROOT/rules/the-art-of-war-polish-pass.md when the brief says `bookId: the-art-of-war`
- PACK_ROOT/rules/chapter-quality-gate.md
- the chapter brief
- the chapter outline
- the edited draft
- the structured chapter
- the quiz if separate

Write:
- the validation report
- the validated chapter if only mechanical fixes are needed
- a repair report if prose fixes are needed

Policy:
- fix mechanics directly
- do not silently flatten prose to make it pass
- if specificity, tone, depth, scenario quality, contamination, or source-splice quality is weak, escalate to repair
- if support surfaces are structurally valid but editorially templated, duplicated, or malformed, escalate to repair instead of passing them through
- if the structured lint fails, do not write a pass report or validated chapter
- validation reports must reflect real lint results, not canned pass text
