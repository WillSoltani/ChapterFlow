# v21 Per-Book Migration Prompt

Paste this into a fresh Sonnet 4.6 or GPT-5.5 chat session that has shell + code access to the chapterflow-siliconx repo. Replace `<BOOK_ID>` with the slug of the book you want to migrate (e.g., `atomic-habits`, `the-prince`, `thinking-fast-and-slow`).

The agent will regenerate that book as v21, ship it through every gate, integrate it with the reader UI if needed, and upload it to your production app — all in one chat session.

---

## Mission

Migrate `<BOOK_ID>` from v13 to v21 end-to-end. Single session. By the time you're done:

- `book-packages/<BOOK_ID>.v21.json` exists, ship-gate-clean and book-gate-clean.
- The legacy `book-packages/<BOOK_ID>.modern.json` has been moved to `book-packages/_legacy/`.
- The reader app renders this book correctly using v21 fields (hook, reflections, memorable lines, fastRead/deepRead/fullRead tiers).
- The book is uploaded and live in the production app.

## Working directory

`/Users/radinsoltani/ChapterFlow` — `cd` here at the start.

## Read these before you do anything

1. [scripts/book/prompts/chapterflow-v21-authored/FAILURE-MODES.md](FAILURE-MODES.md) — the v21 quality contract. Every rule the ship gate enforces.
2. [scripts/book/prompts/chapterflow-v21-authored/OPERATOR-PROMPT.md](OPERATOR-PROMPT.md) — operator manual for `generate-book`.
3. [scripts/book/prompts/chapterflow-v21-authored/README.md](README.md) — pipeline architecture overview.

After reading, briefly summarize back to the user: which book you'll migrate, where the v13 source is, and how many chapters it has. Confirm before proceeding.

## Phase 0 — One-time setup (skip if already done)

Check whether these files exist. If yes, the setup work is already done — skip Phase 0.

| File | Purpose |
|---|---|
| `app/book/lib/v21-adapter.ts` | Schema adapter mapping v21 → unified UI shape |
| `app/book/library/[bookId]/chapter/[chapterId]/components/HookBanner.tsx` | Renders the v21 `hook` field |
| `app/book/library/[bookId]/chapter/[chapterId]/components/TryThisNow.tsx` | Renders the `tryThisNow` directive as a mid-chapter callout (NOT a question/textarea) |
| `app/book/library/[bookId]/chapter/[chapterId]/components/MemorableLines.tsx` | Renders `memorableLines[]` with copy-to-clipboard |
| `app/book/library/[bookId]/chapter/[chapterId]/components/ReadingDepthSwitch.tsx` | Toggle between `fastRead` / `deepRead` / `fullRead` |

If any are missing, do this once before doing the book:

1. Read [scripts/book/prompts/chapterflow-v21-authored/src/types.ts](src/types.ts) carefully — that's the v21 schema you must consume.
2. Build `v21-adapter.ts` with this signature:
   ```ts
   export function adaptChapter(raw: unknown): UnifiedChapterView {
     // Branches on raw.schemaVersion. For "chapterflow-v21-authored", maps:
     //   breakdown.fastRead/deepRead/fullRead -> tiers.{easy,medium,hard}
     //   hook, counterintuition, reflectionBefore/After, memorableLines -> v21-only optional fields
     // For legacy v13, returns the legacy shape with v21-only fields = undefined.
   }
   ```
3. Build the four UI components above. Each is small (~50–100 lines). They should:
   - `HookBanner` — display `hook` text in a bold one-liner above the chapter title; show `counterintuition` underneath if present.
   - `TryThisNow` — renders the `tryThisNow` directive as a mid-chapter callout block (e.g., bordered, italicized, with a small "try this" label). NO textarea, NO question framing, NO save button. It's a directive embedded in the reading experience, like a magazine pull-quote that happens to ask the reader to do a small thing. Shown once between deepRead and the implementation plan, or near the chapter's natural pause point.
   - `MemorableLines` — renders an expandable list at chapter end with three quotes, each with a "copy" button.
   - `ReadingDepthSwitch` — three-button segmented control. Stores choice in localStorage. Replaces the existing tone toggle (gentle/direct/competitive) for v21 chapters.
4. Wire these into [ChapterReaderClient.tsx](../../../../app/book/library/[bookId]/chapter/[chapterId]/ChapterReaderClient.tsx). The existing component should branch on `schemaVersion` from the data layer and use either the legacy tone toggle or the new `ReadingDepthSwitch`, plus render the v21-only surfaces when present.
5. Run `npm run typecheck` and confirm clean.
6. Run `npm run dev` and visually verify nothing existing broke. (The Carnegie v21 chapters at `state/chapters/` are good test fixtures — temporarily symlink one into the local DB or create a dev route that loads from disk.)

## Phase 1 — Generate the v21 book

