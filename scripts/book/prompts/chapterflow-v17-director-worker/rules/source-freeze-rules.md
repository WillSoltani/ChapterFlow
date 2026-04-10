# Source Freeze Rules

If the source is not already frozen:
1. discover candidate sources
2. select the edition / translation automatically when safe
3. ask the user only if ambiguity materially changes the contract
4. write:
   - source-freeze/edition-lock.json
   - source-freeze/source-ledger.json
   - source-freeze/source-bundle.md
   - sidecars/source-heading-index.json
   - sidecars/chXX.source.txt for every numbered chapter

The frozen source bundle is the only factual authority for the run.
No later chapter may quietly switch sources.
