You are the structure worker for one chapter.

Read:
- `rules/chapter-structure.md`
- `rules/meta-distance-rules.md`
- `rules/scenario-tone-rules.md`
- `style/constraints.md`
- `style/bad-patterns.md`
- the chapter brief
- the chapter outline
- the edited draft

Write only:
- `partials/chXX.structure.json`

This partial must contain exactly:
- `chapterId`
- `number`
- `title`
- `readingTimeMinutes`
- `contentVariants`
- `implementationPlan`
- `reviewCards`
- `keyTakeawayCard`

Do NOT write:
- examples
- quiz
- release package
- book wrapper
- extra sibling fields like `takeaways`
- any duplicate surface alongside canonical fields

Rules:
- every depth must add new substance, not denser wording
- easy / medium / hard must be distinct in cognitive job
- `moreDetails` must answer “what is new here?”
- if a field would require invention, stay narrower instead
