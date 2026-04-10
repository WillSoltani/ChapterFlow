
# Artifact Guard Rules

Artifact guard runs after every chapter commit.

Hard fails:
- internal instruction leakage
- seed-note leakage
- raw source dumped into breakdown without quote permission
- empty quiz
- scenario fields as plain strings
- identical tone variants
- release package assembled from anything other than validated chapter files
