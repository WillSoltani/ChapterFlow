# Contributing

## Scope
This repository contains two active product domains. Changes should be made with explicit awareness of which domain is affected:
- `Cloud Portfolio`
- `ChapterFlow`

## Expectations
- Keep pull requests focused
- Prefer low risk refactors over broad file churn
- Preserve current behavior unless the task intentionally changes it
- Update documentation when architecture, setup, or developer workflow changes

## Before opening changes
- Read [DEVELOPMENT.md](DEVELOPMENT.md)
- Review [ARCHITECTURE.md](ARCHITECTURE.md) for the relevant domain
- If working on ChapterFlow content or backend flows, review [BOOK_ACCELERATOR.md](BOOK_ACCELERATOR.md)

## Quality bar
- Routes and persistence changes must be validated against real feature flows
- New shared helpers should remove duplication, not just move it
- Avoid leaving placeholder logic in production paths unless the UI explicitly depends on a planned placeholder surface
- Book package JSON files should only be changed for content or required organization work
