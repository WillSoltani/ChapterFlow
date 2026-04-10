# Repo Runbook

## Pack root
```text
scripts/book/prompts/chapterflow-v17-director-worker/
```

## Run root
```text
.chapterflow/runs/{bookId}/{runId}/
```

## Core commands

### Audit the pack
```bash
python3 scripts/book/prompts/chapterflow-v17-director-worker/tools/chapterflow_v17_pack_audit.py   scripts/book/prompts/chapterflow-v17-director-worker
```

### Launch a run
```bash
bash scripts/book/prompts/chapterflow-v17-director-worker/launch.sh   "The Prince"   "Niccolò Machiavelli"
```

### Artifact guard
```bash
python3 scripts/book/prompts/chapterflow-v17-director-worker/tools/chapterflow_v17_artifact_guard.py   .chapterflow/runs/the-prince/<runId>
```

### Commit a chapter
```bash
python3 scripts/book/prompts/chapterflow-v17-director-worker/tools/chapterflow_v17_commit.py   .chapterflow/runs/the-prince/<runId>   3
```

### Release guard
```bash
python3 scripts/book/prompts/chapterflow-v17-director-worker/tools/chapterflow_v17_release_guard.py   .chapterflow/runs/the-prince/<runId>
```

## Book source policy
If no local source is present, the Director discovers and freezes sources from the web, writes:
- `source-freeze/edition-lock.json`
- `source-freeze/source-ledger.json`
- `source-freeze/source-bundle.md`

Then it creates chapter sidecars under `sidecars/`.

## Integration policy
This pack is focused on the content pipeline. It may optionally wire the final package into the repo after release validation, but it does not create covers or placeholders.
