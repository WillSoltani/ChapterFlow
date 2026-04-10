
# Repetition Audit Rules

Run this after structure assembly and before final validation.

Checks:
- core thesis explicit restatement count <= 4 across the full chapter package
- no identical or near-identical sentence stems across 3 or more adjacent surfaces
- each `moreDetails` answers "what is new?"
- easy/medium/hard must map to different concept sets from the ticket
- no duplicate `takeaways` / `keyTakeaways`
- no repeated section wrappers

Common fail signals:
- repeated "this is not X, it is Y"
- repeated "the real issue is"
- repeated "keep this question alive"
- repeated "what changes once..."
- repeated summary sentence at the end of multiple fields
