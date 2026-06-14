# ChapterFlow v21 Codex Migration, Three-Step Operator Prompt

Use this when the older batch workflow has already proven quality and you want less manual work.

The goal is still HWF-level authored quality. This is not a one-shot whole-book draft. It is one operator flow with three controlled steps:

1. **Step 1, setup plus full-book planning**: create the manual brief, manual ledger, chapter core map, and manual plans for every chapter.
2. **Step 2, full-book writing with checkpoints**: write chapters in order, one chapter at a time, from existing plans. After every chapter, run the checkpoint script. Rewrite before moving on if it fails.
3. **Step 3, finalize**: run one command that verifies artifacts, gates every chapter, runs the book pattern audit, promotes, validates, and scores.

This keeps the good part of the 3-chapter workflow, persisted plans and per-chapter gates, while removing the repeated user handoff after every small batch.

## Paste target book values at the top of each Codex session

```text
Target book:
- bookId: <bookId>
- title: <Title>
- author: <Author>
- source package: book-packages/<bookId>.modern.json
- chapter index: scripts/book/prompts/chapterflow-v21-authored/state/indexes/<bookId>.json
- output package: book-packages/<bookId>.v21.json
- categories: Productivity, Self Improvement
- tags: attention, focus, habits
```

Use lowercase kebab-case bookIds unless the repo index says otherwise.

## Three Codex sessions

### Session 1

Paste the target book block, then paste or reference:

```text
scripts/book/prompts/chapterflow-v21-authored/MIGRATION-CODEX-STEP1-SETUP-PLAN.md
```

Expected result: all setup artifacts and all manual plan files exist. No chapter JSON should be written.

### Session 2

Paste the target book block, then paste or reference:

```text
scripts/book/prompts/chapterflow-v21-authored/MIGRATION-CODEX-STEP2-WRITE-BOOK.md
```

Expected result: every chapter file is written, gate-passing, and pattern-audit clean. The agent should checkpoint after every chapter and rewrite failures without asking for user intervention.

### Session 3

Paste the target book block, then paste or reference:

```text
scripts/book/prompts/chapterflow-v21-authored/MIGRATION-CODEX-STEP3-FINALIZE.md
```

Expected result: the final package is promoted, v21-validated, legacy-validated, scored, and reported.

## What got automated

- Finding missing plans and missing chapters.
- Running the per-chapter ship gate.
- Running the cross-chapter pattern audit.
- Updating checkpoint status in the manual ledger.
- Final artifact verification.
- Final promotion with manual categories/tags, no model-backed categorizer.
- Final validation and score commands.

## What is still deliberately not automated

- Writing prose with helper scripts.
- Looping through arrays of names, domains, cities, or examples.
- Auto-fixing failed chapters by search/replace.
- Promoting when plan artifacts are missing.
- Ignoring audit failures.

A chapter that fails needs a structural rewrite, not variable renaming.
