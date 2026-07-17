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

## `authoringSource`: RESOLVED (Stage-B freeze, D-7 option a — ledger L-37/L-44)

Every unit's `authoringSource` now points at its **frozen chapter brief**
(`…/state/books/<slug>/runs/v23-current/briefs/chNN.brief.json`), produced by
the owner-authorized one-time compile-chain freeze executed 2026-07-17:

1. **Compliant codex research** per book via the WP-701b `auto-research` verb
   (role `research` → modelPolicy → `gpt-5.6-sol@high`, hermetic envelope,
   one session per book, three sessions total, all in the WP-503 ledger under
   `…/state/run-ledger/<slug>/auto-research-*.jsonl`).
2. **Chapter-alignment gate** (pre-registered, L-40): each fresh index carries
   the audited target chapter at the audited number with the audited title —
   nudge ch3 "Following the Herd", made-to-stick ch4 "Credible",
   the-happiness-hypothesis ch6 "Love and Attachments" (case-only difference
   from the sealed record's "Love and attachments"; accepted and recorded).
3. **Deterministic compile chain** (zero model calls): `compile-source-packets`
   → `source-packet-gate` → `compile-book-design` → `book-design-gate` →
   `compile-chapter-briefs` → `chapter-brief-gate` — every gate PASS,
   0 blockers, for all three books.

Each unit's `frozenInputs` array hash-binds the full shared-input set the
candidates consume (chapter index, source-v2 sidecar, source packet, brief
json+md, book design) — the verification test re-hashes every entry, so any
post-freeze drift in the committed state fails the suite. The manifest's
`bakeoffReadiness` reads `"ready-for-bakeoff"`, re-derived independently by
the test from the resolved `units[].authoringSource` values; a single
`"UNRESOLVED"` (or placeholder) unit still vetoes the packet.

## Consumers

- **WP-703** (Stage-1 screening execution) authors the pre-registered
  screening configs against these exact three chapters, from these exact
  frozen inputs (the bakeoff's own freeze re-hashes them per run).
- **WP-704** (Stage-2/3 confirmation) advances surviving configs against the
  same fixed corpus.
