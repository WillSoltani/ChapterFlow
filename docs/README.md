# Documentation

This repository ships a single application: `ChapterFlow`, the guided reading and
learning product. (An earlier `Cloud Portfolio` document-workflow domain was
removed from HEAD; only ChapterFlow remains.)

Use the documents below based on the task you are doing.

## Core docs
- [Repository architecture](ARCHITECTURE.md)
- [Development guide](DEVELOPMENT.md)
- [Contribution guide](CONTRIBUTING.md)

## Product specific docs
- [ChapterFlow architecture and content flow](BOOK_ACCELERATOR.md)
- [ChapterFlow app admin guide](BOOKAPP_ADMIN_GUIDE.md)
- [Two-axis completion (knowledge vs applied)](two-axis-completion.md)
- [Insight Points system design spec](insight-points-system-spec.md) — implemented; shipped in the UI as Flow Points

## Operations docs
- [Operations guide](OPERATIONS.md)
- [CI and deployment notes](CI_CD.md)
- [Environment & configuration reference](ENVIRONMENT.md)
- [Data retention matrix](DATA-RETENTION.md)
- [Production launch checklist](LAUNCH_CHECKLIST.md)
- [Account lifecycle & erasure](ACCOUNT_LIFECYCLE.md)

## Campaign & pipeline subdirectories
Point-in-time working sets from past campaigns — reference records, not living
docs:

- [fix-prompts/](fix-prompts/) — 2026-06 audit fix-prompt pack + dispatch/run-order notes
- [fix-notes/](fix-notes/) — notes from individual audit fixes
- [pipeline-hardening/](pipeline-hardening/) — book-pipeline hardening verification records
- [book-score/](book-score/) — book content-quality scoring baseline + design notes
- [v24/](v24/) — v24 book-pipeline campaign reports (background tooling, not the web app)

## Archived audit artifacts
Point-in-time campaign records (completed audits, fix logs, one-shot redesign
prompts). Kept for history under [archive/](archive/) — not living reference docs.

- [Bug hunt 2026-06-15](archive/BUG-HUNT-2026-06-15.md) and [bug-fix log](archive/BUG-FIX-2026-06-15.md)
- [ChapterFlow audit](archive/CHAPTERFLOW-AUDIT.md)
- [Production-readiness audit 2026-06-14](archive/CHAPTERFLOW-PRODUCTION-READINESS-2026-06-14.md)
- [UI feedback 2026-06-15](archive/UI-FEEDBACK-2026-06-15.md) and [UI-fix log](archive/UI-FIX-2026-06-15.md)
- [Landing redesign v6 implementation prompt](archive/landing-premium-redesign-v6-IMPLEMENTATION-PROMPT.md) and [field-manual plan](archive/landing-premium-redesign-v6-field-manual-plan.md)

## How to use this docs set
- Start with `ARCHITECTURE.md` if you need to understand the repo shape
- Use `DEVELOPMENT.md` before adding features or new books
- Use `BOOK_ACCELERATOR.md` when working in `app/book`, the book APIs, or content ingestion
- Use `BOOKAPP_ADMIN_GUIDE.md` when running admin upload or publish flows
- Use `ENVIRONMENT.md` to find any config var and how it's supplied per environment
- Use `LAUNCH_CHECKLIST.md` before standing up or re-verifying a deployed environment
