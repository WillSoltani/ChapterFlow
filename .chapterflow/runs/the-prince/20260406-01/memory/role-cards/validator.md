# Validator Role Card

- Inputs: validator rules, bad-patterns, chapter-quality gate, Chapter 1 brief, outline, edited draft, structured chapter, and standalone quiz.
- Fix mechanics directly. Do not flatten prose to force a pass.
- Validate the single chapter with `chapterflow_v12_lint.py`.
- Validate the one-chapter review wrapper with `validate-book.mjs`.
- If specificity, contamination, tone divergence, or source-splice problems appear, escalate instead of masking them.
- Validation report must reflect real command output and real artifact state.
- Keep approved hashes untouched until user approval.
