# ChapterFlow 140-book evaluation snapshot

This directory contains the offline 140-book evaluation report and its repair workflow assets.

## Contents

- `chapterflow-140-evaluation-report.html` — self-contained interactive report.
- `chapterflow-140-evaluation-report-data.json` — canonical report data embedded in the HTML.
- `chapterflow-140-remediation-prompts.json` — structured below-80 condition ledger and per-book repair prompts.
- `chapterflow-140-remediation-prompts.md` — copy-ready remediation prompts.
- `chapterflow-book-evaluator-full-content.zip` — evaluator skill package; every chapter is mandatory.
- `chapterflow-book-evaluator-below80-update.zip` — compatibility alias of the current evaluator package.
- `book-repair.zip` — repair, independent reevaluation, report refresh, and conditional publication skill.

## Update contract

The report begins with 140 books and 5,040 subcriteria. Exact live totals, method counts, chapter counts, QA findings, rankings, and below-80 conditions are stored in `chapterflow-140-evaluation-report-data.json`; they may change after a source-bound full-book reevaluation.

Targeted reevaluations must use two blind raters and adjudication over every chapter in the current candidate package. The updater replaces one stable book ID, recalculates ranks and portfolio totals, regenerates every remediation prompt and downloadable audit export, and transactionally keeps the HTML, JSON, Markdown, and repo mirror byte-identical. It also writes a baseline-hash-bound receipt proving the complete 140-book update.

`book-repair` always refreshes the report with the truthful result. It permits publication only when the updated Content Design Score is strictly greater than 80, every original below-80 condition and mapped QA/gate defect is confirmed resolved, fresh independent pipeline QC passes, and the accepted nested candidate hash matches the package ultimately published. Missing active-v24 state is recovered only from a richer historical package that round-trips exactly to the shipped reader content; source evidence and QC are never inherited or fabricated.

## Validation

Run the bundled evaluator and repair test suites plus each skill's quick validator after any skill change. The current implementation also includes a real-report no-write refresh test, HTML safety checks, exact source-inventory validation, stale-mirror rollback tests, and candidate-bound publication tests.

The directory is listed in the repository `.gitignore`. Its curated files are force-added intentionally; unrelated generated files placed here remain local.
