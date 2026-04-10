
# Quiz Lifecycle Rules

- Every chapter in chapter_gate mode gets a real 10-question quiz unless the manifest explicitly defers it.
- Quiz generation happens after structure, never before prose.
- Empty `questions` arrays are a hard fail.
- Quiz JSON is written separately, then assembled into the chapter.
