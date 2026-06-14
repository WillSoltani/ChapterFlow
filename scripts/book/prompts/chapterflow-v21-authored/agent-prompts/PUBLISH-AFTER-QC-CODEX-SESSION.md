# Publish After QC Codex Session

Before promoting a book, work from `scripts/book/prompts/chapterflow-v21-authored`
and verify that no-api QC artifacts are fresh.

If `publish` or `promote-book` blocks because the latest QC round returned
REVISE, inspect the evidence before launching another repair loop:

```bash
npx tsx src/cli.ts qc-diagnose "<bookId>" --round <roundId>
```

Do not reuse a QC round after repair changes chapter content. Start a fresh round:

```bash
CHAPTERFLOW_NO_API_CODEX_QC=1 npx tsx src/cli.ts qc-auto "<bookId>" --pass
```
