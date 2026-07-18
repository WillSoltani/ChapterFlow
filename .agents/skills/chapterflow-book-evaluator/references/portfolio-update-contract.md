# Single-Book Portfolio Update Contract

Use this contract only after a current package has a complete, source-bound,
dual-rater adjudication. It updates evaluation truth; it does not decide whether a
repair is acceptable or whether repository changes may be published.

## Required inputs

- the current external report-data JSON;
- the matching self-contained report HTML;
- the independently validated primary, verification, and adjudicated records;
- the primary and verification orchestrator dispatch receipts plus their sealed blind-pair receipt;
- one envelope produced by `export_portfolio_book_update.py --primary <primary.json> --verification <verification.json> --primary-dispatch <primary.dispatch.json> --verification-dispatch <verification.dispatch.json> --blind-pair-seal <pair.seal.json> --adjudicated <adjudicated.json>` and valid against
  [portfolio-book-update.schema.json](portfolio-book-update.schema.json);
- the current remediation JSON and Markdown packs when they are published beside
  the report; and
- at least one existing byte-identical mirror directory containing the same four
  current snapshot files; and
- a distinct receipt destination whose parent directory already exists.

All primary snapshot files must share one parent directory. `--mirror-dir` is
mandatory and repeatable; every mirror must exist, be distinct from the primary,
and already contain byte-identical copies of those four files. A stale, missing,
or mismatched mirror is a hard failure. Match the target by one exact, unique
stable book id. Never fall back to title, array position, rank, or filename.

## Preconditions

Before export or mutation, require all of the following:

1. Primary, verification, and adjudicated records reference the same book id,
   current package SHA-256, run id, and immutable inspection.
2. The source inspection explicitly certifies a complete inventory. A numbering
   gap, duplicate, partial numbering sequence, or truncated inspection is
   unevaluable. A saved inspection artifact must be independently reproduced
   from its still-current `package_path`, not trusted as a self-declaration.
3. Each blind record validates against the exact ordered source chapter
   inventory, its own dispatch receipt, and the shared pair seal with
   `--require-full-content`; the adjudicated record also uses `--adjudicated`.
4. Expected, fully read, and evidence-record chapter counts equal the source
   inventory length; partial and inaccessible counts are zero; every chapter id,
   index, title, and order matches.
5. The report contains exactly one target id and no duplicate book ids.
6. The exporter itself revalidates both blind records and the complete receipt
   chain. It requires exact `primary`/`verification` roles, distinct nonempty
   job/task/session identities, exact receipt/result hashes, and different
   administrative-field-stripped judgment hashes; a cloned primary record with
   edited labels or identities is invalid. It reconciles the
   adjudication's agreement metrics, disagreement inventory, and gate conflicts
   to those two inputs, and rejects selected-chapter records.
7. The update envelope declares `evaluation_mode: full_content`, carries the
   same current source hash at its top level and in book provenance, and records
   `rater_pair_validated: true`, exact distinct worker/job/task/session ids, the
   pair id and inventory hash, both dispatch-receipt hashes, and pair-seal hash.

Any failure is terminal for the update. Do not weaken validation, edit a score,
or substitute a previous package to make it pass.

## Deterministic mutation

The updater must:

1. Read the external JSON and inert embedded report JSON with a real HTML parser,
   not a regular expression, and require them to describe the same snapshot.
2. Replace exactly the target book. Preserve every non-target source record
   byte-for-byte in the logical data model; only cohort-derived values such as
   rank, summaries, and regenerated remediation may change.
3. Recalculate the target's nine domain means, weighted points, overall score,
   band, gates, and 36 subcriteria from its exported values. Reject arithmetic
   drift instead of accepting the supplied headline score.
4. Re-rank all books deterministically by score and stable book id, then recompute
   every cohort total, component count, gate/profile count, and below-80 count.
5. Regenerate remediation data for all books from the updated canonical data.
   Require the new condition total to equal the old total minus the old target's
   conditions plus the new target's conditions.
6. Synchronize the external report data, embedded HTML data, remediation JSON,
   remediation Markdown, all regenerated downloadable CSV/Markdown exports, and
   every downloadable-file size/hash. Update visible method wording so a mixed
   cohort is never presented as uniformly single-evaluator or uniformly
   adjudicated. Update a snapshot README when it carries generated hashes or
   counts.
7. Run structural, arithmetic, remediation, HTML-safety, and embedded/external
   equality checks before exposing any new snapshot. Materialize the candidate
   HTML and JSON in a temporary directory and actually invoke the independent
   complete `scripts/validate_report.py` validator. Any returned error is a hard
   failure; the updater may not self-assert `full_validator_status: valid`.
8. Build a receipt valid against
   [portfolio-update-receipt.schema.json](portfolio-update-receipt.schema.json).
   Bind it to the exact frozen pre-update report-data SHA-256, target book id,
   candidate source hash, 140 unique books, proven non-target preservation,
   regenerated remediation validity, source-download validity, the complete
   validator status and candidate hashes. Assign one transaction id and inventory
   the primary root plus every required mirror root. Under every root, record the
   absolute path and final SHA-256 of exactly the same four outputs. The receipt,
   all primary outputs, and all mirror outputs enter the same rollback-capable
   replacement call.

## Mixed-method provenance

A targeted full-content reevaluation does not upgrade the method used for the
other cohort records. Store per-book `evaluation_provenance` and count a record as
full only when its method is `full_book_blind_dual_rater_adjudication`, its source
and positive chapter counts reconcile, `rater_pair_validated` is true, its
adjudicated/primary/verification job ids are nonempty and distinct, its primary
and verification task/session ids are nonempty and distinct, and its inventory,
dispatch, and pair-seal hashes are valid SHA-256 digests. When fewer
than all books meet that standard:

- label the portfolio method `mixed_method`;
- show the full-evaluation count and total cohort size;
- state that legacy screening scores and full adjudications are not perfectly
  comparable; and
- retain each legacy record's original provenance without inventing full-book
  coverage.

Only label the portfolio uniformly full-content when every current book has valid
all-chapter provenance.

## Transaction and failure behavior

Build and validate complete primary and mirror staging snapshots. Replace every
primary and mirror file in one transaction only after every check passes; preserve
rollback paths until all replacements succeed. A missing mirror is a hard failure.
On an exception, validation failure, duplicate id, source drift, stale mirror, or
interrupted write, leave every original primary and mirror file byte-identical.
Use `--dry-run` for preflight and repeat `--mirror-dir` for each already
synchronized canonical mirror. `--receipt` is required even for preflight, but a
dry run must not create or replace the receipt. In a real update, stage and write
the receipt inside the same rollback-capable transaction as all primary and
mirror files; never issue it before complete validation succeeds.

Updating the report is mandatory even when the reevaluated score is at or below
80 or a claimed repair remains unresolved. Do not commit or push book changes from
this updater; a separate repair acceptance and publisher role owns that decision.
