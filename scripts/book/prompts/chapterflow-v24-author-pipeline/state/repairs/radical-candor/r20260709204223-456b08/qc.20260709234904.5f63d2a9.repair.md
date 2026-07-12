# Self-healing repair prompt — Qc

You are a fresh ChapterFlow repair agent. Your job is to fix the specific failure below with the smallest safe change, then prove the fix with the validation commands.

## Role contract
- Do not certify publishability. Do not run `qc-attest`, `bar-attest`, `sweep-attest`, `key-resolve`, `major-disposition`, `promote-book`, or `publish` unless a validation command explicitly says so.
- Do not weaken gates, critics, schemas, prompts, config, source-reality policy, or QC policy to make the failure disappear.
- Prefer content/source/state repair over code repair. Edit pipeline code only when this prompt clearly identifies an infrastructure defect, and then add or update a regression test.
- Preserve source-v2 grounding, source anchor ids, quiz keys, chapter identity, and content hashes for unrelated fields.
- If you cannot fix safely within the scope below, stop and report exactly what evidence is missing.

## Failure context
- bookId: `radical-candor`
- runId: `r20260709204223-456b08`
- stage: `qc`
- severity: `blocker`
- createdAt: 2026-07-09T23:49:04.701Z

## Summary
author review: 2 chapter(s) still fail independent review after the regen cap (2 write attempts each):
  ch01 — quiz Q5: The keyed sequence prescribes making care visible immediately before counsel, while the prose warns that last-second care can be staged and gives a different path when the fact must be said now. No answer expresses that guardrail, making the quiz source-contradictory. (must fix); implementation plan, If-then 1: Telling the reader to produce one care signal when the count is zero and then 
  ch02 — fast read: SOURCE-CONTRADICTORY: If Sandberg withholds the observation, Sandberg receives the calm minute and Scott pays through lost information. The summary instead says Scott keeps the calm minute, reversing the chapter’s central cost mechanism. (must fix); fast read / deep read / examples 1-2 / review card 4: FACTUALLY WRONG: The chapter repeatedly places the Sandberg–Scott Google relationship

## Evidence artifacts
- state/qc/radical-candor.sweep.json
- state/qc/radical-candor.sweep-history.jsonl
- state/qc-orchestrator/radical-candor/r20260709204223-456b08/sweep-record.json
- state/qc-orchestrator/radical-candor/r20260709204223-456b08/evidence-matrix.json (path may be relative or not yet written)
- state/qc-orchestrator/radical-candor/r20260709204223-456b08/repair-prompt.md (path may be relative or not yet written)

## Recommended fix strategy
- Use the QC repair brief/prompt for the latest round. Repair content only; never attest your own repair.
- After edits, run qc-converge and then a fresh QC round.

## Validation commands
Run these from the pipeline root after the repair:
```bash
npx tsx src/cli.ts qc-converge radical-candor
npx tsx src/cli.ts book-run radical-candor --no-publish
```

## Required handoff
When done, report:
- files changed
- exact findings fixed
- validation command output
- any remaining blocker and why it could not be safely fixed

Machine-readable sidecar: `/Users/radinsoltani/ChapterFlow-books/scripts/book/prompts/chapterflow-v24-author-pipeline/state/repairs/radical-candor/r20260709204223-456b08/qc.20260709234904.5f63d2a9.repair.json`
