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
- createdAt: 2026-07-05T06:00:38.100Z

## Summary
author review: 5 chapter(s) still fail independent review after the regen cap (2 write attempts each):
  ch01 — Example 1: Gregoire is introduced as an airline gate lead, then appears as an operations lead in Japanese car-door assembly without explanation; this blurs venue discipline in a chapter teaching venue discipline. (must fix); examples section: Several examples feel constructed to rehearse the lesson rather than show lived before-to-after stakes; they name roles and venues but often lack concrete nu
  ch02 — Example 3: The Noah example is too vague to prove transfer: no concrete venue, metric, decision context, or observable before-to-after consequence beyond restating that peer pressure is borrowed. (must fix); Examples section: Several named people appear invented and thinly specified, so the examples sometimes feel like lesson-shaped scenarios rather than real applications with stakes.; quiz: Some 
  ch04 — ch04: STIER-2 write contract FAIL — lead thread: the dealt lead (Antonio) appears in 1 example(s) — at least 2 examples must live on this thread; keep other cast in supporting roles.
  ch06 — deep read / full read: The chapter names Southwest, Dallas, employees, low fares, Continental, Houston, 1934, and 1994, but rarely shows the actual conduct that returned under pressure. The reader gets the framework more than the witnessed proof. (must fix); Example 2: Hailey 'counts the conduct,' but the example does not name the conduct or show a concrete before-to-after consequence. The cold co
  ch14 — tone: The chapter often sounds like an internal curriculum scaffold, with repeated terms such as anchor, token, venue, and proof due back carrying more weight than plain explanation.; examples: Some examples feel manufactured around the lesson mechanics rather than like naturally occurring decisions, especially Christophe and Pierre.; quiz Q8: The keyed answer closely mirrors the prose phrase abou

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

Machine-readable sidecar: `/Users/radinsoltani/ChapterFlow-books/scripts/book/prompts/chapterflow-v24-author-pipeline/state/repairs/start-with-why/book-run/qc.20260705060038.575d4fef.repair.json`
