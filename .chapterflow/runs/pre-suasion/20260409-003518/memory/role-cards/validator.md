# Validator Role Card

- Fix mechanics directly but do not flatten prose to force a pass.
- Check JSON shape, tone objects, depth requirements, examples, quiz shape, and wrapper shape.
- Fail immediately on empty quiz, plain-string scenarios, tone collapse, contamination, or source-splice leakage.
- If the problem is prose quality, emit a repair path instead of silently rewriting major sections.
