# Schema Notes

Canonical chapter JSON top-level keys only:
- chapterId
- number
- title
- readingTimeMinutes
- contentVariants
- examples
- quiz
- implementationPlan
- reviewCards
- keyTakeawayCard

Disallowed leftovers:
- `takeaways`
- `keyTakeaways` outside `contentVariants.*`
- duplicate wrappers inside a chapter file
- sibling helper fields not in the canonical schema
