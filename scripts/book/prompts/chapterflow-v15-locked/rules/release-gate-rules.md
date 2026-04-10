# Release Gate Rules

Release gate happens only after all chapters are validated.

Release passes only when:
- every chapter has `validated/chXX.chapter.json`
- release package is assembled from validated chapters only
- release guard passes
- lint passes in release_gate mode
- repo package validates
- build passes

Do not use release gate as a place to hide poor chapter quality.
