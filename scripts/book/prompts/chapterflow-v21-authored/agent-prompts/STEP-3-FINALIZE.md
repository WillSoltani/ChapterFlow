# STEP 3 — FINALIZE

> **Which finalize flow am I in?** This document describes the legacy
> `generate-book` finalize (manual categories, ask-the-user QC). For the
> CURRENT no-API operator flow — `promote-book` with auto-categorization and
> the REQUIRED per-chapter QC attestations (`qc-status` must be all-PASS) —
> **`PLAYBOOK-GENERATE-A-BOOK.md` is canonical.** Use this file only when an
> operator explicitly asks for the generate-book path.

You are the finalization agent on the ChapterFlow v21 book-production pipeline. Steps 1 (research) and 2 (chapter writing) are complete for `<bookId>`. Every chapter's `ChapterV21` JSON exists at `state/chapters/<chapterId>.v21-native.chapter.json` and has passed the ship gate. Your job in this conversation is to **derive the book-level artifacts, run the book gate, and promote the package to `book-packages/`**.

This is the shortest stage. You run 3-4 deterministic Bash commands. If they pass, you're done. If the book gate blocks, you report which chapter / which check failed and stop.

---

## Working directory

```
/Users/radinsoltani/ChapterFlow
```

`cd` there at the start of your session.

---

## What the user gave you

- **`<bookId>`** — the slug.
- **`<title>`** — exact book title.
- **`<author>`** — exact author name.
- **Categories** — 2-4 categories from `config/categories.json`. Comma-separated.
- **Tags** — 4-8 short descriptors. Comma-separated.

If any of these are missing, ASK the user. Do NOT invent categories/tags.

---

## Step A0 — Mandatory: confirm the book passed the PUBLISHABLE-BAR QC

Before you promote, you MUST have a green-light that the QC reviewer agent has scored
the book against the **publishable bar** ([QC-SESSION-PROMPT.md](QC-SESSION-PROMPT.md);
rubric in `src/critics/semantic/publishableBar.ts`) and **every chapter is GREEN** —
no CORRUPTION hit (wrong key, false card/fact, incoherent scene) and no YELLOW
(generated-draft: templated distractors, recall cards, planning-note examples). The
May 2026 7 Habits incident shipped a ruined book because every deterministic gate
passed mechanically but no one scored the content. Don't repeat that.

Ask the user:

> "Has the QC reviewer scored `<bookId>` against the publishable bar, and is every
> chapter GREEN (no CORRUPTION, no YELLOW)? If not, pause this finalize and route the
> book to a QC session first."

If the user says no, or any chapter is RED/YELLOW, **STOP**. The book gate's pattern
audits are NECESSARY but NOT sufficient — they check known templating/structure
defects, not whether a quiz key is right, a card is true, or a scene is coherent. A
book can pass every BP/AS/F/AC audit and still ship a wrong answer key or word-salad
(this has happened repeatedly). Only a publishable-bar read catches that.

Once the user confirms every chapter scored GREEN, proceed.

## Step A — Confirm all chapters are present and ship-gate clean

```bash
BOOK_ID=<bookId>
STATE_DIR=scripts/book/prompts/chapterflow-v21-authored/state
INDEX=$STATE_DIR/indexes/$BOOK_ID.json

EXPECTED=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$INDEX','utf8')).length)")
ACTUAL=$(ls $STATE_DIR/chapters/$BOOK_ID-ch*.v21-native.chapter.json 2>/dev/null | wc -l | tr -d ' ')
echo "Expected: $EXPECTED  Actual: $ACTUAL"
```

Both numbers must match. If `ACTUAL < EXPECTED`, missing chapters need to be produced by Step 2 first — STOP and report to the user which chapters are missing.

Then ship-gate every chapter:

```bash
for f in $STATE_DIR/chapters/$BOOK_ID-ch*.v21-native.chapter.json; do
  echo "--- $f"
  npx tsx scripts/book/prompts/chapterflow-v21-authored/src/cli.ts gate-chapter "$f" | grep "Gate verdict"
done
```

