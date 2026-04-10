# Chapter Review Artifact Rules

Every validated chapter should also produce:
- `validated/chXX.review-package.json`

This wrapper should include:
- book metadata
- the single validated chapter
- package metadata
- creation timestamp

Purpose:
- makes chapter-gate inspection consistent
- supports validator tooling
- avoids judging a raw chapter object as if it were the final package

This wrapper is not a manual approval artifact.
