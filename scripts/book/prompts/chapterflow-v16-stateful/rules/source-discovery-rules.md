
# Source Discovery Rules

The run is web-first.

## Required outputs
- `source-freeze/edition-lock.json`
- `source-freeze/source-ledger.json`
- `source-freeze/source-bundle/`
- `source-freeze/source-discovery.md`
- `state/chapter-index.json`
- `sidecars/source-heading-index.json`

## Rules
- prefer public-domain full text or clearly authorized text
- if the book is copyrighted and full text is not available, freeze the best authorized or reputable coverage and narrow chapter claims accordingly
- ask the user only if edition / translation ambiguity materially changes chapter structure or interpretation
- otherwise auto-resolve and document the choice
- do not start chapter tickets until the source ledger is frozen

## Sidecars
Create one sidecar per chapter where possible:
- `sidecars/source/chXX.source.txt`
- `sidecars/source/chXX.source.json`

The chapter ticket must read only the current chapter sidecar, not the whole book source.
