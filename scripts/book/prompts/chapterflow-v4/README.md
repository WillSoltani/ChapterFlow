# ChapterFlow v4 Prompt Pack

This directory contains the static instruction pack for the quality-first ChapterFlow generation workflow.

## Entry Point

Use:

- `scripts/book/prompts/chapterflow-book-generation-v4.md`

That file is the single chat prompt you paste into Claude or another orchestrator-capable model.

## Approval Gate

The v4 workflow is designed to stop after Chapter 1.

Flow:

1. generate and validate Chapter 1
2. present Chapter 1 for review
3. wait for explicit approval
4. only then continue the remaining chapters with the same approach

This is intentional. It lets you verify writing quality before the pipeline spends time generating the rest of the book.

## Static Files

### Style

- `style/voice.md`
- `style/constraints.md`
- `style/bad-patterns.md`
- `style/gold-patterns.md`
- `style/gold-prose.md`
- `style/gold-examples.md`
- `style/gold-quiz.md`

### Rules

- `rules/chapter-quality-gate.md`
- `rules/writer-agent.md`
- `rules/editor-agent.md`
- `rules/converter-agent.md`
- `rules/quiz-agent.md`
- `rules/validator-agent.md`
- `rules/repair-agent.md`
- `rules/chapter-structure.md`
- `rules/quiz-rules.md`
- `rules/validator-rules.md`
- `rules/repair-rules.md`

### Templates

- `briefs/brief-template.md`
- `briefs/chapter-outline-template.md`

## Design Principles

- Canonical prose first, schema later
- The chapter brief is the factual source of truth
- The edited draft is the content source of truth
- No downstream agent may invent facts beyond the brief
- Validators fix mechanics, but prose failures are repaired explicitly
- Quizzes are a separate pass after validated chapter content exists

## Role Split

- Writer runs from `rules/writer-agent.md`
- Editor runs from `rules/editor-agent.md`
- Converter runs from `rules/converter-agent.md`
- Quiz Agent runs from `rules/quiz-agent.md`
- Validator runs from `rules/validator-agent.md`
- Repair Agent runs from `rules/repair-agent.md`

Each role file points at the right benchmark and constraint files, so the orchestrator only needs to pass the role file plus the current chapter files.

## Quality Bar

Chapter 1 is the benchmark gate for the entire run.

- it must pass the explicit quality rubric in `rules/chapter-quality-gate.md`
- it must score at least `10/12`
- unsupported factual invention is an automatic fail
- the rest of the book should not continue until Chapter 1 is approved
