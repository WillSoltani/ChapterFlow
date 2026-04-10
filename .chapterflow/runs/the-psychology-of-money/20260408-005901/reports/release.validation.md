# Release Validation

- Status: PASS
- Release artifact: `release/the-psychology-of-money.modern.json`
- Package ID: `the-psychology-of-money.modern`
- Chapter count: 22

## Final Gate Results

- `python3 scripts/book/prompts/chapterflow-v14-segmented/tools/chapterflow_v14_lint.py release/the-psychology-of-money.modern.json`: PASS
- `python3 scripts/book/prompts/chapterflow-v14-segmented/tools/chapterflow_v14_artifact_guard.py RUN_ROOT`: PASS
- `python3 scripts/book/prompts/chapterflow-v14-segmented/tools/chapterflow_v14_release_guard.py RUN_ROOT release/the-psychology-of-money.modern.json`: PASS
- `node scripts/book/validate-book.mjs release/the-psychology-of-money.modern.json`: PASS

## Validator Notes

- The sealed package validator reported 44 prose warnings for thesis-first openings in competitive breakdown variants across earlier chapters.
- Those warnings are non-blocking. There were no package-shape, depth, word-count, example, quiz, or sealed-integrity failures.
- The release guard confirmed that every release chapter exactly matches its corresponding `validated/chXX.chapter.json`.
