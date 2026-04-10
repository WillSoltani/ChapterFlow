# Install guide

## Static pack root
Install to:

`PACK_ROOT = scripts/book/prompts/chapterflow-v14-segmented`

## Run root
Generated files go to:

`RUN_ROOT = .chapterflow/runs/{bookId}/{runId}`

## Important
Never mix static pack files and generated run artifacts.
Static files resolve from PACK_ROOT.
Dynamic files resolve from RUN_ROOT.
