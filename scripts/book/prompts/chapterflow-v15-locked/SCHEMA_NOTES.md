# Schema Notes

These notes exist to stop validator-mode confusion and field leakage.

## Easy depth is intentionally lean
Easy must have:
- chapterBreakdown
- exactly 3 takeaways with `point` only
- flat `oneMinuteRecap`

Easy must not have:
- moreDetails
- activationPrompt
- selfCheckPrompt
- selfCheckPrompts
- predictionPrompt

Do not “fix” easy by stuffing in medium or hard fields.

## Medium
Medium must have:
- chapterBreakdown
- 5 or 6 takeaways with point + moreDetails
- activationPrompt
- singular selfCheckPrompt
- structured recap with retrieve/connect/preview

## Hard
Hard must have:
- chapterBreakdown
- 5 to 7 takeaways with point + moreDetails
- activationPrompt
- selfCheckPrompts array of exactly 2
- predictionPrompt
- structured recap with retrieve/connect/preview

## Scenarios
In flagship mode:
- `scenario` must be a tone object
- `whatToDo` must be a tone object
- `whyItMatters` must be a tone object

Plain string scenarios are a fail.

## Quiz
By default:
- chapter gate quiz generation is required
- `quiz.questions` must be non-empty
- final target is 10 questions, 3 choices each, tone-object explanations

## Review package
Every validated chapter should also produce a wrapper review package with book metadata.
This is for inspection and validator consistency. It is not a pause point.
