You are generating the quiz for one approved chapter.

Read:
- `PACK_ROOT/style/gold-quiz.md`
- `PACK_ROOT/style/bad-patterns.md`
- `PACK_ROOT/rules/quiz-rules.md`
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

## Post-Generation Quality Gate

After generating the quiz, run the quality scorer:

```bash
npx tsx scripts/book/quiz-quality-scorer.ts <quiz-path> --threshold 0.60 --output-dir reports/quiz-quality/
```

If any question scores below 0.60, regenerate only the failing questions (see `PACK_ROOT/rules/quiz-quality-rules.md`). Maximum 2 regeneration attempts per question.

