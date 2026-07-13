# IMP-22 Final Implementation Report

**Final decision:** `INCONCLUSIVE`  
**Starting HEAD:** `37cb0804e157758272e7ec06c2aaf96ebdec6724`  
**Ending HEAD:** `37cb0804e157758272e7ec06c2aaf96ebdec6724`  
**Commits created:** none

## Outcome

The forward-only production implementation is locally complete and the no-model verification suite is green. A production-readiness PASS is not available because authorization to send the frozen qualification corpus and fresh pilot/gold content to ChatGPT through `codex exec` was not granted. No live result, fixed role assignment, fresh-content hard-gate result, Content Design Score, or local activation has been invented.

The old Section 16 campaign remains mechanically closed. No historical model bakeoff ran and no historical book was repaired.

## Implemented surfaces

- Reproducible reader, source, and quiz qualification corpora with disjoint calibration/holdout partitions.
- Frozen candidate order, thresholds, schedule, availability policy, and one-replay infrastructure policy.
- ChatGPT-authenticated, no-API live qualification boundary with exact request/receipt persistence.
- Fixed role-assignment and reader-audit-subset freeze.
- Central SOL author risk route and real future authoring integration.
- Deferred noncanonical candidates, fixed split reader/source/quiz lanes, conductor aggregation, typed repair, bounded regeneration, CAS commit, required-evidence readback, and rollback/reconciliation.
- Fresh pilot/gold input materialization without prior prose.
- Crash-safe pilot/gold live-call ledger and exact resume.
- Four-call Rubric v2 gold evaluation instrument with source-aware proof and independent sweep.
- Dormant local activation and one-shot rollback policy with all external capabilities disabled.
- A content-addressed production-instrument seal over 426 implementation/config/schema/dependency files.

Primary new implementation modules are under `src/orchestrator/forward*.ts`, with qualification builders/runners under `src/bakeoff/migration/`, contract artifacts under `state/migration-experiments/contracts/`, and fresh no-prose inputs under the two forward experiment roots. Existing authoring, transaction, gate, review, routing, and CLI modules were integrated rather than replaced by a parallel production path.

## Verification

| Verification | Final result |
|---|---|
| `npx tsc -p . --noEmit` | PASS |
| `node --import tsx src/cli.ts contract-validate` | PASS (contract freeze plus IMP-00..12 and IMP-20) |
| Full repository suite | PASS: 2,703 pass, 0 fail, 6 environment-absent, 18 skip |
| Focused IMP-22 functional set | PASS: 245 pass, 0 fail |
| Focused provenance/compatibility set | PASS: 76 pass, 0 fail |
| Production seal dry verification | PASS; zero model/API calls |
| Zero-call live qualification preflight | PASS (`chatgpt`, API key absent) |
| Old-campaign closure | PASS; all raw entrypoints halt before argument/corpus/output/spawn work |
| Corpus reproducibility | PASS for reader/source/quiz and fresh pilot/gold inputs |

Production instrument seal:

- seal SHA-256: `133f3deb430c5ee0541d8720d44442092186e816a27cbd706d6648dc54839c12`;
- artifact bytes SHA-256: `dcd299b0c4b80a44c251cdf5308fe11fe8a132875cdd9b3c2d7315fa6da6d527`;
- inventory: 426 files;
- model calls: 0;
- API calls: 0.

## Live evidence and decision metrics

| Field | Result |
|---|---|
| Qualified profiles | None; live qualification NOT RUN |
| Fixed role assignment | Not created |
| Pilot | NOT RUN; rates not measured |
| Gold book | NOT RUN; rates not measured |
| Hard gates | NOT EVALUATED |
| Content Design Score | Not measured |
| Repair/regeneration demand | Not measured |
| Live calls | 0 |
| API calls | 0 |
| Max-plan capacity events | 0 |
| Local SOL activation | false |
| Publish/deploy/push | none |

## Risks and incidents

Known non-blocking implementation risks:

- The injectable `AuthorIo` seam cannot provide a kernel-level multi-file transaction. Hash checks, readback, CAS rollback, and reconciliation fail closed, but a custom nonstandard implementation can still have a final read/write race.
- Local model-cache visibility is time-bound and does not guarantee capacity at the eventual live run.
- The explicit operator `--legacy` route remains available for compatibility; it is never selected implicitly by an ACTIVE forward policy.

Repository hygiene incident:

- Legacy test fixtures overwrote pre-existing untracked telemetry under `state/autopilot-logs/zz/` and `state/autopilot-logs/your-money-or-your-life/` before fixture hermeticity was added. The original bytes were not recoverable. The files were preserved rather than deleted or guessed. Author, autopilot, session, and sweep fixtures now snapshot and restore exact bytes and mtimes; dynamic fixture logs are removed and task-created debris was cleaned.

Blocking evidence gap:

- Explicit authorization to transmit the frozen corpus and fresh pilot/gold content to ChatGPT was not provided.
- Consequently qualification, fixed assignment, fresh pilot, fresh gold hard gates/score/sweep, and activation are incomplete.

Required authorization:

`I approve sending the frozen qualification corpus and the fresh pilot/gold content to ChatGPT through codex exec; proceed with the live calls.`

## Rollback profile

The existing central `gpt-5.5` author route remains selected. No activation file was written, so rollback is a no-op. The dormant activation policy records the previous profile and supports a one-shot audited rollback only after a future evidence-complete activation.