1. **Verify provider is reachable:**
   ```bash
   npx tsx scripts/book/prompts/chapterflow-v21-authored/src/cli.ts ping
   ```
   Expect `{"ok": true, ...}`. If not, the user needs to install `claude` CLI (`npm i -g @anthropic-ai/claude-code` then `claude /login`) or set `CHAPTERFLOW_PROVIDER` + an API key.

2. **Confirm a chapter index exists for the book.** Pre-built indexes live at `state/indexes/<BOOK_ID>.json`. v13 packages and the `extract-chapter-index.ts` helper have been retired — for any new book without a pre-built index, write `state/indexes/<BOOK_ID>.json` by hand (`{ "bookId", "title", "author", "chapters": [{ "number", "title" }, ...] }`).

3. **Run the pipeline. This takes ~14 minutes per chapter.** A 25-chapter book is ~6 hours sequential. Use a background task and monitor for milestones:
   ```bash
   npx tsx scripts/book/prompts/chapterflow-v21-authored/src/cli.ts generate-book <BOOK_ID> \
     --title "<TITLE>" \
     --author "<AUTHOR>"
   ```
   Pull title and author from the v13 package's `book.title` and `book.author` fields.

   While it runs, monitor for: `hook:`, `chapter done:`, `Ship gate:`, `Book gate:`, `PROMOTED`, `BLOCKED`, `Error`, `FAILED`.

4. **If a chapter fails ship-gate**, the run aborts and the failed draft is in `state/chapters/_blocked/`. Inspect the report — it lists the catalog blockers. Almost always the fix is just to re-run `generate-book`, which auto-resumes (cached chapters skip, only the failed one regenerates).

5. **Verify the package was promoted:**
   ```bash
   ls -la book-packages/<BOOK_ID>.v21.json
   node scripts/book/validate-book.mjs book-packages/<BOOK_ID>.v21.json
   ```
   Validator should print `RESULT: PASS`.

6. **Spot-read at least 2 chapters** by opening the JSON. Look for: hook landing, reflectionBefore/After present, memorableLines populated, examples have named protagonists with specific scenes, no meta-references in the prose.

## Phase 2 — Migration to library

1. **Move v13 backup:**
   ```bash
   mkdir -p book-packages/_legacy
   mv book-packages/<BOOK_ID>.modern.json book-packages/_legacy/
   ```

2. **Test in the local reader app:**
   ```bash
   npm run dev
   ```
   Open the book in the app. Confirm:
   - Hook displays at chapter top
   - Reading depth switch shows fastRead/deepRead/fullRead options (not gentle/direct/competitive)
   - The `tryThisNow` directive renders as a mid-chapter callout (no textarea)
   - Memorable lines section renders at chapter end
   - Examples, quiz, cards, implementation plan all render correctly
   - No console errors

   If anything looks broken, fix the adapter or component before continuing.

## Phase 3 — Upload to production app

```bash
node scripts/book/upload-book-package.mjs \
  --origin https://<your-app-domain> \
  --token "<COGNITO_ID_TOKEN>" \
  --file book-packages/<BOOK_ID>.v21.json \
  --publish
```

Ask the user for the origin and token if you don't have them. Don't proceed without explicit confirmation.

After upload, verify in the production app: navigate to the book, open a chapter, confirm the v21 surfaces render correctly.

## Phase 4 — Report back

When you're done, tell the user:

1. What shipped: book ID, chapter count, file path, file size.
2. Wall time and (if API was used) cost.
3. Ship gate findings: blockers (always 0 for shipped books), majors, minors. Highlight any major worth a human eye.
4. Book gate findings: same.
5. UI integration: what you added or modified, anything still rough.
6. Confirmation that the production app shows the new content correctly.

If anything is still rough or unfinished, say so explicitly. Don't oversell.

## Hard rules (don't violate)

- **Don't bypass the ship gate.** If it blocks, fix the cause; don't disable.
- **Don't edit chapter files manually.** Manual edits skip the catalog.
- **Don't run two `generate-book` for the same book at once.** The library ledger has a file-lock but cached briefs/plans can race.
- **Don't ship to production without verifying locally first.**
- **Don't proceed without the user's confirmation** at the start (which book?) and before upload (origin + token).

## What to do if you get stuck

- Quarantined chapter? Look at the `_blocked/` report, identify the failing catalog ID (B1, C7, etc.), fix the upstream cause if you can, otherwise re-run `generate-book` — usually a single retry succeeds.
- Validator rejecting v21? Confirm `validate-book.mjs` was patched to accept `chapterflow-v21-authored` as a supported schema version.
- UI not rendering? Check the adapter handles both `schemaVersion` values. Use console logging to confirm what shape the chapter data is in by the time it reaches the components.
- Pipeline never finishes? Check the active provider (`ping`). Check for rate limits or timeouts in the logs. Resume — the orchestrator skips completed chapters.
