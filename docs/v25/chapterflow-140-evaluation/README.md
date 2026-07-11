# ChapterFlow 140-book evaluation snapshot

Generated on 2026-07-10 from the supplied ChapterFlow 140-book evaluation package.

## Contents

- `chapterflow-140-evaluation-report.html` — self-contained interactive report.
- `chapterflow-140-evaluation-report-data.json` — normalized, remediation-enriched analysis data.
- `chapterflow-140-remediation-prompts.json` — structured remediation prompt pack.
- `chapterflow-140-remediation-prompts.md` — copy-ready remediation prompts for all books.
- `chapterflow-book-evaluator-below80-update.zip` — updated evaluator skill package.

## Coverage

- 140 books
- 1,903 chapters
- 5,040 subcriteria
- 176 QA findings
- 4,216 strict-below-80 remediation conditions: 51 overall, 545 domain, and 3,620 subcriterion

The generator emits one complete, book-specific prompt per book. Related conditions are consolidated into 1,227 domain workstreams, while every raw below-80 condition remains in the ledger.

## Validation

- Independent forward audit: pass
- Evaluator skill tests: 71 passed
- HTML and embedded JavaScript validation: pass
- Remote report assets: 0
- Updated skill archive integrity: pass

## SHA-256

```text
21c0a291cff327f2f7a472802e4cae987eff08549508617ae8a70bcb36b910cc  chapterflow-140-evaluation-report.html
4a7d9716ccce15ff1354012a6c3889fe2d730ea48e6c08608ae59623e2ee70bc  chapterflow-140-evaluation-report-data.json
cd0a06f5a0c58fc8c2fadbc0db61e82590877cb40e9baa06e36737cd7b1ca910  chapterflow-140-remediation-prompts.json
fcdeadfbfcb4c0c831183f309024a885b0321bcc342cd6fc46ce36993f2cee18  chapterflow-140-remediation-prompts.md
6868f29656d5974a5452db9bb0b73c54b94bd97a327b1b05d39b70b90a3644c1  chapterflow-book-evaluator-below80-update.zip
```

The directory is listed in the repository `.gitignore`. This committed snapshot was force-added intentionally; future untracked files placed under the directory are ignored.
