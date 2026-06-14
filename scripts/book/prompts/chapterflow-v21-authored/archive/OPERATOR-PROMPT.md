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

A chapter cannot ship unless it passes the **ship gate** (24+ blocker categories from `FAILURE-MODES.md`). A book cannot promote to `book-packages/` unless every chapter ship-gates AND the book passes the **book gate**:
- Cumulative answer-position balance (≤45% in any single position across the whole book)
- **Within-book name duplication** (BLOCKER): no recurring protagonist name (named character mentioned 2+ times in one chapter's scenes) appears in more than one chapter
- **Schema completeness** (BLOCKER, A10): every chapter must carry the same set of fields (memorableLines, counterintuition, etc.). Catches cache-skip regressions where a later pipeline version added a field but earlier-cached chapters silently shipped without it
- Voice consistency: per-chapter sentence-length means within ±7 of the book mean

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
- Per chapter: planner → hook + breakdown (parallel) → voice-pass (iterative, max 3) → line-editor → examples (3 candidates × N slots, curator picks) → quiz/cards/plan/try-this-now (parallel) → memorable-lines → ship gate → library ingest (atomic — concurrent book runs are safe; the ledger uses `withLibraryState`)
- After all chapters: book gate (cumulative answer-positions, name dup blocker, schema completeness, voice) → categorizer (assigns 2–4 canonical categories + 4–8 tags from `config/categories.json`, cached at `state/books/<bookId>.categories.json`) → promotion to `book-packages/<bookId>.v21.json`

Per-chapter wall time: ~10–13 minutes on the Anthropic CLI provider after the cards-writer reverse-priming fix landed. A 25-chapter book runs in ~4–5 hours sequential. Multiple books can run in parallel safely.

### 5. Verify success

The CLI exits 0 if promotion succeeded. Check that:

- `book-packages/<bookId>.v21.json` exists. This is the production package.
- `state/books/<bookId>.gate.json` exists with detailed gate findings.
- The output prints `✓ PROMOTED: <bookId>`.

If you see `✗ BLOCKED`, look at `state/books/_blocked/<bookId>.<timestamp>.report.json` for the failure reasons. Common blockers:
- **Meta-references in prose** ("the chapter", "the author") → writer drift; re-run the affected chapter. The cards-writer was the dominant offender pre-hardening (36% of HWF chapters); after the brief-sanitizer + structural-only system prompt landed, it's near-zero.
- **Non-canonical Bloom's level** → quiz writer issue; re-run.
- **Em dashes** → defense-in-depth caught it; re-run.
- **F1 within-book name dup**: two chapters use the same recurring protagonist name. Delete the affected `state/chapters/<bookId>-chNN.v21-native.chapter.json` files and re-run those chapters, or hand-rename in-place via [src/scratch/swap-recurring-names.ts](src/scratch/swap-recurring-names.ts).
- **A10 schema inconsistency**: most chapters have a field (e.g. `memorableLines`) but some don't — usually because they were generated before that agent existed and auto-resumed from cache. Run [src/scratch/backfill-memorable-lines.ts](src/scratch/backfill-memorable-lines.ts) `<book-package.json>` to fill the gap.

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
- Do not run more than one `generate-book` for the **same** book at the same time — cached briefs/plans can race. Different books in parallel are safe (the library ledger now uses an atomic-create lock + `withLibraryState` for the entire load-modify-write cycle).

## Reporting

When you finish, tell the user:
1. The book ID and the path to the v21 package
2. Wall time for the run
3. Ship-gate / book-gate findings (blockers, majors)
4. Estimated cost (if running on a paid API)
5. Any chapters that needed retry, and why

Tell them whether the package is production-quality or has open issues that need a human pass.
