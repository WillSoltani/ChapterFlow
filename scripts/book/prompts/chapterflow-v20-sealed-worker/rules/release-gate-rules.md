# Release Gate Rules

The release passes only if:
- every chapter has a commit record
- every chapter in release matches the corresponding committed validated chapter
- release guard passes
- repo validator passes if available
- final package schema is valid
- quiz quality scorer passes for all chapter quizzes (threshold 0.60)
- semantic diversity checker passes for all chapters (see semantic-diversity-rules.md)
