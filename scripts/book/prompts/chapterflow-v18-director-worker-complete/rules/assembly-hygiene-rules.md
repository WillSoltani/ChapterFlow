
# Assembly Hygiene Rules

The assembler merges partial artifacts into one canonical chapter JSON.

Allowed inputs:
- structure partial
- examples partial
- quiz JSON
- metadata from ticket

Forbidden:
- adding fields from old generator formats
- carrying forward worker notes
- carrying forward non-canonical wrappers

Must fail on:
- duplicate top-level semantic surfaces
- duplicate metadata fields that disagree
- non-canonical keys
- empty quiz
- plain-string scenarios
