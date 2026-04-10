# Install Guide

## Required repo roots

### PACK_ROOT
```text
scripts/book/prompts/chapterflow-v17-director-worker/
```

### RUN_ROOT
```text
.chapterflow/runs/{bookId}/{runId}/
```

Do not mix static pack files with generated run artifacts.

## Run directory layout

```text
RUN_ROOT/
├── manifests/
├── state/
├── memory/
├── source-freeze/
├── sidecars/
├── skeleton/
├── briefs/
├── outlines/
├── quiz-blueprints/
├── tickets/
├── work-orders/
├── drafts/canonical/
├── drafts/edited/
├── structured/
├── quizzes/
├── validated/
├── continuity/
├── commits/
├── reports/
└── release/
```

## Minimum tools
- Python 3
- node
- repo `scripts/book/validate-book.mjs`

## Safety rule
Delete or quarantine any bulk content generators like `generate-*.mjs` that write chapter prose or chapter JSON directly. In v17, scripts may orchestrate, validate, hash, or assemble. They may not author reader-facing chapter content.
