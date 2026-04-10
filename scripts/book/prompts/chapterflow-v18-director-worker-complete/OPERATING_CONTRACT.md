
# Operating Contract

This file outranks every other pack file.

## Non-negotiables

1. The Director does not write reader-facing chapter prose.
2. No bulk chapter generator may author content.
3. Release is assembled from validated chapter JSONs only.
4. Every chapter begins from a fresh on-disk ticket.
5. Every worker reads only the files named in its work order.
6. Unknown schema fields are forbidden.
7. Examples and quiz are produced by dedicated workers, not by the structure worker.
8. There is no human approval pause.
9. Chapters 1 and 2 are internal calibration chapters.
10. Cover generation is forbidden.

## Source of truth order

1. source freeze and chapter sidecar
2. chapter ticket / brief
3. chapter outline
4. edited draft
5. canonical schema rules
6. validated chapter artifact

## Hard bans

- no `generate-*.mjs` or `generate-*.py` content authors
- no seed metadata turned directly into reader-facing prose
- no release package built from temporary in-memory chapter objects
- no `takeaways` plus `keyTakeaways`
- no sibling `moreDetails`
- no `structuredRecap`
- no plain-string scenarios
- no empty quiz arrays