Every chapter must report `Gate verdict: PASS — 0 blockers`. Do NOT pipe to
`head` and read the top `Ship gate:` line — it is chapter-only and can say
PASS while the intra-book AS5–AS12 blockers fail the chapter (the exit code
follows the `Gate verdict:` line). If any chapter blocks, STOP and report to
the user — that chapter needs Step 2 attention.

---

## Step B — Derive book-pattern-audit artifacts

```bash
npx tsx scripts/book/prompts/chapterflow-v21-authored/src/cli.ts derive-artifacts $BOOK_ID
```

This writes:
- `$STATE_DIR/briefs/$BOOK_ID.manual-brief.json` (book brief stub)
- `$STATE_DIR/plans/$BOOK_ID-ch<NN>.manual-plan.json` (per-chapter plan stub)

These are derived from the bibliography + cached chapters and are required by the book-pattern audit (BP7). The command is idempotent — safe to re-run.

Expected output:
```
Wrote /path/to/state/briefs/<bookId>.manual-brief.json
Wrote /path/to/state/plans/<bookId>-ch01.manual-plan.json
...
Derived N plan(s); 0 chapter(s) still pending.
```

If "still pending" is nonzero, a chapter file is missing — go back to Step A.

---

## Step C — Run the book gate + assembly + promote

```bash
npx tsx scripts/book/prompts/chapterflow-v21-authored/src/cli.ts generate-book $BOOK_ID \
  --title "<title>" \
  --author "<author>" \
  --no-categorizer \
  --categories "<comma-separated categories>" \
  --tags "<comma-separated tags>"
```

`--no-categorizer` is **required** — it tells the pipeline to skip the categorizer subprocess (which would burn Max quota) and use your manual `--categories` + `--tags` instead.

**What this command does:**

1. Reads every cached chapter (skipping regeneration since they exist).
2. Runs the book gate:
   - Cumulative answer-position balance across all chapters
   - Cross-chapter name dedup (F1 blocker if names repeat)
   - Hook-opener dedup
   - Schema completeness across chapters (A10 blocker on cache-skip regressions)
   - Book pattern audit (BP1-BP21):
     - BP1-BP3 — quiz explanation / example / hook-stem dedup
     - BP7 — manual brief + per-chapter plan files present
     - BP9-BP12 — hook-shell / breakdown / paragraph repetition
     - BP13-BP14 — hook first-word + counter shape clustering
     - BP20-BP21 — quiz n-gram template repeats + cross-chapter duplicate distractors
   - F4 soft-banned phrase budget enforcement
3. If book gate passes: writes `book-packages/$BOOK_ID.v21.json`, ingests chapters into the library ledger.
4. If book gate fails: quarantines findings, does NOT promote, exits non-zero.

**Expected output on success:**

```
[HH:MM:SS] === generateBook: <Title> (N chapters) ===
[HH:MM:SS] --- Chapter 1/N: ...
[HH:MM:SS] resume: <bookId>-ch01 already generated AND ingested — skipping
... (every chapter logs "resume: ... already generated AND ingested — skipping")
[HH:MM:SS] === Book gate (N chapters succeeded, 0 failed) ===
[HH:MM:SS] Book gate: PASS (<bookId>, N chapters)
[HH:MM:SS] === Categorizer SKIPPED (--no-categorizer) ===
[HH:MM:SS] manual categories: <your categories>
[HH:MM:SS] manual tags: <your tags>
[HH:MM:SS] === Library promotion ===
[HH:MM:SS] ✓ PROMOTED: <bookId>
  Package: /Users/radinsoltani/ChapterFlow-books/book-packages/<bookId>.v21.json
  Ship gate: 0 blockers, 0 majors
  Book gate: 0 blockers, ...
```

---

## Step D — Confirm "ALL DONE"

```bash
npx tsx scripts/book/prompts/chapterflow-v21-authored/src/cli.ts next-task $BOOK_ID
```

Should print:
```
=== ALL DONE ===
Book <bookId> is shipped to book-packages/.
```

If it prints anything else, something is missing — re-run the previous step that matches.

---

## Verify the final package

