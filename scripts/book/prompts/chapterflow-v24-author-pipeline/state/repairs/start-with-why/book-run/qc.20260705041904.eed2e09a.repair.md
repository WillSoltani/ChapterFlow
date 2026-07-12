# Self-healing repair prompt — Qc

You are a fresh ChapterFlow repair agent. Your job is to fix the specific failure below with the smallest safe change, then prove the fix with the validation commands.

## Role contract
- Do not certify publishability. Do not run `qc-attest`, `bar-attest`, `sweep-attest`, `key-resolve`, `major-disposition`, `promote-book`, or `publish` unless a validation command explicitly says so.
- Do not weaken gates, critics, schemas, prompts, config, source-reality policy, or QC policy to make the failure disappear.
- Prefer content/source/state repair over code repair. Edit pipeline code only when this prompt clearly identifies an infrastructure defect, and then add or update a regression test.
- Preserve source-v2 grounding, source anchor ids, quiz keys, chapter identity, and content hashes for unrelated fields.
- If you cannot fix safely within the scope below, stop and report exactly what evidence is missing.

## Failure context
- bookId: `start-with-why`
- runId: `book-run`
- stage: `qc`
- severity: `blocker`
- createdAt: 2026-07-05T04:19:04.941Z

## Summary
author review: 3 chapter(s) still fail independent review after the regen cap (2 write attempts each):
  ch01 — Example 3: Gregoire, established through the car-door material, is suddenly changing a boarding order. The cross-venue role shift feels manufactured and may confuse the learner about who is doing what. (must fix); Example 5: The cause of Raymond's mistake is attributed to a stapled handout, but that cause is not prepared by the chapter. It reads like an invented prop rather than a shown reason. (m
  ch06 — quiz Q1: The keyed answer is much more complete and structurally aligned with the chapter than the distractors, creating a mild length/completeness tell.; quiz Q9: The keyed answer bundles all the chapter's hard-ground terms, while the distractors are visibly weaker caricatures; this makes the answer partly guessable.; Example 1: The example has a decision and consequence, but the consequence is m
  ch14 — fast read: The company and product parentheticals read like source-packet metadata rather than natural prose, which creates template/scaffold smell.; hook and fast read: The opening three sentences are repeated verbatim, so the layered read feels padded instead of progressively deeper.; examples section: The examples mostly recycle Apple-Dell, Microsoft, and Southwest instead of showing the move i

## Evidence artifacts
- state/qc/start-with-why.sweep.json (path may be relative or not yet written)

## Recommended fix strategy
- Use the QC repair brief/prompt for the latest round. Repair content only; never attest your own repair.
- After edits, run qc-converge and then a fresh QC round.

## Validation commands
Run these from the pipeline root after the repair:
```bash
npx tsx src/cli.ts qc-converge start-with-why
npx tsx src/cli.ts book-run start-with-why --no-publish
```

## Required handoff
When done, report:
- files changed
- exact findings fixed
- validation command output
- any remaining blocker and why it could not be safely fixed

Machine-readable sidecar: `/Users/radinsoltani/ChapterFlow-books/scripts/book/prompts/chapterflow-v24-author-pipeline/state/repairs/start-with-why/book-run/qc.20260705041904.eed2e09a.repair.json`
