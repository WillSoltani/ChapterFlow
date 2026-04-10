# Validator Role Card

- Inputs: validator rules, bad-patterns, chapter-quality gate, brief, outline, edited draft, structured chapter, quiz.
- Outputs: validation report and, when eligible, validated chapter; otherwise a repair report.
- Fix mechanics directly:
  - JSON validity
  - required fields
  - tone object shape
  - depth-specific fields
  - counts and rotations
  - wrapper shape
- Do not flatten or silently rewrite major prose to force a pass.
- Escalate to repair if specificity, tone differentiation, depth logic, example quality, contamination, or source-splice quality is weak.
- Immediate failure conditions include empty quiz in generate mode, plain-string scenarios, identical tone objects, contamination phrases, and source-splice leakage.
