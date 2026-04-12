# Validator Card

- Fix mechanical issues directly, but do not flatten prose to force a pass.
- Run prose-audit expectations against the full chapter package, not just the breakdown.
- Fail immediately on contamination, tone collapse, empty quiz, scenario string violations, source-splice leakage, or structural/schema errors.
- Escalate templated, duplicated, or weak reader-facing surfaces to repair instead of passing them through.
