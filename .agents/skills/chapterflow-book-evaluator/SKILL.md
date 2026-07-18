---
name: chapterflow-book-evaluator
description: Evaluate nonfiction ChapterFlow packages under book-packages/ with the ChapterFlow Evidence, Learning, and Reader Experience Rubric v2.0. Read every source chapter and reader-facing component, run two isolated blind raters, adjudicate against the exact source inventory, validate weighted scores, and generate or transactionally refresh the offline HTML/JSON evaluation report. Use for full-book scoring, post-repair reevaluation, chapter-level content audits, learning-design reviews, rubric comparisons, and package QA. Never use chapter samples or infer full-book quality from selected chapters.
---

# ChapterFlow Book Evaluator

Produce a source-bound, full-content evaluation. Keep judgment in isolated worker records; keep discovery, coverage checks, arithmetic, aggregation, remediation generation, and report mutation deterministic.

## Non-negotiable boundaries

- Read every chapter and every reader-facing component in the canonical package. A selected-chapter or random-chapter evaluation is invalid, even if requested to reduce cost.
- Bind primary, verification, and adjudicated records to the current package hash and the exact ordered chapter inventory. Never accept self-declared chapter counts as proof of coverage.
- Finalize only when every inventory entry has one matching `read_status: full` record. Stop as unevaluable when any chapter is partial, inaccessible, missing, duplicated, or out of order. A declared numbering gap such as chapters 1 and 3 is an incomplete inventory, not a two-chapter book; do not create rater jobs or manufacture a score.
- Use only local reader-facing content and metadata. Do not use reputation, reviews, previous scores, remediation prompts, or memory of the source book while rating.
- Keep the two raters mutually blind and run them in distinct orchestrator task and session identities. Issue each worker a source/inventory/job/role-bound dispatch receipt, require its hash in the result, and seal both exact result payloads into one pair receipt before validation. A role label or changed job id is not independence proof. Give the adjudicator only the source, sealed receipt chain, and two independently validated records.
- Keep external factual verification disabled unless the user explicitly authorizes a separate fact-check. In the isolated rubric run, set external accuracy to `not_assessed`.
- Describe design support for retention, transfer, action, and completion; never claim measured outcomes without study data.
- Paraphrase evidence with precise package/chapter/section/item locators. Do not reproduce chapters.
- Assess gates independently from score. A high score never erases a gate failure.
- Preserve unrelated repository changes. Write run artifacts atomically and never publish a partial or invalid run.

## Context and token discipline

- Keep chapter prose out of the orchestrator context. Give each blind worker exactly one package plus the rubric, prompt, schema, immutable hash, and ordered inventory; persist its structured result to disk.
- Fan out independent book/role jobs up to the repository concurrency limit, but never combine multiple books in one rater context. Adjudicators receive only one source package and its two validated records.
- Use deterministic inspection, validation, arithmetic, aggregation, remediation generation, and report mutation scripts instead of asking agents to restate data.
- For a single-book repair check, inspect and reevaluate only that current package, then update its cohort record transactionally. Do not rediscover or reread the other 139 packages.
- Keep handoffs compact and path-based. Pass hashes, artifact paths, validator errors, and exact condition ids instead of embedding chapters or prior reports in prompts.

## Required references

Read each applicable reference completely before acting:

- Scoring: [rubric-v2.md](references/rubric-v2.md) and [scoring-protocol.md](references/scoring-protocol.md)
- Blind workers: [book-rater-prompt.md](references/book-rater-prompt.md), [book-evaluation.schema.json](references/book-evaluation.schema.json), [worker-dispatch-receipt.schema.json](references/worker-dispatch-receipt.schema.json), and [blind-pair-seal.schema.json](references/blind-pair-seal.schema.json)
- Adjudication: [adjudication-protocol.md](references/adjudication-protocol.md) and [adjudicated-book.schema.json](references/adjudicated-book.schema.json)
- Full portfolio reporting: [report-spec.md](references/report-spec.md) and [report-data.schema.json](references/report-data.schema.json)
- Below-80 remediation: [remediation-prompt-contract.md](references/remediation-prompt-contract.md)
- Single-book refresh: [portfolio-update-contract.md](references/portfolio-update-contract.md), [portfolio-book-update.schema.json](references/portfolio-book-update.schema.json), and [portfolio-update-receipt.schema.json](references/portfolio-update-receipt.schema.json)

## Full portfolio workflow

