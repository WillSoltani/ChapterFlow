# PLAYBOOK — Operator-driven finalization

Once every chapter has its own `state/chapters/<bookId>-ch<NN>.v21-native.chapter.json` and each has passed the ship gate, this playbook runs the book-level gate, assembles the package, and promotes to `book-packages/<bookId>.v21.json`.

No model calls in this step — purely deterministic Bash invocations.

---

## Inputs you need

- The same `<bookId>` used during research + per-chapter generation.
- A short list of categories and tags (you choose these, no model call).

## Step 1 — Verify every chapter exists and ship-gates clean

```bash
BOOK_ID=<bookId>
STATE_DIR=scripts/book/prompts/chapterflow-v21-authored/state
INDEX=$STATE_DIR/indexes/$BOOK_ID.json

# Count expected chapters
EXPECTED=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$INDEX','utf8')).length)")

# Count chapters with output files
ACTUAL=$(ls $STATE_DIR/chapters/$BOOK_ID-ch*.v21-native.chapter.json 2>/dev/null | wc -l | tr -d ' ')

echo "Expected: $EXPECTED  Actual: $ACTUAL"
[ "$EXPECTED" = "$ACTUAL" ] && echo "all chapters present" || echo "MISSING — run per-chapter playbook first"

# Ship-gate each chapter
for f in $STATE_DIR/chapters/$BOOK_ID-ch*.v21-native.chapter.json; do
  echo "---"
  echo "Gating: $f"
  npx tsx scripts/book/prompts/chapterflow-v21-authored/src/cli.ts gate-chapter "$f"
done
```

If any chapter blocks, fix it (re-edit the JSON, re-run the gate) before proceeding.

---

## Step 2 — Derive BP7 artifacts

The book-pattern audit (BP7) requires a manual brief stub + per-chapter plan stubs. Inline-operator mode doesn't produce these directly, so derive them from the bibliography + cached chapters:

```bash
npx tsx scripts/book/prompts/chapterflow-v21-authored/src/cli.ts derive-artifacts $BOOK_ID
```

This writes:
- `state/briefs/<bookId>.manual-brief.json`
- `state/plans/<chapterId>.manual-plan.json` for each cached chapter

The derived plans use the chapter's own `keyTakeaway` as `coreMove`, the actual `quiz.questions` length and Bloom's distribution as `quizFocus`, and the actual `examples[].planSpec` entries. Operator can hand-edit these if a particular chapter needs a different `coreMove` framing.

---

## Step 3 — Run book gate + promote

The `generate-book` CLI command, with `--no-categorizer`, reads every cached chapter, runs the book gate, then promotes to `book-packages/`. No subprocess model calls because:
- Editor-in-chief: skipped (you wrote chapters directly, not from a brief)
- Curriculum planner: skipped (same)
- Writers: skipped (chapters already exist on disk)
- Categorizer: skipped via `--no-categorizer`

```bash
npx tsx scripts/book/prompts/chapterflow-v21-authored/src/cli.ts generate-book <bookId> \
  --title "<title>" --author "<author>" \
  --no-categorizer \
  --categories "Productivity,Habits" \
  --tags "habits,systems,compounding"
```

Pick categories from [config/categories.json](../config/categories.json) (2-4 of them). Pick tags freely (4-8 short descriptors that describe the book's content).

The command:
1. Skips chapter generation (every chapter cached on disk)
2. Runs `runBookGate` (cumulative answer balance, cross-chapter name dedup, voice consistency, n-gram template repeat, cross-chapter duplicate distractor, schema completeness, F4 soft-banned phrase budget)
3. If book gate passes, promotes to `book-packages/<bookId>.v21.json`
4. Ingests every chapter into the cross-book ledger
5. Quarantines to `state/books/_blocked/` on failure

---

## Step 4 — Verify the final package

```bash
node -e "
const j = JSON.parse(require('fs').readFileSync('book-packages/<bookId>.v21.json','utf8'));
console.log('schemaVersion:', j.schemaVersion);
console.log('book:', j.book.title, 'by', j.book.author);
console.log('chapters:', j.chapters.length);
console.log('categories:', j.book.categories);
console.log('tags:', j.book.tags);
"
```

---

## Done

The book is live in `book-packages/`. The upload-book-package flow can pick it up; the library ledger has all the protagonist names + phrase budgets recorded for the next book's writer pass to avoid.
