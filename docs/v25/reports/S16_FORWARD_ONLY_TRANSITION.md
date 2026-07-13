# Section 16 Forward-Only Transition

**Recorded:** 2026-07-12  
**Starting identity:** `37cb0804e157758272e7ec06c2aaf96ebdec6724` on `feat/v25-pipeline`

The legacy Section 16 campaign remains immutable and mechanically closed. IMP-22
does not resume, repair, rescore, or use it to select the future reviewer panel.

| Field | Decision |
|---|---|
| `oldCampaignStatus` | `ARCHIVED_INCONCLUSIVE_REVIEW_INSTRUMENT_MISMATCH` |
| `historicalOutputsRequireRepair` | `false` |
| `historicalScoresBlockFutureValidation` | `false` |
| `legacySolSourceCasesAffectPanelSelection` | `false` |
| `legacyBakeoffRequired` | `false` |
| `newDecision` | `FUTURE_SOL_NATIVE_PRODUCTION_READINESS` |

The fourteen legacy SOL source-register disagreements are classified only as:

`NOT_ADJUDICABLE_FOR_SOURCE_TRUTH_UNDER_LEGACY_CONTEXT`

They may inform source-blind reader-origin-ambiguity regression coverage. They
cannot qualify or disqualify a judge, select a model family, block a forward run,
or require owner adjudication before fresh validation.

All legacy evidence bytes and the existing closed-experiment registry remain
unchanged. Every new qualification, pilot, and gold validation must use a new
identity, fresh outputs, frozen forward-only inputs, and the ChatGPT-authenticated
`codex exec` route without API fallback.

The three preserved raw Stage-Q owner drivers are also mechanically closed at
their first executable statement. Each is bound to its archived experiment ID
and halts before argument parsing, corpus reads, output writes, or a model spawn;
registry drift still fails closed. Their historical bodies remain readable for
audit and replay analysis, but none is an executable resume route.
