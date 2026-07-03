# ChapterFlow v22 Optimized Autonomous Pipeline

v22 keeps v21's strict publish law and reduces cost before the law runs.

## One command

```bash
npm run pipeline -- <bookId> --title "Book Title" --author "Author" --policy standard
```

Policies:
- `economy`: adaptive examples 1-2 candidates, deterministic memorable lines, risk-gated line edit.
- `standard`: adaptive examples 1-3 candidates, model only on risky memorable lines, incremental QC policy metadata.
- `premium`: more candidates and mandatory polish for thin-source or flagship books.
- `publish`: strict final validation posture.

## Phase model

1. Preflight: doctor checks catch state traps before writer spend.
2. Research: existing source/index artifacts are reused; if the chapter index is missing, the researcher runs once to produce the source-freeze bundle and chapter index.
3. Source: source-v2 adequacy blocks missing/thin source before generation.
4. Generation: central RunPolicy controls candidate count, prose polish, and support behavior.
5. Deterministic gate: ship gate and book gate remain strict.
6. Promotion: existing promote-book law revalidates package, QC freshness, source reality, generation debt, manifest integrity.
7. Metrics: cost/token manifest is written under `state/metrics/<bookId>/<runId>.cost.json`.

## Cost reductions

- Adaptive examples replace fixed 3x overgeneration.
- Model curator runs only for ties/risky slots instead of every multi-candidate slot.
- Line editor runs only when deterministic prose risk says it is needed, except premium/publish.
- Memorable lines default to deterministic selection with model escalation only when weak.
- Cost telemetry is captured by stage so future reductions are evidence-driven.

## Quality protections kept

- Final ship gate.
- Book gate.
- Source-v2/source-reality gates.
- Quiz key review gates.
- QC attestation freshness.
- Atomic promotion/quarantine.
- Generation-debt evaluation.

v22 optimizes the work before the gate, not the gate itself.
