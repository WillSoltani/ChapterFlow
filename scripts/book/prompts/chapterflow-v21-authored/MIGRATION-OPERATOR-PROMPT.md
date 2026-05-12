# v13 → v21 Migration: Per-Book Operator Prompt (Claude Code / pipeline path)

Paste this entire document into a fresh Claude Code session. The agent will migrate ONE book end-to-end through the deterministic pipeline: `generate-book` spawns the Anthropic Code CLI subprocess (free under Claude Max), produces the v21 package, validates, scores, publishes to production catalog, and wires it into library metadata.

> If you're driving migrations from a GPT/Codex session, use [MIGRATION-CODEX-PROMPT.md](MIGRATION-CODEX-PROMPT.md) instead — that flow has the GPT agent write chapters inline (Pro/Max sub, no API key, no paid spend).

Before pasting, replace **`<BOOK_ID>`** everywhere below with the kebab-case bookId from the next `○ ready` row in [MIGRATION-ROSTER.md](MIGRATION-ROSTER.md).

> **CRITICAL — bookId MUST be lowercase kebab-case.** Always use the value from the `bookId` column of MIGRATION-ROSTER.md (e.g. `getting-things-done`, `atomic-habits`, `the-power-of-habit`). Do **NOT** use the casing from the v13 filename, the book title, or any other source — only the roster's bookId column. The publish step rejects non-kebab-case bookIds, and rejects kebab-case bookIds that collide with an existing catalog row under a different normalized form (e.g. `you-cant-hurt-me` colliding with `you-can't-hurt-me`).

---

## Mission

Migrate `<BOOK_ID>` from v13 (`book-packages/<BOOK_ID>.modern.json`) to v21. Produce `book-packages/<BOOK_ID>.v21.json`, ship it to the production DynamoDB catalog, register it in the library metadata, and report back.

The chapter index is already written at `scripts/book/prompts/chapterflow-v21-authored/state/indexes/<BOOK_ID>.json`. Title and author are in the v13 package's `book.bookId/title/author` fields — read them once at the start.



## Step 1 — Read book metadata

```bash
jq '.book | {bookId, title, author}' book-packages/<BOOK_ID>.modern.json
```

Capture `title` and `author` for use in the next steps. **Some v13 titles
have stray curly quotes and dashes** baked into the data (e.g.
`"<BOOK_ID>"` instead of `Smarter Faster Better`, or
`"Charles-Duhigg"` instead of `Charles Duhigg`). Clean those before passing
to the pipeline:
- Strip leading/trailing curly quotes (`"`, `"`, `'`, `'`)
- Replace hyphens with spaces in the title and author
- Capitalize properly

Use the cleaned values for the `--title` and `--author` flags in step 3, and
in the catalog metadata at step 7.

## Step 2 — Confirm the chapter index is ready

```bash
jq 'length' scripts/book/prompts/chapterflow-v21-authored/state/indexes/<BOOK_ID>.json
```

Expect a number (the chapter count). If the file doesn't exist, run:

```bash
npx tsx scripts/book/prompts/chapterflow-v21-authored/src/scratch/extract-all-chapter-indexes.ts
```

## Step 3 — Generate v21 content

```bash
npx tsx scripts/book/prompts/chapterflow-v21-authored/src/cli.ts generate-book <BOOK_ID> \
  --title "<title>" --author "<author>"
```

This invokes the full pipeline: editor-in-chief → planner → hook + breakdown → voice-pass → line-editor → examples (over-generated, curated) → quiz/cards/plan/try-this-now → memorable-lines → ship gate per chapter, then book gate → categorizer → promotion to `book-packages/<BOOK_ID>.v21.json`.

**Wall time**: ~10–13 minutes per chapter on the CLI provider. A 12-chapter book is ~2.5 hours.

If the run aborts on a ship-gate blocker:

- The failing chapter's quarantine report is at `scripts/book/prompts/chapterflow-v21-authored/state/chapters/_blocked/<BOOK_ID>-chNN.blocked.<timestamp>.json`. Read it.
- Common causes: meta-references in cards (rare post-fix; just retry), em dashes (defense-in-depth caught it; retry), within-book name dup (regenerate the offending example or use [src/scratch/swap-recurring-names.ts](src/scratch/swap-recurring-names.ts)).
- Delete the quarantine, then re-run `generate-book` — the orchestrator will resume from cache and only redo the failed chapter.

## Step 4 — Validate the package

```bash
node scripts/book/validate-book.mjs book-packages/<BOOK_ID>.v21.json
```

Must print `RESULT: PASS`. If not, fix the structural issue before publishing.

## Step 5 — Score the chapters

```bash
npx tsx scripts/book/prompts/chapterflow-v21-authored/src/scratch/score-chapters.ts \
  book-packages/<BOOK_ID>.v21.json
