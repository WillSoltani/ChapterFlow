# Schema Notes

These notes clarify what v13 treats as canonical.

## Easy depth is intentionally lean
Easy has:
- chapterBreakdown
- exactly 3 takeaway points
- flat oneMinuteRecap

Easy does **not** have:
- moreDetails
- activationPrompt
- selfCheckPrompt(s)
- predictionPrompt

Do not "fix" easy by bloating it.

## Medium self-check shape
Canonical:
- `medium.selfCheckPrompt` (singular tone object)

Not canonical:
- `medium.selfCheckPrompts` array-of-one

## Hard self-check shape
Canonical:
- `hard.selfCheckPrompts` with exactly 2 tone objects

## Scenario tone policy
In flagship mode:
- `examples[].scenario` must be a tone object
- `examples[].whatToDo` must be a tone object
- `examples[].whyItMatters` must be a tone object

A plain scenario string is not acceptable in flagship mode.

## Automatic chapter gate vs release gate
Chapter gate checks a single chapter bundle and may auto-continue.
Release gate checks the full assembled book.

Do not score a chapter-gate artifact as if it were already the final book.

## Release assembly
The release package is not a place where new content appears.
It is only where validated chapters are assembled.
