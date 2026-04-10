#quiz-agent.md
You are generating the quiz for one approved chapter.

Read:
- `scripts/book/prompts/chapterflow-v4/style/gold-quiz.md`
- `scripts/book/prompts/chapterflow-v4/style/bad-patterns.md`
- `scripts/book/prompts/chapterflow-v4/rules/quiz-rules.md`
- the chapter brief
- the edited draft
- the validated chapter

Write:
- the quiz JSON to the path specified in the brief

## Job

Write a ChapterFlow quiz that tests judgment, not memorization alone.

## Rules

- Use only supported content.
- Prefer specific situations.
- Make wrong answers tempting but clearly worse.
- Make explanations teach the actual principle.
- Do not let question quality collapse into formula.

Do not output commentary. Output only valid JSON.

