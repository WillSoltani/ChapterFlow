# Self-healing repair prompt — Qc

You are a fresh ChapterFlow repair agent. Your job is to fix the specific failure below with the smallest safe change, then prove the fix with the validation commands.

## Role contract
- Do not certify publishability. Do not run `qc-attest`, `bar-attest`, `sweep-attest`, `key-resolve`, `major-disposition`, `promote-book`, or `publish` unless a validation command explicitly says so.
- Do not weaken gates, critics, schemas, prompts, config, source-reality policy, or QC policy to make the failure disappear.
- Prefer content/source/state repair over code repair. Edit pipeline code only when this prompt clearly identifies an infrastructure defect, and then add or update a regression test.
- Preserve source-v2 grounding, source anchor ids, quiz keys, chapter identity, and content hashes for unrelated fields.
- If you cannot fix safely within the scope below, stop and report exactly what evidence is missing.

## Failure context
- bookId: `the-culture-code`
- runId: `book-run`
- stage: `qc`
- severity: `blocker`
- createdAt: 2026-07-09T14:14:06.632Z

## Summary
author acceptance REJECTED (churn HIGH) and BOTH bounded repair lanes are spent for every content-repair target:
  content-device lane: kept no chapter (reverted / devices-persisted / grant-consumed) on ch01
  global regen lane: exhausted for those chapters (cap 2 write attempts/chapter)
Manual escape hatch — reset a chapter's content-repair grant and force one fresh attempt, then re-run book acceptance:
  content-repair-book the-culture-code --only <ch[,ch...]> [--force]
Readers:
  reader auto-author-book-reader-1-mrdl6b4a-4: comp=70 gate=FAIL churn=HIGH — The sample has a real instructional spine: it repeatedly pushes readers to ground culture claims in visible behavior, named settings, and testable cues. The quizzes are answerable and the keyed answers match my derivations, but the answer choices are often predictable, explanations are absent, and m
  reader auto-author-book-reader-2-mrdl6b4c-5: comp=73.3 gate=FAIL churn=HIGH — The sample has real strengths: the chapters usually keep claims bounded, name failure modes, and offer several memorable lines. The quizzes are answerable from the prose and I found no key mismatches. But the gate fails because one source claim smells factually wrong, and the book-level experience i
  reader auto-author-book-reader-3-mrdl6b4c-6: comp=72.6 gate=FAIL churn=HIGH — The sample is keyed sound on the quizzes, and many chapter-level lessons are useful, concrete, and bounded. The gate fails because at least one named factual anchor smells wrong, especially the Will Felps institutional attribution, which is severe in chapters that repeatedly demand exact source disc

## Evidence artifacts
- state/qc/the-culture-code.sweep.json (path may be relative or not yet written)

## Recommended fix strategy
- Use the QC repair brief/prompt for the latest round. Repair content only; never attest your own repair.
- After edits, run qc-converge and then a fresh QC round.

## Validation commands
Run these from the pipeline root after the repair:
```bash
npx tsx src/cli.ts qc-converge the-culture-code
npx tsx src/cli.ts book-run the-culture-code --no-publish
```

## Required handoff
When done, report:
- files changed
- exact findings fixed
- validation command output
- any remaining blocker and why it could not be safely fixed

Machine-readable sidecar: `/Users/radinsoltani/ChapterFlow-books/scripts/book/prompts/chapterflow-v24-author-pipeline/state/repairs/the-culture-code/book-run/qc.20260709141406.21e31435.repair.json`
