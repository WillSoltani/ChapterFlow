# ChapterFlow Report Specification

Generate one deterministic canonical dataset and derive every CSV and the HTML report from it. `report-data.json` is the complete data embedded in `report.html`, never a separately maintained summary.

## Contents

1. [Artifact tree](#artifact-tree)
2. [Canonical data](#canonical-data)
3. [HTML security and offline contract](#html-security-and-offline-contract)
4. [Required report sections](#required-report-sections)
5. [Usability and accessibility](#usability-and-accessibility)
6. [CSV and ordering contract](#csv-and-ordering-contract)
7. [Validation](#validation)

## Artifact tree

Every successful run contains:

```text
<run-dir>/
├── report.html
├── data/
│   ├── report-data.json
│   ├── scorecard.csv
│   ├── domain-scores.csv
│   ├── subcriteria.csv
│   ├── chapter-evidence.csv
│   ├── chapter-domain-index.csv
│   ├── chapter-issue-index.csv
│   ├── gates.csv
│   ├── technical-findings.csv
│   ├── rater-agreement.csv
│   ├── calibration-log.csv
│   ├── package-manifest.csv
│   ├── run-manifest.json
│   ├── remediation-prompts.json
│   └── remediation-prompts.md
├── raw/
│   ├── primary/
│   ├── verification/
│   └── adjudicated/
├── jobs/
│   ├── book-rater-jobs.csv
│   ├── book-rater-results.csv
│   ├── adjudication-jobs.csv
│   └── adjudication-results.csv
├── logs/
│   ├── validation.log
│   ├── retries.log
│   └── report-audit.log
└── tmp/
```

Update `artifacts/chapterflow-evaluation/latest/` transactionally only after data, report, tests, validation, and audit pass.

## Canonical data

Validate `report-data.json` against [report-data.schema.json](report-data.schema.json). It must carry run metadata and counts; package manifest entries and duplicate/error status; agent configuration; validation and limitations; the complete rubric with nine domains, 36 subcriteria, 0–4 anchors, gates, formula, bands, and evidence rules; every complete adjudicated book record; ranking/tie data; category winners; recommendations and qualitative comparisons; calibration changes; and generated-file metadata.

Aggregate adjudicated results only. Recalculate ratings, domain means, weighted points, overall score, classification, certification, rank, ties, and agreement summaries deterministically. Preserve raw primary, verification, and adjudicated outputs separately. Build `chapter_filter_index` as a report-only sidecar: domain membership comes only from final adjudicated evidence that resolves explicitly to a chapter, and severity comes only from structured chapter-scoped technical findings. Partition book-scoped and unresolved sources explicitly; never infer either value from keywords or sentiment.

The canonical dataset is full-content only. Before aggregation, reopen the current package and validate every required primary, verification, and adjudicated record against the same persisted source inspection and current package SHA-256. Recompute the blind-pair agreement metrics and require them to match the adjudication; never admit a lone adjudication or a missing/malformed blind record. Expected, fully read, and evidence-record chapter counts must equal the exact ordered source inventory; every read status must be `full`. Do not aggregate a coverage defect, selected-chapter result, or self-declared count that was not reconciled to source.

After aggregation and calibration, run the deterministic below-80 pass in [remediation-prompt-contract.md](remediation-prompt-contract.md). Attach one remediation record to every book, preserve exactly one ledger entry for every raw overall/domain/subcriterion value below 80%, add a portfolio `remediation_summary`, and generate JSON and Markdown prompt packs from the same records. Reject any run that does not prove exact, ordered, all-chapter coverage for every primary, verification, and adjudicated record.

For a single-book reevaluation inside an existing cohort snapshot, follow [portfolio-update-contract.md](portfolio-update-contract.md). Preserve per-book method provenance, label a partially refreshed cohort `mixed_method`, and replace the snapshot transactionally only after external JSON, embedded HTML data, prompt packs, hashes, counts, and validation all agree.

## HTML security and offline contract

`report.html` must open directly from `file://` with no server or network:

- no CDN, external font, analytics, remote script/style/image, fetch, XHR, or API call;
- inline or bundle all CSS, JavaScript, icons, and canonical data;
- embed data in `<script type="application/json" id="chapterflow-report-data">` or an equivalently inert container;
- escape `</script>`, `<`, `>`, `&`, U+2028, and U+2029 in embedded JSON;
- never insert package-derived strings with `innerHTML`; create text nodes or set `textContent`;
- never embed full chapter text; use concise paraphrases and local locators;
- include a useful static overview and book details when JavaScript is disabled;
- use only inline SVG or Canvas for charts unless an already-local dependency is fully bundled;
- keep all identifiers, rows, and render order deterministic.

## Required report sections

### Remediation Center

Place a first-class Remediation Center after the executive dashboard. Show portfolio counts for below-80 overall books, domains, subcriteria, and P0–P3 conditions; a sortable/filterable queue; a book-by-domain matrix; arithmetic score-lift scenarios; per-book workstreams, evidence, complete condition ledger, and prompt preview; copy and Markdown download actions; complete JSON/Markdown pack downloads; and coverage/missing-rationale warnings.

Every evaluated book must appear even when its overall score is at least 80, because any subcriterion below 80 remains a condition. Keep rating-3 conditions visible but permit a collapsed P3 enhancement view. Link remediation rows back to book scores, QA, technical findings, and chapter evidence.

### 1. Run overview

Show report title; run id and UTC generation time; rubric/schema versions; isolation/no-web mode; package directory; found/canonical/scored/duplicate counts; chapters expected/full/partial/inaccessible; component totals; agent configuration; validation/audit status; and limitations.

### 2. Executive dashboard

Show overall ranking, Content Design Score, classification, certification, confidence, completeness, five gate badges, effective-tie indicators for books within 1.0 point, category winners, and a concise evidence-based explanation of how leaders differ. Make the scorecard sortable by title, rank, overall, every domain, confidence, gate status, and certification.

### 3. Interactive comparison

Allow selection of two through four books. Provide a radar or parallel-coordinate domain view, grouped/stacked weighted-contribution view, and 36-subcriterion heatmap. Show definitions and evidence summaries in accessible tooltips/details. Switch between 0–4, weighted points, and normalized percentage; hide/show domains; and export the visible comparison as valid CSV.

### 4. Rubric explorer

Expose philosophy, five gates, weights, all nine domains, all 36 subcriteria, every 0–4 anchor, formula, bands, evidence requirements, and the distinction between design support and actual outcomes. Provide safe search and collapsible semantic sections.

### 5. Per-book detail

For every canonical evaluated book show title, rank, score, classification, certification, confidence; package path and source hash; audience, prior knowledge, purpose, intended outcomes, contexts/exclusions; chapter and component inventory; technical findings; gate evidence; all nine domain scores; all 36 final/primary/verification ratings; weighted-point audit; rater disagreement; adjudication rationales; overall reader experience; strongest/weakest qualities; engagement curve; comprehension/retention support; practical use/judgment; best-fit and struggling readers; exactly three improvements; and the two- or three-sentence verdict.

### 6. Chapter evidence browser

For every chapter of every book provide a details/accordion panel with number/id/title, read status, central ideas, mental-model contribution, engagement/pacing, learning support, retention/retrieval support, transfer/action support, trust/QA/safety issues, and paraphrased evidence locators. Provide global search over explicit chapter fields, evidence, issues, and recommendations plus filters for book, domain, structured-finding severity, and chapter status. Domain filtering must use exact `chapter_filter_index` associations with no text fallback. Severity filtering must use the indexed maximum structured technical-finding severity; untyped QA/safety observations remain searchable but do not receive an inferred severity.

### 7. QA and technical findings

Show missing/duplicate/malformed/inaccessible/ambiguous material; semantic quiz defects and answer-key mismatches; formulaic example patterns; answer-length cue diagnostics when calculated; duplicate hashes; gate consequences; and unresolved issues. Label automated findings as diagnostics and never equate component quantity with quality.

### 8. Rater agreement and calibration

Show mean absolute disagreement, maximum disagreement, overall-score gap, gate conflicts, disagreement matrix, adjudication changes, cross-book calibration changes, source rechecks, and confidence rationale per book. State clearly that adjudication is evidence-based and not automatic averaging.

### 9. Cross-book analysis and recommendations

Show best overall design; every category/domain winner; meaningful score differences and effective ties; overall ranking; “choose this book if…” for each title; greatest improvement opportunity; most extensive redesign need; the most important lesson for ChapterFlow's content team; and limitations/uncertainty. Do not force a winner or distribution.

### 10. Data and methods

Show methodology, formulas, version information, run manifest, isolation/no-web explanation, and the limitation that actual reader outcomes were not measured. Provide working downloads generated from embedded canonical JSON for JSON and each CSV artifact.

## Usability and accessibility

- Use semantic headings, landmarks, tables, buttons, details, and form labels.
- Keep controls keyboard-operable with visible focus, sufficient contrast, and ARIA only where needed.
- Use sticky table headers and color-independent status text/icons.
- Highlight search terms with DOM-safe text operations.
- Support URL-hash navigation to every major section and book; preserve practical filter state in the hash.
- Include reset-filters, show-only-disagreements, and show-evidence controls.
- Lazily render large chapter-detail panels from embedded data while retaining static overview/book fallback content.
- Lazily render long remediation prompts and condition ledgers. Preserve selected remediation book, priority, and domain state in the URL hash where practical.
- Provide print styles for book details and rubric content.
- Ensure every local anchor and control id is unique.

## CSV and ordering contract

Write UTF-8, RFC 4180-compatible CSV with a header even for zero rows. Quote correctly, use `\r\n` or a standard library dialect consistently, and keep stable headers. Sort books by deterministic rank then stable book id where rank applies; otherwise by stable book id. Sort domains in rubric order, subcriteria in rubric order, chapters by numeric index then stable id, gates in the five-gate order, findings by book/severity/type/locator, and calibration changes by book/path/sequence.

At minimum, CSV rows must expose enough identifiers to join back to `run_id`, `book_id`, canonical path, domain/subcriterion/gate/chapter, and source evidence. Do not serialize undocumented summary values that can drift from canonical JSON.

## Validation

Before publishing `latest/`, confirm:

- `report.html` exists and is non-empty;
- no external resource or network dependency is required;
- embedded JSON parses and is semantically identical to `report-data.json`;
- every canonical book and every exact source-inventory chapter appears in source order with a full-read evidence record;
- the chapter filter sidecar has exactly one entry per chapter, exhaustively partitions all final rating evidence and technical findings, and contains no unresolved source used for filtering;
- every domain, subcriterion, gate, disagreement, and calibration change appears;
- every evaluated book has one remediation record and comprehensive prompt; strict-below-80 counts reconcile; every condition id appears once in its ledger and in its prompt/workstream mapping;
- no score-only target is presented as a proven defect and no modeled score lift clears a gate;
- displayed scores match deterministic calculations;
- all ids are unique and local targets resolve;
- malicious strings and `</script>` cannot execute;
- JSON/CSV downloads parse and match canonical data;
- static fallback content exists;
- keyboard and print essentials exist;
- the report auditor finds no unresolved material defect.

If a renderer or validator fails, preserve logs, do not update `latest/`, fix the defect, and rerun affected steps.
