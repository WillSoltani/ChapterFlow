# No-Generator Rules

Forbidden:
- scripts that store chapter prose seeds
- scripts that build chapterBreakdowns from string templates
- scripts that build examples, quizzes, cards, or prompts from seed objects
- release packages assembled from chapter objects never validated individually

If you are tempted to create `generate-<book>.mjs`, stop.

Allowed utilities:
- source freezing
- sidecar creation
- lint / validator execution
- release assembly from validated chapters
- repo registration
- cleanup
