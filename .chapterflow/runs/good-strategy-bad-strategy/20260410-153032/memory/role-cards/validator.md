# Validator Card

- Inputs: brief, outline, edited draft, structured chapter, quiz, validator rules.
- Outputs: validation report and validated chapter if passable with direct mechanical fixes; repair report if prose quality still fails.
- Run prose audit before passing chapter gate.
- Fix mechanics directly, but do not silently flatten prose to force a pass.
- Fail immediately on empty quiz, plain-string scenarios, exact identical tone objects, contamination, source-splice leakage, or hard/medium collapse.
