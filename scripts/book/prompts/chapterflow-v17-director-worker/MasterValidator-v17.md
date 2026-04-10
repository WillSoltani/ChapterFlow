# ChapterFlow v17 — Release Validator

Run this only after the Director has assembled the release package.

Validate:
1. every committed chapter artifact
2. the release package
3. the final book JSON package

## Required checks

### Source integrity
- release assembled only from committed validated chapter JSONs
- committed hashes match release content

### Structural integrity
- JSON parses
- required fields present
- tone objects where required
- quizzes populated
- scenario tone objects present
- EMH structure intact

### Drift integrity
- contamination scan passes
- no internal instruction leakage
- no source-splice contamination outside the quote ledger
- tone collapse absent
- later chapters do not fall below calibration floor without documented reason

### Learning integrity
- prediction prompts real
- recap retrieve fields demand recall
- implementation plans chapter-specific
- quiz explanations teach mechanism

### Continuity integrity
- names
- settings
- format rotation
- ending rotation
- vocabulary watchlist
- cross-chapter callbacks where intended

## Output
Write:
- `reports/release.validation.md`
- `reports/release.failures.md` if any blocker exists

If blockers exist, do not rewrite the whole book.
Route only the failing chapters back to patch or repair.
