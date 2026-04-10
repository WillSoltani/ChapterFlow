# Architecture

## Persistent roles
- Director: long-lived orchestration session
- Workers: fresh, file-scoped chapter workers

## Worker roles
- writer
- editor
- critic
- structure worker
- scenario worker
- assembler
- quiz worker
- validator
- patch / repair

## Persistent storage
Use the filesystem as memory.
After every chapter, the Director reads state from disk instead of relying on long-chat memory.

## Core principle
The Director never authors content. Workers do.
If workers are unavailable as true subagents, emulate them by re-reading only the work order and role card for that stage, writing the one requested file, writing a receipt, and then returning to the Director role.
