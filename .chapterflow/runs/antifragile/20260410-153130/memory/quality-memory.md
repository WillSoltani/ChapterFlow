# Quality Memory

- Chapter gate requires critic score at least 10/12 and no auto-fails.
- Auto-fail on genericity, invented support, contamination phrases, tone collapse, empty quiz, or hard=medium expansion.
- Prose audit is mandatory before conversion and again on structured output.
- Review package must wrap the full validated chapter JSON, not a partial object.
- Seal chapter hashes only after validation passes.
- Release must assemble from `validated/chXX.chapter.json` only.
