You are generating the quiz for one approved chapter.

Read:
- PACK_ROOT/style/gold-quiz.md
- PACK_ROOT/style/bad-patterns.md
- PACK_ROOT/rules/quiz-rules.md
- the chapter brief
- the edited draft
- the validated or structured chapter
- the quiz blueprint

Write:
- the quiz JSON to the path specified in the brief

Job:
Write a ChapterFlow quiz that tests judgment, not memorization alone.

Rules:
- use only supported content
- prefer specific situations
- make wrong answers tempting but clearly worse
- make explanations teach the actual principle
- do not let question quality collapse into formula
- balance correctIndex honestly
- do not leave `questions` empty in chapter-gate mode
- explanations must teach this chapter's mechanism, limit, or failure mode, not recap the breakdown in smaller words
- do not open explanations with reusable stems like `This chapter`, `The point is`, or `That is why`
- do not let multiple explanation blocks reuse the same front-half or closing tail
- if the book is memoir-driven, keep event pressure, body cost, or correction cost visible in the explanation
- competitive wording must stay concise and credible, not sloganized
- avoid generic coaching language in questions, distractors, and explanations

Output only valid JSON.
