# Install Guide

## Static vs dynamic roots

Static prompt pack:
- `PACK_ROOT = scripts/book/prompts/chapterflow-v13-autonomous`

Generated artifacts:
- `RUN_ROOT = .chapterflow/runs/{bookId}/{runId}`

Never mix them.

## How to install

1. Copy the pack into your repo at `scripts/book/prompts/chapterflow-v13-autonomous/`
2. Audit the pack:

```bash
python3 scripts/book/prompts/chapterflow-v13-autonomous/tools/chapterflow_v13_pack_audit.py \
  scripts/book/prompts/chapterflow-v13-autonomous
```

3. Launch a run with only title + author:

```bash
bash scripts/book/prompts/chapterflow-v13-autonomous/launch.sh "Book Title" "Author Name"
```

4. Paste the generated `RUN_ROOT/manifests/launch-prompt.txt` into the coding agent.

## What scripts are allowed to do

Allowed:
- bootstrap the run root
- prefill the manifest
- discover and freeze sources
- slice sources into chapter sidecars
- compare hashes
- run validators
- assemble release from validated chapters
- wire repo files
- run build/test

Forbidden:
- author reader-facing chapter prose
- generate breakdowns from seed objects
- build examples, quizzes, or review cards from JS/Python helpers
- rebuild validated chapters during release assembly
- create book-specific bulk generators

## Source policy

v13 defaults to:
- public-domain full text when available
- official / authorized previews or samples when full text is unavailable
- chapter TOCs, scholarly references, reviews, and secondary analysis when needed
- paraphrase-first unless exact quote support is verified in the frozen source bundle

The run writes its own source freeze inside `RUN_ROOT/source-freeze/`, so you do not need to manage a separate source folder.
