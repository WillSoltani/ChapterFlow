# Install

## Pack root

Install this pack at:

` scripts/book/prompts/chapterflow-v15-locked/ `

## Keep old packs separate

Do not merge files from earlier packs into this folder.
Do not point the run at `v4`, `v11`, `v12`, `v13`, or `v14`.

## Legacy scripts

Do not reuse or adapt legacy content generators such as:
- `generate-*.mjs`
- `generate-*.py`

unless they are pure orchestration utilities that never author reader-facing strings.

If a script contains chapter seeds, breakdown builders, example builders, quiz builders, or prewritten reader-facing sentences, it is forbidden for v15 runs.

## Required external assumptions

- the coding agent can browse the web
- the repo contains the product registration files you normally update for new books
- `node scripts/book/validate-book.mjs` exists in the repo
- `npm run build` exists in the repo

## Optional

If you already know the exact edition or translation you want, you can write it into the manifest after launch and before pasting the prompt.