1. Resolve the repository root, read every applicable `AGENTS.md`, and verify `book-packages/`.
2. Create `artifacts/chapterflow-evaluation/<UTC timestamp>-<manifest hash>/` with `data/inspections`, `raw/{primary,verification,adjudicated}`, `jobs`, `logs`, and `tmp`.
3. Run deterministic discovery. Safely inspect every canonical package and persist its source hash plus ordered chapter inventory before creating rater jobs.
4. Create exactly two isolated jobs per canonical package with the project-scoped `chapterflow_book_rater` agent: `primary` and `verification`. They must have distinct job ids, orchestrator task ids, and worker session ids. After both identities exist, run `issue_worker_receipts.py` into `jobs/worker-receipts/<book-id>/`; give each worker only its own dispatch receipt and require it to copy that receipt's canonical SHA-256 into `worker_dispatch_receipt_sha256`.
5. Require each worker to read all chapters and components. After both outputs exist, run `seal_blind_pair_receipt.py` to create `jobs/worker-receipts/<book-id>/pair.seal.json`. The seal binds both dispatch identities, exact canonical result hashes, and administrative-field-stripped judgment hashes; exact cloned judgments are rejected. Validate each output against its schema, dispatch receipt, pair seal, expected job fields, and independently re-opened source inspection with `--require-full-content`. Retry once with validator errors only and reseal after any changed output.
6. Give the project-scoped `chapterflow_book_adjudicator` agent in a fresh task/session the current package, its immutable inspection, and the two validated records. Reinspect all rating differences, gate conflicts, contradictory findings, and source mismatches; never average automatically.
7. Validate the adjudication with the exact same inspection and `--require-full-content --adjudicated`. Reject any source drift or coverage mismatch.
8. After every book has an individual adjudication, run cross-book anchor calibration without forcing a distribution. Log every reopened rating.
9. Aggregate adjudicated records only. Before admitting each record, reopen the current package; require and validate the two dispatch receipts plus pair seal under `jobs/worker-receipts/<book-id>/`; revalidate both exact blind payloads and the adjudication against the current inventory/hash; and reconcile agreement metrics. A lone adjudication, missing receipt, identity collision, cloned judgment, or missing/malformed rater blocks aggregation. Then recalculate every score and generate canonical JSON and CSV artifacts.
10. Generate one comprehensive remediation prompt per book and one ledger entry for every raw overall, domain, or subcriterion value strictly below 80%.
11. Render the self-contained offline HTML report; run tests and report validation, then use the project-scoped `chapterflow_report_auditor` agent for an independent read-only audit.
12. Replace `artifacts/chapterflow-evaluation/latest/` transactionally only after every check passes.

## Single-book reevaluation and report refresh

Use this path after a repair or when one current package must replace its existing cohort record.

1. Identify exactly one package and one existing report book by stable book id. Hash and inspect the current package before either rater starts.
2. Run the same two blind, all-chapter ratings with distinct task/session identities, source-bound dispatch receipts, sealed pair receipt, and independent adjudication as the full workflow. Do not expose the prior score, remediation prompt, or expected outcome until the adjudicated result is sealed and validated.
3. Validate primary, verification, and adjudicated files against the same exact source inspection. A stale package hash, truncated record, reordered chapter, partial read, or inaccessible chapter blocks export.
4. Run `export_portfolio_book_update.py` with the separately validated primary, verification, both dispatch receipts, pair seal, adjudicated record, current package, and current report data. The exporter must revalidate the complete receipt chain and both blind records against the source inventory, require distinct primary/verification job/task/session identities, reject cloned judgments, reconcile the adjudication's agreement trail to the pair, and propagate receipt hashes and worker identities into the envelope. Validate that envelope against [portfolio-book-update.schema.json](references/portfolio-book-update.schema.json).
5. Run `update_portfolio_report.py` on the report snapshot and at least one existing byte-identical mirror. It must reject a missing or stale mirror, replace only the matching book, recompute arithmetic/rankings/cohort summaries, regenerate all remediation records and prompt packs, synchronize embedded and external JSON, validate the complete snapshot, and write a hash-bound typed receipt together with every primary/mirror replacement in one transaction. A dry run must not write an acceptance-usable receipt.
6. Update the report even when the new score remains low or a repair is unconfirmed; evaluation data must remain truthful. Acceptance, commit, and push decisions belong to the repair/publishing workflow, not to scoring.

## Mixed-method cohort truthfulness

