# Release Protocol

Release assembly is allowed only after all target chapters have commit records.

The release assembler must:
- read committed `validated/chXX.chapter.json` files only
- preserve order
- write `release/{bookId}.modern.json`

The release guard must verify:
- every release chapter has a corresponding commit record
- every release chapter exactly matches the committed validated chapter hash
- no chapter appears that lacks provenance
- no wrapper pollution or duplicate chapter surfaces exist
