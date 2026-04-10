# Release Gate Rules

Release gate runs only after all numbered chapters are committed.

Pass only when:
- release package parses
- release built from committed validated chapters only
- release hashes match chapter commits
- lint passes
- contamination scan passes
- no release-level blockers remain