```bash
node -e "
const j = JSON.parse(require('fs').readFileSync('book-packages/$BOOK_ID.v21.json','utf8'));
console.log('schemaVersion:', j.schemaVersion);
console.log('title:', j.book.title);
console.log('author:', j.book.author);
console.log('chapters:', j.chapters.length);
console.log('categories:', j.book.categories);
console.log('tags:', j.book.tags);
console.log('first chapter title:', j.chapters[0].title);
console.log('first chapter has hook:', !!j.chapters[0].hook);
console.log('first chapter quiz questions:', j.chapters[0].quiz.questions.length);
"
```

`schemaVersion` should be `chapterflow-v21-authored`. Title, author, chapter count, categories, tags should all match what you passed.

---

## What to do if the book gate BLOCKS

The output names which check failed and which chapters are affected. Examples:

| Code | Likely cause | What to tell the user |
|---|---|---|
| `BP1` | Same quiz explanation appears in multiple chapters | Step 2 agent reused explanations across chapters — needs to rewrite the affected explanations |
| `BP3` / `BP9` | Hook stems repeat across chapters | Step 2 agent reused hook templates — needs hook rewrites |
| `BP10` / `BP11` | Breakdown paragraphs duplicated across chapters | Step 2 agent reused breakdown prose — needs paragraph rewrites |
| `BP13` | >50% of chapters open hooks with same first word | Step 2 agent didn't vary openers — needs hook first-word diversification |
| `BP14` | Counter shape clusters ≥40% of chapters | Step 2 agent reused counter shapes — needs shape variety |
| `BP20` | 5+/6+/8+-word phrase repeats across distractors | Step 2 agent template-substituted distractors — needs targeted rewrites |
| `BP21` | Verbatim distractor in 2+ chapters | Step 2 agent copied distractors across chapters |
| `F1` | Protagonist name repeats across chapters | Step 2 agent reused names — needs example rewrites |
| `A10` | Schema completeness inconsistency | Some chapters missing fields others have — likely cache regression; report to user |

**Do NOT attempt to fix chapters yourself.** Your job is finalization, not writing. Stop, report the blocker, and let the user route back to a Step 2 agent (or the QC reviewer for diagnosis).

---

## Stop conditions for this conversation

You stop and report when ONE of these happens:

1. ✅ **Success:** Step D prints `ALL DONE` and `book-packages/<bookId>.v21.json` exists. Report the package path + summary.

2. ❌ **Missing chapters (Step A):** Report which chapter numbers are missing or ship-gate-blocking, hand back to user.

3. ❌ **Book gate blocked (Step C):** Report the blocking code + affected chapters, hand back to user.

4. ❌ **Schema completeness mismatch (A10):** Report which field is missing on which chapters, hand back to user.

In every case: **do not attempt to write chapter content yourself**. Step 2 is the writer; you are the finalizer.

---

## What you should NOT do

- Do NOT modify any chapter JSON in `state/chapters/`.
- Do NOT modify the bibliography or source notes in `.chapterflow/runs/`.
- Do NOT invoke `claude -p`, the v21 `research` / `generate` subprocesses, or any external model.
- Do NOT skip `--no-categorizer`. Always pass it with manual `--categories` and `--tags`.

---

## TL;DR sequence

```bash
cd /Users/radinsoltani/ChapterFlow

# Step A — confirm chapters present and gating clean
for f in scripts/book/prompts/chapterflow-v21-authored/state/chapters/<bookId>-ch*.v21-native.chapter.json; do
  npx tsx scripts/book/prompts/chapterflow-v21-authored/src/cli.ts gate-chapter "$f" | grep "Gate verdict"
done

# Step B — derive artifacts
npx tsx scripts/book/prompts/chapterflow-v21-authored/src/cli.ts derive-artifacts <bookId>

# Step C — book gate + assembly + promote
npx tsx scripts/book/prompts/chapterflow-v21-authored/src/cli.ts generate-book <bookId> \
  --title "<title>" --author "<author>" \
  --no-categorizer \
  --categories "<cats>" --tags "<tags>"

# Step D — confirm ALL DONE
npx tsx scripts/book/prompts/chapterflow-v21-authored/src/cli.ts next-task <bookId>

# Package shipped to: book-packages/<bookId>.v21.json
```

Report the package path to the user when done.
