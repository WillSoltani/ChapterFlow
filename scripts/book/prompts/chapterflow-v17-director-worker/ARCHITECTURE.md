# Architecture

## Summary

v17 uses a **Director + Workers + Persistent Tickets** architecture.

### Director
One long-lived orchestrator session.
It does planning, state management, spawning, committing, and release assembly.

### Workers
Short-lived, chapter-local specialists.
Each worker gets:
- one role card
- one work order
- only the files needed for that stage

### Persistent tickets
Every chapter starts from disk state, not from chat memory.

## Why this architecture

Earlier packs drifted because:
- long runs overloaded context
- instructions were front-loaded once
- later chapters inherited weaker internal state
- the system sometimes switched into generator behavior after a few good chapters

v17 breaks that failure loop by making the filesystem the authority.

## The 3 memory layers

### 1. Pack memory
Static style + rule files in PACK_ROOT.

### 2. Run memory
Compiled short memory cards written once:
- `memory/style-memory.md`
- `memory/quality-memory.md`
- `memory/schema-memory.md`
- `memory/learning-memory.md`

### 3. Chapter memory
Fresh chapter ticket + source sidecar + continuity delta + calibration lock.

## The wave model

### Default wave width
6 chapters.

### Risk lanes
- calibration lane: Chapters 1 and 2
- standard lane: default wave width 6
- premium lane: downshift to 1–3 chapters for morally dense or source-rich chapters
- repair lane: only flagged chapters re-enter

The Director may shrink a wave. It may not enlarge beyond 6.

## The barriers

Within a wave, work happens in role barriers:

1. research barrier
2. prose barrier (writer → editor → critic)
3. structure barrier (converter → quiz → validator)
4. commit barrier

No chapter advances past a barrier until its current stage artifacts pass.

## The anti-drift principle

The Director re-anchors before every chapter and every barrier by rereading:
- current ticket
- continuity state
- calibration lock
- relevant memory card
- last commit summary

That is the whole point.
