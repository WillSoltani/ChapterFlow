# Independent evaluator handoff

Use this handoff only after the final content edit and fresh pipeline QC. The evaluator must run in a genuinely new Codex task, never a fork and never the repair task.

## Authority check

Immediately before task creation, re-read the current user request. Create a new task only when the user explicitly authorized that action in the current request. A persisted flag is an audit aid, not authority by itself. If authority is absent or ambiguous, save the handoff prompt and stop for confirmation.

In the Codex app, use the thread tools exactly as follows:

1. Call `list_projects` and identify the project containing this exact checkout.
2. Call `create_thread` for that exact project with `target.environment.type="local"`. Do not call `fork_thread`; a fork carries repair context forward.
3. Set a clear title such as `Evaluate repaired <book-id> and refresh portfolio`.
4. Send only the handoff below. Do not paste the old score, original conditions, remediation prompt, or claimed fixes into the evaluator task.

If new-task tooling is unavailable, save the handoff as an artifact and stop. Do not evaluate in the writer task.

## Handoff prompt

Replace bracketed paths with absolute paths:

```text
Use $chapterflow-book-evaluator to independently evaluate [nested-candidate-package-path]. This must be the candidate produced by promote-book under scripts/book/prompts/chapterflow-v24-author-pipeline/book-packages, not the unchanged outer shipped package.

Read every accessible chapter in full. Sampling is prohibited. Run two blind raters and an independent adjudication against the current package hash. Do not open [repair-context-path], its remediation prompt, any old score, or any claimed fix until the full adjudicated result has been written and sealed.

Preserve the raw blind records as files named exactly `primary.json` and `verification.json`. Before dispatch, have the evaluator orchestrator issue `primary.dispatch.json` and `verification.dispatch.json` for distinct worker tasks and sessions; after both results exist, create `pair.seal.json`. Bind all five artifact hashes, distinct job/task/session IDs, common run ID, source inventory, recomputed agreement statistics, disagreements, and gate conflicts into the adjudication, portfolio update, repair verification, and `evaluation_complete` state artifacts. A result renamed from the other role is not an independent rating and must fail the pair seal.

After sealing the adjudication:
1. Export a full-content single-book portfolio update.
2. Transactionally update the supplied user-facing snapshot [report-html-path], including its report-data and remediation JSON/Markdown companions. Update it truthfully even when the score remains at or below 80 or a defect remains.
3. Transactionally mirror the validated HTML, report-data JSON, remediation JSON, and remediation Markdown byte-for-byte into [repo-root]/docs/v25/chapterflow-140-evaluation. Verify parity before acceptance. If no tested safe mirror helper exists, fail closed; do not copy files piecemeal and do not publish a stale repo snapshot.
   Save a typed updater receipt bound to one transaction ID, the frozen baseline report hash, candidate hash, exactly 140 unique books, non-target preservation, remediation regeneration, source-download validation, a real full report-validator PASS, and exact primary plus canonical-mirror output inventories/hashes.
4. Only now open [repair-context-path]. Map every original below-80 condition to its post-repair rubric value and exact evaluator evidence locator. Write [repair-verification-path] using the book-repair repair-verification schema. Set blind_result_sealed_before_baseline_opened=true only if that chronology actually occurred.
5. Run book-repair/scripts/verify_repair_outcome.py against the current package, book update, updated HTML, repair context, state, and verification artifact.
6. Preserve the truthful report update on either PASS or FAIL. On FAIL, report blockers and do not commit or push.
7. On PASS, re-check live user push authority. If present, hand the receipt and exact changed-file allowlist to a fresh publisher role/task. The evaluator must not publish.
8. For an already registered book, the publisher must preflight `publish-final --dry-run`, use `publish-to-live <id> --outer-root <repo>` without `--commit` as the supported copy/hash bridge, then create and normally push the exact five-file commit. It must prove the outer package hashes to `accepted_candidate_sha256` before marking the run published. If registration or bridge policy is unavailable, stop.
```

## Required evaluator outputs

- canonical blind rater A result;
- canonical blind rater B result;
- primary and verification orchestrator dispatch receipts plus the blind-pair seal;
- adjudicated full-content result bound to the current package hash;
- portfolio `book-update.json`;
- updated user-facing HTML/report-data/remediation artifacts;
- byte-identical canonical repo snapshot artifacts;
- `repair-verification.json`;
- `acceptance-receipt.json`;
- Git-anchored `acceptance-seal.json` and `acceptance-manifest.json`;
- updated run `state.json`.

Report updating is unconditional. Acceptance and publication are conditional.
