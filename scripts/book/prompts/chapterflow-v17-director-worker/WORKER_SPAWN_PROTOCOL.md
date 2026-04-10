# Worker Spawn Protocol

The Director should not explain the whole system to every worker.
The Director should hand the worker a precise local job.

## General worker launch message

Use this exact pattern:

> Read the work order at `RUN_ROOT/work-orders/chXX.<role>.md`.
> Read only the files listed there.
> Write only the outputs listed there.
> Do not perform work outside the order.
> Do not summarize your plan.
> Complete the order.

## Research worker inputs
- role card
- memory/style-memory.md
- memory/quality-memory.md
- memory/learning-memory.md
- book skeleton
- chapter ticket
- source sidecar
- continuity state
- calibration lock if it exists

Outputs:
- brief
- outline
- quiz blueprint

## Writer worker inputs
- role card
- memory/style-memory.md
- memory/quality-memory.md
- chapter ticket
- brief
- outline
- source sidecar

Output:
- canonical draft

## Editor worker inputs
- role card
- memory/style-memory.md
- memory/quality-memory.md
- chapter ticket
- brief
- outline
- canonical draft

Output:
- edited draft

## Critic worker inputs
- role card
- memory/quality-memory.md
- chapter ticket
- brief
- outline
- edited draft
- calibration lock if it exists

Output:
- critic report

## Converter worker inputs
- role card
- memory/schema-memory.md
- memory/style-memory.md
- chapter ticket
- brief
- outline
- edited draft

Output:
- structured chapter JSON

## Quiz worker inputs
- role card
- memory/schema-memory.md
- memory/learning-memory.md
- chapter ticket
- brief
- quiz blueprint
- edited draft
- structured chapter JSON

Output:
- quiz JSON

## Validator worker inputs
- role card
- memory/schema-memory.md
- memory/quality-memory.md
- chapter ticket
- brief
- outline
- edited draft
- structured chapter JSON
- quiz JSON

Outputs:
- validation report
- validated chapter JSON
- review-package JSON
- reading metrics sidecar
- repair or patch report only when needed

## Patch worker inputs
- role card
- chapter ticket
- failing artifact
- exact patch report

Output:
- patched artifact only
