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
- severity: `infra`
- createdAt: 2026-07-09T23:12:23.572Z

## Summary
unexpected failure: codex exec timed out after 1800000ms — re-run `book-autopilot radical-candor` to resume from the current phase (logs: state/autopilot-logs/radical-candor).

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

Machine-readable sidecar: `/Users/radinsoltani/ChapterFlow-books/scripts/book/prompts/chapterflow-v24-author-pipeline/state/repairs/radical-candor/r20260709204223-456b08/qc.20260709231223.857b8cfc.repair.json`
