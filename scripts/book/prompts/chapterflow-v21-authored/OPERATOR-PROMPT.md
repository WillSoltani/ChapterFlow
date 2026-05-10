# v21 Operator Prompt

Copy the section below into another agent (Sonnet, GPT, Claude, anything that can run a shell). The agent will produce one complete book end-to-end through the v21 pipeline.

---

## Mission

Produce a complete v21-native book package at `book-packages/<bookId>.v21.json` for the book given to you. The pipeline does all the writing, polishing, validation, and promotion. Your job is to drive it correctly.

## What v21 produces (so you know what success looks like)

For each chapter:
- A 60–120 char hook (first thing a reader sees)
- A 1–2 sentence counterintuition (what makes the idea non-obvious; optional)
- Pre-read and post-read reflection prompts
- A 140–220 char key takeaway
- Three progressive breakdown tiers (fastRead grade 8–9, deepRead 10–12, fullRead 12+) with line-editor polish
- 3–9 examples with named protagonists, specific scenes, decision points, mixed formats
- A 6–12 question quiz (application, not recall; uniform answer-position distribution)
- 3–7 retrieval-practice review cards
- Implementation plan with if-then trigger plans, 24-hour challenge, weekly practice
- 3 memorable lines marked for downstream highlighting

A chapter cannot ship unless it passes the **ship gate** (24+ blocker categories from `FAILURE-MODES.md`). A book cannot promote to `book-packages/` unless every chapter ship-gates AND the book passes the **book gate** (cumulative answer-position balance, no within-book name duplication, voice consistency).

## Inputs you need from the user

1. **Book title** — e.g., "How to Win Friends and Influence People"
2. **Author** — e.g., "Dale Carnegie"
3. **Slug / bookId** — kebab-case, e.g., "how-to-win-friends-and-influence-people"
4. **Chapter list** — number + title for every chapter you should generate. If the user doesn't provide one, look up the table of contents from a public source and confirm with them before proceeding.

## What you do, step by step

### 1. Ensure the chapter index exists

Write the chapter list to `scripts/book/prompts/chapterflow-v21-authored/state/indexes/<bookId>.json` as an array:

```json
[
  { "chapterId": "<bookId>-ch01", "chapterNumber": 1, "chapterTitle": "..." },
  { "chapterId": "<bookId>-ch02", "chapterNumber": 2, "chapterTitle": "..." }
]
```

### 2. (Optional) Check for a source-freeze bundle

If `.chapterflow/runs/<bookId>/<latest-run>/sidecars/source/ch01.source.txt` exists, the writer will use it for grounding. If not, the writer falls back to world knowledge — fine for canonical books, marginal for obscure ones.

### 3. Verify the active provider works

```bash
npx tsx scripts/book/prompts/chapterflow-v21-authored/src/cli.ts ping
```

This should print `{"ok": true, ...}`. If not, install/login to Claude Code CLI or set `CHAPTERFLOW_PROVIDER` + the corresponding API key. See `README.md` for provider configuration.

### 4. Run the pipeline

```bash
npx tsx scripts/book/prompts/chapterflow-v21-authored/src/cli.ts generate-book <bookId> \
  --title "<Book Title>" \
  --author "<Author Name>"
```

This invokes:
- Editor-in-chief (one call, cached) → `state/briefs/<bookId>.brief.json`
- Per chapter: planner → hook + breakdown (parallel) → voice-pass (iterative, max 3) → line-editor → examples (3 candidates × N slots, curator picks) → quiz/cards/plan/reflections (parallel) → memorable-lines → ship gate → library ingest
- After all chapters: book gate → promotion to `book-packages/<bookId>.v21.json`

Per-chapter wall time: ~13–15 minutes on the Anthropic CLI provider. A 38-chapter book takes 8–10 hours sequential, ~3 hours with chapter-level parallelism (which is not yet implemented; just run multiple books in parallel for now).

### 5. Verify success

The CLI exits 0 if promotion succeeded. Check that:

- `book-packages/<bookId>.v21.json` exists. This is the production package.
- `state/books/<bookId>.gate.json` exists with detailed gate findings.
- The output prints `✓ PROMOTED: <bookId>`.

If you see `✗ BLOCKED`, look at `state/books/_blocked/<bookId>.<timestamp>.report.json` for the failure reasons. Common blockers:
- Meta-references in prose ("the chapter", "the author") → writer drift; re-run the affected chapter
- Non-canonical Bloom's level → quiz writer issue; re-run
- Ship gate found em dashes → defense-in-depth caught it; re-run

### 6. If a chapter fails ship-gate during generation

The orchestrator quarantines failed drafts to `state/chapters/_blocked/`. Three options:
- Delete the quarantine file and re-run `generate-book` (the orchestrator will retry that chapter)
- Inspect the quarantine to understand why
- If a specific blocker keeps failing, file an issue against `FAILURE-MODES.md`

### 7. (Optional) Re-promote after manual fixes

If you fix a chapter manually:

```bash
npx tsx scripts/book/prompts/chapterflow-v21-authored/src/cli.ts promote-book <bookId> \
  --title "<Book Title>" --author "<Author Name>"
```

This re-runs every gate and writes to `book-packages/` only if all blockers clear.

## What you do NOT do

- Do not edit chapter files directly — the ship gate is the only path to promotion. Manual edits skip the catalog and will produce drift.
- Do not bypass the ship gate. If it blocks, fix the cause; don't disable the check.
- Do not run more than one `generate-book` for the same book at the same time. The library ledger uses a file-lock, but cached briefs/plans can race.

## Reporting

When you finish, tell the user:
1. The book ID and the path to the v21 package
2. Wall time for the run
3. Ship-gate / book-gate findings (blockers, majors)
4. Estimated cost (if running on a paid API)
5. Any chapters that needed retry, and why

Tell them whether the package is production-quality or has open issues that need a human pass.
