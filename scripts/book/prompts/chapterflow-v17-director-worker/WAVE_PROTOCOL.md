# Wave Protocol

## Default
Run chapters in waves of up to 6.

## Sequence inside a wave

### Stage A — Research packets
For each chapter in the wave:
- write chapter ticket
- write work orders
- spawn research worker
- require brief + outline + quiz blueprint

### Stage B — Prose lane
For each chapter:
- writer
- editor
- critic
- local patch only if critic flags local issues
- reroute to writer/editor only if critic flags global weakness

### Stage C — Structure lane
For each passing chapter:
- converter
- quiz
- validator
- patch only the flagged fields when possible
- repair only if real prose failures remain

### Stage D — Commit lane
For each passing chapter:
- run artifact guard
- write commit record
- update continuity from validated chapter only

## Risk controls

### Calibration chapters
- Chapter 1
- Chapter 2

These run first, even if the later book is large.

### Premium chapters
Downshift from 6 to 1–3 when a chapter is:
- morally dense
- source-rich enough to support deeper prose
- rhetorically central
- previously flagged by the skeleton as premium

### Failure handling
If 2 or more chapters in a wave fail the artifact guard:
- stop the wave
- do not open a new wave
- repair only the failing chapters
- rerun the guard
- continue only after all chapters in the wave are either committed or explicitly rerouted

## Wave scorecard
After every wave, write:
`reports/wave-XX.scorecard.md`

Must include:
- chapters attempted
- chapters committed
- chapters rerouted
- drift findings
- contamination findings
- tone-divergence findings
- continuity updates applied
