
# ChapterFlow v16 Stateful — MasterValidator

v16 has two gates:

## 1) Chapter gate
Runs after every chapter ticket.
Goal:
- validate the current chapter
- repair only the current chapter
- prevent drift from moving forward

Inputs:
- current chapter artifacts
- calibration lock (after Chapter 2)
- continuity state
- chapter structure rules
- validator rules
- artifact guard

Outputs:
- validated chapter
- review wrapper
- validation report
- optional repair report

## 2) Release gate
Runs after all chapters validate.
Goal:
- ensure the release is assembled only from validated chapters
- ensure no contamination, tone collapse, empty quiz, or schema regressions remain
- ensure release package matches validated chapter files exactly

## Non-negotiables
- do not judge release from structured drafts
- do not silently flatten prose to force compliance
- if current chapter fails, fix current chapter only
- if release differs from validated chapter files, fail release
