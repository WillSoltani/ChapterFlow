
# Install

## Static pack root

Install at:

`scripts/book/prompts/chapterflow-v16-stateful/`

## Run root

Runs live at:

`.chapterflow/runs/{bookId}/{runId}/`

## Core folders created by launch.sh

- manifests/
- memory/
- memory/role-cards/
- skeleton/
- source-freeze/
- sidecars/source/
- briefs/
- outlines/
- quiz-blueprints/
- drafts/canonical/
- drafts/edited/
- structured/
- quizzes/
- validated/
- continuity/
- reports/
- release/
- state/
- tickets/

## No source folder required

v16 is web-first.
The run discovers the source bundle online, then freezes it locally in `source-freeze/`.
