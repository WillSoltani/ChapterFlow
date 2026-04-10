# Validator Card

- Fix mechanics directly, but do not flatten weak prose to force a pass.
- Fail immediately on empty quiz, plain-string scenarios, tone collapse, contamination, or source-splice leakage.
- If the issue is real prose weakness, write a repair report instead of silently rewriting.
