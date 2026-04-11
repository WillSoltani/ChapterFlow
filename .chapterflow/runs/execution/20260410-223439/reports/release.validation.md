# Release Validation Report

- Run root: `.chapterflow/runs/execution/20260410-223439`
- Release file: `release/execution.modern.json`
- Repo package: `book-packages/execution.modern.json`

## Release gate

- Release assembled from `validated/ch01.chapter.json` through `validated/ch10.chapter.json` only: pass
- Source guard: `FAIL=0 WARN=0`
- Release lint (`release_gate`): `FAIL=0 WARN=0`
- Release guard: `FAIL=0 WARN=0`

## Repo wiring

- Copied `release/execution.modern.json` to `book-packages/execution.modern.json`
- Registered `execution` in `app/book/data/bookPackages.ts`

## Repo-level validation

- `python3 scripts/book/prompts/chapterflow-v13-autonomous/tools/chapterflow_v13_lint.py book-packages/execution.modern.json release_gate`: `FAIL=0 WARN=0`
- `node scripts/book/validate-book.mjs book-packages/execution.modern.json`: fail

## Validator mismatch note

The repo validator identifies itself as `ChapterFlow v12 Sealed Package Validator` and explicitly states it is `v12-sealed-only`. It rejects the v13 autonomous package for contract-shape reasons unrelated to release corruption, including empty `book.categories` and older sealed-package expectations around hard recap structure, example formats, and chapter word-count ranges.

The sealed v13 release artifact was not mutated to satisfy the mismatched v12 validator because release assembly rules forbid regenerating or normalizing approved chapter content during release.

## Build

- `npm run build`: pass
