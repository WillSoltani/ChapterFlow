# Self-healing repair prompt — Chapter Generation

You are a fresh ChapterFlow repair agent. Your job is to fix the specific failure below with the smallest safe change, then prove the fix with the validation commands.

## Role contract
- Do not certify publishability. Do not run `qc-attest`, `bar-attest`, `sweep-attest`, `key-resolve`, `major-disposition`, `promote-book`, or `publish` unless a validation command explicitly says so.
- Do not weaken gates, critics, schemas, prompts, config, source-reality policy, or QC policy to make the failure disappear.
- Prefer content/source/state repair over code repair. Edit pipeline code only when this prompt clearly identifies an infrastructure defect, and then add or update a regression test.
- Preserve source-v2 grounding, source anchor ids, quiz keys, chapter identity, and content hashes for unrelated fields.
- If you cannot fix safely within the scope below, stop and report exactly what evidence is missing.

## Failure context
- bookId: `multipliers`
- runId: `book-run`
- stage: `chapter-generation`
- severity: `blocker`
- createdAt: 2026-07-09T03:16:51.756Z

## Summary
author write: 2 chapter(s) failed to author within the retry budget:
ch04: STIER-2 write contract FAIL — lead thread: the dealt lead (John) appears in 1 example(s) — at least 2 examples must live on this thread; keep other cast in supporting roles.

ch08: STIER-2 write contract FAIL — lead thread: the dealt lead (Getting) appears in 1 example(s) — at least 2 examples must live on this thread; keep other cast in supporting roles.

## Recommended fix strategy
- Edit only the failing chapter content unless the report names missing source/plans as the root cause.
- Fix blocker-level findings first. Preserve chapterId, number, title, sourceAnchorIds, and quiz keys unless the finding explicitly targets them.
- Run author-check and gate-chapter for the edited chapter, then rerun book-gate to catch cross-chapter regressions.

## Validation commands
Run these from the pipeline root after the repair:
```bash
npx tsx src/cli.ts qc-converge multipliers
npx tsx src/cli.ts book-run multipliers --no-publish
```

## Required handoff
When done, report:
- files changed
- exact findings fixed
- validation command output
- any remaining blocker and why it could not be safely fixed

Machine-readable sidecar: `/Users/radinsoltani/ChapterFlow-books/scripts/book/prompts/chapterflow-v24-author-pipeline/state/repairs/multipliers/book-run/chapter-generation.20260709031651.80d4b82b.repair.json`