```

Read the output. Average score should be ≥95/100. If a chapter is below 90, look at the listed gaps; usually they're cosmetic (one short memorable line, a counter that didn't trigger the paradox heuristic). Decide whether to regenerate that chapter or accept and move on.

## Step 6 — Publish to the production DynamoDB catalog

```bash
npx tsx scripts/book/publish-single-package.ts --file book-packages/<BOOK_ID>.v21.json
```

Should print `✓ Published <BOOK_ID> v<N>`. The script:
1. Uploads the package JSON to `s3://<BOOK_INGEST_BUCKET>/book-ingest/bootstrap/...`
2. Calls `ingestBookPackageFromS3` which validates (v21 schema is accepted via the v21 adapter), writes the manifest + chapter files to `<BOOK_CONTENT_BUCKET>/book-content/books/<BOOK_ID>/v<NNNNNN>/...`, and updates the DDB catalog row.
3. Marks the new version as PUBLISHED and bumps `currentPublishedVersion`.

If the v13 entry was at v1, v21 publishes as v2. The new version is what the library list, book detail page, and reader will resolve to going forward.

## Step 7 — Wire into the library metadata

The library grid reads from `app/book/data/booksCatalog.metadata.json`. Add (or update) the entry for `<BOOK_ID>`. Use the v21 package's metadata as the source of truth:

```bash
# Compute estimated minutes (sum of chapter readingTimeMinutes)
jq '[.chapters[].readingTimeMinutes] | add' book-packages/<BOOK_ID>.v21.json

# Get the categories and tags the categorizer assigned
jq '.book | {categories, tags}' book-packages/<BOOK_ID>.v21.json
```

Then add an entry to `app/book/data/booksCatalog.metadata.json` modeled on the existing tiny-habits or how-to-win-friends-and-influence-people row:

```json
{
  "id": "<BOOK_ID>",
  "title": "<title>",
  "author": "<author>",
  "categories": [...from package],
  "category": "<first category>",
  "tags": [...from package],
  "chapterCount": <N>,
  "estimatedMinutes": <sum>,
  "icon": "📘",
  "coverImage": "/book-covers/<BOOK_ID>.svg",
  "difficulty": "Medium",
  "synopsis": "A modern reading of <author>'s <N> chapters on <theme>."
}
```

Pick an icon emoji that fits the topic (🧠 for psychology, 📊 for productivity, 🤝 for communication, 💼 for business, etc.). If a cover SVG doesn't exist at the listed path, that's fine — the reader will fall back to a default cover.

## Step 8 — Wire into the local bookPackages registry

**Required.** Without this, the dev server at localhost:3000 will serve the old v13 content to anyone testing locally, which means the migration looks broken until noticed.

Edit `app/book/data/bookPackages.ts` and mirror the existing tiny-habits / how-to-win-friends-and-influence-people pattern at all 7 sites:
1. `import` line at top
2. `<BOOK_NAME>_PACKAGE = normalizeAnyPackage(...)` constant
3. `<BOOK_NAME>_RAW_CHAPTERS = getRawChapters(...)` constant
4. `get<BookName>PackageForTone(tone)` function
5. Entry in `BOOK_PACKAGES` array (~line 1086)
6. Entry in `BOOK_PACKAGE_TONE_GETTERS` map (~line 1144)
7. Entry in `BOOK_PACKAGE_PRESENTATION` (~line 1264)

## Step 9 — Rebuild the global search index

```bash
npx tsx scripts/book/rebuild-search-index.ts
```

This re-reads the DDB catalog and writes a fresh search index to `<BOOK_CONTENT_BUCKET>/book-content/library/search-index.json`. The new book's chapter takeaways and examples become searchable.

## Step 10 — Mark this book done in the migration roster

```bash
npx tsx scripts/book/prompts/chapterflow-v21-authored/src/scratch/extract-all-chapter-indexes.ts
```

This re-scans `book-packages/`, sees the new `<BOOK_ID>.v21.json`, and updates `MIGRATION-ROSTER.md` so the book moves from `○ ready` to `✓ shipped`.

## Step 11 — Report back

Tell the user:
- `<BOOK_ID>` migrated, v21 package at `book-packages/<BOOK_ID>.v21.json`
- Wall time for the run
- Average score across chapters (from Step 5)
- Categories assigned (from Step 6)
- Production catalog version (e.g. "promoted as v2")
- Search index document count (Step 9 output)
- Any chapters that needed retry, and why
- Next pending bookId from the roster

## What to NOT do

- Don't edit chapter JSONs by hand (skip the gate). If a chapter fails, regenerate it.
- Don't run two `generate-book` invocations on the SAME book in parallel (briefs/plans cache-collide). Different books are fine — the librarian ledger is atomic.
- Don't bypass the ship gate or book gate. If a check blocks, fix the cause.
- Don't push to production without `validate-book.mjs` passing first.
- **A11 (BLOCKER): broken memorable lines.** Every `memorableLines[i].text` must appear verbatim in `breakdown.fastRead`, `breakdown.deepRead`, or `breakdown.fullRead`. The deterministic pipeline maintains this by construction (the memorable-lines agent extracts pins FROM the prose), but if you hand-edit a chapter after generation and accidentally rewrite a pinned sentence, the gate blocks promotion. Recovery: restore the original sentence, repoint the pin, or run `scripts/book/prompts/chapterflow-v21-authored/src/scratch/regenerate-broken-memorable-lines.ts --book <bookId>` to have the agent pick fresh pins from the new prose.