The 140-book report may contain legacy screening records alongside books reevaluated with full dual-rater adjudication. After the first targeted refresh, label the cohort `mixed_method`; record the exact fully adjudicated book count and each book's provenance; and preserve limitations explaining that scores from different methods are not perfectly comparable. Never relabel all 140 books as full-content adjudications because one or several books were refreshed. A portfolio becomes uniformly adjudicated only after every current package passes this workflow.

## Deterministic commands

Run from the repository root and substitute concrete paths:

```bash
python3 .agents/skills/chapterflow-book-evaluator/scripts/discover_packages.py --packages-dir book-packages --run-dir artifacts/chapterflow-evaluation/<run-id>
python3 .agents/skills/chapterflow-book-evaluator/scripts/inspect_package.py --package <package> --output <inspection.json> --expected-source-hash <sha256>
python3 .agents/skills/chapterflow-book-evaluator/scripts/issue_worker_receipts.py --package <package> --run-id <run-id> --book-id <book-id> --pair-id <pair-id> --primary-job-id <primary-job-id> --primary-task-id <primary-task-id> --primary-session-id <primary-session-id> --verification-job-id <verification-job-id> --verification-task-id <verification-task-id> --verification-session-id <verification-session-id> --output-dir artifacts/chapterflow-evaluation/<run-id>/jobs/worker-receipts/<book-id>
python3 .agents/skills/chapterflow-book-evaluator/scripts/seal_blind_pair_receipt.py --package <package> --primary <primary.json> --verification <verification.json> --primary-dispatch <primary.dispatch.json> --verification-dispatch <verification.dispatch.json> --output <pair.seal.json>
python3 .agents/skills/chapterflow-book-evaluator/scripts/validate_book_result.py --schema .agents/skills/chapterflow-book-evaluator/references/book-evaluation.schema.json --input <primary.json> --inspection <inspection.json> --expected-source-hash <sha256> --expected-book-id <book-id> --expected-role primary --worker-dispatch-receipt <primary.dispatch.json> --blind-pair-seal <pair.seal.json> --require-full-content
python3 .agents/skills/chapterflow-book-evaluator/scripts/validate_book_result.py --schema .agents/skills/chapterflow-book-evaluator/references/book-evaluation.schema.json --input <verification.json> --inspection <inspection.json> --expected-source-hash <sha256> --expected-book-id <book-id> --expected-role verification --worker-dispatch-receipt <verification.dispatch.json> --blind-pair-seal <pair.seal.json> --require-full-content
python3 .agents/skills/chapterflow-book-evaluator/scripts/validate_book_result.py --schema .agents/skills/chapterflow-book-evaluator/references/adjudicated-book.schema.json --input <adjudicated.json> --inspection <inspection.json> --expected-source-hash <sha256> --expected-book-id <book-id> --expected-role adjudicated --require-full-content --adjudicated
python3 .agents/skills/chapterflow-book-evaluator/scripts/export_portfolio_book_update.py --report-data <report-data.json> --primary <primary.json> --verification <verification.json> --primary-dispatch <primary.dispatch.json> --verification-dispatch <verification.dispatch.json> --blind-pair-seal <pair.seal.json> --adjudicated <adjudicated.json> --package <package> --output <book-update.json> --evaluator-thread-id <thread-id>
python3 .agents/skills/chapterflow-book-evaluator/scripts/update_portfolio_report.py --report-data <report-data.json> --report-html <report.html> --book-update <book-update.json> --remediation-json <remediation-prompts.json> --remediation-markdown <remediation-prompts.md> --mirror-dir <existing-byte-identical-mirror-directory> --receipt <portfolio-update-receipt.json>
python3 .agents/skills/chapterflow-book-evaluator/scripts/aggregate_results.py --run-dir artifacts/chapterflow-evaluation/<run-id>
python3 .agents/skills/chapterflow-book-evaluator/scripts/generate_remediation_prompts.py --input <report-data.json> --output-report-data <report-data.json> --json-output <remediation-prompts.json> --markdown-output <remediation-prompts.md>
python3 .agents/skills/chapterflow-book-evaluator/scripts/render_report.py --data <report-data.json> --output <report.html>
python3 .agents/skills/chapterflow-book-evaluator/scripts/validate_report.py --report <report.html> --data <report-data.json>
python3 -m unittest discover -s .agents/skills/chapterflow-book-evaluator/tests -p 'test_*.py'
```

Chapter sampling is unsupported. Every evaluator, aggregation, remediation, rendering, validation, export, and update entrypoint must hard-fail a chapter-sample mode or result. Do not update `latest/` or a portfolio snapshot after any failed validation.
