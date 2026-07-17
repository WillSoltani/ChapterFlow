# Bakeoff corpus v1 — sealed, immutable

This directory freezes **one** immutable input packet for the V25 model
bakeoff: the same three audited chapters, bound to their sealed D7
("rubric-audit-2026-07-15") baselines, so that every model, every bakeoff
stage, and every evaluator reads byte-identical source text and is judged
against the same fixed floor.

## What this is

- **The fixed bakeoff input.** WP-703 (Stage-1 screening) and WP-704
  (Stage-2/3 confirmation) author against these exact three chapters and no
  others — "SAME 3 fixed source chapters" for every model/config compared.
- **The band-reachability floor.** Each candidate chapter is judged by the D7
  rubric-audit instrument (`PIPE/src/bakeoff/migration/rubricAuditInstrument.ts`)
  against the sealed `sealedChapterDiagnostic` baseline recorded here. The
  ratified D7 bar (`RUBRIC_AUDIT_BAR_D7`) applies on top of these floors:
  - **Release floor: mean ≥ 85** across the corpus.
  - **Screening floor: mean ≥ 75** (the pre-registered Stage-1 advancement bar).

## Sealed once, read many times

- `corpus-manifest.json` is generated once from
  `docs/v25/rubric-audit-2026-07-15/` (the sealed owner adjudication run,
  `run_id 20260715T110908Z`) and the in-repo reader-doc pool at
  `scripts/book/prompts/chapterflow-v24-author-pipeline/state/migration-experiments/reader-gold-dev-pool-v1/reader-docs/`.
  It is **immutable once sealed** (`"immutable": true`): every field is either
  a content hash of an existing sealed artifact or a pointer path into it —
  never a hand-typed copy of a number from `REPORT.md` prose.
- Every `sealedAdjudicatedRecordRelPath` / provenance-chain path points
  **into** `docs/v25/rubric-audit-2026-07-15/` — this directory holds no
  duplicated copies of sealed evidence, so there is nothing here that could
  drift out of sync with the sealed run.
- `scripts/book/prompts/chapterflow-v24-author-pipeline/tests/bakeoff-corpus-fixtures.test.ts`
  is the model-free guard: it independently re-hashes every reader doc,
  independently rebuilds every `chapter_diagnostic_score` from the sealed
  adjudicated JSON's raw subcriteria ratings using the instrument's own
  `RUBRIC_DOMAINS` weights and `RUBRIC_CHAPTER_WEIGHT_TOTAL` (95) divisor, and
  asserts the manifest is byte-stable under the pipeline's canonical
  serializer. Any drift in the sealed evidence, the reader docs, or the
  manifest itself fails this suite closed.

## The three frozen units

| unit | book | chapter | sealed chapter diagnostic | sealed band |
| --- | --- | --- | --- | --- |
| `nudge-ch03` | Nudge | 3 ("Following the Herd") | 70.75657894736842 | Standalone chapter diagnostic: valuable but materially uneven; targeted redesign needed. |
| `made-to-stick-ch04` | Made to Stick | 4 ("Credible") | 67.66447368421052 | Chapter diagnostic: substantial redesign needed |
| `the-happiness-hypothesis-ch06` | The Happiness Hypothesis | 6 ("Love and attachments") | 68.8157894736842 | Chapter diagnostic: Substantial redesign needed |

These bindings (book + chapter number) are frozen. Nothing about them —
the source text, the sealed adjudication, or the diagnostic — may change
without unsealing this corpus and re-running the WP-701 verification test.

## `authoringSource`: UNRESOLVED (owner decision D-7 pending)

Every unit's `authoringSource` field — the draft/manuscript pointer the
bakeoff intake will use to hand each model the source it authors from — is
currently the literal string `"UNRESOLVED"`. This is **not** a placeholder
bug: the owner has not yet supplied the authoring-source draft for any of the
three chapters (open decision **D-7**), and instruction 3 of WP-701 requires
this state to be explicit and fail-closed rather than a silent default.

Consequently the manifest's `bakeoffReadiness` field reads
`"not-ready-for-bakeoff"`. This is not merely stated — the verification test
independently re-derives the same verdict from the `units[].authoringSource`
array and asserts it agrees with the stored field, and separately proves the
derivation is state-driven (it flips to `"ready-for-bakeoff"` once every
`authoringSource` is resolved, and a single remaining `"UNRESOLVED"` unit
still vetoes the whole packet). **No WP may treat this corpus as bakeoff-ready
while any `authoringSource` is `"UNRESOLVED"`.**

## Consumers

- **WP-703** (Stage-1 screening execution) authors the pre-registered
  screening configs against these exact three chapters.
- **WP-704** (Stage-2/3 confirmation) advances surviving configs against the
  same fixed corpus.

Both are blocked from starting real authoring against this corpus until the
owner resolves D-7 and every `authoringSource` is a real pointer — not a
change to this README or the manifest's shape, a change to the underlying
`authoringSource` values once the owner decision lands.
