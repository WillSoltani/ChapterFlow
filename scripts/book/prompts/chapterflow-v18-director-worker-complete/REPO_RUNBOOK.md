
# Repo Runbook

## Install path

`scripts/book/prompts/chapterflow-v18-director-worker-complete/`

## Launch

```bash
bash scripts/book/prompts/chapterflow-v18-director-worker-complete/launch.sh   "<TITLE>"   "<AUTHOR>"
```

## Director startup order

Read in order:
1. PACK_ROOT/README.md
2. PACK_ROOT/OPERATING_CONTRACT.md
3. PACK_ROOT/ARCHITECTURE.md
4. PACK_ROOT/MasterDirector-v18.md
5. RUN_ROOT/manifests/run-manifest.json

## Defaults

- outputProfile = flagship_v4_compatible
- learningContract = research_native
- runProfile = director_workers_parallel
- validationMode = chapter_gate
- chapterGateQuizMode = generate
- scenarioTonePolicy = required
- waveDefaultWidth = 6

## After each chapter commit

Run:
```bash
python3 PACK_ROOT/tools/chapterflow_v18_artifact_guard.py RUN_ROOT validated/chXX.chapter.json
```

## Before release

Run:
```bash
python3 PACK_ROOT/tools/chapterflow_v18_release_guard.py RUN_ROOT release/{bookId}.modern.json
node scripts/book/validate-book.mjs release/{bookId}.modern.json
```

## Integration

This pack may wire package/library metadata, but it must not create or wire a cover.
