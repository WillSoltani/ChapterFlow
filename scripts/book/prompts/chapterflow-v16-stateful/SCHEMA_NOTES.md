
# Schema Notes

These notes exist to prevent false fixes.

## Easy depth is intentionally lean

Easy includes:
- `chapterBreakdown`
- exactly 3 `keyTakeaways` with `point` only
- flat `oneMinuteRecap`

Easy does not include:
- `moreDetails`
- `activationPrompt`
- `selfCheckPrompt`
- `selfCheckPrompts`
- `predictionPrompt`

Do not “fix” easy by adding medium or hard fields.

## Medium canonical fields

Medium includes:
- `chapterBreakdown`
- 5 to 6 takeaways
- `moreDetails`
- `activationPrompt`
- singular `selfCheckPrompt`
- structured recap with `retrieve`, `connect`, `preview`

## Hard canonical fields

Hard includes:
- `chapterBreakdown`
- 5 to 7 takeaways
- `moreDetails`
- `activationPrompt`
- `selfCheckPrompts` array of exactly 2
- `predictionPrompt`
- structured recap with `retrieve`, `connect`, `preview`

## Examples

Flagship mode requires 6 examples:
- 2 work
- 2 school
- 2 personal

`scenario`, `whatToDo`, and `whyItMatters` are tone objects.

## Quiz

By default:
- quiz exists at chapter gate
- exactly 10 questions
- exactly 3 choices each
- tone-object explanations
- Bloom tags and depth tags present

## Release

Release package chapters must match validated chapter files exactly.
