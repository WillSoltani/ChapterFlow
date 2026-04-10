# Final Checklist

## Before launch
- pack audit passes
- `launch.sh` accepts title + author only
- launch prompt file is generated

## Before Chapter 1
- source discovery rules loaded
- edition selection rules loaded
- source ledger path known
- edition lock path known

## After Chapter 1 automatic gate
- critic score >= 10/12
- quiz exists if `chapterGateQuizMode = generate`
- scenario tone objects are valid
- contamination scan passes
- source freeze and sidecars exist
- continue automatically if all pass

## After Chapter 2 automatic gate
- critic score >= 10/12
- Chapters 1 and 2 hashes sealed
- baseline quality floor written to reports
- continue in waves only

## Before every new wave
- artifact guard passes
- source sidecars exist for active wave
- continuity updated from validated chapters only
- no sealed chapter hash drift

## Before release gate
- all numbered chapters validated
- release assembled from validated chapters only
- release guard passes

## Before repo wiring
- `validate-book.mjs` passes
- `chapterflow_v13_lint.py` passes in `release_gate`
- build passes
