# Quickstart

## 1) Install the pack

Put the folder at:

`scripts/book/prompts/chapterflow-v15-locked/`

## 2) Audit the pack

```bash
python3 scripts/book/prompts/chapterflow-v15-locked/tools/chapterflow_v15_pack_audit.py   scripts/book/prompts/chapterflow-v15-locked
```

## 3) Launch a run with only title and author

```bash
bash scripts/book/prompts/chapterflow-v15-locked/launch.sh   "The Prince"   "Niccolò Machiavelli"
```

This creates:

`.chapterflow/runs/the-prince/<runId>/`

and writes:

`RUN_ROOT/manifests/launch-prompt.txt`

## 4) Paste only `launch-prompt.txt` into the coding agent

The run will:
- resolve sources from the web
- freeze the edition/source bundle
- generate chapters end-to-end
- assemble the release package
- wire the repo without touching cover generation

## 5) Review final outputs

Minimum final outputs:
- `RUN_ROOT/release/{bookId}.modern.json`
- `book-packages/{bookId}.modern.json`
- `RUN_ROOT/reports/release.validation.md`
- `RUN_ROOT/reports/release.audit.md`

## Notes

- The pipeline should not ask for approval during the run.
- The only allowed question is a single edition/translation clarification if the difference materially changes the content contract and cannot be auto-resolved safely.
- Cover generation is disabled by design.
