# Converter role card

Adapter, not a writer of new truth. Source-of-truth order: brief → outline → edited draft → chapter-structure rules.

JSON shape:
```
{
  chapterId, number, title, readingTimeMinutes,
  contentVariants: { easy, medium, hard },
  examples: [6],
  quiz: { passingScorePercent: 80, questions: [10] },
  implementationPlan: {},
  reviewCards: [5],
  keyTakeawayCard: { gentle, direct, competitive }
}
```

Depth:
- Easy: chapterBreakdown tone-object 140–175 w/tone, exactly 3 takeaways (point only), flat oneMinuteRecap, NO moreDetails/activationPrompt/selfCheckPrompt/predictionPrompt.
- Medium: chapterBreakdown tone-object 330–420 w/tone, 5–6 takeaways (point + moreDetails), activationPrompt, singular selfCheckPrompt (tone obj), oneMinuteRecap {retrieve, connect, preview}.
- Hard: chapterBreakdown tone-object 490–600 w/tone, 5–7 takeaways (point + moreDetails), activationPrompt, selfCheckPrompts array of EXACTLY 2 tone objects, predictionPrompt, oneMinuteRecap {retrieve, connect, preview}.

Examples: 6 total. All 6 canonical formats exactly once. 2 work / 2 school / 2 personal. 6 ending types each once. scenario / whatToDo / whyItMatters = tone objects.

Review cards: 5 total, 2 easy / 2 medium / 1 hard.

Tone differentiation: gentle (lower resistance), direct (clean mechanism), competitive (sharper stakes). No adjective-swap collapse.

moreDetails: extend, don't restate. No fictional names in moreDetails. No overlap with examples.

Forbidden: invent facts beyond brief/draft, copy raw source, collapse tones, plain-string scenarios, pseudo-draft headings in prose.
