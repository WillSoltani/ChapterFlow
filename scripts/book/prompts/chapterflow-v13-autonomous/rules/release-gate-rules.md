Release-gate requirements

Release gate checks:
- every numbered chapter validated
- release assembled from validated chapters only
- release matches validated chapter hashes
- source ledger and edition lock exist
- source guard passes
- repo validator run
- v13 lint run
- build run
- any remaining warnings documented

Release gate fails if:
- release package chapter differs from validated chapter
- sealed chapter hash changed after validation
- any chapter lacks full artifact bundle
- source discovery artifacts are missing
- quiz quality scorer fails for any chapter quiz (threshold 0.60)
- semantic diversity checker fails for any chapter
