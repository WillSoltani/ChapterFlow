# Release Assembly Rules

Only committed validated chapter JSONs may enter the release package.

Assembly source:
`validated/chXX.chapter.json`

Do not use:
- structured JSON
- temporary worker output
- in-memory generated objects
- seed metadata
- prior release package objects

Release must be deterministic from committed validated chapters.
