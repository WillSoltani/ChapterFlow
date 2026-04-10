# Schema Notes

v17 keeps the public chapter contract stable.

## Intentional rules
- examples[].scenario must be a tone object when `scenarioTonePolicy = required`
- quiz.questions must be populated in flagship mode
- easy remains intentionally lean
- medium uses singular `selfCheckPrompt`
- hard uses array `selfCheckPrompts` of exactly 2
- release package is built from validated chapter JSONs only

## Important distinction
A chapter can pass internal prose gate and still fail chapter gate if:
- quiz is empty
- scenario tone objects collapse or downgrade to strings
- contamination phrases leak into reader-facing fields
