# docs/ — documentation set

Global rules live in the root [CLAUDE.md](../CLAUDE.md).

- [README.md](README.md) is the index. Root-level docs listed under
  Core/Product/Operations are the LIVING references; `archive/` and the
  campaign subdirs (`fix-prompts/`, `fix-notes/`, `pipeline-hardening/`,
  `book-score/`, `v24/`) are point-in-time records — don't cite them as
  current behavior.
- Entry points: `ARCHITECTURE.md` (repo shape), `DEVELOPMENT.md` (workflow),
  `ENVIRONMENT.md` (the full env-var matrix), `SCRIPTS.md` (script catalogue).
- `docs/ios/` holds the native-app contracts — out of scope for web-app
  sessions; leave it alone unless a task explicitly targets iOS.
- Adding a doc? Add an index entry in README.md. Finishing a campaign?
  `git mv` its outputs into `archive/` (history-preserving) and link them
  under the index's Archived section.
- Path discipline: every filesystem path a doc names must exist — `ls` each
  one before writing it down.
