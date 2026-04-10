# Schema Memory

- Public chapter contract remains EMH.
- `contentVariants.easy.chapterBreakdown` is a tone object with 140-175 words per tone.
- `contentVariants.medium.chapterBreakdown` is a tone object with 330-420 words per tone.
- `contentVariants.hard.chapterBreakdown` is a tone object with 490-600 words per tone.
- Easy: exactly 3 takeaways, no `moreDetails`, no activation/self-check/prediction extras, flat `oneMinuteRecap`.
- Medium: 5-6 takeaways, `moreDetails` required, `activationPrompt`, singular `selfCheckPrompt`, structured recap.
- Hard: 5-7 takeaways, `moreDetails` required, `activationPrompt`, exactly 2 `selfCheckPrompts`, `predictionPrompt`, structured recap.
- Exactly 6 examples per chapter, one of each canonical format, one of each ending type, category distribution 2 work / 2 school / 2 personal.
- `scenario`, `whatToDo`, and `whyItMatters` are tone objects.
- Quiz: object with `passingScorePercent` and exactly 10 questions, 3 choices each, explanation tone object, valid `correctIndex`.
- Implementation plan: tone-object `coreSkill`, 3 contextual `ifThenPlans`, tone-object `twentyFourHourChallenge`, tone-object `weeklyPractice`.
- Review cards: exactly 5 with difficulty distribution 2 easy / 2 medium / 1 hard.
- `keyTakeawayCard` is a tone object.
- Release package is assembled from committed validated chapter JSON only.
