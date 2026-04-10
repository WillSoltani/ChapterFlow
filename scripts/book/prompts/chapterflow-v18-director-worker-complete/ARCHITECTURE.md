
# Architecture

## Actors

### Director
Persistent orchestrator chat. Owns:
- source freeze
- skeleton
- chapter tickets
- worker work orders
- commit records
- guards
- release assembly
- repo integration (without cover generation)

### Workers
Fresh-context specialists:
- research
- writer
- editor
- critic
- structure
- scenario
- quiz
- validator
- patch / repair
- assembler

Workers are stateless beyond the files they are told to read.

## Wave model

Default wave width = 6 chapters.

A wave is parallel only within stage barriers:
1. research packets for 6 chapters
2. writer runs for 6 chapters
3. editor runs for 6 chapters
4. critic runs for 6 chapters
5. structure runs for 6 chapters
6. scenario runs for 6 chapters
7. quiz runs for 6 chapters
8. assembler runs for 6 chapters
9. validator runs for 6 chapters
10. patch only failing chapters
11. commit passing chapters
12. update continuity and write next tickets

## Calibration

Chapters 1 and 2 run first.
When both are validated, the Director writes `continuity/calibration-lock.json`.
Later chapters are compared against that floor automatically.

## Anti-drift principle

No chapter is allowed to proceed using chat memory alone.
Every chapter starts from:
- current ticket
- source sidecar
- continuity state
- calibration lock
- local work order
