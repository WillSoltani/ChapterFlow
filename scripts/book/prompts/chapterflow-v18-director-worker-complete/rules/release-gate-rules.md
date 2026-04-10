
# Release Gate Rules

- Release is assembled only from validated chapter JSONs.
- No chapter may be regenerated at release time.
- Release fails if any chapter hash differs from its committed validated artifact.
- Cover generation is out of scope. Do not create or wire a cover.
