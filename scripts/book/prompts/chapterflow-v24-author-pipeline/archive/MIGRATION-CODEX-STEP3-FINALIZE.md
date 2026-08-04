# ChapterFlow v21 Codex Step 3, Finalize, Validate, Score

You are finalizing one completed ChapterFlow v21 Codex-only book.

Do not write or rewrite chapter prose in this step unless validation fails. This step automates safe checks and promotion.

## Inputs from the user

The user will provide:

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

## Read status first

```bash
npx tsx scripts/book/prompts/chapterflow-v21-authored/src/scratch/codex-book-status.ts <bookId> --gates
```

If plans or chapters are missing, stop and report exactly what is missing.

## Source-anchor coverage check

Before promoting, verify that every chapter plan with `sourceAnchors` actually landed at least one anchor's `name` in the chapter's `breakdown.deepRead` or `breakdown.fullRead`:

```bash
for plan in scripts/book/prompts/chapterflow-v21-authored/state/plans/<bookId>-ch*.manual-plan.json; do
  chId=$(jq -r '.chapterId' "$plan")
  anchors=$(jq -r '.sourceAnchors // [] | .[].name' "$plan")
  [ -z "$anchors" ] && continue
  chFile="scripts/book/prompts/chapterflow-v21-authored/state/chapters/${chId}.v21-native.chapter.json"
  [ ! -f "$chFile" ] && echo "MISSING CHAPTER: $chId" && continue
  prose=$(jq -r '(.breakdown.deepRead // "") + " " + (.breakdown.fullRead // "")' "$chFile")
  while IFS= read -r name; do
    [ -z "$name" ] && continue
    if echo "$prose" | grep -qF "$name"; then
      echo "OK $chId :: $name"
    else
      echo "MISSING ANCHOR $chId :: $name (planned but not in breakdown)"
    fi
  done <<< "$anchors"
done
```

If a chapter has `MISSING ANCHOR` entries, rewrite that chapter's `deepRead` or `fullRead` to land the planned anchor before finalizing. Never fabricate the anchor in the prose if the source did not actually contain that figure or study — instead, remove it from the plan.

## Finalize command

Run one command, with the real values substituted:

```bash
npx tsx scripts/book/prompts/chapterflow-v21-authored/src/scratch/codex-finalize-book.ts <bookId> \
  --title "<Title>" \
  --author "<Author>" \
  --categories "Productivity,Self Improvement" \
  --tags "attention,focus,habits"
```

This command performs:

1. artifact verification
2. per-chapter ship gate
3. book pattern audit
4. promotion with manual metadata and no model-backed categorizer
5. v21 package validation
6. legacy package validation
7. chapter scoring

## If finalization fails

Do not force promotion.

- If a chapter gate fails, rewrite that chapter using Step 2 rules.
- If pattern audit fails, rewrite the affected chapters structurally.
- If plans are missing, go back to Step 1 and create only the missing plans.
- If validation fails after promotion, fix the listed issue and rerun the finalize command.

## Report

Report:

- package path
- chapter count
- ship-gate result
- pattern audit result
- validation results
- score for every chapter
- chapters rewritten during final QA
- categories and tags used
- source-anchor coverage: how many chapters planned anchors, how many landed them in prose, list of any anchors that were intentionally dropped because the source didn't actually support them
- example opening-device distribution across the book: counts of each device used so we can spot books where one device still dominates
- warnings worth human review
