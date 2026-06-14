# ChapterFlow v21 Codex Migration Prompt

## Mission

INPUTS:

BOOK NAME:
AUTHOR:
PICK THE RIGHT CATEGORIES YOURSELF.

Migrate one book from `.modern.json` to the existing v21 schema using Codex sessions only. Do not use Anthropic CLI, OpenAI API calls, `CHAPTERFLOW_PROVIDER`, or the model-backed categorizer. The goal is not just to pass shape checks. The goal is HWF-level authored quality: every chapter should feel planned, source-grounded, and specific, not generated from one reusable chapter factory.

Use this prompt as the operator guide, then use the three phase prompts in this folder:

1. `MIGRATION-CODEX-SETUP-PROMPT.md`
2. `MIGRATION-CODEX-PLAN-PROMPT.md`
3. `MIGRATION-CODEX-WRITE-PROMPT.md`

Do not write an entire book in one Codex session. That is the failure mode. A long single session compresses the book into reusable frames, then swaps names, objects, and chapter phrases. This pipeline forces durable setup, persisted plans, small writing batches, and deterministic cross-book audits.

## Quality bar to inspect before work

From the repo root, read the real HWF artifacts before writing anything:

```bash
jq '.book | {bookId,title,author}' book-packages/how-to-win-friends-and-influence-people.v21.json
jq '.chapters[] | select(.number==15)' book-packages/how-to-win-friends-and-influence-people.v21.json
cat scripts/book/prompts/chapterflow-v21-authored/state/plans/how-to-win-friends-and-influence-people-ch15.plan.json
```

What to notice in HWF Ch15: the plan names a specific core move, then every example is built to make that move visible in a different domain. The romaine, disclosing tablet, brown tap water, coffee cups, toy bills, and press guards are not decorative props. They are the teaching mechanism.

## Non-negotiable workflow

### Phase A: setup only

Use `MIGRATION-CODEX-SETUP-PROMPT.md` in a fresh Codex session. It must create:

```text
scripts/book/prompts/chapterflow-v21-authored/state/briefs/<bookId>.manual-brief.json
scripts/book/prompts/chapterflow-v21-authored/state/books/<bookId>.manual-generation-ledger.json
scripts/book/prompts/chapterflow-v21-authored/state/books/<bookId>.chapter-core-map.json
```

Do not write chapter JSON in setup.

### Phase B: plans only

Use `MIGRATION-CODEX-PLAN-PROMPT.md` in short sessions, usually 3 to 5 chapters per session. It must create one persisted plan per chapter:

```text
scripts/book/prompts/chapterflow-v21-authored/state/plans/<chapterId>.manual-plan.json
```

Do not write chapter JSON in planning.

### Phase C: chapter writing

Use `MIGRATION-CODEX-WRITE-PROMPT.md` in short sessions. Write exactly one chapter per session unless the user explicitly asks for a 2 to 3 chapter batch. The writer must read:

```text
state/briefs/<bookId>.manual-brief.json
state/books/<bookId>.manual-generation-ledger.json
state/plans/<chapterId>.manual-plan.json
state/indexes/<bookId>.json
.chapterflow/runs/<bookId>/<latest>/sidecars/source/chNN.source.txt  # if present
```

After each chapter, run the ship gate and the pattern audit:

```bash
npx tsx scripts/book/prompts/chapterflow-v21-authored/src/cli.ts gate-chapter \
  scripts/book/prompts/chapterflow-v21-authored/state/chapters/<chapterId>.v21-native.chapter.json

npx tsx scripts/book/prompts/chapterflow-v21-authored/src/scratch/audit-book-patterns.ts <bookId> --from-state
```

If either blocks, rewrite structurally. Do not rename variables inside a bad template.

## Why this exists

The real v21 generator separated roles: editor-in-chief, curriculum planner, hook writer, breakdown writer, voice pass, line editor, example over-generation, curator, quiz writer, card writer, implementation writer, memorable-lines pass, ship gate, and ledger ingest. A Codex-only workflow can still match that quality, but only if Codex is used as a disciplined operator with persisted artifacts and small batches, not as a one-shot whole-book factory.

## Cross-chapter anti-template rules

The old per-chapter C8 check catches examples that repeat within one chapter. It does not catch six cross-book scene shells repeated thirty times. This workflow adds a book-level pattern audit, and you must write as if it is always watching.

Hard rules:

1. No repeated hook frame across chapters. Do not use `<chapter title>: <object at time>, and the next distraction asks to be called necessary` or any cousin of it.
2. No repeated counterintuition frame across chapters. Avoid `Most people assume the fix is X, but actually...` as a reusable stem.
3. No repeated `tryThisNow` stem. The action must be chapter-specific.
4. No repeated quiz explanation. Every explanation must mention the actual scenario, choice logic, and chapter move.
5. No repeated example shell across chapters. A six-scene carousel with new names is a failed book.
6. No conversation-only ledgers. Persist names, domains, hooks, counters, try-actions, quiz explanation stems, example anchors, and rejected frames in the manual ledger file.
7. No chapter without a plan artifact. A chapter JSON without `<chapterId>.manual-plan.json` is not eligible for promotion.
8. Do not drift from the source sidecar. A chapter titled around meetings, costs, schedules, or external triggers must teach those things, not generic self-control prose.

## Book-level commands

After every 3 to 5 chapters:

```bash
npx tsx scripts/book/prompts/chapterflow-v21-authored/src/scratch/audit-book-patterns.ts <bookId> --from-state
```

Final promotion, Codex-only, no model-backed categorizer:

```bash
npx tsx scripts/book/prompts/chapterflow-v21-authored/src/cli.ts promote-book <bookId> \
  --title "<Title>" \
  --author "<Author>" \
  --no-categorizer \
  --categories "Productivity,Self Improvement" \
  --tags "attention,focus,habits"
```

Final validation:

```bash
npx tsx scripts/book/prompts/chapterflow-v21-authored/src/scratch/validate-v21-package.ts \
  book-packages/<bookId>.v21.json

node scripts/book/validate-book.mjs book-packages/<bookId>.v21.json

npx tsx scripts/book/prompts/chapterflow-v21-authored/src/scratch/score-chapters.ts \
  book-packages/<bookId>.v21.json
```

`validate-book.mjs` is not a substitute for the v21 ship gate or pattern audit. Use it only after the v21-specific validation passes.

## Stop conditions

Stop and rewrite before continuing if any of these happen:

- Two chapters share the same hook, counterintuition, or `tryThisNow` skeleton.
- Two examples in different chapters open with the same scene choreography after names and times are stripped.
- Quiz explanations sound interchangeable.
- A chapter uses the book's general theme but not the chapter's specific source pressure.
- You find yourself saying "I can finish the rest in the same style." That means the style has become a template.

## Report back format

At the end, report:

- bookId, title, author
- chapter count
- pattern audit result
- ship-gate result
- average score and score range
- how many chapters were rewritten because of cross-chapter patterns
- categories/tags used for promotion
- any remaining warnings worth human review
