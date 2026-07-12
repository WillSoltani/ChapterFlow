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
- createdAt: 2026-07-05T02:55:21.903Z

## Summary
author review: 4 chapter(s) still fail independent review after the regen cap (2 write attempts each):
  ch01 — full read: The American Airlines/Fort Worth material names a carrier and place but gives no concrete before-to-after boarding decision, measured consequence, or specific friction observed. (must fix); Example 3: The boarding example says the line bends and proof has not come back, but it does not show a completed consequence or what changed after the decision. (must fix); Example 6: The supplier e
  ch06 — quiz: The keys are sound and derivable, but the correct answers often have the most careful, bounded phrasing while distractors use exaggerated claims, creating testwise tells.; Example 4: The paper-cup detail feels like a slot-filler: it names an object but does not affect the decision, consequence, or learning promise.; examples: Several examples demonstrate the lesson cleanly, but some feel eng
  ch13 — quiz Q1: The stem says Tobias's service line failed and asks what caused the drift, but the Tobias service-launch example says the order almost collapsed, while a different Tobias example has a family group chat drift. The keyed cause is directionally right, but the stem blends two scenes. (must fix); quiz choices overall: Correct answers often carry the chapter's exact vocabulary while distractor
  ch14 — Example 5: Reads like a slot-filler: Christophe's team recites the chapter's named examples and framework, but there is no concrete before-to-after decision or consequence. (must fix); Implementation plan if-then 2: Too tied to the book's own Apple-Dell/Microsoft artifact instead of transferring the principle to a general case where a true fact is used in the wrong comparison. (must fix); quiz Q3:

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

Machine-readable sidecar: `/Users/radinsoltani/ChapterFlow-books/scripts/book/prompts/chapterflow-v24-author-pipeline/state/repairs/start-with-why/book-run/qc.20260705025521.ea58c51b.repair.json`
