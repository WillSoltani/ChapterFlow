# Chapter Gate Rules

Chapter gate is internal.
It is not a human pause point.

A chapter passes chapter gate only when:
- critic score >= 10/12
- no chapter-quality auto-fails
- quiz exists and is non-empty unless manifest explicitly defers
- scenario tone policy passes
- validator passes
- lint returns no FAILs in chapter_gate mode

If a chapter fails:
- patch locally when possible
- reroute only that chapter when necessary
- do not stop the whole run for approval
