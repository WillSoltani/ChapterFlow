# Repo Runbook

## Required commands

Audit pack:
```bash
python3 scripts/book/prompts/chapterflow-v19-sealed-provenance/tools/chapterflow_v19_pack_audit.py   scripts/book/prompts/chapterflow-v19-sealed-provenance
```

Launch:
```bash
bash scripts/book/prompts/chapterflow-v19-sealed-provenance/launch.sh   "<Book Title>"   "<Author>"
```

Per-chapter commit:
```bash
python3 scripts/book/prompts/chapterflow-v19-sealed-provenance/tools/chapterflow_v19_commit.py   <RUN_ROOT> ch03
```

Per-chapter provenance guard:
```bash
python3 scripts/book/prompts/chapterflow-v19-sealed-provenance/tools/chapterflow_v19_provenance_guard.py   <RUN_ROOT> ch03
```

Per-chapter artifact guard:
```bash
python3 scripts/book/prompts/chapterflow-v19-sealed-provenance/tools/chapterflow_v19_artifact_guard.py   <RUN_ROOT> validated/ch03.chapter.json
```

Release guard:
```bash
python3 scripts/book/prompts/chapterflow-v19-sealed-provenance/tools/chapterflow_v19_release_guard.py   <RUN_ROOT> release/<bookId>.modern.json
```
